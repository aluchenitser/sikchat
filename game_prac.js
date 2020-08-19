const fs = require('fs');

var dayjs = require('dayjs')
    var isSameOrAfter = require('dayjs/plugin/isSameOrAfter')
    var advancedFormat = require('dayjs/plugin/advancedFormat')
    dayjs.extend(isSameOrAfter)
    dayjs.extend(advancedFormat)




module.exports = class Game {
    constructor({ io, room = "lobby"})
    {
        this.room = room
        this.io = io
        this.interval = null
    }

    start() {
        this.interval = setInterval(() => {
            
        }, 1000)
        this.alterSocket()
        console.log("started!")
    }

    stop() {

    }

    alterSocket() {
        let sockets = this.io.sockets.sockets

        Object.keys(sockets).forEach(key => {
            let socket = sockets[key]
            console.log(socket.handshake.session)
        })
    }
}    
