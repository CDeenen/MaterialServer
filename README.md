# Material Server
Material Server is a companion app for the Material Keys and Material Deck modules for Foundry VTT.<br>
The app forms a bridge between Foundry and the connected hardware device (Novation Launchpad Mk3 for Material Keys, and a Stream Deck for Material Deck). Because Foundry cannot natively support USB devices, this app is required to the modules.<br>

<b>Note: </b>This app has only been tested on my Windows 10 machine. There are Linux and OSX files included, but I don't know if they work. I cannot guarantee compatibility.

## Starting the app
The app can be downloaded from <a href="https://github.com/CDeenen/MaterialServer/releases">here</a>. Run MaterialServer-win.exe.<br>
For OSX or Linux users, you should run MaterialServer-macos or MaterialServer-linux, respectively. As stated before, I do not know if they work.

# Connecting to Foundry
The connection to Foundry should go automatically, if the correct IP address is set in the module settings. If the app is run on the same computer as the client, the IP addres can be set as 'localhost'. Otherwise, use the IP address that the app prints after startup.<br>
The default port is 3001, but this can be changed in MaterialServer.js.

# Material Deck
The server should connect automatically.

# Material Keys
## Connecting to the Launchpad
If the app is started, it will list all the detected MIDI devices on the computer. From this list it will look for the MIDI input and output devices that contain a unique string. In the case of the Launchpad Mini Mk3 this is "(LPMiniMK3 MIDI)". If the correct device is found, it will open the MIDI ports. If the correct device was not detected, it will try again after 2 seconds.<br>
Once the Launchpad is connected, it will send a message to Foundry, and it will recheck all MIDI devices to check for a disconnect. In case of a disconnect, Foundry is notified, and the above mentioned search procedure starts again.

<img src="https://github.com/CDeenen/MaterialServer/blob/master/src/img/App.png" width="1000">

## Receiving data from the Launchpad
If a key on the Launchpad is pressed, the launchpad sends a 'note on' or 'control change' message. 'Note on' for the 64 main keys, and 'control change' for the other keys. The 'note' or 'controller' parameter corresponds with the pressed key, while the 'velocity' or 'value' parameter corresponds with whether the key is pressed or released. The key and press state are then send over a websocket to Foundry, where it is further processed.

## Sending data to the Launchpad
There are various ways to send data to the Launchpad, either through normal MIDI messages, or through SysEx. In this app, only SysEx is used.<br>
In Foundry, a LED buffer is stored, which contains color and mode data on all the LEDs (the LEDs can have 3 modes: continuous, blinking and fading). When launchpad.updateLEDs() is called in Foundry, the complete LED buffer is sent over the websocket to the app, which then interprets this data and sends the correct SysEx message to the Launchpad, updating all the LEDs.<br>
Besides updating the LEDs, there are some other features, such as setting the LED brightness.

## Connecting to other MIDI devices
Right now, only the Novation Launchpad Mini Mk3 is supported. Some other products from the Launchpad lineup should work, however, some edits to the app are required.<br>
<br>
You will need to add the device to the variable midiDevices in midiBridge.js. As an example, I've added the Launchpad Mk2 (I don't know if the information is correct).<br>
Furthermore, you will have to investigate if the rest of the protocol is compatible. There are multiple points where the program checks if the connected device is a Launchpad Mini Mk3, you'll have to add functionality for your device yourself.<br>
It is possible that you do not need to change anything, except also allowing your device to use the same code, in which case, please do not edit out the Launchpad Mini Mk3, but add yours to it:<br>
<br>
if (midiDevices[this.midiDeviceSelected].name == "Launchpad Mini Mk3" && midiDevices[this.midiDeviceSelected].name == "Launchpad Mk2")<br>
<br>
 If you then share your midiBridge.js, other people will be able to use it as well.<br>

