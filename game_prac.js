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
        if(this.interval) return;
        let interval = 0

        this.interval = setInterval(() => {
            console.log("inside------", interval)
            // console.log("Number of sockets:", Object.keys(this.io.sockets.sockets).length)
            console.log("Session list:")

            Object.keys(this.io.sockets.sockets).forEach(key => {
                let socket = this.io.sockets.sockets[key]
                console.log("\t", socket.handshake.session.guid, "views:", socket.handshake.session.guid)
            })

            interval++

        }, 2500)
        // this.alterSocket()
        // console.log("started!")
    }

    stop() {
        clearInterval(this.interval)
        this.interval = null
    }

    clearUsers() {
        // let sockets = this.io.sockets.sockets

        // Object.keys(sockets).forEach(key => {
        //     let socket = sockets[key]
        //     console.log(socket.handshake.session.user)
        // })
    }

    showUsers() {
        let sockets = this.io.sockets.sockets

        Object.keys(sockets).forEach(key => {
            let socket = sockets[key]
            console.log(socket.handshake.session.user)
        })
    }
}    
