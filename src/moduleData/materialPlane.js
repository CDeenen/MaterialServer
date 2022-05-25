const { SerialPort } = require('serialport')
const { ReadlineParser } = require('@serialport/parser-readline')
const { getConfiguration, getSetting, saveConfiguration, saveSetting } = require('../misc');

let serialPorts = [];
let mpSerialPort;
let mpSerialPortConnected = false;
let wss;
let eventEmitter;
let spInterval;
let selectedComPort;

async function searchSerialPorts() {
    serialPorts = await SerialPort.list();
    return serialPorts;
}

async function initializeMaterialPlane(evE) {
    eventEmitter = evE;
    return searchSerialPorts(false);
}

function changePort(port) {
    clearInterval(spInterval);
    if (mpSerialPortConnected) mpSerialPort.close();
    openSerialPort(port, wss)
}

async function openSerialPort(MPComPort, wsserver) {
    clearInterval(spInterval);
    wss = wsserver;
    if (MPComPort == undefined) MPComPort = serialPorts[0]?.path;
    console.log('opening COM port: ',MPComPort)
    selectedComPort = MPComPort;
    if (MPComPort == undefined) {
        console.log('No COM Port found')
        return;
    }
    for (let port of serialPorts) {
        if (port.path == MPComPort) {
            mpSerialPort = await new SerialPort({path:port.path, baudRate:250000});
            mpSerialPort.on('open', showPortOpen);
            const parser = new ReadlineParser();
            mpSerialPort.pipe(parser); // pipe the serial stream to the parser
            parser.on('data',readSerialData);
            mpSerialPort.on('close', showPortClose);
            mpSerialPort.on('error', showError);
        }
    }
    if (mpSerialPort == undefined) {
        spInterval = setInterval(openSerialPort, 2000, selectedComPort,wss);
    }
}

function showPortOpen() {
    console.log('Material Sensor serial port open.');
  }
   
async function readSerialData(data) {
    let msg;
    try {
        msg = JSON.parse(data);
        msg.target = "MP";         
        wss.broadcast(msg);

        if (msg.status == 'ping' && !mpSerialPortConnected) {
            mpSerialPortConnected = true;
            await saveSetting('mpSerialPortConnected', true, 'temp');
            setTimeout(function (){eventEmitter.emit('ws', 'connected', 'MPS', true)},1000);
        }
    }
    catch (err) {
        
    }
}
   
async function showPortClose(interval = true) {
    console.log('Material Sensor serial port closed.');
    await saveSetting('mpSerialPortConnected', false, 'temp');
    eventEmitter.emit('ws', 'connected', 'MPS', false);
    mpSerialPortConnected = false;
    if (interval) spInterval = setInterval(openSerialPort, 2000, selectedComPort,wss);
}

async function showError(error) {
    console.log('Material Sensor serial port error: ' + error);
    await saveSetting('mpSerialPortConnected', false, 'temp');
    eventEmitter.emit('ws', 'connected', 'MPS', false);
    mpSerialPortConnected = false;
    spInterval = setInterval(openSerialPort, 2000, selectedComPort,wss);
}

function sendSerialData(data) {
    if (mpSerialPortConnected)
        mpSerialPort.write(data);
}

module.exports = { initializeMaterialPlane, searchSerialPorts, openSerialPort, changePort, sendSerialData };