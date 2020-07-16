
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

// time window

// full window size in minutes
const TIME_LENGTH_WINDOW = 1;              // components need to add up to the whole. (windows have to be in minutes)

// window components in seconds
const TIME_LENGTH_INTERMISSION = 20;
const TIME_LENGTH_STARTING = 10;
const TIME_LENGTH_STARTED = 20;
const TIME_LENGTH_ENDING = 10;

// game state
var gameState = {

    // live time checkpoints
    time: {
        intermission: null,
        starting: null,
        start: null,
        ending: null,
        next: null,
        current: ""
    },

    // timeConstants is for emitting to the client
    timeConstants: {
        TIME_LENGTH_WINDOW: TIME_LENGTH_WINDOW,
        TIME_LENGTH_INTERMISSION: TIME_LENGTH_INTERMISSION,
        TIME_LENGTH_STARTING: TIME_LENGTH_STARTING,
        TIME_LENGTH_STARTED: TIME_LENGTH_STARTED,
        TIME_LENGTH_ENDING: TIME_LENGTH_ENDING
    },

    isPreLoad: true,            // first iteration
    isInit: false,              // purgatory before first real window
    isIntermission: false,      // start of time window
    isStarting: false,          // countdown
    isStarted: false,           // game is in session
    isEnding: false,            // outro

    // question bank, load flags and meta data
    qBank: {
        isLoaded: false,
        isLoading: false,
        isLoadFailed: false,
        loaded: {},
        current: {}
    },

    // question data
    questions: [],
    question: {},

    // question helpers
    isQuestionLoaded: false,
    questionsLeft: [],              // initialized with integers from 0 to questions.length, then gets spliced as questions are used

    // logging
    logString: null,
}


/* ----------------- GAME LOOP ----------------- */
checkWindowIntegrity();
initialTimeWindow()
printTimeWindow()

