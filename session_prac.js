/* ------------------- PRACTICE HOW SOC ------------------- */

const express = require('express')

var session = require('express-session');
const app = express()

const http = require('http').Server(app)
const io = require('socket.io')(http)

// const cookieParser = require('cookie-parser')     
// app.use(cookieParser());

app.use(express.static(__dirname + "/public/"));
app.use(express.json());

sharedsession = require("express-socket.io-session");

var expressSession = session({
    secret: "dork breath",
    key: "sesh_sid",
    resave: false,      
    saveUninitialized: false,
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

        req.session.user = "joe"
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

io.on('connection', socket => {
    console.log("socket connected")
    console.log("total sockets: ", Object.keys(io.sockets.sockets).length)

    if(socket.handshake.session) {
        console.log("socket session found:")
        console.log(socket.handshake.session)
    }
    else {
        console.log("no socket session found")
    }



    // TODO: clients gets by without any cookie data socket.io reconnects a dead session without a page refresh .. just need to reload page for now
});

/* ------------------- WEB SERVER ------------------- */

// command line port selection or default to 3000
let port = parseInt(process.argv[2]);
port = port && port >= 1023 && port <= 65535
    ? port
    : 3001;

http.listen(port, function() {
    console.log(`listening on *:${port}`);
});
