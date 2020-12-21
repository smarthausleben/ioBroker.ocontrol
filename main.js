'use strict';

/*
 * Created with @iobroker/create-adapter v1.17.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');

const BluetoothSerialPort = require('bluetooth-serial-port');
const btSerial = new BluetoothSerialPort.BluetoothSerialPort();

// set to true to get more information in the log file
var developerLogs = false;

//Reference to interval for handling data
var myHandleDataInterval;
var interval_data_use_millisec = 60000; // Interval frequence in milliseconds
const interval_data_use_millisec_default = 60000;

var controller_blt_macAdress = '';
var controller_blt_name = '';
const controller_blt_defaultname = 'oControl';

//reference to interval for blue tooth inquire
var inquireBlt_isrunning = false;
var bltFound = false;
var blt_connected = false;
var myBltInquireInterval;
var interval_blt_inquire_millisec = 10000; // Interval frequence in milliseconds

let interval_counter = 0;
let trash_data = true;

const coPackageLength = 16;
const tiPackageLength = 17;
const minPackageLength = 40;
let gotCoPackage = false;
let gotTIPackage = false;

const messageBegin = '9,*';
const monoxidIdentifier = 'CO';     // CO = Carbon Monoxid
const flapIdentifier = 'FL';         // FL = Flap
const timeIdentifier = 'TI';        // TI = Time
const temperaturIdentifier = 'EGT';  // EGT = Exaust Gas Temperature

//Reference to my own adapter
var myAdapter;


let local_data = '';
let local_trash_data = '';
// let received_trash_counter = 0;
let received_data_buffer = '';
// let received_trash_data_buffer = '';


// Load your modules here, e.g.:
// const fs = require("fs");

var oControlStatusTxt_de = {
	S0: 'Aus',
	S1: 'Anheizen',
	S3: 'Nachlegen',
	S2: 'Abbrandregelung',
	S4: 'Glut'
};

// Objekt in JavaScript
var oControlValues = {
	EGTemp: 0,
	CO: 0,
	Flap: 42,
	S: 0,
	TimeSec: 0,
	Duration: '',
	Mode: ''
};


class Ocontrol extends utils.Adapter {

	/**
	 * @param {Partial<ioBroker.AdapterOptions>} [options={}]
	 */
	constructor(options) {
		super({
			...options,
			name: 'ocontrol',
		});
		this.on('ready', this.onReady.bind(this));
		this.on('objectChange', this.onObjectChange.bind(this));
		this.on('stateChange', this.onStateChange.bind(this));
		// this.on('message', this.onMessage.bind(this));
		this.on('unload', this.onUnload.bind(this));
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {


		// Initialize your adapter here

		// Abfrageintervall Daten aus config ermitteln
		if(typeof this.config.oControl_Data_Use_Interval !== 'undefined' && this.config.oControl_Data_Use_Interval !== null){
			if(this.config.oControl_Data_Use_Interval < 5){
				this.log.warn('Data read interval of ' + this.config.oControl_Data_Use_Interval.toString() + ' is to small. (minimum is 5 seconds! Default of 60 seconds will be used.)');
				// wert zu klein -> default Wert benutzen
				interval_data_use_millisec = interval_data_use_millisec_default;
			}
			else {
				// Abfrageinterval aus den Settings verwenden
				interval_data_use_millisec = (this.config.oControl_Data_Use_Interval * 1000); // mal 1000 weil Millisekunden benötigt werden
			}
		}
		else{
			// falls nicht definiert, default Wert benutzen
			interval_data_use_millisec = interval_data_use_millisec_default;
		}

		try {
			// Logging settings
			if (typeof this.config.full_logging !== 'undefined' && this.config.full_logging !== null && this.config.full_logging !== true) {
				developerLogs = false;
			} else {
				developerLogs = true;
				this.log.info('full logging: ' + developerLogs.toString());
			}
		}
		catch (e) {
			this.log.info('ERROR: ' + e.message.toString());
		}

		if(typeof this.config.oControlMAC !== 'undefined' && this.config.oControlMAC !== null && this.config.oControlMAC !== ''){
			this.log.info('using config bluetooth MAC address: ' + this.config.oControlMAC);
			controller_blt_macAdress = this.config.oControlMAC;
		}
		else{
			this.log.info('no bluetooth MAC address is defined. Using first found oControl device.');
		}

		// Initialize your adapter here
		if(typeof this.config.oControlName !== 'undefined' && this.config.oControlName !== null && this.config.oControlName !== ''){
			this.log.info('using config bluetooth device name: ' + this.config.oControlName);
			controller_blt_name = this.config.oControlName;
		}
		else{
			controller_blt_name = controller_blt_defaultname;
			this.log.info('using default bluetooth device name: \'' + controller_blt_defaultname + '\'');
		}

		// Reset the connection indicator during startup
		this.setState('info.connection', false, true);

		// The adapters config (in the instance object everything under the attribute "native") is accessible via
		// this.config:
		if(developerLogs) {  // Developer Information to Log
			this.log.info('config BLT MAC oControl: ' + this.config.oControlMAC);
			this.log.info('data use interval: ' + this.config.oControl_Data_Use_Interval.toString());
			//this.log.info('config option2: ' + this.config.option2);
		}
		/*
		For every state in the system there has to be also an object of type state
		Here a simple template for a boolean variable named "testVariable"
		Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
		*/
		await this.setObjectAsync('testVariable', {
			type: 'state',
			common: {
				name: 'testVariable',
				type: 'boolean',
				role: 'indicator',
				read: true,
				write: true,
			},
			native: {},
		});

		await this.setObjectAsync('burning_phase', {
			type: 'state',
			common: {
				name: 'Phase',
				type: 'string',
				role: 'state',
				read: true,
				write: true,
			},
			native: {},
		});

		await this.setObjectAsync('duration_time', {
			type: 'state',
			common: {
				name: 'duration',
				type: 'string',
				role: 'state',
				read: true,
				write: true,
			},
			native: {},
		});


		await this.setObjectAsync('co_value', {
			type: 'state',
			common: {
				name: 'CO',
				type: 'number',
				role: 'state',
				read: true,
				write: false,
			},
			native: {},
		});

		await this.setObjectAsync('eg_temperatur_value', {
			type: 'state',
			common: {
				name: 'Abgastemperatur °C',
				type: 'number',
				role: 'state',
				read: true,
				write: false,
			},
			native: {},
		});

		await this.setObjectAsync('flap_value', {
			type: 'state',
			common: {
				name: 'Luftklappe %',
				type: 'number',
				role: 'state',
				read: true,
				write: false,
			},
			native: {},
		});

		await this.setObjectAsync('seconds_running', {
			type: 'state',
			common: {
				name: 'Sekunden seit Start',
				type: 'number',
				role: 'state',
				read: true,
				write: false,
			},
			native: {},
		});

		await this.setObjectAsync('mode_raw_value', {
			type: 'state',
			common: {
				name: 'Modus',
				type: 'number',
				role: 'state',
				read: true,
				write: false,
			},
			native: {},
		});


		// in this template all states changes inside the adapters namespace are subscribed
		this.subscribeStates('*');

		if(false) {
			/*
            setState examples
            you will notice that each setState will cause the stateChange event to fire (because of above subscribeStates cmd)
            */
			// the variable testVariable is set to true as command (ack=false)
			await this.setStateAsync('testVariable', true);

			// same thing, but the value is flagged "ack"
			// ack should be always set to true if the value is received from or acknowledged from the target system
			await this.setStateAsync('testVariable', {val: true, ack: true});

			// same thing, but the state is deleted after 30s (getState will return null afterwards)
			await this.setStateAsync('testVariable', {val: true, ack: true, expire: 30});

			// examples for the checkPassword/checkGroup functions
			let result = await this.checkPasswordAsync('admin', 'iobroker');
			this.log.info('check user admin pw ioboker: ' + result);

			result = await this.checkGroupAsync('admin', 'admin');
			this.log.info('check group user admin group admin: ' + result);

			//====================================================================================
			// the variable testVariable is set to true as command (ack=false)
			await this.setStateAsync('burning_phase', 'testeintrag test');

			// the variable testVariable is set to true as command (ack=false)
			await this.setStateAsync('co_value', 127);

			// the variable testVariable is set to true as command (ack=false)
			await this.setStateAsync('eg_temperatur_value', 97);

			// the variable testVariable is set to true as command (ack=false)
			await this.setStateAsync('flap_value', 10);

			// the variable testVariable is set to true as command (ack=false)
			await this.setStateAsync('seconds_running', 45710);

			// the variable testVariable is set to true as command (ack=false)
			await this.setStateAsync('mode_raw_value', 2);
		}
		// const dataUseInterval = setInterval(timer_triggered , interval_data_use_millisec);

		//====================================================================================

		// saving reference to my adapter;
		myAdapter = this;

		main();
	}


	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 * @param {() => void} callback
	 */
	onUnload(callback) {
		try {
			if(btSerial.isOpen()){
				this.log.info('close Bluetooth connection');
				btSerial.close();
			}

			if (typeof myBltInquireInterval !== 'undefined' && myBltInquireInterval !== null) {
				this.log.info('Stop \'Bluetooth Inquire interval\'');
				clearInterval(myBltInquireInterval);
			}
			else {
				this.log.info('\'Bluetooth Inquire interval\' not set .. noting to clear.');
			}

			if (typeof myHandleDataInterval !== 'undefined' && myHandleDataInterval !== null) {
				this.log.info('Stop \'Data handling interval\'');
				clearInterval(myHandleDataInterval);
			}
			else{
				this.log.info('\'Data handling interval\' not set .. noting to clear.');
			}

			this.log.info('cleaned everything up...');
			callback();
		} catch (e) {
			callback();
		}
	}

	/**
	 * Is called if a subscribed object changes
	 * @param {string} id
	 * @param {ioBroker.Object | null | undefined} obj
	 */
	onObjectChange(id, obj) {
		if(developerLogs) {
			if (obj) {
				// The object was changed
				// this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
			} else {
				// The object was deleted
				// this.log.info(`object ${id} deleted`);
			}
		}
	}

	/**
	 * Is called if a subscribed state changes
	 * @param {string} id
	 * @param {ioBroker.State | null | undefined} state
	 */

	onStateChange(id, state) {
		if(developerLogs) {
			if (state) {
				// The state was changed
				this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
			} else {
				// The state was deleted
				this.log.info(`state ${id} deleted`);
			}
		}
	}

		// /**
	//  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
	//  * Using this method requires "common.message" property to be set to true in io-package.json
	//  * @param {ioBroker.Message} obj
	//  */
	// onMessage(obj) {
	// 	if (typeof obj === 'object' && obj.message) {
	// 		if (obj.command === 'send') {
	// 			// e.g. send email or pushover or whatever
	// 			this.log.info('send command');

	// 			// Send response in callback if required
	// 			if (obj.callback) this.sendTo(obj.from, obj.command, 'Message received', obj.callback);
	// 		}
	// 	}
	// }

}

