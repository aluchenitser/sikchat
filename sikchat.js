
/* SIKCHAT - THE SIKKEST CHAT AMIRITE */

/* ------------------- DEPENDENCIES ------------------- */

const express = require('express')

var session = require('express-session');
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

rooms = {
    chosen: "lobby",   
    roomList: ["lobby", "history", "slang", "maps", "madlibs", "history II", "slang II", "people"]
}
var userRepo = {};             // stores user accounts, { email: user } for registered and { guid: user } for free

/* ------------------- ROUTER ------------------- */

app.route('/')
    .get(function(req, res) {
        console.log("get /")

        res.sendFile(__dirname + '/index.html');
        res.cookie("sik_debug", "false", {path: "/"});
        
        if (req.session.user && req.cookies.sik_sid) {
            console.log("-- existing user found --")
            printUser(req.session.user)
            printUserRepo()
        }
        else {
            req.session.user = new User()                           // blank account until the user logs in or registers
            userRepo[req.session.user.guid] = req.session.user

            console.log("-- created blank user --")
            printUser(req.session.user)
            printUserRepo()
        }

        res.cookie("sik_user", JSON.stringify(mapRepoUserToClientUser(req.session.user)), {path: "/", expires: dayjs().add(7,"d").toDate()});
        res.cookie("sik_rooms", JSON.stringify(rooms), {path: "/", expires: dayjs().add(7,"d").toDate()});

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

                    let user = new User(req.body.email, req.body.password, req.body.username, true)   // newly registered user has default username of "someone"
                    delete userRepo[req.session.user.guid]

                    // update session and add to user repo
                    req.session.user = user
                    userRepo[req.body.email] = user

                    console.log("registration success")
                    printUserRepo()

                    
                    res.send({ username: user.username, msg: "registration success" })
                    console.log(" -- registration success --")
                }
            }

            // existing login (session likely expired)
            else {
                console.log(" -- login attempt -- ")
                if(userRepo.hasOwnProperty(req.body.email) && userRepo[req.body.email].password == req.body.password) {
                    let user = userRepo[req.body.email]
                    req.session.user = user
                    res.cookie("sik_user", JSON.stringify(mapRepoUserToClientUser(req.session.user)), {path: "/", expires: dayjs().add(7,"d").toDate()});
                    res.send({ username: user.username, msg: "success" })
                    console.log(" -- login success -- ")
                }
                else {
                    res.send("failed login")
                    console.log(" -- login failed -- ")
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


/* ----------------- GAME LOOP ----------------- */


let slang1 = new Game("slang1", io, userRepo)
slang1.start()

/* ------------------- SOCKETS ------------------- */

io.on('connection', (socket) => {
    // TODO: clients gets by without any cookie data socket.io reconnects a dead session without a page refresh .. just need to reload page for now

    try {
        socket.join(socket.handshake.session.user.room)
    }
    catch(e) { console.log("room lookup failed, likely init")}

    socket.on('chat_message', (text) => {           
        
        // chat number allows the client to decorate individual messages with visual effects
        try {
            var chatMessage = {
                text: text,
                chatCount: gameState.chatCount,
                guid: socket.handshake.session.user.guid,
                username: socket.handshake.session.user.username
            }
        } catch(e) {
            console.log("--- socket.handshake.session.user.guid error, session is: --- ")
            console.log(socket.handshake.session)
            return
        }

        // broadcast to the room
        
        // per game behavior
        let sendChat = true
        switch(socket.handshake.session.user.room) {
            case 'slang1': 
                slang1.submitAnswer(text, socket)
                break;
            default:
        }
            
        if(sendChat == true) {
            console.log(chatMessage)
            // io.to(socket.handshake.session.user.room).emit('chat_message_response', chatMessage);
            io.emit('chat_message_response', chatMessage);
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

function calculateWinner() {
    if(gameState.winners.length === 0) {
        let highest = 0
        for(user in userRepo) {
            if(userRepo[user].points > highest) {
                highest = userRepo[user].points
                gameState.winners = [userRepo[user].username]
            }
            else if(userRepo[user].points === highest && highest > 0) {
                gameState.winners.push(userRepo[user].username)
            }
        }

        if(highest === 0) {
            gameState.winners = ["nobody??"]
        }
    }
}

function printTimeWindow() {
    console.log("-- time window");
    console.log(`\tintermission\t: ${gameState.time.intermission.format("h[h] m[m] s[s]")}`)
    console.log(`\tstarting\t: ${gameState.time.starting.format("h[h] m[m] s[s]")}`)
    console.log(`\tstarted\t\t: ${gameState.time.started.format("h[h] m[m] s[s]")}`)
    console.log(`\tending\t\t: ${gameState.time.ending.format("h[h] m[m] s[s]")}`)
    console.log(`\tnext\t\t: ${gameState.time.next.format("h[h] m[m] s[s]")}`)
}

function printIntermissionStartTime() {
    console.log(`intermission begins at ${gameState.time.intermission.format("h[h] m[m] s[s]")}`)
}

/* ------------------- QBANK FUNCTIONS ------------------- */

function loadQuestionBank() {  // returns original number of questions before question stack 
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

        return 
    });
}

function loadQuestion() {
  // load question
  
  gameState.qBank.currentQuestion = gameState.qBank.questionStack.pop()
  gameState.qBank.currentQuestion.timeLeft = gameState.qBank.currentQuestion.timeAllotted
  gameState.qBank.currentQuestion.questionNumber = ++gameState.questionCount
  
  gameState.qBank.currentQuestion.q = gameState.qBank.questionStack.length + 1
  gameState.qBank.currentQuestion.of = gameState.qBank.questionStack.originalLength

//   console.log("question chosen\n", gameState.qBank.currentQuestion);
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

    gameState.winners = []
}

function printUserRepo() {
    console.log("--- user repo ---")
    for(var email in userRepo) {
        user = userRepo[email]
        console.log(user.username, user.email, user.password, user.guid)
    }
}

function printUser(user) {
    console.log(user.username, user.email, user.password, user.guid)
}

/* ------------------ UTILITY FUNCTIONS ------------------- */

// snips the more repo esque properties to save bandwidth
// look at a questions_xyz.json file to see what the object looks like
function mapGameStateForClient() {
    let clone = JSON.parse(JSON.stringify(gameState))

    delete clone.qBank.loaded.questions
    delete clone.qBank.questionStack
    delete clone.time.questionStack

    delete clone.time.intermission
    delete clone.time.starting
    delete clone.time.started
    delete clone.time.ending
    // delete clone.time.next

    return clone;
}

function mapRepoUserToClientUser(user) {
    let clone = JSON.parse(JSON.stringify(user))
    delete clone.created
    delete clone.last
    delete clone.email
    delete clone.password
    
    clone.isRegistered = user.email == null ? false : true              // toggles whether they see logout or register/login

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
