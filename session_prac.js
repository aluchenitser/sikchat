/* ------------------- PRACTICE HOW SOC ------------------- */

const express = require('express')

var session = require('express-session');

var MemoryStore = require('memorystore')(session)
var sessionStore = new MemoryStore({
    checkPeriod: 86400000 // prune expired entries every 24h
})

const app = express()

const http = require('http').Server(app)
const io = require('socket.io')(http)

// const cookieParser = require('cookie-parser')     
// app.use(cookieParser());

app.use(express.static(__dirname + "/public/"));
// app.use(express.json());

sharedsession = require("express-socket.io-session");

var expressSession = session({
    secret: "dork breath",
    key: "sesh_sid",
    resave: true,      
    saveUninitialized: false,
    store: sessionStore
    // cookie: {
    //     expires: 600000
    // }
})

app.use(expressSession);

io.use(sharedsession(expressSession, {
    autoSave: true
}))

var dayjs = require('dayjs')

const Game = require('./game_prac.js')

/* ------------------- ROUTER ------------------- */

app.route('/')
    .get((req, res) => {
        console.log('get /')
        res.sendFile(__dirname + '/session_prac.html');

        if(req.session.views) {
            req.views++
        }
        else {
            req.session.guid = Math.random()
            req.session.views = 1
            console.log("new session")
        }

        // req.session.save(() => {
            printSessions("print sessions (get /)")
        // })


        // req.session.derp = "derperoo!"
        // console.log(req.session)
        // if (req.session.user && req.cookies.sik_sid) {
        //     console.log("-- existing session --")
        // }
        // else {
        //     console.log("-- new session --")
        //     userRepo[req.session.user.guid] = req.session.user
        // }

        // res.cookie("sik_user", JSON.stringify(mapRepoUserToClientUser(req.session.user)), {path: "/", expires: dayjs().add(7,"d").toDate()});
        // res.cookie("sik_rooms", JSON.stringify(roomList), {path: "/", expires: dayjs().add(7,"d").toDate()});

    })

/* ------------------- SOCKETS ------------------- */

let game = new Game({ io });
let outerInterval = null

io.on('connection', socket => {
    console.log("new socket connected")
    printSocketSessions("print sessions (socket)")

    // socket.on("start_game", () => {
    //     start_outside()
    //     game.start();
    // })
    
    // socket.on("stop_game", () => {
    //     stop_outside()
    //     game.stop();
    // })

    socket.on("data", dataFromClient => {
        console.log(`socket.handshake.session.data = ${dataFromClient}`)
        socket.handshake.session.data = dataFromClient
        // socket.handshake.session.save()
    })

    socket.on("retrieve", () => {
        console.log("--retrieving:", socket.handshake.session.data)
        socket.emit("retrieve_response", socket.handshake.session.data)
    })


    socket.on("disconnect", () => {
        console.log("socket disconnceted\n\tsockets:", Object.keys(io.sockets.sockets).length)
    })
});




function printSessions(msg) {
    console.log(msg)
    sessionStore.all(function(err, sessions) {
        console.log("\ttotal sessions:", Object.keys(sessions).length)
        Object.keys(sessions).forEach(sess => {
            console.log("\t\t", "data", sessions[sess].data, "guid", sessions[sess].guid, "views", sessions[sess].views)
        })
        
    });
}

function printSocketSessions(msg) {
    console.log(msg)
    console.log(`\tsockets: ${Object.keys(io.sockets.sockets).length}\n\tdata, guid, views`)

    Object.keys(io.sockets.sockets).forEach(key => {
        let socket = io.sockets.sockets[key]
        if(socket.handshake.session) {
            console.log("\t\t", "data", socket.handshake.session.data, "guid", socket.handshake.session.guid, "views", socket.handshake.session.views)
        }
        else {
            console.log("\t\t", "--empty--")
        }
    })
}



/* ------------------- WEB SERVER ------------------- */

// command line port selection or default to 3000
let port = parseInt(process.argv[2]);
port = port && port >= 1023 && port <= 65535
    ? port
    : 3001;

http.listen(port, function() {
    console.log(`listening on *:${port}\n`);
});




/* ------------------- SESSION LOOPER ------------------- */



// function start_outside() {
//     let interval = 0

//     if(outerInterval) return;

//     outerInterval = setInterval(() => {
//         console.log("outside------", interval)
//         // console.log("Number of sockets:", Object.keys(io.sockets.sockets).length)
//         console.log("Session list:")
    
//         Object.keys(io.sockets.sockets).forEach(key => {
//             let socket = io.sockets.sockets[key]
//             console.log("\t", socket.handshake.session.guid, "views:", socket.handshake.session.guid)
//         })
        
//         interval++
//     }, 2500)
// }

// function stop_outside() {
//     clearInterval(outerInterval)
// }