function main(){
	if(developerLogs) {
		myAdapter.log.info('main() hit');
		test_function();
	}
	start_bltInquire_Interval();

}


// @ts-ignore parent is a valid property on module
if (module.parent) {
	// Export the constructor in compact mode
	/**
	 * @param {Partial<ioBroker.AdapterOptions>} [options={}]
	 */
	module.exports = (options) => adapter = Ocontrol(options);
} else {
	// otherwise start the instance directly
	new Ocontrol();
}



function interval_dataHandling_triggered() {
	if(developerLogs) {  // Developer Information to Log
		myAdapter.log.info('handling data triggered');
	}
	if(btSerial.isOpen() === true) {
		interval_counter = 0;
		trash_data = false;
	}
	else{
		interval_counter++;
		myAdapter.log.warn(interval_counter.toString() + '. failed Interval (no data from device)!');
		if(interval_counter >= interval_max_fails){
			myAdapter.log.error('no data for ' + interval_max_fails.toString() + ' times ... terminating BlueTooth object');
			myAdapter.log.error('to be implemented!!!!');
		}
	}
}

function start_handlingData_interval() {
	if(developerLogs) {
		myAdapter.log.info('start_handlingData_interval() hit');
	}
	// starting data handling interval
	myHandleDataInterval = setInterval(interval_dataHandling_triggered, interval_data_use_millisec);
	myAdapter.log.info("Data handling interval started");
}

