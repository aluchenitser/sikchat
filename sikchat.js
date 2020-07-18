
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
const User = require('./user.js').User

/* ------------------- DEBUG MODES ------------------- */

if(process.argv[2] == "--host" || process.argv[2] == "-h") {
    require('./debug.js').host()
    return;
}



/* ------------------- SETUP ------------------- */

app.use(express.static(__dirname + "/public/"));

var usersRepo = [];

const QUESTIONS_BANK_FILES_ARRAY = ["slang", "slang", "slang"];                        // each entry matches the unique portion of a file name in /questions

// time window
const timeConstants = {
    // in minutes
    WINDOW: 1,              // components in seconds must add up to this window in minutes

    // in seconds
    INTERMISSION: 10,
    STARTING: 10,
    STARTED: 30,
    ENDING: 10,

    // question length
    QUESTION_EASY: 5,
    QUESTION_MEDIUM: 10,
    QUESTION_HARD: 15,
}

// game state
var gameState = {

    // live time checkpoints
    time: {
        intermission: null,
        starting: null,
        started: null,
        ending: null,
        next: null,
        current: "",
        tick: null,
        ticks: null
    },

    // game loop flags
    isPreLoad: true,            // first iteration
    isInit: false,              // purgatory before first real window
    isIntermission: false,      // start of time window
    isStarting: false,          // countdown
    isStarted: false,           // game is in session
    isEnding: false,            // outro

    // question bank
    qBank: {

        // from json
        loaded: {
            meta: {},
            questions: []
        },
        
        // dynamic
        currentQuestion: {},
        questionStack: []
    },

    // logging
    logString: null,
}

/* ----------------- GAME LOOP ----------------- */
checkWindowIntegrity();
initialTimeWindow()
printTimeWindow()

// time window starts at intermission
setInterval(() => {
    let topWindowState = gameState.time.current

    // acknowledge limbo period (init) before the first game window has started
    if(dayjs().isBefore(gameState.time.intermission) && gameState.isPreLoad) {

        // flags
        gameState.isPreLoad = false;
        gameState.time.current = "init";
        gameState.isInit = true;
    }

    // proceed to intermission, also window update
    if(dayjs().isSameOrAfter(gameState.time.intermission) && gameState.isInit || dayjs().isSameOrAfter(gameState.time.next) && gameState.isEnding) {
        // update window
        if(gameState.isEnding) {
            updateTimeWindow()
            printTimeWindow()
        }
        loadQuestionBank()
    
        //flags
        gameState.isInit = false

        gameState.time.tick = 0
        gameState.time.ticks = timeConstants.INTERMISSION
        gameState.isEnding = false
        gameState.time.current = "intermission"
        gameState.isIntermission = true
    }

    // proceed to starting
    if(dayjs().isSameOrAfter(gameState.time.starting) && gameState.isIntermission) { 
        


        // flags
        gameState.time.tick = 0
        gameState.time.ticks = timeConstants.STARTING
        gameState.isIntermission = false;
        gameState.time.current = "starting";
        gameState.isStarting = true;
    }

    
    // proceed to started
    if(dayjs().isSameOrAfter(gameState.time.started) && gameState.isStarting) { 
        console.log("started");
        
        // flags
        gameState.time.tick = 0
        gameState.time.ticks = timeConstants.STARTED
        gameState.isStarting = false;
        gameState.time.current = "started";
        gameState.isStarted = true;
    }
    
    // detect question, then select new ones as old ones expire
    if(gameState.qBank.questionStack.length > 0 && gameState.isStarted) {
        if(gameState.qBank.currentQuestion.timeLeft == 0 && gameState.qBank.questionStack.length > 0 || gameState.qBank.questionStack.length == gameState.qBank.questionStack.originalLength) 
        {
            loadQuestion();
        }
        gameState.qBank.currentQuestion.timeLeft--
       
        // console.log("current question timeLeft: ", gameState.qBank.currentQuestion.timeLeft)
    }

    // proceed to ending
    if(dayjs().isSameOrAfter(gameState.time.ending) && gameState.isStarted) { 
    
        // flags
        gameState.time.tick = 0
        gameState.time.ticks = timeConstants.ENDING
        gameState.isStarted = false;
        gameState.time.current = "ending";
        gameState.isEnding = true;
    }    
    console.log(`${dayjs().format("h[h ]m[m ]s[s]\t")}top: ${topWindowState}\tbottom: ${gameState.time.current}`)
    gameState.time.tick++               // used to help client know where in window we are

    let gameStateEmit = mapGameStateForEmit()
    io.emit("tick", gameStateEmit)
}, 1000)

/* ------------------- ROUTER ------------------- */

