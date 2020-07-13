
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
        const SECONDS_FOR_INTRO = SECONDS_BETWEEN_GAMES / 2;

var isDebug = true

var gameState = {
    // game state
    startTime: null,
    endTime: null,
    nextGameIn: null,
    isStarted: false,
    
    // flags
    startGameFlag: false,
    endGameFlag: false,

    // logging
    logString: null,
}


/* ----------------- GAME LOOP ----------------- */

setInterval(() => {
    
    // clear flags
    gameState.startGameFlag = false
    gameState.endGameFlag = false

    // init original time window
    if(gameState.isStarted == false && gameState.startTime == null) { 
        createInitTimeWindow(isDebug)
    }
    
    // start game
    if(dayjs().isSameOrAfter(gameState.startTime) && gameState.isStarted == false) {
        gameState.isStarted = true
        // gameState.nextGameIn = null

        gameState.startGameFlag = true;
        console.log("\tgame started");
    }
    
    // end game
    if(dayjs().isSameOrAfter(gameState.endTime)) {
        
        gameState.isStarted = false
        gameState.startTime = null
        gameState.endTime = null 

        gameState.endGameFlag = true;
        console.log("\tgame ended");
    }    
    
    // set up emit for client + logging
    switch(true) {
        case gameState.isStarted == false && gameState.startTime != null:
            gameState.nextGameIn = gameState.startTime.diff(dayjs(), "s")
            gameState.logString = `${dayjs().format("[---tick\t]m[m ]s[s]")}, next game in: ${gameState.nextGameIn}s`
            break;
        default:
            gameState.logString = dayjs().format("[---tick\t]m[m ]s[s]")
    }


    console.log(gameState.logString)
    io.emit("tick", gameState)
}, 1000)

/* ------------------- ROUTER ------------------- */

// page request
app.get('/', function(req, res) {
    consoleLatestUserRepo("simple");
    
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

function consoleLatestUserRepo(mode) 
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

function createInitTimeWindow(isDebug) {

    let now = dayjs()

    gameState.startTime = dayjs().minute(
        Math.ceil(
            now.minute() / MINUTES_ALLOTED_FOR_TIME_SLOT == now.minute() 
            ? now.minute() + MINUTES_ALLOTED_FOR_TIME_SLOT 
            : now.minute() / MINUTES_ALLOTED_FOR_TIME_SLOT
        ) * MINUTES_ALLOTED_FOR_TIME_SLOT
    ).second(0)

    gameState.endTime = gameState.startTime.add(MINUTES_ALLOTED_FOR_TIME_SLOT, "m").subtract(SECONDS_BETWEEN_GAMES, "s");
    
    if(isDebug) {
        console.log("new window")
        console.log(gameState.startTime.format("[\tgameStart at\t]m[m] [s]s"));
        console.log(gameState.endTime.format("[\tgameEnd at\t]m[m] [s]s"));
    }
}

function mapGameStateForTransport(gameState) {

}