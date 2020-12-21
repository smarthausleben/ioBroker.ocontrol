![Logo](admin/ocontrol.png)
# ioBroker.ocontrol

[![NPM version](http://img.shields.io/npm/v/iobroker.ocontrol.svg)](https://www.npmjs.com/package/iobroker.ocontrol)
[![Downloads](https://img.shields.io/npm/dm/iobroker.ocontrol.svg)](https://www.npmjs.com/package/iobroker.ocontrol)
[![Dependency Status](https://img.shields.io/david/cmoehler/iobroker.ocontrol.svg)](https://david-dm.org/cmoehler/iobroker.ocontrol)
[![Known Vulnerabilities](https://snyk.io/test/github/cmoehler/ioBroker.ocontrol/badge.svg)](https://snyk.io/test/github/cmoehler/ioBroker.ocontrol)

[![NPM](https://nodei.co/npm/iobroker.ocontrol.png?downloads=true)](https://nodei.co/npm/iobroker.ocontrol/)

**Tests:**: [![Travis-CI](http://img.shields.io/travis/cmoehler/ioBroker.ocontrol/master.svg)](https://travis-ci.org/cmoehler/ioBroker.ocontrol)

## oControl adapter for ioBroker

Adapter to get values from 'oControl' furance control device using by bluetooth serial port of the device.  

### Prerequisites on Linux

    * Needs Bluetooth development packages to build

    apt-get install build-essential libbluetooth-dev


### oControl Hardware Device needs to be paired first in order to use the adapter!!!
### ================================================================================   

    Pair oControl using the Raspberry Command Line

    1. on the Rasperry running ioBroker enter 'bluetoothctl' to open Bluetooth control

    2. At the [bluetooth]# prompt enter the following commands:
        discoverable on
        pairable on
        agent on
        default-agent
        scan on

    3. Wait for a message to appear showing the oControl has been found:
     ... Device 00:12:6F:34:6D:0F ...

    4. Type pair with the mac address of the oControl:
        pair 00:12:6F:34:6D:0F

        you should see: Attempting to pair with 00:12:6F:34:6D:0F
                        Request PIN code
    
    5. Enter the correct PIN code (see oControl Software Dokumentation)
        [agent] Enter PIN code: ***
        
    6. oControl paireing process should look similar to this            .
        [CHG] Device 00:12:6F:34:6D:0F UUIDs: 00001101-0000-1000-8000-00805f9b34fb
        [CHG] Device 00:12:6F:34:6D:0F ServicesResolved: yes
        [CHG] Device 00:12:6F:34:6D:0F Paired: yes
        Pairing successful

    7. After successfull pairing your oControl hardware with the Raspberry, you can start the oControl adapter

    
## Changelog

### 0.0.1
* (cmoehler) initial release
* test

## License
MIT License

Copyright (c) 2019 cmoehler <ccm@gmx.net>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.