// page request
app.get('/', function(req, res) {
    consoleLatestUserRepo("simple");
    
    // send front end code
    res.sendFile(__dirname + '/index.html');

    // disable debug mode
    res.cookie("debug", "false", {path: "/"});
    
    // create or detect user & cookie
    if(!req.cookies.userData) {
        let user = new User()
        usersRepo.push(user)

        // TODO: figure our "domain" cookie attribute
        res.cookie("userData", JSON.stringify(user), {path: "/", expires: dayjs().add(1,"y").toDate()});
    }
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

/* ------------------- WINDOW FUNCTIONS ------------------- */

function checkWindowIntegrity(obj) {

    let calculatedTotal = timeConstants.INTERMISSION + timeConstants.STARTING + timeConstants.STARTED + timeConstants.ENDING;

    if (calculatedTotal != timeConstants.WINDOW * 60) {
        console.log("window components don't add up to window")
        console.log(`${timeConstants.INTERMISSION} + ${timeConstants.STARTING} + ${timeConstants.STARTED} + ${timeConstants.ENDING} = ${calculatedTotal}`)
        console.log(`WINDOW: ${timeConstants.WINDOW * 60}`);
        process.exit(1)
    }
}                   

function initialTimeWindow() {
    /* time window sequence is like so:
        1. intermission 2. game starting (countdown) 3. game started 4. game ending (tally stats) 5. new time window  */

    let now = dayjs()
    
    // calculates time up to the next multiple
    gameState.time.intermission = dayjs().minute(Math.ceil(now.minute() / timeConstants.WINDOW) * timeConstants.WINDOW).second(0)    // rounds up to next multiple of WINDOW

    // adds a WINDOW length if it's the same minute
    if(now.minute() == gameState.time.intermission.minute()) {
        gameState.time.intermission = gameState.time.intermission.add(timeConstants.WINDOW, "m")
    }

    // setup window sub components
    gameState.time.starting = gameState.time.intermission.add(timeConstants.INTERMISSION, "s");
    gameState.time.started = gameState.time.starting.add(timeConstants.STARTING, "s");
    gameState.time.ending = gameState.time.started.add(timeConstants.STARTED, "s");
    gameState.time.next = gameState.time.ending.add(timeConstants.ENDING, "s");
}

function updateTimeWindow() {
    gameState.time.intermission = gameState.time.next;

    gameState.time.starting = gameState.time.intermission.add(timeConstants.INTERMISSION, "s");
    gameState.time.started = gameState.time.starting.add(timeConstants.STARTING, "s");
    gameState.time.ending = gameState.time.started.add(timeConstants.STARTED, "s");
    gameState.time.next = gameState.time.ending.add(timeConstants.ENDING, "s");
}

function printTimeWindow() {
    console.log("-- time window");
    console.log(`\tintermission\t: ${gameState.time.intermission.format("h[h] m[m] s[s]")}`)
    console.log(`\tstarting\t: ${gameState.time.starting.format("h[h] m[m] s[s]")}`)
    console.log(`\tstarted\t\t: ${gameState.time.started.format("h[h] m[m] s[s]")}`)
    console.log(`\tending\t\t: ${gameState.time.ending.format("h[h] m[m] s[s]")}`)
    console.log(`\tnext\t\t: ${gameState.time.next.format("h[h] m[m] s[s]")}`)
}

/* ------------------- QBANK FUNCTIONS ------------------- */

function loadQuestionBank() {
    console.log("loading question bank...")


    let name = QUESTIONS_BANK_FILES_ARRAY[Math.floor(Math.random() * QUESTIONS_BANK_FILES_ARRAY.length)];
    let path = `./questions/questions_${name}.json`;

    fs.readFile(path, (err, raw) => {

        if (err) {
            console.log("failed bank load")
            throw err;
        }
        gameState.qBank.loaded = JSON.parse(raw)

        // --- scrambles then builds questionStack
        let timeLeft = timeConstants.STARTED  // 30
        let shuffled = shuffle(gameState.qBank.loaded.questions)
        
        var i = 0;
        while(timeLeft > 0 && i < shuffled.length) {
            let questionSeconds;
            let question = shuffled[i]
            
            switch(question.difficulty) {
                case "easy": 
                    questionSeconds = timeConstants.QUESTION_EASY
                    break;
                case "medium": 
                    questionSeconds = timeConstants.QUESTION_MEDIUM
                    break;
                case "hard": 
                    questionSeconds = timeConstants.QUESTION_HARD
                    break;
            }

            i++
            // doesn't fit
            if(timeLeft - questionSeconds < 0) {
                // console.log("continuing!");
                continue;           // maybe the next question will be small enough to fit
            }

            // does fit
            timeLeft -= questionSeconds
            question.timeAllotted = questionSeconds
            gameState.qBank.questionStack.push(question)
        }
        
        // make up the rest by adding time to the final question
        if(timeLeft > 0) {
            gameState.qBank.questionStack[gameState.qBank.questionStack.length - 1].timeAllotted += timeConstants.STARTED - timeLeft
        }

        gameState.qBank.questionStack.originalLength = gameState.qBank.questionStack.length

        // logging
        // console.log(`question bank "${gameState.qBank.loaded.meta.name}" loaded ${gameState.qBank.questionStack.length} questions`)
        // console.log(gameState.qBank.questionStack)
        // let totalSeconds = gameState.qBank.questionStack.reduce((acc, curr) => { return acc + curr.timeAllotted}, 0)
        // console.log(`question bank "${gameState.qBank.loaded.meta.name}" is ${totalSeconds}s long vs a STARTED of ${timeConstants.STARTED}s`)
    });
}

function loadQuestion() {
  // load question
    gameState.qBank.currentQuestion = gameState.qBank.questionStack.pop()
    gameState.qBank.currentQuestion.timeLeft = gameState.qBank.currentQuestion.timeAllotted

    // console.log("question chosen\n", gameState.qBank.currentQuestion);
}

/* ------------------ USER FUNCTIONS ------------------- */

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

/* ------------------ UTILITY FUNCTIONS ------------------- */

// snips the more repo esque properties to save bandwidth
// look at a questions_xyz.json file to see what the object looks like
function mapGameStateForEmit() {
    let clone = JSON.parse(JSON.stringify(gameState))
    clone.qBank.topic = gameState.qBank.loaded.meta.topic

    delete clone.qBank.loaded
    delete clone.qBank.questionStack
    delete clone.time.questionStack

    delete clone.time.intermission
    delete clone.time.starting
    delete clone.time.started
    delete clone.time.ending
    delete clone.time.next

    return clone;
}

// shuffle array non destructive
function shuffle(array) {
    let a = [...array];

    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
