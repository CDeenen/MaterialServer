//Sets the port of the websocket
const port = 3001;

const DEBUG = false;

let WSconnected = false;
webSockets = {} // userID: webSocket
let MDConnected = false;
let MKConnected = false;
let SDConnected = false;

const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: port });

require('dns').lookup(require('os').hostname(), function (err, add, fam) {
    console.log('Websocket on: '+add+':'+port);
  })

//Stores all compatible Midi devices. id should be a string that occurs in the detected input and output name, and does not occur in any other inputs and outputs
const midiDevices = [
    {
        name: 'Launchpad Mini Mk3',
        id: '(LPMiniMK3 MIDI)',
        sysExHeader: [0xF0,0x00,0x20,0x29,0x02,0x0D]
    },
    {
        name: 'Launchpad Mk2',
        id: '(LPMK2 MIDI)',
        sysExHeader: [0xF0,0x00,0x20,0x29,0x02,0x18]
    }];


///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//Websocket
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/*
 * Do when a new websocket connection is made
 */
wss.on('connection', function (ws) {
    WSconnected = true;
    let target;
    
    //Send currently connected MIDI device name to Foundry
    let deviceName = 'null'
    if (midi.connected) deviceName = midiDevices[midi.midiDeviceSelected].name;

    const data = {
        type: 'connected',
        data: 'server'
    }
    ws.send(JSON.stringify(data));
    
    //Set ping interval
    const id = setInterval(function () {
        ws.send("{\"T\":\"P\"}")
    }, 1000);

    //If a message is received, send this to analyzeWS()
    ws.on('message', function incoming(data) {
        let JSONdata = JSON.parse(data);
        if (JSONdata.target == "server"){
            if (JSONdata.module == "MK"){
                MKConnected = true;
                webSockets[0] = ws;
                console.log('Foundry VTT - MK connected');
                target = "MK";

                if (midi.connected){
                    const data = {
                        target: 'MK',
                        type: 'connected',
                        data: deviceName
                    }
                    wss.broadcast(data);
                }
            }
            else if (JSONdata.module == "MD"){
                MDConnected = true;
                webSockets[1] = ws;
                console.log('Foundry VTT - MD connected');
                target = "MD";

                if (SDConnected){
                    const data = {
                        target: 'MD',
                        type: 'connected',
                        data: 'SD'
                    }
                    wss.broadcast(data);
                }
            }
            else if (JSONdata.source == "SD"){
                SDConnected = true;
                webSockets[2] = ws;
                console.log('Stream Deck connected');
                target = "SD";

                if (MDConnected){
                    const data = {
                        target: 'MD',
                        type: 'connected',
                        data: 'SD'
                    }
                    wss.broadcast(data);
                }
            }
        }
        else
            analyzeWS(JSONdata);
      });

    //If connection is closed, stop ping interval
    ws.on('close', function () {
        //console.log(ws,target)
        if (target == "MK"){
            console.log('Foundry VTT - MK disconnected');
            MKConnected = false;
        }
        else if (target == "MD"){
            console.log('Foundry VTT - MD disconnected');
            MDConnected = false;
        }
        else if (target == "SD") {
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
      clearInterval(id);
    });  
});

/*
 * Broadcast message over websocket to all connected clients
 */
wss.broadcast = function broadcast(data) {
    if (DEBUG) console.log("SENDING OVER WS: ",data);
    let msg = JSON.stringify(data);
    //console.log(data,data.target,MKConnected)
    if (data.target == "MK" && MKConnected) webSockets[0].send(msg);
    else if (data.target == 'MD' && MDConnected) webSockets[1].send(msg);
    else if (data.target == 'SD' && SDConnected) webSockets[2].send(msg);
 };

 /*
  * Analyze received data
  */
function analyzeWS(data){
    if (DEBUG) console.log("RECEIVED FROM WS: ",data);

    if (data.target == 'MD' || data.target == 'SD') wss.broadcast(data);

    if (data.target == 'MIDI' && midi.connected){
        //If led data is received, and a midi device is connected
        if (data.type == 'LED') 
            midi.updateLeds(data.data);
        
        //If brightness data is received
        else if (data.type == 'Brightness') 
            midi.setBrightness(data.data);
    }
}




//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//MIDI for Material Keys
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

class Midi{
    constructor(){
        this.input;                     //Stores the MIDI input
        this.output;                    //Stores the MIDI output
        this.inputName;                 //Stores the input name
        this.outputName;                //Stores the output name
        this.connected = false;         //Is a device currently connected             
        this.inputs = null;             //List of connected inputs
        this.outputs = null;            //List of connected outputs
        this.midiDeviceSelected = 0;    //Currently selected device (from midiDevices[])
        this.colorPickerActive = false;
        this.colorPickerSel = 0;
        this.colorPickerKey = 0;
        this.colorPickerOn = 0;
        this.colorPickerCurrent = 0;
        
        //Start searching for midi devices
        this.searchMidi();
    }
    
    /*
     * Prints a list of the found MIDI inputs and outputs
     */
    midiFoundMsg(){
        console.log("\n--------------------------------------------------------------");
        if (this.inputs.length == 0) console.log("No MIDI inputs found");
        else {
            console.log("MIDI inputs found:");
            for (let i=0; i<this.inputs.length; i++)
                console.log(this.inputs[i]);
        }
        console.log("");
        if (this.outputs.length == 0) console.log("No MIDI outputs found");
        else {
            console.log("MIDI outputs found:");
            for (let i=0; i<this.outputs.length; i++)
                console.log(this.outputs[i]);
        }
        console.log("--------------------------------------------------------------\n");
    }

    /*
     * Checks the connection to the midi device every second
     */
    searchMidi(){
        //Get the MIDI inputs and outputs
        let inputs = easymidi.getInputs();
        let outputs = easymidi.getOutputs();

        //If no previous inputs and outputs have been stored, store these
        if (this.inputs == null && this.outputs == null) {
            this.inputs = inputs;
            this.outputs = outputs;
            this.midiFoundMsg();
        }
        let newFound = false;
        let disconnect = 0;
        
        //Check if there is any change in the inputs and outputs compared to the last iteration
        if (inputs.length != this.inputs.length) 
            newFound = true;
        for (let i=0; i<this.inputs.length; i++){
            if (inputs[i] != this.inputs[i]) 
                newFound = true;
            if (inputs[i] == this.inputName) 
                disconnect++;
        }
        if (outputs.length != this.outputs.length) 
            newFound = true;
        for (let i=0; i<this.outputs.length; i++){
            if (outputs[i] != this.outputs[i]) 
                newFound = true;
            if (outputs[i] == this.outputName)
                disconnect++;
        }
        
        //If previously selected device is no longer found, notify user and Foundry
        if (disconnect < 2 && this.connected) {
            console.log("\nMIDI device disconnected");
            midi.close();
            this.connected = false; 

            if (WSconnected){
                const data = {
                    target: 'MK',
                    type: 'connected',
                    data: 'null'
                }                
                wss.broadcast(data);
            }
        }

        //If new devices are found, print midi devices
        if (newFound) {
            this.inputs = inputs;
            this.outputs = outputs;
            this.midiFoundMsg();
        }

        //If currently not connected to a midi device, check if any of the found inputs and outputs correspond with any device set in midiDevices. If so, connect to that device
        let conCheck = 0;
        let input = undefined;
        let output = undefined;
        if (this.connected == false){
            for (let i=0; i<this.inputs.length; i++)
                for (let j=0; j<midiDevices.length; j++)
                    if (this.inputs[i].includes(midiDevices[j].id)){
                        this.midiDeviceSelected = j;
                        conCheck++;
                        this.inputName = this.inputs[i];
                        input = inputs[i];
                        break;
                    }
            for (let i=0; i<this.outputs.length; i++)
                if (this.outputs[i].includes(midiDevices[this.midiDeviceSelected].id)){
                    conCheck++;
                    this.outputName = this.outputs[i];
                    output = outputs[i];
                    break;
                }
            if (conCheck == 2){
                if (input != undefined && output != undefined)
                    this.connect(input,output);
            }
        }

        //Repeat the search every 2 seconds to check for disconnections or new connections
        setTimeout(() => this.searchMidi(),2000);  
    }

    /*
     * Open connection to midi device
     */
    connect(input,output){
        this.connected = true; 

        //Print connection details
        console.log("\n--------------------------------------------------------------");
        console.log("Connecting to:");
        console.log("Name: "+midiDevices[this.midiDeviceSelected].name);
        console.log("Input: "+input);
        console.log("Out: "+output);
        console.log("--------------------------------------------------------------\n");
        
        //Store name of connected input and output
        this.inputName = input;
        this.outputName = output;

        //Open the input and connections
        this.input = new easymidi.Input(input);
        this.output = new easymidi.Output(output);

        //Set to programming mode
        this.setToProgramming();

        //Send connection data to Foundry
        if (WSconnected){
            let deviceName = midiDevices[this.midiDeviceSelected].name;
            const data = {
                target: 'MK',
                type: 'connected',
                data: deviceName
            }
            wss.broadcast(data);
        }

        //********************************************************************************************************************************** */
        //Register 'note on' and 'control change' callbacks for the Launchpad Mini Mk3, send keypress data to Foundry
        if (midiDevices[this.midiDeviceSelected].name == "Launchpad Mini Mk3") {
            this.input.on('noteon', function (msg) {
                let state = 0;
                if (msg.velocity == 127) state = 1;
                if (WSconnected){
                    const data = {
                        target: 'MK',
                        type: 'key',
                        button: msg.note,
                        state: state
                    }
                    wss.broadcast(data);
                }
            });
            this.input.on('cc', function (msg) {
                let state = 0;
                if (msg.value == 127) state = 1;
                if (WSconnected){
                    const data = {
                        target: 'MK',
                        type: 'key',
                        button: msg.controller,
                        state: state
                    }
                    wss.broadcast(data);
                }
            });
        }
    }

    /*
     * Midi send SysEx
     */
    sendSysEx(data){
        if (DEBUG) console.log("SENDING SYSEX TO MIDI DEVICE: ",data);
        this.output.send('sysex',data);
    }

    /*
     * Close the midi input and output
     */
    close(){
        if (this.input != undefined)
            this.input.close();
        if (this.output != undefined)
            this.output.close();
    }

    //********************************************************************************************************************************** */
    /*
     * Set the launchkey to programming mode
     */
    setToProgramming(){
        //Set Launchpad Mini Mk3 to programming mode
        if (midiDevices[this.midiDeviceSelected].name == "Launchpad Mini Mk3")
            this.sendSysEx([0xF0, 0x00, 0x20, 0x29, 0x02, 0x0D, 0x0E, 0x01, 0xF7]);
    }

    //********************************************************************************************************************************** */
    /*
     * Set the LED brightness level
     */
    setBrightness(brightness){
        //Set brightness of Launchpad Mini Mk3
        if (midiDevices[this.midiDeviceSelected].name == "Launchpad Mini Mk3"){
            let data = [];
            let header = midiDevices[midi.midiDeviceSelected].sysExHeader;
            for (let i=0; i<header.length; i++)//
                data[i] = header[i];
            data[header.length] = 0x08;
            data[header.length+1] = brightness;
            data[header.length+2] = 0xF7;
            this.sendSysEx(data);
        }
    }

    //********************************************************************************************************************************** */
  
    /*
    * Update LED data
    */
    updateLeds(data){
        //Update leds for the Launchpad Mini Mk3
        if (midiDevices[this.midiDeviceSelected].name == "Launchpad Mini Mk3") {
            let ledArray = data.split(";");
            let dataSend = [];
            let header = midiDevices[this.midiDeviceSelected].sysExHeader;
            for (let i=0; i<header.length; i++)//
                dataSend[i] = header[i];
            let counter = header.length;
            dataSend[counter] = 0x03;
            counter++;
            for (let i=0; i<400; i++){
                if (ledArray[i] == undefined) break;
                let array = ledArray[i].split(",");
                let led = parseInt(array[0]);
                let color = parseInt(array[2]);
                let type = parseInt(array[1]);
                dataSend[counter] = type;
                dataSend[counter+1] = led;
                if (color > 127) color = 0;
                dataSend[counter+2] = color;
                counter += 3;
                if (type == 1 || type == 3){
                    let color = parseInt(array[3]);
                    if (color > 127) color = 0;
                    dataSend[counter] = color;
                    counter++;
                }
                if (type == 3){
                    let color = parseInt(array[4]);
                    if (color > 127) color = 0;
                    dataSend[counter] = color;
                    counter++;
                }
            }
            dataSend[counter] = 0xF7;
            this.sendSysEx(dataSend);
        }
    }
}

const easymidi = require('easymidi');
var midi = new Midi();

