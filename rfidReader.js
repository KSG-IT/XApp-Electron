/**

 "vendorId": 65535,
 "productId": 53,
 "path": "IOService:/AppleACPIPlatformExpert/PCI0@0/AppleACPIPCI/XHC1@14/XHC1@14000000/HS07@14400000/USB2.0 Hub@14400000/AppleUSB20Hub@14400000/AppleUSB20HubPort@14410000/SYC ID&IC USB Reader@14410000/USB Standard Keyboard@0/IOUSBHostHIDDevice@14410000,0",
 "serialNumber": "08FF20140315",
 "manufacturer": "Sycreader RFID Technology Co., Ltd",
 "product": "SYC ID&IC USB Reader",
 "release": 256,
 "interface": -1,
 "usagePage": 1,
 "usage": 6

 */

// const HID = require('node-hid');
// try {
//     const devices = HID.devices();
//
//     const productName = 'SYC ID&IC USB Reader';
//
//     let myDevice = null;
//
//     devices.map((device) => {
//         if (device.product == productName){
//             myDevice = device;
//         }
//     });
//
//     console.log(myDevice);
//
//     // new HID.HID(myDevice);
// } catch {
//     throw new Error()
// }


// process.stdin.resume();
// // only set below if capturing non-printing keystrokes
// process.stdin.setRawMode(true);
// process.stdin.on('data', function (chunk) {
//     console.log('data: ', chunk);
// });


// const serialport = require('serialport');

const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});

readline.question(`What's your name?`, (name) => {
    console.log(`Hi ${name}!`);
    readline.close()
});