function start_bltInquire_Interval() {
	if(developerLogs) {
		myAdapter.log.info('start_bltInquire_Interval() hit');
	}
	// starting bluetooth inquiering interval
	myBltInquireInterval = setInterval(bltInquiering, interval_blt_inquire_millisec);
	myAdapter.log.info("Bluetooth inquire started");
}

function bltInquiering() {
	if(developerLogs) {
		myAdapter.log.info('bltInquiering() hit');
	}
	// connect oControl via bluetooth
	if(	inquireBlt_isrunning === false && bltFound === false) {
		inquireBlt_isrunning = true;
		btSerial.inquire();
		myAdapter.log.info("Inquire Bluetooth ...");
	}
}

function bltFoundEvent(address, name) {
	if (developerLogs) {
		myAdapter.log.info('bltFoundEvent(address, name) hit');
		myAdapter.log.info('btSerial found event...');
	}
	myAdapter.log.info('looking for \'' + controller_blt_name + '\'');
	myAdapter.log.info('found Bluetooth Device, Address: ' + address.toString() + ' Name: ' + name.toString());
	if (name !== controller_blt_name) {
		if(developerLogs) {
			myAdapter.log.info('bltFoundEvent - if (name !== controller_blt_name) ist wahr');
		}
		// nicht der richtige controller
		myAdapter.log.info('not the one we are looking for');
		return;
	}
	if (controller_blt_macAdress !== '') {
		if(developerLogs) {
			myAdapter.log.info('bltFoundEvent - if (controller_blt_macAdress !== ) ist wahr');
		}
		if (controller_blt_macAdress !== address.toString()) {
			if(developerLogs) {
				myAdapter.log.info('bltFoundEvent - if (controller_blt_macAdress !== address.toString()) ist wahr');
			}
				// falsche MAC Adresse
			myAdapter.log.info('right controller name but wrong MAC-address.');
			return;
		}
	}

	if(developerLogs) {
		myAdapter.log.info('bltFound wird auf true gesetzt');
	}
	bltFound = true;
	myAdapter.log.info('stopping Bluetooth inquire');
	clearInterval(myBltInquireInterval);

	btSerial.findSerialPortChannel(address, function foundBltChanel(chanel) {
		if (developerLogs) {
			myAdapter.log.info('Variable bltFound: ' + bltFound.toString());
			myAdapter.log.info('Found Address: ' + address.toString());
			myAdapter.log.info('Found Chanel: ' + chanel.toString());
		}
		btSerial.connect(address, chanel, function connecttion() {
			if (developerLogs) {
				myAdapter.log.info('btSerial.connect(address, chanel, function connecttion() hit');
				myAdapter.log.info('btSerial.connect - Found Address: ' + address.toString());
				myAdapter.log.info('btSerial.connect - Found Chanel: ' + chanel.toString());
			}
				myAdapter.log.info('successfully connected to ' + name + ' (MAC: ' + address + ') chanel: ' + chanel.toString());
			// Reset the connection indicator during startup
			myAdapter.setStateAsync('info.connection', true, true);
			blt_connected = true;

			// Daten Intervall starten
			start_handlingData_interval();

			btSerial.on('data', function (buffer) {
				//myAdapter.log.info('incomming Data: ' + buffer.toString());

				local_data = buffer.toString();

				if (trash_data === false) {
					received_data_buffer += local_data.toString();
					// console.log(received_data_buffer.toString());
					if (received_data_buffer.length >= minPackageLength) {
						handleData(received_data_buffer.toString());
						received_data_buffer = '';
						trash_data = true;
					}
				} else {

				}

			});

		}, bltErrorEvent);

	}, bltErrorEvent);
}

