# Material Server
Material Server is a companion app for the Material Keys and Material Deck modules for Foundry VTT.<br>
The app forms a bridge between Foundry and the connected hardware device (Novation Launchpad Mk3 for Material Keys, and a Stream Deck for Material Deck). Because Foundry cannot natively support USB devices, this app is required to the modules.<br>

Get the latest release <a href="https://github.com/CDeenen/MaterialServer/releases">here</a>.<br>
Please go to the main <a href="https://github.com/CDeenen/MaterialDeck">Material Deck</a> or <a href="https://github.com/CDeenen/MaterialKeys">Material Keys</a> github page for more information on the modules.

<b>Note: </b>This app has only been tested on my Windows 10 machine. There are Linux and OSX files included, but I don't know if they work. I cannot guarantee compatibility.

## Prerequisites

### Windows
<ul>
 <li><a href="https://support.microsoft.com/en-in/help/2977003/the-latest-supported-visual-c-downloads">Microsoft Visual C++</a></li> 
 <li><a href="https://www.python.org/downloads/">Python</a></li> 
</ul>

### OSX
<ul>
 <li><a href="https://apps.apple.com/us/app/xcode/id497799835?mt=12">Xcode</a> or <a href="https://idmsa.apple.com/IDMSWebAuth/signin?appIdKey=891bd3417a7776362562d2197f89480a8547b108fd934911bcbea0110d07f757&path=%2Fdownload%2Fmore%2F&rv=1">command line tools</a></li> 
 <li><a href="https://www.python.org/downloads/">Python</a></li> 
</ul>

### Linux
<ul>
 <li>A C++ compiler</li>
 <li>You must have installed and configured <a href="https://www.alsa-project.org/wiki/Main_Page">ALSA</a></li> 
 <li><a href="https://www.python.org/downloads/">Python</a></li> 
 <li>You must install the libasound2-dev package</li>
</ul>

## Starting the app
The app can be downloaded from <a href="https://github.com/CDeenen/MaterialServer/releases">here</a>. Download and extract the archive for your operating system.<br>
If the system-specific instructions don't work, try running it from the source (see below).

#### Windows
Doubleclick MaterialServer-win.exe.

