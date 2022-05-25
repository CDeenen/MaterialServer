console.log('Starting Material Server');

const { ipcRenderer } = require('electron');
const path = require('path');
const { getConfiguration, getSetting, saveSetting } = require('../misc');
const { searchSerialPorts } = require('../moduleData/materialPlane')
var ip = require('ip');

let configuration = {};
let mkAllowableDevices = [];

initialize();

/**
 * Initialization function
 */
async function initialize() {
    
    configuration = await getConfiguration();
    temp = await getConfiguration('temp');
    //console.log('Configuration', configuration)
    //console.log('temp',temp)
    
    //Configure elements
    document.getElementById('port').value = configuration.port;
    let msAddress = `localhost:${configuration.port}`;
    document.getElementById('materialServerAddress').value = msAddress;
    document.getElementById('materialServerAddressRemote').value=`${ip.address()}:${configuration.port}`

    document.getElementById('mkFoundry').checked = temp.MKconnected;
    document.getElementById('mkFoundryCb').checked = temp.MKconnected;
    document.getElementById('mkDevice').checked = temp.LPconnected;
    document.getElementById('mdFoundry').checked = temp.MDconnected;
    document.getElementById('mdFoundryCb').checked = temp.MDconnected;
    document.getElementById('mdDevice').checked = temp.mdDevices != undefined && temp.mdDevices.length > 0;
    document.getElementById('mdDeviceCb').checked = temp.SDconnected;
    document.getElementById('mpFoundry').checked = temp.MPconnected;
    document.getElementById('mpFoundryCb').checked = temp.MPconnected;
    document.getElementById('mpDevice').checked = temp.MPSconnected;

    document.getElementById('runInTray').checked = configuration.runInTray;
    document.getElementById('enableUSB').checked = configuration.enableUSB;
    const comPorts = await searchSerialPorts();
    const selectedPort = configuration.mpComPort;
    let comSelect = document.getElementById('comPort');
    for (let i=0; i<comPorts.length; i++) {
        const newOption = document.createElement('option');
        const optionText = document.createTextNode(comPorts[i].path);
        newOption.appendChild(optionText);
        newOption.setAttribute('value',comPorts[i].path);
        
        comSelect.options[i] = new Option(comPorts[i].path,comPorts[i].path)
    }
    comSelect.value = selectedPort;

    let expandableHeadings = document.getElementsByClassName("expandable");
    for (let element of expandableHeadings) {
        element.addEventListener("click",(event) => {
            let thisElement = event.target;
            if (event.target.className == "expandableIcon") thisElement = event.target.parentElement;
            let nextElement = thisElement.nextElementSibling;
            const collapse = nextElement.className == "section" ? true : false;
            nextElement.className = collapse ? "section collapsed" : "section";
            thisElement.children[0].src = collapse ? "images/arrow-right.png" : "images/arrow-down.png";
        })
    }
    setMaterialDeckTable(temp.mdDevices);
    setMaterialKeysTable(temp.mkDevices);
}

/**
 * Add event listener to apply port button to change the port
 */
document.getElementById('applyPort').addEventListener('click', function(event){
    const port = document.getElementById('port').value;
    if (port != '' && port > 0 && port < 65535) {
        saveSetting('port',port);
        let msAddress = `localhost:${port}`;
        document.getElementById('materialServerAddress').value = msAddress;
        ipcRenderer.send('asynchronous-message','wsPortChanged');
    }
});

/**
 * Add event listener to run in tray
 */
document.getElementById('runInTray').addEventListener('change', async function(event){
    console.log('runInTray',event.target.checked)
    await saveSetting('runInTray',event.target.checked);
    ipcRenderer.send('asynchronous-message','runInTrayChanged');
});

/**
 * Add event listener to enable USB
 */
 document.getElementById('enableUSB').addEventListener('change', function(event){
    saveSetting('enableUSB',event.target.checked);
    ipcRenderer.send('asynchronous-message','enableUSBChanged');
});

/**
 * Add event listener to COM Port
 */
 document.getElementById('comPort').addEventListener('change', async function(event){
    await saveSetting('mpComPort',event.target.value);
    ipcRenderer.send('asynchronous-message','USBComChanged');
});

