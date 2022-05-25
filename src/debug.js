const util = require('util')
let eventEmitter;

const consoleMethodNames = ['log','warn','error']

const messages = [];

global.cnsl = {};

function configureLogging(eventEm, cons, orgn) {
  eventEmitter = eventEm;
  consoleMethodNames.forEach(consoleMethodName => {
    const originalMethod = (global.cnsl[consoleMethodName] = cons[consoleMethodName])
  
    cons[consoleMethodName] = function () {
      // save the original message (formatted into a single string)
      // use "util.format" to perform string formatting if needed
      const params = Array.prototype.slice.call(arguments, 1)
      const origin = orgn;
      const message = params.length
        ? util.format(arguments[0], ...params)
        : arguments[0]
      messages.push({
        type: consoleMethodName, // "log", "warn", "error"
        message
      })
  
      // call the original method like "console.log"
      originalMethod.apply(cons, arguments)

      eventEmitter.emit('console', consoleMethodName, origin, message);
      //win.webContents.send('asynchronous-message',{data: 'console',type: consoleMethodName, message})
    }
  })
}

module.exports = {configureLogging};