#### OSX
OSX has been giving some trouble. First, simply try doubleclicking MaterialServer-macos.<br>
If that doesn't work, try the following things:<br>
<br>
-You might have to give permission to run the executable in Preferences => Security & Privacy => Click 'Run Anyway' or 'Allow'.<br>
-You might run into the issue that OSX won't open MaterialServer-macos as an executable. Try right-clicking the executable, to 'Open in...' and select Terminal.app.<br>
-Some users had to give the proper permissions (besides through Security & Privacy) to MaterialSer-macos: Open Terminal.app, navigate to the Material Server folder, and run `chmod 755 MaterialServer-macos` (you might need to add sudo at the start)<br>
-It has been reported that there are issues with Safari's decompression algorithm. You could try downloading using a different browser, or in the Safari preferences, in the general tab, uncheck 'Open “safe” files after downloading' at the bottom. You will then have to decompress the files using some other software (such as <a href="https://setapp.com/apps/betterzip">BetterZip</a>.<br>
-If you get an error along the lines of 'midi.node can't opened because it's from unidentified developer' (should only be the case if you're trying to use Material Keys), make sure you go into Preferences => Security & Privacy and allow midi.node to run.<br>


#### Linux
Open MaterialServer-linux in the terminal

#### Running from the source
You can run Material Server from the source. This might be helpful if the executable doesn't work.<br>
<ol>
 <li>Install <a href="https://nodejs.org/en/">Node.js</a></li>
 <li>Download the <a href="https://github.com/CDeenen/MaterialServer/tree/master/src">source code</a> for you operating system</li>
 <li>Using a terminal application, browse to the folder containing MaterialServer.js</li>
 <li>Run `npm install` to make sure all dependencies are up to date</li>
 <li>Run the server using 'node MaterialServer.js'</li>
</ol>

## Connecting to Foundry
The connection to Foundry should go automatically, if the correct IP address is set in the module settings. If the app is run on the same computer as the client, the IP addres can be set as 'localhost'. Otherwise, use the IP address that the app prints after startup.<br>
The default port is 3001, but this can be changed, see below.

## Changing the port and enabling debugging
The default port is 3001, this can be changed by passing arguments into the app. You simply enter the desired port number as argument.<br>
<br>
To enable debugging, pass the following argument: 'debug'

#### Windows
In windows, you can do this using 2 ways:<br>
<ol>
<li>Create a shortcut to MaterialServer-win.exe. Right-click the shortcut, click properties. In the 'Target' textbox, at the end add the arguments. So to set the port to 4000 and enable debugging the 'Target' textbox would contain: '[pathToApp]\MaterialServer-win.exe 4000 debug'</li>
<li>Run the app from the command line. Press the 'windows' key, type 'cmd.exe' and press enter. Then either navigate to the app, or drag the app into the command prompt. Add the arguments after 'MaterialServer-win.exe'</li>
</ol>

#### OSX & Linux
Run the app from the terminal. Either navigate to the app, or drag the app into the terminal and add the arguments after 'MaterialServer-macos' or 'MaterialServer-linux'.

## Material Deck
The server should connect automatically to Foundry and the Stream Deck.

## Material Keys
### Connecting to the Launchpad
If the app is started and Material Keys is enabled in Foundry, the server will list all the detected MIDI devices on the computer. From this list it will look for the MIDI input and output devices that contain a unique string. In the case of the Launchpad Mini Mk3 on Windows this is "(LPMiniMK3 MIDI)". If the correct device is found, it will open the MIDI ports. If the correct device was not detected, it will try again after 2 seconds.<br>
Once the Launchpad is connected, it will send a message to Foundry, and it will recheck all MIDI devices to check for a disconnect. In case of a disconnect, Foundry is notified, and the above mentioned search procedure starts again.

<img src="https://github.com/CDeenen/MaterialServer/blob/master/src/img/App.png" width="1000">

### Receiving data from the Launchpad
If a key on the Launchpad is pressed, the launchpad sends a 'note on' or 'control change' message. 'Note on' for the 64 main keys, and 'control change' for the other keys. The 'note' or 'controller' parameter corresponds with the pressed key, while the 'velocity' or 'value' parameter corresponds with whether the key is pressed or released. The key and press state are then send over a websocket to Foundry, where it is further processed.

### Sending data to the Launchpad
There are various ways to send data to the Launchpad, either through normal MIDI messages, or through SysEx. In this app, only SysEx is used.<br>
In Foundry, a LED buffer is stored, which contains color and mode data on all the LEDs (the LEDs can have 3 modes: continuous, blinking and fading). When launchpad.updateLEDs() is called in Foundry, the complete LED buffer is sent over the websocket to the app, which then interprets this data and sends the correct SysEx message to the Launchpad, updating all the LEDs.<br>
Besides updating the LEDs, there are some other features, such as setting the LED brightness.

### Connecting to other MIDI devices
Right now, only the Novation Launchpad Mini Mk3 is supported. Some other products from the Launchpad lineup should work, however, some edits to the app are required.<br>
<br>
You will need to add the device to the variable midiDevices in MaterialServer.js. As an example, I've added the Launchpad Mk2 (I don't know if the information is correct).<br>
Furthermore, you will have to investigate if the rest of the protocol is compatible. There are multiple points where the program checks if the connected device is a Launchpad Mini Mk3, you'll have to add functionality for your device yourself.<br>
It is possible that you do not need to change anything, except also allowing your device to use the same code, in which case, please do not edit out the Launchpad Mini Mk3, but add yours to it:<br>
<br>
if (midiDevices[this.midiDeviceSelected].name == "Launchpad Mini Mk3" && midiDevices[this.midiDeviceSelected].name == "Launchpad Mk2")<br>
<br>
 If you then share your MaterialServer.js, other people will be able to use it as well.<br>

