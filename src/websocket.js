const { getConfiguration, getSetting, saveConfiguration, saveSetting } = require('./misc');
const { ipcRenderer } = require('electron');
const { openSerialPort, sendSerialData } = require('./moduleData/materialPlane');
const { MKmidi } = require('./moduleData/materialKeys')
const WebSocket = require('ws');

let eventEmitter;
let MKMidi;
let wss;
let port = 3001;
let version;
let SDversion;
let connections = [];
let connectionId = 0;

let WSconnected = false;
webSockets = {} // userID: webSocket
let MDConnected = false;
let MKConnected = false;
let SDConnected = false;
let MPConnected = false;
let MPSConnected = false;

let MPComPort;
let MPserial = false;

async function initializeWebsocket(app,eventEm) {
    eventEmitter = eventEm;
    version = app.getVersion();
    console.log('version',version)
    port = await getSetting('port');
    console.log(`Starting websocket on port ${port}`)
    wss = new WebSocket.Server({ port: port });
    
    /*
    * Do when a new websocket connection is made
    */
    wss.on('connection', function (ws, request, client) {
        WSconnected = true;
        let target;
        let connection;
        
        const data = {
            type: 'connected',
            data: 'server',
            MSversion: version
        }
        ws.send(JSON.stringify(data));
        
        //Set ping interval
        const id = setInterval(function () {
            ws.send("{\"T\":\"P\"}")
        }, 1000);

        //If a message is received, send this to analyzeWS()
        ws.on('message', function incoming(data) {
            let JSONdata = JSON.parse(data);
            
            if (JSONdata.target == "server") {
                target = JSONdata.module != undefined ? JSONdata.module : JSONdata.source;
                connection = setServerConfig(JSONdata, ws, connection);
            }
            analyzeWS(JSONdata);
        });

        //If connection is closed, stop ping interval
        ws.on('close', async function () {
            
            if (target == "MK"){
                console.log('Foundry VTT - MK disconnected');
                MKConnected = false;
                eventEmitter.emit('ws', 'connected', target, false);
                saveSetting(`${target}connected`,false,'temp');
            }
            else if (target == "MD"){
                console.log('Foundry VTT - MD disconnected');
                const index = connections.findIndex(c => c.conId == connection);
                connections.splice(index,1);
                MDConnected = false;
                eventEmitter.emit('ws', 'connected', target, false);
                saveSetting(`${target}connected`,false,'temp');
            }
            else if (target == "SD") {
                console.log('Stream Deck disconnected');
                const index = connections.findIndex(c => c.conId == connection.conId);
                connections.splice(index,1);
                if (connections.find(c => c.target == target) == undefined) {
                    SDConnected = false;
                    eventEmitter.emit('ws', 'connected', target, false);
                    saveSetting(`${target}connected`,false,'temp');
                    if (MDConnected){
                        const data = {
                            target: 'MD',
                            type: 'disconnected',
                            data: 'SD'
                        }
                        wss.broadcast(data);
                    }
                }
            }
            else if (target == "MP"){
                console.log('Foundry VTT - MP disconnected');
                const index = connections.findIndex(c => c.conId == connection.conId);
                connections.splice(index,1);
                MPConnected = false;
                wsSensor.close();
                eventEmitter.emit('ws', 'connected', target, false);
                saveSetting(`${target}connected`,false,'temp');
            }
            clearInterval(id);
        });  
    });

    /*
    * Broadcast message over websocket to all connected clients
    */
    wss.broadcast = function broadcast(data) {
        let msg = JSON.stringify(data);

        for (let connection of connections) {
            if (connection.target == data.target) connection.ws.send(msg);
        }
    };
}

let mdDevices = [];


function analyzeWS(data) {
    if (data.target == 'MD' || data.target == 'SD') {
        wss.broadcast(data);
        if (data.target == 'MD') {
            if (data.type == 'deviceList') {
                mdDevices = data.devices;
                eventEmitter.emit('ws', 'mdDevices', mdDevices);
                saveSetting('mdDevices', mdDevices, 'temp');
            }
            else if (data.type == 'newDevice') {
                mdDevices.push(data.device);
                eventEmitter.emit('ws', 'mdDevices', mdDevices);
                saveSetting('mdDevices', mdDevices, 'temp');
            }
            else if (data.type == 'deviceDisconnected') {
                const index = mdDevices.findIndex( d => d.id === data.device.id );
                mdDevices.splice(index,1);
                eventEmitter.emit('ws', 'mdDevices', mdDevices);
                saveSetting('mdDevices', mdDevices, 'temp');
            }
        }
    }

    else if (data.target == "MPSensor") {
        sendSerialData(data.data);
        sendMPS(data.data);
    }

    else if (data.target == 'MIDI' && MKMidi.connected){
        //If led data is received, and a midi device is connected
        if (data.type == 'LED') 
            MKMidi.updateLeds(data.data);
        
        //If brightness data is received
        else if (data.type == 'Brightness') 
            MKMidi.setBrightness(data.data);
    }
}