function bltErrorEvent(err)
{
	if(developerLogs) {
		myAdapter.log.info('bltErrorEvent(err) hit');
	}

	if(typeof err !== 'undefined' && err !== null) {
		myAdapter.log.error('Error: ' + err.message);
	}
	else{
		myAdapter.log.warn('bltError hit with err undefined')
	}
	if(btSerial.isOpen()){
		myAdapter.log.warn('Bluetooth Error ... closing Bluetooth connection if open')
		btSerial.close();
	}
}

function bltFinishedEvent(address, name){
	if(developerLogs) {
		myAdapter.log.info('bltFinishedEvent(address, name) hit');
	}
	myAdapter.log.info('inquiry execution did finish');
	inquireBlt_isrunning = false;
}

function handleData(rx_data) {
	if(developerLogs) {
		myAdapter.log.info('handleData(rx_data) hit');
		myAdapter.log.info(rx_data.toString());
	}
	var packages = rx_data.split('\n');
	for (let i = 0; i < packages.length; i++) {

		if(packages[i].startsWith(messageBegin + monoxidIdentifier) && packages[i].length === coPackageLength && gotCoPackage === false)
		{
			if(developerLogs) {
			myAdapter.log.info("got CO Package: " + packages[i].toString());
			}
			gotCoPackage = true;
			oControlValues.CO = parseInt(packages[i].substr(5,3).trim());
			oControlValues.Flap = parseInt(packages[i].substr(10,3).trim());
			oControlValues.S = parseInt(packages[i].substr(14,1).trim());


		}
		else if(packages[i].startsWith(messageBegin + timeIdentifier) && packages[i].length === tiPackageLength  && gotTIPackage === false)
		{
			if(developerLogs) {
			myAdapter.log.info("got TI Package: " + packages[i].toString());
			}
			gotTIPackage = true;
			oControlValues.TimeSec = parseInt(packages[i].substr(5,5).trim());
			oControlValues.EGTemp = parseInt(packages[i].substr(13,3).trim());

		}
		else
		{
			// Kein brauchbares Packet
			if(developerLogs) {
			myAdapter.log.info("bad data!!");
			}
			// console.log(i.toString() + ': ' + "Unbekanntes Packet");
		}

		if(gotCoPackage === true && gotTIPackage === true) {
			if(developerLogs) {
			myAdapter.log.info("got All Packages");
			}
			// Flags zurücksetzen
			gotCoPackage = false;
			gotTIPackage = false;

			oControlValues.Duration = secondsToDuration(oControlValues.TimeSec);
			oControlValues.Mode = numberStatusToTxt(oControlValues.S);

			myAdapter.log.info(JSON.stringify(oControlValues));

			myAdapter.setStateAsync('co_value', oControlValues.CO);
			myAdapter.setStateAsync('eg_temperatur_value', oControlValues.EGTemp);
			myAdapter.setStateAsync('flap_value', oControlValues.Flap);
			myAdapter.setStateAsync('mode_raw_value', oControlValues.S);
			myAdapter.setStateAsync('seconds_running', oControlValues.TimeSec);
			myAdapter.setStateAsync('duration_time', oControlValues.Duration);
			myAdapter.setStateAsync('burning_phase', oControlValues.Mode);

			return;
		}
	}
}

