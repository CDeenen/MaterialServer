const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
let eventEmitter;

const defaultConfiguration = {
    port: 3001,
    runInTray: false,
    enableUSB: false,
    mpComPort: undefined
}

const setEventEmitter = (em) => {
    eventEmitter = em;
}

/**
 * Get configuration
 */
const getConfiguration = async (fileName = 'configuration', type = 'text') => {
    try {
        if (!fs.existsSync(path.join(__dirname, fileName))) {
            const conf = fileName == 'temp' ? {} : defaultConfiguration;
            //console.log(`Creating new file ${fileName}`);
            await fsPromises.writeFile(path.join(__dirname, fileName), JSON.stringify(conf));
            return conf;
        }
        else {
            //console.log(`Reading file ${fileName}`);
            let newData, counter;
            while (newData == '' || newData == undefined) {
                newData = await fsPromises.readFile(path.join(__dirname, fileName), 'utf8');
                counter++;
                if (counter >= 10) {
                    console.log(`Failed to read file ${fileName}`)
                    return;
                }
            }
            //console.log('newData',newData)
            let configuration = type == 'text' ? JSON.parse(newData) : newData ;
            return configuration; 

        }
    } catch (err) {
        console.log(err);
    }
}

/**
 * Get single setting in configuration
 */
 const getSetting = async (key, fileName = 'configuration') => {
    let configuration = await getConfiguration(fileName);
     if (configuration[key] == undefined) await getConfiguration(fileName);
    return configuration[key];
}

/**
 * Save configuration
 */
const saveConfiguration = async (configuration, fileName = 'configuration') => {
    try {
        return await fsPromises.writeFile(path.join(__dirname, fileName), JSON.stringify(configuration));
    } catch (err) {
        console.err(err);
    }
}

let saveBuffer = [];

/**
 * Save single setting in configuration
 */
const saveSetting = async (key, value, fileName = 'configuration') => {
    saveBuffer.push({key,value,fileName});
    var promise = new Promise(function(resolve,reject){
        setTimeout(function(){
            resolve(true);
        },100)
    })
    return promise;
}

const saveToBuffer = async () => {
    while (saveBuffer.length > 0) {
        setting = saveBuffer[0];
        saveBuffer.shift();
        let configuration = await getConfiguration(setting.fileName);
        //console.log('configuration',configuration)
        //console.log('key',setting.key, 'value',setting.value, 'fileName',setting.fileName)
        configuration[setting.key] = setting.value;
        //console.log('saveSetting', key, value, configuration, fileName)
        await saveConfiguration(configuration, setting.fileName);
    }
    setTimeout(saveToBuffer,100);
}

const waitForSaveBuffer = () => {
    if (saveBuffer.length > 0) setTimeout(waitForSaveBuffer,100);
    else eventEmitter.emit('restartApp');
}

const deleteFile = (fileName) => {
    if (fs.existsSync(path.join(__dirname, fileName))) {
        try {
            fs.unlinkSync(path.join(__dirname, fileName))
            //file removed
        } catch(err) {
            console.error(err)
        }
    }
}

saveToBuffer();

module.exports = { getConfiguration, getSetting, saveConfiguration, saveSetting, deleteFile, waitForSaveBuffer, setEventEmitter }