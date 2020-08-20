
/* SIKCHAT - THE SIKKEST CHAT AMIRITE */

/* ------------------- DEPENDENCIES ------------------- */

const express = require('express')

var session = require('express-session');
var MemoryStore = require('memorystore')(session)
var sessionStore = new MemoryStore({
    checkPeriod: 86400000 // prune expired entries every 24h
  })


const app = express()

const http = require('http').Server(app)
const io = require('socket.io')(http)

const cookieParser = require('cookie-parser')     
app.use(cookieParser());

const User = require('./user.js')
app.use(express.static(__dirname + "/public/"));
app.use(express.json());

sharedsession = require("express-socket.io-session");

var expressSession = session({
    secret: "dajfklhsl&&3fhalskfasfd",
    store: sessionStore,
    key: "sik_sid",
    resave: false,      
    saveUninitialized: false,
    cookie: {
        expires: 600000
    }
})

app.use(expressSession);

io.use(sharedsession(expressSession, {
    autoSave: true
}))

var dayjs = require('dayjs')
    var isSameOrAfter = require('dayjs/plugin/isSameOrAfter')
    var advancedFormat = require('dayjs/plugin/advancedFormat')
    dayjs.extend(isSameOrAfter)
    dayjs.extend(advancedFormat)

const Game = require('./game.js')


/* ------------------- DEBUG MODES ------------------- */

if(process.argv[2] == "--host" || process.argv[2] == "-h") {
    require('./debug.js').host()
    return;
}

/* ------------------- SETUP ------------------- */

roomList = ["lobby", "history", "slang", "maps", "madlibs", "history II", "slang II", "people"]

var userRepo = {};             // stores user accounts, { email: user } for registered and { guid: user } for free
var chatCount = 0

/* ------------------- ROUTER ------------------- */

app.route('/')
    .get(function(req, res) {
        // debugger;
        console.log("get /")

        res.sendFile(__dirname + '/index.html');
        res.cookie("sik_debug", "false", {path: "/"});
        
        if (req.session.user && req.cookies.sik_sid) {
            req.session.user.room = req.session.user.room || "lobby"

            console.log("existing user found")
            printUser(req.session.user)
            printUserRepo("user repo at get/")
            printSessionUsers("sessions at get /")
        }
        else {
            req.session.user = new User({})                           // blank account until the user logs in or registers
            userRepo[req.session.user.guid] = req.session.user

            console.log("created blank user")
            printUser(req.session.user)
            printUserRepo("user repo at get/")
            printSessionUsers("sessions at get /")

        }

        res.cookie("sik_user", JSON.stringify(mapRepoUserToClientUser(req.session.user)), {path: "/", expires: dayjs().add(7,"d").toDate()});
        res.cookie("sik_rooms", JSON.stringify(roomList), {path: "/", expires: dayjs().add(7,"d").toDate()});

    })
    .post((req, res) => {
        console.log("post /")

        if (req.session.user && req.cookies.sik_sid) {
            // register new login
            if(req.body.register == true) {
                console.log(" -- registration attempt -- ")

                if(userRepo.hasOwnProperty(req.body.email)) {
                    console.log("duplicate email")
                    res.send("duplicate email")
                    console.log(" -- registration failed -- ")
                }
                else {

                    let user = new User({ email: req.body.email, password: req.body.password, username: req.body.username, isRegistered: true})   // newly registered user has default username of "someone"
                    delete userRepo[req.session.user.guid]

                    // update session and add to user repo
                    req.session.user = user
                    userRepo[req.body.email] = user

                    console.log("registration success")
                    printUserRepo("user repo at post/")

                    
                    res.send({ username: user.username, msg: "registration success" })
                    console.log("registration success")
                }
            }

            // existing login (session likely expired)
            else {
                console.log("login attempt")
                if(userRepo.hasOwnProperty(req.body.email) && userRepo[req.body.email].password == req.body.password) {
                    let user = userRepo[req.body.email]
                    req.session.user = user
                    res.cookie("sik_user", JSON.stringify(mapRepoUserToClientUser(req.session.user)), {path: "/", expires: dayjs().add(7,"d").toDate()});
                    res.send({ username: user.username, msg: "success" })
                    console.log("login success")
                }
                else {
                    res.send("failed login")
                    console.log("login failed")
                }
            }
        }
        else { res.statusCode(403) }
    })

app.get('/logout', (req, res) => {
    console.log("-- logout attempt --")

    req.session.destroy((err) => {
        res.redirect('/')
    })
})

/* ----------------- GAME LOOPS ----------------- */


let lobby = new Game("lobby", io, userRepo)
lobby.start()

// let history = new Game("history", io, userRepo)
// history.start()

// let history = new Game("history", io, userRepo)
// history.start()

