const { getConfiguration, getSetting, saveConfiguration, saveSetting } = require('../misc');
const { configureLogging } = require('../debug')
let wss;

const midiDevices = [
    {
        name: 'Launchpad Mini Mk3',
        id: '(LPMiniMK3 MIDI)',
        protocol: 'MK3',
        sysExHeader: [0xF0,0x00,0x20,0x29,0x02,0x0D]
    },{
        name: 'Launchpad Mini Mk3',
        id: 'Launchpad Mini MK3 LPMiniMK3 MIDI',
        protocol: 'MK3',
        sysExHeader: [0xF0,0x00,0x20,0x29,0x02,0x0D]
    },{
        name: 'Launchpad Mini Mk3',
        id: 'Launchpad Mini MK3 MIDI 2',
        protocol: 'MK3',
        sysExHeader: [0xF0,0x00,0x20,0x29,0x02,0x0D]
    },{
        name: 'Launchpad Mini Mk3',
        id: 'LPMiniMK3 MI',
        protocol: 'MK3',
        sysExHeader: [0xF0,0x00,0x20,0x29,0x02,0x0D]
    },{
        name: 'Launchpad Mk2',
        id: '(LPMK2 MIDI)',
        protocol: 'MK2',
        sysExHeader: [0xF0,0x00,0x20,0x29,0x02,0x18]
    },{
        name: 'Launchpad Mk2',
        id: 'Launchpad MK2',
        protocol: 'MK2',
        sysExHeader: [0xF0,0x00,0x20,0x29,0x02,0x18]
    },{
        name: 'Launchpad Pro Mk3',
        id: 'Launchpad Pro MK3',
        protocol: 'MK3',
        sysExHeader: [0xF0,0x00,0x20,0x29,0x02,0x0E]
    }
];

class MKmidi{
    constructor(ws, eventEmitter){
        wss = ws;
        this.protocol;                  //Stores the MIDI protocol id
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
        this.eventEmitter = eventEmitter;
        this.midiDevices = midiDevices;

        saveSetting('mkAllowableDevices',midiDevices,'temp');

        //Start searching for midi devices
        this.searchMidi();
    }
    
    /*
     * Prints a list of the found MIDI inputs and outputs
     */
    midiFoundMsg(){
        /*
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
        */
    }

    /*
     * Checks the connection to the midi device every second
     */
    async searchMidi(){
        //Get the MIDI inputs and outputs
        let inputs = easymidi.getInputs();
        let outputs = easymidi.getOutputs();

        let newFound = false;
        let disconnect = 0;

        //If no previous inputs and outputs have been stored, store these
        if (this.inputs == null && this.outputs == null) {
            newFound = true;
            this.inputs = inputs;
            this.outputs = outputs;
            //this.midiFoundMsg();
        }
        
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
            this.close();
            this.connected = false; 
            newFound = true;

            const data = {
                target: 'MK',
                type: 'connected',
                data: 'null'
            }                
            wss.broadcast(data);
            await saveSetting('LPconnected', false, 'temp');
        }

        //If new devices are found, print midi devices
        if (newFound) {
            this.inputs = inputs;
            this.outputs = outputs;
            this.midiFoundMsg();
            await saveSetting('mkDevices',{inputs:this.inputs,outputs:this.outputs},'temp');
            this.eventEmitter.emit('ws', 'mkDevices', {inputs, outputs})
        }

        //If currently not connected to a midi device, check if any of the found inputs and outputs correspond with any device set in midiDevices. If so, connect to that device
        let conCheck = 0;
        let input = undefined;
        let output = undefined;
        if (this.midiDevices == undefined) this.midiDevices = await getConfiguration('/moduleData/materialKeysDevices');