async function setServerConfig(JSONdata, ws, connection) {
    const target = JSONdata.module != undefined ? JSONdata.module : JSONdata.source;

    if (target == 'SD' && JSONdata.type == 'disconnected') {
        eventEmitter.emit('ws', 'connected', 'SD', false);
        saveSetting('SDconnected', false, 'temp');
    }
    else {
        eventEmitter.emit('ws', 'connected', target, true);
        saveSetting(`${target}connected`, true, 'temp');
    }

    if (target == "MK"){
        MKConnected = true;
        connection = {
            ws,
            conId: connectionId,
            target
        };
        connections.push(connection);
        connectionId++;
        console.log('Foundry VTT - MK connected');
        if (MKMidi == undefined) MKMidi = new MKmidi(wss,eventEmitter);

        if (MKMidi.connected){
            const data = {
                target: 'MK',
                type: 'connected'
            }
            wss.broadcast(data);
        }
    }
    else if (target == "MD"){
        connection = {
            ws,
            conId: connectionId,
            target
        };
        connections.push(connection);
        connectionId++;
        MDConnected = true;

        console.log('Foundry VTT - MD connected');

        if (SDConnected){
            const data = {
                target: 'MD',
                type: 'connected',
                data: 'SD',
                MSversion: version,
                SDversion: SDversion,
            }
            wss.broadcast(data);
        }
    }
    else if (target == "SD"){
        SDversion = JSONdata.version;
        if (JSONdata.type == "disconnected"){
            console.log('Stream Deck disconnected');
            SDConnected = false;
            if (MDConnected){
                const data = {
                    target: 'MD',
                    type: 'disconnected',
                    data: 'SD'
                }
                wss.broadcast(data);
            }
        }
        else {
            connection = {
                ws,
                conId: connectionId,
                target
            };
            connections.push(connection);
            connectionId++;
            SDConnected = true;
            console.log('Stream Deck connected');

            if (MDConnected){
                const data = {
                    target: 'MD',
                    type: 'connected',
                    data: 'SD',
                    MSversion: version,
                    SDversion: SDversion,
                }
                wss.broadcast(data);
            }
        }
    }
    else if (target == "MP"){
        MPConnected = true;
        connection = {
            ws,
            conId: connectionId,
            target
        };
        connections.push(connection);
        connectionId++;
        const enUSB = await getSetting('enableUSB')
        console.log('Foundry VTT - MP connected',enUSB);
        if (enUSB != true) {
            startMPClient(JSONdata.ip);
            const data = {
                target: 'MP',
                status: 'MSConnected',
                MSversion: version,
            }
            wss.broadcast(data);
        } else {
            if (await getSetting('mpSerialPortConnected', 'temp') == true) {
                const data = {
                    target: 'MP',
                    status: 'serialConnected',
                    MSversion: version,
                    port: await getSetting("mpComPort")
                }
                wss.broadcast(data);
            }
            else {
                openSerialPort(await getSetting("mpComPort"), wss);
            }
        }
    }
    return connection;
}

let wsSensor;
let wsOpen = false;
let wsInterval;
let mpSensorIp;

async function startMPClient(ip) {
    //console.log(`Starting Material Plane websocket client on "${ip}`);
    mpSensorIp = ip;

    wsSensor = new WebSocket('ws://'+ip);

    clearInterval(wsInterval);

    wsSensor.onmessage = function(msg){
        
        if (MPConnected){
            let data = JSON.parse(msg.data);
            data.target = "MP";         
            wss.broadcast(data);
        }
        clearInterval(wsInterval);
        wsInterval = setInterval(resetWS, 5000);
    }

    wsSensor.onopen = function() {
        console.log("Material Plane Sensor: Websocket connected")
        MPSConnected = true;
        wsOpen = true;
        eventEmitter.emit('ws', 'connected', 'MPS', true);
        saveSetting(`MPSconnected`, true, 'temp');
        clearInterval(wsInterval);
        wsInterval = setInterval(resetWS, 5000);

        if (MPConnected){
            const data = {
                target: 'MP',
                status: 'sensorConnected',
                data: 'null'
            }                
            wss.broadcast(data);
        }
    }
  
    clearInterval(wsInterval);
    wsInterval = setInterval(resetWS, 1000);
}

/**
 * Try to reset the websocket if a connection is lost
 */
 function resetWS(){
    MPSConnected = false;
    eventEmitter.emit('ws', 'connected', 'MPS', false);
    saveSetting(`MPSconnected`, false, 'temp');
    if (wsOpen) {
        wsOpen = false;
        console.log("Material Plane: Disconnected from server");
        startMPClient(mpSensorIp);
    }
    else if (wsSensor.readyState == 2 || wsSensor.readyState == 3){
        //console.log("Material Plane: Connection to server failed");
        startMPClient(mpSensorIp);
    }
}


function sendMPS(txt){
    if (wsOpen) wsSensor.send(txt);
}

process.on('uncaughtException', function (err) {
    if (err.errno == "ENOTFOUND" && err.hostname == "materialsensor.local") {
        console.log("Could not connect to Material Plane sensor")
        setTimeout(function(){
            startMPClient(mpSensorIp)
        },10000);
    }
  });


module.exports = { initializeWebsocket };