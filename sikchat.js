
// standard requires
const express = require('express')
const app = express()
const http = require('http').Server(app)
const io = require('socket.io')(http)
const fs = require('fs');

// requires with extra shit
var dayjs = require('dayjs')
var isSameOrAfter = require('dayjs/plugin/isSameOrAfter')
dayjs.extend(isSameOrAfter)

const cookieParser = require('cookie-parser')
app.use(cookieParser());

// requires that load my stuff
const help = require('./help.js')


/* ------------------- SETUP ------------------- */

app.use(express.static(__dirname + "/public/"));

var usersRepo = [];

const QUESTIONS_BANK_FILES_ARRAY = ["slang", "slang", "slang"];                        // each entry matches the unique portion of a file name in /questions


const MINUTES_ALLOTED_FOR_TIME_SLOT = 1;
const SECONDS_BETWEEN_GAMES = 30;

var isDebug = true



var gameState = {

    // game state
    startTime: null,
    endTime: null,
    nextGameIn: null,
    isActive: false,
    isBankLoaded: false,
    isBankLoading: false,
    isBankLoadFailed: false,
    isQuestionLoaded: false,

    // questions bank
    bank: {},
    questions: [],
    currentQuestion: {},
    questionsHistory: [],

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
    
    
    // load question bank
    if(gameState.isBankLoaded == false && gameState.isBankLoading == false && gameState.isBankLoadFaled == false) {
        let name = QUESTIONS_BANK_FILES_ARRAY[Math.floor(Math.random() * QUESTIONS_BANK_FILES_ARRAY.length)];
        let fullName = `./questions/questions_${name}.json`;
        
        gameState.isBankLoading = true;         // to prevent double load in case file takes longer than a game loop to load.

        fs.readFile(fullName, (err, raw) => {
            gameState.isBankLoading = false;

            if (err) {
                gameState.isBankLoadFailed = true;
                console.log("------------ read bank file is fucked!! we're goin' down!! ------------")
                throw err;
            }

            // parse and assign
            let data = JSON.parse(raw)
            gameState.bank = data.bank
            gameState.questions = data.questions

            gameState.isBankLoaded = true

            console.log("bank loaded\n\t", gameState.questions.current)
        });
    }

    // init first game time window
    if(gameState.isActive == false && gameState.startTime == null) { 
        createInitTimeWindow(isDebug)
    }
    
    
    // start game
    if(dayjs().isSameOrAfter(gameState.startTime) && gameState.isActive == false) {
        gameState.isActive = true
        // gameState.nextGameIn = null
        
        gameState.startGameFlag = true;
        console.log("\tgame started");
    }
   
    // load question
    if(gameState.isActive == true && gameState.isBankLoaded == true && gameState.isQuestionLoaded == false) {
        

        let currentQuestion = gameState.questions
    }
    
    // end game
    if(dayjs().isSameOrAfter(gameState.endTime)) {
        
        gameState.isActive = false
        gameState.startTime = null
        gameState.endTime = null 

        gameState.endGameFlag = true;
        console.log("\tgame ended");
    }    
    

    // set up poll style emits and logging
    switch(true) {
        case gameState.isActive == false && gameState.startTime != null:
            gameState.nextGameIn = gameState.startTime.diff(dayjs(), "s") || null
            gameState.logString = `${dayjs().format("m[m ]s[s]")}, next game in: ${gameState.nextGameIn}s`
            break;
        default:
            gameState.logString = dayjs().format("m[m ]s[s]")
    }

    console.log("---tick", gameState.logString)

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