// Diese Funktion wandelt die übergebenen Sekunden in eine
// Zeitdauer String um "00:00:00" und gibt ihn zurück
function secondsToDuration(seconds){
	if(developerLogs) {
		myAdapter.log.info('secondsToDuration(seconds) hit');
	}
	const secsMinute = 60;
	const secsHour = 3600;
	var receivedSeconds = 0;
	try{
		receivedSeconds = parseInt(seconds);
	}
	catch(exception){
		return exception;
	}

	var mHour = Math.floor(seconds / secsHour).toString().padStart(2,'0').toString();
	var mMin = Math.floor((seconds % secsHour)/secsMinute).toString().padStart(2,'0').toString();
	var mSec = Math.floor(((seconds % secsHour)%secsMinute) % secsMinute).toString().padStart(2,'0').toString();

	var ret_str = mHour + ':' + mMin + ':' + mSec;

	return ret_str;

}

// Diese Funktion erwartet den Ofenstatus als Zahl 'oControlValues.S'
// und gibt den Status in klartext zurück
function numberStatusToTxt(numberStatus) {
	if(developerLogs) {
		myAdapter.log.info('numberStatusToTxt(numberStatus) hit');
	}
	switch (numberStatus) {
		case 0:
			return oControlStatusTxt_de.S0;
			break;
		case 1:
			return oControlStatusTxt_de.S1;
			break;
		case 2:
			return oControlStatusTxt_de.S2;
			break;
		case 3:
			return oControlStatusTxt_de.S3;
			break;
		case 4:
			return oControlStatusTxt_de.S4;
			break;
		default:
			return numberStatus.toString() + ' is undefined!';
	}
}
//=====================================================================================
// Serial Blue-Tooth Events
btSerial.on('finished', bltFinishedEvent);
btSerial.on('found', bltFoundEvent);
btSerial.on('failure', bltErrorEvent);
//=====================================================================================

var testVar_number = 0;
// Funktion um Tests auszuführen
function test_function() {
	if(developerLogs) {
		myAdapter.log.info('test_function() hit');
	}
	myAdapter.log.info('test_function line 1');
	if (typeof myAdapter.config.oControl_Test_Number !== 'undefined' && myAdapter.config.oControl_Test_Number !== null) {

		myAdapter.log.info('test_function = true');
		testVar_number = myAdapter.config.oControl_Test_Number;
		myAdapter.log.info('test_function config read value = ' + testVar_number.toString());
	}
	else{
		myAdapter.log.info('test_function = false');
	}
	myAdapter.log.info('test_function line 2');

	myAdapter.log.info('test_function writing config ...');
	myAdapter.config.oControl_Test_Number = 17;
	myAdapter.log.info('test_function writing done');
	myAdapter.log.info('test_function reading again .. written value was ' + myAdapter.config.oControl_Test_Number.toString());

	return;
}