document.getElementById('refreshComPort').addEventListener('click', async function(event){
    const comPorts = await searchSerialPorts();
    let comSelect = document.getElementById('comPort');
    for (let i=0; i<comPorts.length; i++) {
        const newOption = document.createElement('option');
        const optionText = document.createTextNode(comPorts[i].path);
        newOption.appendChild(optionText);
        newOption.setAttribute('value',comPorts[i].path);
        comSelect.options[i] = new Option(comPorts[i].path,comPorts[i].path)
    }
});

ipcRenderer.on('asynchronous-message' , async (event, arg) => {
    //console.log('async-message', event, arg)
    if (arg.data == 'console') {
        console?.[arg.type](arg.message)
    }
    else if (arg.data === 'connected') {
        let id;
        switch (arg.target) {
            case 'MK': id = 'mkFoundry'; break;
            case 'LP': id = 'mkDevice'; break;
            case 'MD': id = 'mdFoundry'; break;
            case 'SD': id = 'mdDevice'; break;
            case 'MP': id = 'mpFoundry'; break;
            case 'MPS': id = 'mpDevice'; break;
        }
        if (id == 'mdDevice' && !arg.state) {
            document.getElementById(id).checked = false;
            document.getElementById(`${id}Cb`).checked = false;
        }
        else {
            if (id != 'mdDevice') document.getElementById(id).checked = arg.state;
            document.getElementById(`${id}Cb`).checked = arg.state;
        }
        
    }
    else if (arg.data === 'mdDevices') {
        document.getElementById('mdDevice').checked = arg.devices.length > 0;
        setMaterialDeckTable(arg.devices);
    }
    else if (arg.data === 'mkDevices') {
        setMaterialKeysTable(arg.devices);
    }
});

function setMaterialDeckTable(devices) {
    let table = document.getElementById('sdTable');
    for (let i=table.rows.length-1; i>0; i--) 
        table.deleteRow(i);

    if (devices == undefined || devices.length == 0) return;
    let i = 1;
    for (let device of devices) {
        let deviceType;
        switch (device.type) {
            case 0: deviceType = 'Stream Deck'; break;
            case 1: deviceType = 'Stream Deck Mini'; break;
            case 2: deviceType = 'Stream Deck XL'; break;
            case 3: deviceType = 'Stream Deck Mobile'; break;
            case 4: deviceType = 'Corsair G Keys'; break;
        }
        let row = table.insertRow(i);
        cell1 = row.insertCell(0);
        cell2 = row.insertCell(1);
        cell1.innerHTML = device.name;
        cell2.innerHTML = deviceType;
        i++;
    }
}

let mkTableBusy = false;

async function setMaterialKeysTable(devices) {
    if (mkTableBusy) {
        setTimeout(setMaterialKeysTable, 15, devices);
        return;
    }
    else {
        mkTableBusy = true;
        setTimeout(function(){mkTableBusy = false}, 10)
    }
    let table = document.getElementById('mkTable');
    for (let i=table.rows.length-1; i>0; i--) 
        table.deleteRow(i);
    
    if (devices == undefined || devices.length == 0) return;

    const temp = await getConfiguration('temp')
    if (temp.mkAllowableDevices == undefined) return;

    let length = devices.inputs.length;
    if (devices.outputs.length > length) length = devices.outputs.length;

    for (let i=0; i<length; i++) {
        let row = table.insertRow(i+1);
        cell1 = row.insertCell(0);
        cell2 = row.insertCell(1);
        let input = devices.inputs[i];
        let output = devices.outputs[i];

        if (input == undefined) cell1.innerHTML = '';
        else {
            cell1.innerHTML = input; 
            let allowableDevices = temp.mkAllowableDevices.filter(d => input.includes(d.id))
            if (allowableDevices.length > 0) {
                if (allowableDevices.find(d => d.id == temp?.LPconnected?.id)) cell1.style.color = 'green'
                else cell1.style.color = 'orange'
            }   
        }

        if (output == undefined) cell2.innerHTML = '';
        else {
            cell2.innerHTML = output;
            allowableDevices = temp.mkAllowableDevices.filter(d => output.includes(d.id))
            if (allowableDevices.length > 0) {
                if (allowableDevices.find(d => d.id == temp?.LPconnected?.id)) cell2.style.color = 'green'
                else cell2.style.color = 'orange'
            }  
        }  
    }
}