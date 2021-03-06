
/* SIKCHAT - THE SIKKEST CHAT AMIRITE */

/* ------------------- DEPENDENCIES ------------------- */

const express = require('express')

const { Sequelize, DataTypes } = require('sequelize');

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
const {printUserRepo, getRoomUsers, printSessions, printSocketSessions, getUserSocket} = require('./utils.js')

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

/* ------------------- CUSTOM MODULES ------------------- */

const Game = require('./game.js')
const { defineUsers } = require('./sik_db.js')


/* ------------------- DEBUG MODES ------------------- */

if(process.argv[2] == "--host" || process.argv[2] == "-h") {
    require('./debug.js').host()
    return;
}

/* ------------------- DATABASE SETUP ------------------- */


// (async() => {
    //     try {
        //         await sequelize.authenticate();
        //         console.log('Connection has been established successfully.');
        //         const Users = await defineUsers(sequelize);
        //         const queryResult = await Users.findAll();
        //         console.log("All users:", JSON.stringify(queryResult, null, 2))
        //     } catch (error) {
            //         console.error('Unable to connect to the database:', error);
            //     }
            // })();
            
            





// defineUsers(sequelize).findAll()
// console.log("All users:", JSON.stringify(users, null, 2));
// return;

/* ------------------- GENERAL SETUP ------------------- */

roomList = ["lobby", "history", "slang", "maps", "madlibs", "history II", "slang II", "people"]

var userRepo = {};             // stores user accounts, { email: user } for registered and { guid: user } for free
var chatCount = 0

/* ------------------- ROUTER ------------------- */

app.route('/')
    .get(function(req, res) {
        console.log("------ START GET / ------")

        res.sendFile(__dirname + '/index.html');
        res.cookie("sik_debug", "false", {path: "/"});
        
        let isNewUser = false

        if (!(req.session.user && req.cookies.sik_sid)) {
            req.session.user = new User({})                           // blank account until the user logs in or registers
            userRepo[req.session.user.guid] = req.session.user
            isNewUser = true
        }

        console.log(isNewUser ? "created blank user" : "existing user found")
        
        let user = req.session.user
        console.log(user)
        // console.log("\t", user.guid, user.username, user.email, user.password, user.guid, user.answered, user.points)

        printUserRepo(userRepo, "user repo at get /")
        // printSessions(sessionStore, "sessions at get /")
        // printSocketSessions(io, "get / socket sessions")
      
        console.log("------ END GET / ------")
        
        // update client
        res.cookie("sik_user", JSON.stringify(mapRepoUserToClientUser(req.session.user)), {path: "/", expires: dayjs().add(7,"d").toDate()});
        res.cookie("sik_rooms", JSON.stringify(roomList), {path: "/", expires: dayjs().add(7,"d").toDate()});

    })
    .post((req, res) => {
        console.log("post /")

        if(req.session.user && req.cookies.sik_sid) {
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
                    printUserRepo(userRepo, "user repo at post/")

                    
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

app.get('/dashboard', (req, res) => {
    console.log("-- entered dashboard --")

    res.sendFile(__dirname + '/dashboard/dashboard.html');
})



/* ------------------- WEB SERVER ------------------- */
            
const sequelize = new Sequelize('postgres://allanluchenitser:@localhost:5432/sikchat');
// command line port selection or default to 3000
let port = parseInt(process.argv[2]);
port = port && port >= 1023 && port <= 65535
    ? port
    : 3000;


sequelize.sync().then(() => {
    http.listen(port, function() {
        console.log(`listening on *:${port}`);
    });
});

/* ----------------- GAME LOOPS ----------------- */


let lobby = new Game({room: "lobby", io, userRepo, sessionStore})
lobby.start()

// let history = new Game("history", io, userRepo)
// history.start()

// let history = new Game("history", io, userRepo)
// history.start()

/* ------------------- SOCKETS ------------------- */
let disconnectTimers = {}

io.on('connection', socket => {

    console.log("socket connection")

    if(socketSessionUserHasProperty(socket, "room")) {
        clearTimeout(disconnectTimers[socket.handshake.session.user.guid])
        
        socket.join(socket.handshake.session.user.room, () => {
            let chatList = getRoomUsers(io, socket.handshake.session.user.room)
            if(chatList.length > 0) {
                io.to(socket.handshake.session.user.room).emit("chat_list_response", chatList)
            }
        })
    }
    else {
        console.log("\tdoes not have room\n\treload_page")
        socket.emit("reload_page")
    }

    socket.on('chat_message', (text) => {      
        
        // chatCount helps the client to decorate individual messages with visual effects
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
        // console.log("chat:", chatMessage.username, chatMessage.text)
        io.to(socket.handshake.session.user.room).emit('chat_message_response', chatMessage);
        
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
    
    // socket.on("chat_list", requestingGuid => {
    //     let users = getRoomUsers(io, socket.handshake.session.user.room, requestingGuid)
    //     socket.emit("chat_list_response", users)
    // })

    socket.on("pm_window", guid => {
        let data = getUserSocket(io, guid)     // { guid, username, socket }

        if(data) {
            delete data.socket
            socket.emit("pm_window_success", data)
        }
    })

    // sends pm chat to recipient and echos to client
    socket.on("pm_chat", data => {          // { msg, username, sender_guid, recipient_guid }
        socket.emit("pm_chat_response", data)
        getUserSocket(io, data.recipient_guid).socket.emit("pm_chat_response", data)
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

    socket.on('username_update', username => {        
        console.log("username_update request")
            printUserRepo(userRepo, "userRepo prior username_update")
            printSessions(sessionStore, "sessions prior username_update")
            printSocketSessions(io, "socket sessions prior username_update")

        let foundDuplicate = false;
        
        for(var i in userRepo) {
            if(userRepo[i].username == username && userRepo[i].guid != socket.handshake.session.user.guid) {
                foundDuplicate = true
                break;
            }
        }

        if(foundDuplicate == false) {
            socket.handshake.session.user.username = username
            socket.handshake.session.save()

            // update repo for registered accounts
            userRepo[socket.handshake.session.user.guid] = socket.handshake.session.user
        }
        
        socket.emit('username_update_response', { username: username, foundDuplicate });

        let chatList = getRoomUsers(io, socket.handshake.session.user.room)
        io.to(socket.handshake.session.user.room).emit("chat_list_response", chatList)


        console.log(`username_update_response\n\t${username} foundDuplicate: ${foundDuplicate}`);
    })

    socket.on('disconnecting', () => {

        let chatList = []
        try {
            chatList = getRoomUsers(io, socket.handshake.session.user.room, socket.handshake.session.user.guid)
        } catch(e) { 
            console.log("disconnecting error catch")
            console.log(socket.handshake.session.user)
            return;
        }
        
     
        // this is to lessen network traffic when the user refreshes the page
        let timer = setTimeout(() => {
            io.to(socket.handshake.session.user.room).emit("chat_list_response", chatList)
            delete disconnectTimers[socket.handshake.session.user.guid]
        }, 1000)

        disconnectTimers[socket.handshake.session.user.guid] = timer
    });
});


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

function socketSessionUserHasProperty(socket, property) {
    return socket.handshake.session && socket.handshake.session.user && socket.handshake.session.user[property]
        ? true
        : false
}

