
// standard requires
const express = require('express')

var session = require('express-session');
const app = express()


const http = require('http').Server(app)
const io = require('socket.io')(http)
const fs = require('fs');
// var bodyParser = require('body-parser');

// requires with extra shit
var dayjs = require('dayjs')
var isSameOrAfter = require('dayjs/plugin/isSameOrAfter')
dayjs.extend(isSameOrAfter)




const cookieParser = require('cookie-parser')       // make cookie available in req.cookie
var cookie = require('cookie')                      // read a cookie

app.use(cookieParser());

// requires that load my stuff
const User = require('./user.js').User
app.use(express.static(__dirname + "/public/"));

// replaces deprecated body-parser, so i'm told
app.use(express.json());

sharedsession = require("express-socket.io-session");

var expressSession = session({
    secret: "dajfklhsl&&3fhalskfasfd",
    key: "sik_sid",
    
    // TODO: read up on these options more closely
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

/* ------------------- DEBUG MODES ------------------- */

if(process.argv[2] == "--host" || process.argv[2] == "-h") {
    require('./debug.js').host()
    return;
}

/* ------------------- SETUP ------------------- */

const QUESTIONS_BANK_FILES_ARRAY = ["slang", "slang", "slang"];                        // each entry matches the unique portion of a file name in /questions

// time window
const timeConstants = {
    // in minutes
    WINDOW: 2,              // components in seconds must add up to this window in minutes

    // in seconds
    INTERMISSION: 10,
    STARTING: 10,
    STARTED: 90,
    ENDING: 10,

    // question length
    QUESTION_EASY: 10,
    QUESTION_MEDIUM: 15,
    QUESTION_HARD: 20,
}

const scoreConstants = {
    "easy": 4,
    "medium": 9,
    "hard": 15
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
        currentQuestion: {
            question: "",
            answer: "",
            difficulty: ""
        },
        questionStack: []
    },

    // counters
    chatCount: 0,
    questionCount: 0,

    // logging
    logString: null,
}


var userRepo = {};             // stores user accounts, { email: user }
var sessionRepo = {}           // for quick lookup of users that have a session attached { sik_sid: user }


/* ------------------- ROUTER ------------------- */

app.route('/')
    .get(function(req, res) {
        res.sendFile(__dirname + '/index.html');
        res.cookie("sik_debug", "false", {path: "/"});
        
        if (req.session.user && req.cookies.sik_sid) {
            console.log("existing user found")
            console.log(req.session.user)
            console.log("--- user repo ---")
            console.log(userRepo)
        }
        else {
            req.session.user = new User()               // blank account until the user logs in or registers
            console.log(req.session.user)
            console.log("creating blank user")
        }
        
        res.cookie("sik_data", JSON.stringify(mapRepoUserToClientUser(req.session.user)), {path: "/", expires: dayjs().add(7,"d").toDate()});
        
        // strips authentication and some other stuff

    })
    .post((req, res) => {
        console.log("------ userRepo ------")
        console.log(userRepo)
        console.log("------ userRepo ------")

        if (req.session.user && req.cookies.sik_sid) {
            
            // register new login
            if(req.body.register == true) {

                if(userRepo.hasOwnProperty(req.body.email)) {
                    console.log("duplicate email")
                    res.send("duplicate email")
                }
                else {
                    console.log("--- req.body ---") 
                    console.log(req.body)

                    let user = new User(req.body.email, req.body.password, req.body.username)
                    
                    // update session and add to user repo
                    req.session.user = user
                    userRepo[req.body.email] = user

                    console.log("registration success")
                    res.send("registration success")
                }
            }

            // existing login (session likely expired)
            else {

                if(userRepo.hasOwnProperty(req.body.email) && userRepo[req.body.email].password == req.body.password) {
                    req.session.user = userRepo[req.body.email]
                    res.cookie("sik_data", JSON.stringify(mapRepoUserToClientUser(req.session.user)), {path: "/", expires: dayjs().add(7,"d").toDate()});
                    res.send("success")
                }
                else {
                    res.send("failed login")
                }
            }
        }
        else { res.statusCode(403) }
    })


/* ----------------- GAME LOOP ----------------- */

checkWindowIntegrity();
initialTimeWindow()
// printTimeWindow()

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
            // printTimeWindow()
        }

        loadQuestionBank()
        clearUserStatistics()
    
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
        // console.log("started");
        
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
    // console.log(`${dayjs().format("h[h ]m[m ]s[s]\t")}top: ${topWindowState}\tbottom: ${gameState.time.current}`)
    gameState.time.tick++               // used to help client know where in window we are

    let gameStateEmit = mapGameStateForEmit()
    io.emit("tick", gameStateEmit)
}, 1000)


