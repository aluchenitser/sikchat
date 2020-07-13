
const express = require('express')
const app = express()
const http = require('http').Server(app)
const io = require('socket.io')(http)
const cookieParser = require('cookie-parser')
const help = require('./help.js')

var dayjs = require('dayjs')
var isSameOrAfter = require('dayjs/plugin/isSameOrAfter')
dayjs.extend(isSameOrAfter)

app.use(cookieParser());
app.use(express.static(__dirname + "/public/"));

/* ------------------- SETUP ------------------- */
var usersRepo = [];

const MINUTES_ALLOTED_FOR_TIME_SLOT = 1;
const SECONDS_BETWEEN_GAMES = 20;

var gameState = {
    isActive: false,
    starts: null,
    ends: null
}

/* ----------------- GAME LOOP ----------------- */

setInterval(() => {
    // console.log("tick");
    console.log(dayjs().format("[---now\t minutes: ]m [seconds: ]s"));

    
    // set time window for incoming game
    if(gameState.isActive == false && gameState.starts == null) { 

        let now = dayjs()

        // round up to next multiple of TIME_SLOT_MINUTES
        let gameStart = dayjs().minute(
            Math.ceil(
                now.minute() / MINUTES_ALLOTED_FOR_TIME_SLOT == now.minute() 
                ? now.minute() + MINUTES_ALLOTED_FOR_TIME_SLOT 
                : now.minute() / MINUTES_ALLOTED_FOR_TIME_SLOT
            ) * MINUTES_ALLOTED_FOR_TIME_SLOT
        ).second(0)

        let gameEnd = gameStart.add(MINUTES_ALLOTED_FOR_TIME_SLOT, "m").subtract(SECONDS_BETWEEN_GAMES, "s");

        let dNow = now.format()
        let dStart = gameStart.format()
        let dEnd = gameEnd.format()

        
        console.log(gameStart.format("[gameStart\t minutes: ]m [seconds: ]s"));
        console.log(gameEnd.format("[gameEnd\t\t minutes: ]m [seconds: ]s"));


        gameState.starts = gameStart;
        gameState.ends = gameEnd
    }
    
    if(dayjs().isSameOrAfter(gameState.starts) && gameState.isActive == false) {
        gameState.isActive = true
        console.log("game started")
        // io.emit("start_game", Date.now())
    }
     
    if(dayjs().isSameOrAfter(gameState.ends)) {
        gameState.isActive = false
        console.log("game ended");
        // io.emit("end_game", Date.now())
    }    

    // io.emit("tick", Date.now());
}, 1000)

/* ------------------- ROUTER ------------------- */

// page request
app.get('/', function(req, res) {
    repoDisplay("simple");
    
    // send front end code
    res.sendFile(__dirname + '/index.html');

    // --- detect or create user cookie

    // create user & cookie
    if(!req.cookies.userData) {
        let user = new help.User()
        usersRepo.push(user)
        
        res.cookie("userData", JSON.stringify(user));
    }
    // load existing user & cookie
    else {
        let data = JSON.parse(req.cookies.userData)

        let i = 0;
        let found = false;
        while(i < usersRepo.length) {
            if (usersRepo[i].guid == data.guid) {
                found = true;
                break;
            }
            i++;
        }
        
        // should repopulate a corrupt cookie?
        res.cookie("userData", JSON.stringify(found ? usersRepo[i] : data))
        if(found == false) usersRepo.push(data)
    }
});

/* ------------------- SOCKETS ------------------- */

io.on('connection', (socket) => {
    console.log("user connected");

    socket.on('chat_message', (msg) => {            // { username, text }
        io.emit('chat_message_response', msg);
        console.log(msg)
    })
    
    socket.on('username_update', (msg) => {         // { username, guid }
        let foundDuplicate = false;

        // look for duplicate username
        let i = 0;
        while(i < usersRepo.length) {
            if (usersRepo[i].username == msg.username) {
                foundDuplicate = true;
                break;
            }
            i++;
        }

        // if all is clear, update the user with the new username
        let j = 0;
        if(!foundDuplicate) {
            while(j < usersRepo.length) {
                if (usersRepo[j].guid == msg.guid) {
                    usersRepo[j].username = msg.username;
                    break;
                }
                j++;
            }
        }

        socket.emit('username_update_response', {username: msg.username, foundDuplicate});
        console.log(`username_update_response\n\t${msg.username} foundDuplicate: ${foundDuplicate}`);
    })

    socket.on('disconnect', () => {
        console.log('user disconnected');
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

/* ------------------- FUNCTIONS ------------------- */

function repoDisplay(mode) 
{
    console.log("%cuserRepo", "color: green")
    switch(mode) {
        case "simple":
            if(usersRepo.length == 0) {
                console.log("%cempty", "color: green");
                return;
            }
            usersRepo.forEach(item => {
                console.log("%c" + item.username + " " + item.guid, "color: green");
            })
            break;
        // show whole object
        default:
            console.log(usersRepo);
    }
}