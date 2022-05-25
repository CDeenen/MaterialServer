console.log('Starting app');

const { app, BrowserWindow, Tray, Menu, ipcMain } = require('electron');
const path = require('path');
const url = require('url');
const { initializeMaterialPlane, changePort } = require('./moduleData/materialPlane');
const { getConfiguration, getSetting, saveConfiguration, saveSetting, deleteFile, waitForSaveBuffer, setEventEmitter } = require('./misc');
const { initializeWebsocket } = require('./websocket')
const { configureLogging } = require('./debug')

const EventEmitter = require('events')
const eventEmitter = new EventEmitter()
setEventEmitter(eventEmitter);

let win;
let tray = null;

process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';

configureLogging(eventEmitter,console,'main app')

async function createWindow() {
    const runInTray = await getSetting('runInTray');
    const startOpen = await getSetting('startOpen','temp');

    win = new BrowserWindow({
        show: false,
        width: 500,
        minWidth: 500,
        maxWidth: 500,
        height: 800,
        minHeight: 800,
        icon: path.join(__dirname, 'app', 'images', 'icons', 'png','48x48.png'),
        backgroundColor: '#4f4f4f',
        webPreferences: {
            contextIsolation: false,
            nodeIntegration: true
        }
    });
    
    win.loadURL(url.format({
        pathname: path.join(__dirname, 'app', 'index.html'),
        protocol: 'file',
        slashes: true
    }));

    win.removeMenu();

    win.webContents.on('before-input-event', (event,input)=>{
        if (input.type == 'keyDown' && input.key == 'F12') {
            if (!win.webContents.isDevToolsOpened()) win.webContents.openDevTools();
            else win.webContents.closeDevTools();
        }
        if (input.type == 'keyDown' && input.key == 'F5') {
            win.reload();
        }
    })

    //win.webContents.openDevTools();

    win.once('ready-to-show', async () => {
        
        if (!runInTray || startOpen) win.show();
        
        //Initialize Material Plane compatibility
        await initializeMaterialPlane(eventEmitter);

        initializeWebsocket(app,eventEmitter);
    })

    win.on('minimize',async function(event){
        const runInTray = await getSetting('runInTray');
        
        if (runInTray) {
            event.preventDefault();
            win.hide();
        }
    });
    
    win.on('close', async function (event) {
        const runInTray = await getSetting('runInTray');
        if(runInTray && !app.isQuiting){
            event.preventDefault();
            win.hide();
        }
        return false;
    });
    
    win.on('closed', () => {
        win = null;
    })
}

app.on('activate', () => {
    if (win === null) {
        createWindow();
    }
});

app.on('ready', async () => {

    const runInTray = await getSetting('runInTray');
    configureTray(runInTray);

    deleteFile('temp')

    createWindow();
});

function configureTray(en) {
    if (en) {
        tray = new Tray(path.join(__dirname, 'app', 'images', 'icons', 'png','48x48.png'))
        const contextMenu = Menu.buildFromTemplate([
        { label: 'Open', click() { win.show() } },
        { label: 'Quit', click() { app.quit() }}
        ])
        tray.setToolTip('Material Server')
        tray.setContextMenu(contextMenu)

        tray.on('click', () => {
            if (!win.isVisible()) win.show();
        })
    }
    else {
        if (tray != null) tray.destroy();
        tray = null;
    }
        
}

function relaunchApp() {
    app.relaunch();
    app.exit();
}

ipcMain.on('asynchronous-message', async (event, arg) => {
    event.reply('asynchronous-reply', 'pong')
    if (arg == 'runInTrayChanged' || arg == 'wsPortChanged') {
        await saveSetting('startOpen',true, 'temp');
        waitForSaveBuffer();
        setTimeout(relaunchApp,1000);
    }
    else if (arg == 'enableUSBChanged') {
        await saveSetting('startOpen',true, 'temp');
        waitForSaveBuffer();
        setTimeout(relaunchApp,1000);
    }
    else if (arg == 'USBComChanged') {
        changePort(await getSetting('mpComPort'))
    }
})
  
ipcMain.on('synchronous-message', (event, arg) => {
    event.returnValue = 'pong'
});

eventEmitter.on('ws', (data, arg1, arg2, arg3) => {
    if (data == 'connected') {
        win.webContents.send('asynchronous-message',{
            data,
            target: arg1,
            state: arg2
        });
    }
    else if (data == 'mdDevices' || data == 'mkDevices' || data == 'mkAllowableDevices') {
        win.webContents.send('asynchronous-message',{
            data,
            devices: arg1
        });
    }
})

eventEmitter.on('restartApp', () => {
    console.log('restarting');
    relaunchApp();
})

eventEmitter.on('console',(type, origin, message) => {
    win.webContents.send('asynchronous-message',{data: 'console', type, origin, message})
})