/* ------------------- SOCKETS ------------------- */

io.on('connection', (socket) => {
    // console.log("user connected")

    // TODO: clients gets by without any cookie data socket.io reconnects a dead session without a page refresh .. just need to reload page for now
    socket.user = userRepo[cookie.parse(socket.handshake.headers.cookie).sik_id]

    socket.on('chat_message', (chatMessage) => {            // { id, text, chatCount }
        
        // chat number allows the client to decorate individual messages with visual effects
        chatMessage.chatCount = gameState.chatCount; 

        // broadcast to the room
        io.emit('chat_message_response', chatMessage);
        console.log(chatMessage)

        // see if they've answered a question correctly
        if(gameState.time.current == "started") {

            // correct answer
            if(chatMessage.text.indexOf(gameState.qBank.currentQuestion.answer) >= 0 && socket.user.lastQuestionAnswered != gameState.questionCount) {
                
                // update the userRepo 
                socket.user.lastQuestionAnswered = gameState.questionCount
                socket.user.answered++
                socket.user.lifeTimeAnswered++
                socket.user.points += scoreConstants[gameState.qBank.currentQuestion.difficulty]
                socket.user.lifeTimePoints += scoreConstants[gameState.qBank.currentQuestion.difficulty]
                //       \___ socket.user is the same memory address as userRepo[sik_id])

                let successReponse = {
                    difficulty: gameState.qBank.currentQuestion.difficulty,
                    chatCount: gameState.chatCount,
                    user: socket.user // update the client
                }
                
                console.log("correct!!")
                socket.emit("success_response", successReponse)    // { difficulty, chatCount }
            }
        }

        gameState.chatCount++
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
            gameState.qBank.questionStack[gameState.qBank.questionStack.length - 1].timeAllotted += timeLeft
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
    gameState.qBank.currentQuestion.questionNumber = ++gameState.questionCount

    // console.log("question chosen\n", gameState.qBank.currentQuestion);
}

/* ------------------ USER FUNCTIONS ------------------- */

function clearUserStatistics() {
    console.log("clear user statistics_______")

    for (var user in userRepo) {
        if(userRepo.hasOwnProperty(user)) {
            userRepo[user].answered = 0
            userRepo[user].points = 0
        }
    }
}


function consoleLatestUserRepo(mode) 
{
    console.log("%cuserRepo", "color: green")
    switch(mode) {
        case "simple":
            if(userRepo.length == 0) {
                console.log("%cempty", "color: green");
                return;
            }
            userRepo.forEach(item => {    // since userRepo is now an object, this bit of code is fucked
                console.log("%c" + item.username + " " + item.guid, "color: green");
            })
            break;
        // show whole object
        default:
            console.log(userRepo);
    }
}

/* ------------------ UTILITY FUNCTIONS ------------------- */

// snips the more repo esque properties to save bandwidth
// look at a questions_xyz.json file to see what the object looks like
function mapGameStateForEmit() {
    let clone = JSON.parse(JSON.stringify(gameState))

    delete clone.qBank.loaded.questions
    delete clone.qBank.questionStack
    delete clone.time.questionStack

    delete clone.time.intermission
    delete clone.time.starting
    delete clone.time.started
    delete clone.time.ending
    delete clone.time.next

    return clone;
}

function mapRepoUserToClientUser(user) {
    let clone = JSON.parse(JSON.stringify(user))
    delete clone.created
    delete clone.last
    delete clone.email
    delete clone.password
    delete clone.guid

    return clone
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