        if (this.connected == false){
            this.inputName = undefined;
            this.outputName = undefined;
            for (let i=0; i<this.midiDevices.length; i++) {
                const device = this.midiDevices[i]
                let input = this.inputs.find(d => d.includes(device.id))
                if (input == undefined) continue;
                let output = this.outputs.find(d => d.includes(device.id))
                if (output == undefined) continue;
                this.midiDeviceSelected = i;
                this.inputName = input;
                this.outputName = output;
                this.protocol = device.protocol;
                break;
            }

            if (this.inputName != undefined && this.outputName != undefined) {
                this.connect(this.inputName,this.outputName);
            }
        }
        //Repeat the search every 2 seconds to check for disconnections or new connections
        setTimeout(() => this.searchMidi(),2000);  
    }

    /*
     * Open connection to midi device
     */
    async connect(input,output){
        this.connected = true; 

        console.log(`MIDI device connected: ${this.midiDevices[this.midiDeviceSelected].name}`)
        /*
        //Print connection details
        console.log("\n--------------------------------------------------------------");
        console.log("Connecting to:");
        console.log("Name: "+this.midiDevices[this.midiDeviceSelected].name);
        console.log("Input: "+input);
        console.log("Out: "+output);
        console.log("Protocol: "+this.protocol);
        console.log("--------------------------------------------------------------\n");
        */
        await saveSetting('LPconnected', this.midiDevices[this.midiDeviceSelected], 'temp');
        this.eventEmitter.emit('ws', 'connected', 'LP', this.midiDevices[this.midiDeviceSelected]);
        this.eventEmitter.emit('ws', 'mkDevices', {inputs:this.inputs, outputs:this.outputs})
        

        //Store name of connected input and output
        this.inputName = input;
        this.outputName = output;

        //Open the input and connections
        this.input = new easymidi.Input(input);
        this.output = new easymidi.Output(output);

        //Set to programming mode
        this.setToProgramming();

        //Send connection data to Foundry
        let deviceName = this.midiDevices[this.midiDeviceSelected].name;
        const data = {
            target: 'MK',
            type: 'connected',
            data: deviceName
        }
        wss.broadcast(data);

        //********************************************************************************************************************************** */
        //Register 'note on' and 'control change' callbacks for the Launchpad Mini Mk3, send keypress data to Foundry
        if (this.protocol == "MK3") {
            this.input.on('noteon', function (msg) {
                let state = 0;
                if (msg.velocity == 127) state = 1;
                const data = {
                    target: 'MK',
                    type: 'key',
                    button: msg.note,
                    state: state
                }
                wss.broadcast(data);
            });
            this.input.on('cc', function (msg) {
                let state = 0;
                if (msg.value == 127) state = 1;
                const data = {
                    target: 'MK',
                    type: 'key',
                    button: msg.controller,
                    state: state
                }
                wss.broadcast(data);
            });
        }
        else if (this.protocol == "MK2") {
            this.input.on('noteon', function (msg) {
                let state = 0;
                if (msg.velocity == 127) state = 1;
                const data = {
                    target: 'MK',
                    type: 'key',
                    button: msg.note,
                    state: state
                }
                wss.broadcast(data);
            });
            this.input.on('cc', function (msg) {
                let state = 0;
                if (msg.value == 127) state = 1;
                const data = {
                    target: 'MK',
                    type: 'key',
                    button: msg.controller-13,
                    state: state
                }
                wss.broadcast(data);
            });
        }
    }

    /*
     * Midi send SysEx
     */
    sendSysEx(data){
        this.output.send('sysex',data);
    }

    /*
     * Close the midi input and output
     */
    async close(){
        if (this.input != undefined)
            this.input.close();
        if (this.output != undefined)
            this.output.close();
        await saveSetting('LPconnected', false, 'temp');
        this.eventEmitter.emit('ws', 'connected', 'LP', false);
        
    }

    //********************************************************************************************************************************** */
    /*
     * Set the launchkey to programming mode
     */
    setToProgramming(){
        //Set Launchpad to programming mode
        if (this.protocol == "MK3") {
            let msg = [];
            const sysExHeader = this.midiDevices[this.midiDeviceSelected].sysExHeader;
            for (let i=0; i<sysExHeader.length; i++) msg.push(sysExHeader[i]);
            msg.push(0x0E);
            msg.push(0x01);
            msg.push(0xF7);
            this.sendSysEx(msg);
        }
        if (this.protocol == "MK2") {
            let msg = [];
            const sysExHeader = this.midiDevices[this.midiDeviceSelected].sysExHeader;
            for (let i=0; i<sysExHeader.length; i++) msg.push(sysExHeader[i]);
            msg.push(0x22);
            msg.push(0x00);
            msg.push(0xF7);
            this.sendSysEx(msg);
        }
    }

    //********************************************************************************************************************************** */
    /*
     * Set the LED brightness level
     */
    setBrightness(brightness){
        //Set brightness of Launchpad
        if (this.protocol == "MK3"){
            let data = [];
            let header = this.midiDevices[this.midiDeviceSelected].sysExHeader;
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
    async updateLeds(data){
        //Update leds for the Launchpad
        if (this.protocol == "MK3") {
            let ledArray = data.split(";");
            let dataSend = [];
            let header = this.midiDevices[this.midiDeviceSelected].sysExHeader;
            for (let i=0; i<header.length; i++)//
                dataSend[i] = header[i];
            let counter = header.length;
            dataSend[counter] = 0x03;
            counter++;
            for (let i=0; i<400; i++){
                if (ledArray[i] == undefined) break;
                let array = ledArray[i].split(",");
                let led = parseInt(array[0]);
                let type = parseInt(array[1]);
                let color = isNaN(parseInt(array[2])) ? 0 : parseInt(array[2]);
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
        else if (this.protocol == "MK2") {
            let staticArray = [];
            let rgbArray = [];
            let header = this.midiDevices[this.midiDeviceSelected].sysExHeader;
            for (let i=0; i<header.length; i++) {
                staticArray[i] = header[i];
                rgbArray[i] = header[i];
            }
            staticArray[header.length] = 0x0A;
            rgbArray[header.length] = 0x0B;
                
            let ledArray = data.split(";");
            for (let i=0; 400; i++) {
                if (ledArray[i] == undefined) break;
                let array = ledArray[i].split(",");
                let led = parseInt(array[0]);
                if (led%10 == 0) continue;
                if (led > 89) led+=13;
                let type = parseInt(array[1]);
                let color = isNaN(parseInt(array[2])) ? 0 : parseInt(array[2]);
                if (color > 127) color = 0;

                if (type == 0 || type == 1 || type == 2) {    //static led
                    staticArray.push(led);
                    if (type == 1) staticArray.push(parseInt(array[3]));
                    else staticArray.push(color);
                }
                else if (type == 1) {    //flashing led
                    flashArray.push(led);
                    flashArray.push(color);
                    let color2 = isNaN(parseInt(array[3])) ? 0 : parseInt(array[3]);
                    if (color2 > 127) color2 = 0;
                    flashArray.push(color2);
                }
                else if (type == 2) {    //pulsing led
                    pulseArray.push(led);
                    pulseArray.push(color);
                }
                else if (type == 3) {    //rgb led
                    rgbArray.push(led);
                    rgbArray.push(Math.floor(color/2));
                    let color2 = isNaN(parseInt(array[3])) ? 0 : parseInt(array[3]);
                    if (color2 > 127) color2 = 0;
                    let color3 = isNaN(parseInt(array[4])) ? 0 : parseInt(array[4]);
                    if (color3 > 127) color3 = 0;
                    rgbArray.push(Math.floor(color2/2));
                    rgbArray.push(Math.floor(color3/2));
                }
                
            }
            staticArray.push(0xF7);
            rgbArray.push(0xF7);

            if (staticArray.length > header.length + 2) await this.sendSysEx(staticArray);
            if (rgbArray.length > header.length + 2) await this.sendSysEx(rgbArray);
        }
    }
}

const easymidi = require('easymidi');

module.exports = { MKmidi }