/* ------------------- SOCKETS ------------------- */

io.on('connection', socket => {
    // TODO: clients gets by without any cookie data socket.io reconnects a dead session without a page refresh .. just need to reload page for now

    console.log("socket connection")

    if(socket.handshake.session) {
        console.log("\thas session")
    }
    else {
        console.log("\tdoes not have session")
    }
    if(socket.handshake.session && socket.handshake.session.user) {
        console.log("\thas user")
    }
    else {
        console.log("\tdoes not have user")
    }
    if(socket.handshake.session && socket.handshake.session.user && socket.handshake.session.user.room) {
        console.log("\thas room:", socket.handshake.session.user.room)
        socket.join(socket.handshake.session.user.room)
    }
    else {
        console.log("\tdoes not have room\n\treload_page")
        socket.emit("reload_page")
    }

    socket.on('chat_message', (text) => {      
        // console.log(text)     
        
        // chatCount allows the client to decorate individual messages with visual effects
        try {
            var chatMessage = {
                text: text,
                chatCount: chatCount,
                guid: socket.handshake.session.user.guid,
                username: socket.handshake.session.user.username
            }
        } catch(e) {
            console.log("chatMessage error")
            return
        }

        // broadcast to the room
        console.log("chat:", chatMessage.username, chatMessage.text)
        io.to(socket.handshake.session.user.room).emit('chat_message_response', chatMessage);
        // io.emit('chat_message_response', chatMessage);
        
        // per game behavior
        switch(socket.handshake.session.user.room) {
            case 'lobby': 
                lobby.submitAnswer(text, socket, chatCount)
                break;
            case 'history': 
                history.submitAnswer(text, socket, chatCount)
                break;
            default:
        }

        chatCount++
    })
    
    socket.on('room_change', (room_name_new) => { 
        console.log("received room_change request:", room_name_new)

        let room_name_old = socket.handshake.session.user.room
        
        if(roomList.indexOf(room_name_new) > -1 && room_name_new != room_name_old) {

            console.log("room_change processing")
            socket.leave(room_name_old, () => {
                console.log("left room:", room_name_old)
    
                socket.join(room_name_new, () => {
                    socket.handshake.session.user.room = room_name_new
                    console.log("joined room:", room_name_new)
                    socket.emit("room_change_response", room_name_new)
                })
            })
        }
        // Object.keys(socket.rooms).filter(name => name.startsWith("sik"))[0]
    })

    socket.on('username_update', (username) => {         // socket.handshake.session added to the socket by socket.handshake.session
        
        let foundDuplicate = false;
        
        for(var i in userRepo) {
            if(userRepo[i].username == username && userRepo[i] != socket.handshake.session.user) {
                foundDuplicate = true
                break
            }
        }

        if(foundDuplicate == false) {
            socket.handshake.session.user.username = username

            // update repo for registered accounts
            if(userRepo.hasOwnProperty(socket.handshake.session.user.email)) {
                userRepo[socket.handshake.session.user.email] = socket.handshake.session.user
            }
        }
        
        socket.emit('username_update_response', { username: username, foundDuplicate });
        console.log(`username_update_response\n\t${username} foundDuplicate: ${foundDuplicate}`);
    })

    socket.on('disconnect', () => {
        // console.log('user disconnected');
    });
});

/* ------------------- WEB SERVER ------------------- */

// command line port selection or default to 3000
let port = parseInt(process.argv[2]);
port = port && port >= 1023 && port <= 65535
    ? port
    : 3000;

http.listen(port, function() {
    console.log(`listening on *:${port}`);
});

/* ------------------- WINDOW FUNCTIONS ------------------- */


/* ------------------- QBANK FUNCTIONS ------------------- */

/* ------------------ USER FUNCTIONS ------------------- */


function printUserRepo(msg) {
    console.log(msg)
    console.log("\tkey, username, email, password, guid, answered, points")
    for(var key in userRepo) {
        printUser(userRepo[key])
    }
}

function printUser(user) {
    console.log("\t", user.username, user.email, user.password, user.guid, user.answered, user.points)
}

function printSessionUsers(msg) {
    console.log(msg)
    // console.log("\tkey, username, email, password, guid, answered, points")

    sessionStore.all(function(err, sessions) {

        console.log("\tnumber of sessions:", Object.keys(sessions).length)
        // if err handle err
        // iterate over sessions array
    });
}

/* ------------------ UTILITY FUNCTIONS ------------------- */

function mapRepoUserToClientUser(user) {
    let clone = JSON.parse(JSON.stringify(user))
    delete clone.created
    delete clone.last
    delete clone.email
    delete clone.password
    
    clone.isRegistered = user.email == null ? false : true              // toggles whether they see logout or register/login

    return clone
}

