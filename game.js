var utils = require('./utils.js')

class Game {
    static default

    constructor(roomName, windowLengths, questionLengths)  // 
    {
        if(utils.isValidWindow(windowLengths)) {
            this.windowLengths = windowLengths
        }
        else {
            process.exit(1)
        }

        
    }

    gameState() {

    }

    StartLoop() {

    }
}


module.exports = Game