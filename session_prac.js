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

        res.sendFile(__dirname + '/session_prac.html');

        // if(req.session.views) {
        //     req.views++
        // }
        // else {
        //     req.session.guid = Math.random()
        //     req.session.views = 1
        //     console.log("new session")
        // }


        if(req.session.data) {
            console.log("req.session.data:", req.session.data)
        }

        // req.session.save(printSessionStore)
        printSessionStore()


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
    printSockets()

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
        printSessionStore()
    })


    socket.on("disconnect", () => {
        console.log("socket disconnceted\ttotal sockets:", Object.keys(io.sockets.sockets).length)
    })
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

function printSessionStore() {
    console.log("print session store")
    sessionStore.all(function(err, sessions) {
        console.log("\ttotal sessions:", Object.keys(sessions).length)
    });
}

function printSockets() {
    console.log("print sockets data")
    console.log("\ttotal sockets:", Object.keys(io.sockets.sockets).length)

    Object.keys(io.sockets.sockets).forEach(key => {
        let socket = io.sockets.sockets[key]
        if(socket.handshake.session.data) {
            console.log("\t", "data", socket.handshake.session.data)
        }
        else {
            console.log("\t", "--empty--")
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