// time window starts at intermission
setInterval(() => {
    
    // before first game window has started
    if(dayjs().isBefore(gameState.time.intermission) && gameState.isPreLoad) {

        // flags
        gameState.isPreLoad = false;
        gameState.time.current = "init";
        gameState.isInit = true;
    }

    console.log(`${dayjs().format("m[m ]s[s]")} window state: ${gameState.time.current}`)

    // intermission & window update
    if(dayjs().isSameOrAfter(gameState.time.intermission) && gameState.isInit || dayjs().isSameOrAfter(gameState.time.next) && gameState.isEnding) {
        // update window
        if(gameState.isEnding) {
            updateTimeWindow()
            printTimeWindow()
        }
    
        loadQuestionBank()
    
        

        //flags
        gameState.isEnding 
            ? gameState.isEnding = false 
            : gameState.isInit = false
        gameState.time.current = "intermission";
        gameState.isIntermission = true;

    }

    // starting
    if(dayjs().isSameOrAfter(gameState.time.starting) && gameState.isIntermission) { 

        // flags
        gameState.isIntermission = false;
        gameState.time.current = "starting";
        gameState.isStarting = true;
    }

    // started
    if(dayjs().isSameOrAfter(gameState.time.started) && gameState.isStarting) { 
        
        // flags
        gameState.isStarting = false;
        gameState.time.current = "started";
        gameState.isStarted = true;
    }

    // ending
    if(dayjs().isSameOrAfter(gameState.time.ending) && gameState.isStarted) { 
    
        // flag
        gameState.isStarted = false;
        gameState.time.current = "ending";
        gameState.isEnding = true;
    }    


    
    // // load question bank at beginning of intermission
    // if(!gameState.isPlaying && !gameState.qBank.loaded && !gameState.qBank.loading && !gameState.qBank.loadFailed) {
    //     loadQuestionBank() 
    // }
    
    // // start game
    // if(dayjs().isSameOrAfter(gameState.time.start) && gameState.isPlaying == false) {
    //     gameState.isPlaying = true
    //     console.log("\tgame started");
    // }
   
    // // load question
    // if(gameState.isPlaying == true && gameState.qBank.loaded == true && gameState.isQuestionLoaded == false) {
    //     loadQuestion()
    // }
    
    // // intermission
    // if(dayjs().isSameOrAfter(gameState.time.intermission)) {
        
    //     gameState.isPlaying = false
    //     gameState.time.start = null
    //     gameState.time.intermission = null 

    //     console.log("\tgame ended");
    // }    
    
    
    // let emit = mapGameStateForEmit()

    // io.emit("tick", emit)
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
// let port = parseInt(process.argv[2]);
// port = port && port >= 1023 && port <= 65535
//     ? port
//     : 3000;

// http.listen(port, function() {
//     console.log(`listening on *:${port}`);
// });

/* ------------------- FUNCTIONS ------------------- */

function checkWindowIntegrity(obj) {

    let calculatedTotal = TIME_LENGTH_INTERMISSION + TIME_LENGTH_STARTING + TIME_LENGTH_STARTED + TIME_LENGTH_ENDING;

    if (calculatedTotal != TIME_LENGTH_WINDOW * 60) {
        console.log("\n--- Bogus time window, cancelling game ---\n")
        console.log(`TIME_LENGTH_INTERMISSION: ${TIME_LENGTH_INTERMISSION}`);
        console.log(`TIME_LENGTH_STARTING: ${TIME_LENGTH_STARTING}`);
        console.log(`TIME_LENGTH_STARTED: ${TIME_LENGTH_STARTED}`);
        console.log(`TIME_LENGTH_ENDING: ${TIME_LENGTH_ENDING}\n`);
        console.log(`${TIME_LENGTH_INTERMISSION} + ${TIME_LENGTH_STARTING} + ${TIME_LENGTH_STARTED} + ${TIME_LENGTH_ENDING} = ${calculatedTotal}`)
        console.log(`does not add up to\n`)
        console.log(`TIME_LENGTH_WINDOW: ${TIME_LENGTH_WINDOW}\n`);
        throw "time window problem"
    }
}                   

function initialTimeWindow() {
    /* time window sequence is like so:
        1. intermission 2. game starting (countdown) 3. game started 4. game ending (tally stats) 5. new time window  */

    let now = dayjs()

    // calculates time up to the next multiple
    gameState.time.intermission = dayjs().minute(
        Math.ceil(
            now.minute() / TIME_LENGTH_WINDOW == now.minute() 
            ? now.minute() + TIME_LENGTH_WINDOW 
            : now.minute() / TIME_LENGTH_WINDOW
        ) * TIME_LENGTH_WINDOW
    ).second(0)

    gameState.time.starting = gameState.time.intermission.add(TIME_LENGTH_INTERMISSION, "s");
    gameState.time.started = gameState.time.starting.add(TIME_LENGTH_STARTING, "s");
    gameState.time.ending = gameState.time.started.add(TIME_LENGTH_STARTED, "s");
    gameState.time.next = gameState.time.ending.add(TIME_LENGTH_ENDING, "s");
}

function updateTimeWindow() {
    gameState.time.intermission = gameState.time.next;

    gameState.time.starting = gameState.time.intermission.add(TIME_LENGTH_INTERMISSION, "s");
    gameState.time.started = gameState.time.starting.add(TIME_LENGTH_STARTING, "s");
    gameState.time.ending = gameState.time.started.add(TIME_LENGTH_STARTED, "s");
    gameState.time.next = gameState.time.ending.add(TIME_LENGTH_ENDING, "s");
}

function printTimeWindow() {
    console.log("-- time window");
    console.log(`\tintermission\t: ${gameState.time.intermission.format("m[m] s[s]")}`)
    console.log(`\tstarting\t: ${gameState.time.starting.format("m[m] s[s]")}`)
    console.log(`\tstarted\t\t: ${gameState.time.started.format("m[m] s[s]")}`)
    console.log(`\tending\t\t: ${gameState.time.ending.format("m[m] s[s]")}`)
    console.log(`\tnext\t\t: ${gameState.time.next.format("m[m] s[s]")}`)
}


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


// snips the more repo esque properties to save bandwidth
function mapGameStateForEmit() {
    let emit = {}
    let reject = ["bank", "questions", "questionsLeft"];

    for(let [key,value] of Object.entries(gameState)) {
        if(reject.indexOf(key) == -1) {
            emit[key] = value;
        }
    }

    return emit;
}

function loadQuestionBank() {

    let name = QUESTIONS_BANK_FILES_ARRAY[Math.floor(Math.random() * QUESTIONS_BANK_FILES_ARRAY.length)];
    let path = `./questions/questions_${name}.json`;
    
    gameState.qBank.isLoading = true;         // to prevent double load in case file takes longer than a game loop to load.

    fs.readFile(path, (err, raw) => {
        gameState.qBank.isLoading = false;

        if (err) {
            gameState.qBank.isloadFailed = true;
            console.log("failed bank load")
            throw err;
        }

        // parse and assign
        gameState.qBank.loaded = JSON.parse(raw)

        // gameState.questionsLeft stores index values to show which questions have already been used
        gameState.questionsLeft = Array.from(Array(gameState.qBank.loaded.questions).keys())

        gameState.qBank.isLoaded = true
        console.log(`question bank "${gameState.qBank.loaded.meta.name}" loaded ${gameState.qBank.loaded.questions.length} questions`)
    });
}

function loadQuestion() {
    if (gameState.questions.length == 0 || gameState.questionsLeft.length == 0 && gameState.isPlaying) {
        throw "no questions or out of questions"
    }
    
    // choose question
    let index = gameState.questionsLeft[Math.floor(Math.random() * gameState.questionsLeft.length)]
    gameState.question = gameState.questions[index];
    gameState.isQuestionLoaded = true;
    console.log("question loaded", gameState.question);

    // pluck from future questions
    gameState.questionsLeft.slice(index, 1);
}


function clearTimeWindow() {

}