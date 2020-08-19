const fs = require('fs');

var dayjs = require('dayjs')
    var isSameOrAfter = require('dayjs/plugin/isSameOrAfter')
    var advancedFormat = require('dayjs/plugin/advancedFormat')
    dayjs.extend(isSameOrAfter)
    dayjs.extend(advancedFormat)

module.exports = class Game {
    constructor(room, io, userRepo)
    {
        this.room = room
        this.io = io
        this.userRepo = userRepo

        this.QUESTIONS_BANK_FILES_ARRAY = ["slang", "slang", "slang"];                        // each entry matches the unique portion of a file name in /questions

        // time window
        this.timeConstants = {
            // in minutes
            WINDOW: 1,              // components in seconds must add up to this window in minutes

            // in seconds
            INTERMISSION: 10,
            STARTING: 10,
            STARTED: 30,
            ENDING: 10,

            QUESTION_TIME: 10,
        }

        this.scoreConstants = {
            "easy": 4,
            "medium": 9,
            "hard": 15
        }

        // game state
        this.gameState = {

            winners:[],

            // live time checkpoints
            time: {
                intermission: null,
                starting: null,
                started: null,
                ending: null,
                next: null,
                current: "",
                tick: null,
                ticks: null,
                secondsUntilNextGame: null

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
            questionCount: 0,

            // logging
            logString: null,
        }
    }

    submitAnswer(answerText, socket, chatCount) {

        let gameState = this.gameState

        if(gameState.time.current == "started") {
            if(answerText.indexOf(gameState.qBank.currentQuestion.answer) >= 0 && socket.handshake.session.user.lastQuestionAnswered != gameState.questionCount) {
                
                // update the session
                socket.handshake.session.user.lastQuestionAnswered = gameState.questionCount
                socket.handshake.session.user.answered++
                socket.handshake.session.user.lifeTimeAnswered++
                socket.handshake.session.user.points += this.scoreConstants[gameState.qBank.currentQuestion.difficulty]
                socket.handshake.session.user.lifeTimePoints += this.scoreConstants[gameState.qBank.currentQuestion.difficulty]

                // update the repo
                let lookup = socket.handshake.session.user.isRegistered
                    ? socket.handshake.session.user.email
                    : socket.handshake.session.user.guid

                this.userRepo[lookup] = socket.handshake.session.user

                let successReponse = {
                    difficulty: gameState.qBank.currentQuestion.difficulty,
                    chatCount: chatCount,
                    user: socket.handshake.session.user, // update the client
                    whoGotIt: socket.handshake.session.user.username
                }
                
                // send notice to the person who got it right
                socket.emit("success_response", successReponse) 
                
                // send notice to everyone else
                delete successReponse.user
                socket.broadcast.to(this.room).emit('success_response', successReponse)

                this.loadQuestion()
            }
        }
    }

    stop() {
        clearInterval(this.intervalId)
    }

    // insert game function 
    start() {
        let gameState = this.gameState
        let timeConstants = this.timeConstants

        this.checkWindowIntegrity();
        this.initialTimeWindow()
            this.printIntermissionStartTime()
            // printTimeWindow()

        // time window starts at intermission
        this.intervalId = setInterval(() => {
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
                    this.updateTimeWindow()
                    // printTimeWindow()
                }

                this.loadQuestionBank()
                this.clearUserStatistics()
            
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
            
            // detect question, then select a new one if the current one expires
            if(gameState.qBank.questionStack.length >= 0 && gameState.isStarted) {
                if(gameState.qBank.currentQuestion.timeLeft == 0 && gameState.qBank.questionStack.length > 0 || gameState.qBank.questionStack.length == gameState.qBank.questionStack.originalLength) 
                {
                    this.loadQuestion();
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

                this.calculateWinner()
            }    

            // console.log(`room ${this.room}: ${dayjs().format("h[h ]m[m ]s[s]\t")}top: ${topWindowState}\tbottom: ${gameState.time.current}`)

            gameState.time.tick++               // used to help the client know where we are in the window

            gameState.time.secondsUntilNextGame = gameState.isIntermission == true
                ? parseInt(gameState.time.started.format("X")) - parseInt(dayjs().format("X"))
                : parseInt(gameState.time.next.add(timeConstants.INTERMISSION + timeConstants.STARTING, "s").format("X")) - parseInt(dayjs().format("X"))
                
            let gameStateEmit = this.mapGameStateForClient()

            this.io.to(this.room).emit("tick", gameStateEmit)

        }, 1000)
    }

    checkWindowIntegrity() {
        let timeConstants = this.timeConstants

        let calculatedTotal = timeConstants.INTERMISSION + timeConstants.STARTING + timeConstants.STARTED + timeConstants.ENDING;
    
        if (calculatedTotal != timeConstants.WINDOW * 60) {
            console.log("window components don't add up to window")
            console.log(`${timeConstants.INTERMISSION} + ${timeConstants.STARTING} + ${timeConstants.STARTED} + ${timeConstants.ENDING} = ${calculatedTotal}`)
            console.log(`WINDOW: ${timeConstants.WINDOW * 60}`);
            process.exit(1)
        }
    }     

    initialTimeWindow() {
        let gameState = this.gameState
        let timeConstants = this.timeConstants


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

    updateTimeWindow() {
        let gameState = this.gameState
        let timeConstants = this.timeConstants

        gameState.time.intermission = gameState.time.next;
    
        gameState.time.starting = gameState.time.intermission.add(timeConstants.INTERMISSION, "s");
        gameState.time.started = gameState.time.starting.add(timeConstants.STARTING, "s");
        gameState.time.ending = gameState.time.started.add(timeConstants.STARTED, "s");
        gameState.time.next = gameState.time.ending.add(timeConstants.ENDING, "s");
    }

    calculateWinner() {
        let gameState = this.gameState
        let userRepo = this.userRepo

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

    printTimeWindow() {
        let gameState = this.gameState

        console.log("-- time window");
        console.log(`\tintermission\t: ${gameState.time.intermission.format("h[h] m[m] s[s]")}`)
        console.log(`\tstarting\t: ${gameState.time.starting.format("h[h] m[m] s[s]")}`)
        console.log(`\tstarted\t\t: ${gameState.time.started.format("h[h] m[m] s[s]")}`)
        console.log(`\tending\t\t: ${gameState.time.ending.format("h[h] m[m] s[s]")}`)
        console.log(`\tnext\t\t: ${gameState.time.next.format("h[h] m[m] s[s]")}`)
    }

    printIntermissionStartTime() {
        console.log(`intermission begins at ${this.gameState.time.intermission.format("h[h] m[m] s[s]")}`)
    }

    loadQuestionBank() {  // returns original number of questions before question stack 
        let gameState = this.gameState
       
        console.log("loading question bank...")
        let path = `./questions/questions_slang.json`;
    
        fs.readFile(path, (err, raw) => {
    
            if (err) {
                console.log("failed bank load")
                throw err;
            }
            gameState.qBank.loaded = JSON.parse(raw)
            gameState.qBank.questionStack = this.shuffle(gameState.qBank.loaded.questions)

            gameState.qBank.questionStack.originalLength = gameState.qBank.questionStack.length

            return 
        });
    }

    loadQuestion() {
        let gameState = this.gameState

        // load question
        
        gameState.qBank.currentQuestion = gameState.qBank.questionStack.pop()
        gameState.qBank.currentQuestion.timeLeft = this.timeConstants.QUESTION_TIME
        gameState.qBank.currentQuestion.timeAlloted = this.timeConstants.QUESTION_TIME
        
        gameState.qBank.currentQuestion.questionNumber = ++gameState.questionCount

        console.log("question chosen\n", gameState.qBank.currentQuestion);
    }

    clearUserStatistics() {
        let sockets = this.io.sockets.sockets
        let userRepo = this.userRepo
        let gameState = this.gameState


        Object.keys(sockets).forEach(key => {
            let socket = sockets[key]
            console.log("clearUserStatistics --- socket")
            // console.log(socket)

            let guid;
            try {
                guid = socket.handshake.session.user.guid
            } catch(e) {
                console.log("socket.handshake.session.user error")
                console.log(socket.handshake.session.user)
            }

            if(socket.rooms.hasOwnProperty(this.room)) {
                socket.handshake.session.user.answered = 0
                socket.handshake.session.user.points = 0
                userRepo[guid].answered = 0
                userRepo[guid].points = 0
            }
        })
   
        gameState.winners = []
    }

    printUserRepo() {
        console.log("--- user repo ---")
        for(var email in userRepo) {
            user = userRepo[email]
            console.log(user.username, user.email, user.password, user.guid)
        }
    }

    /* ------------------ UTILITY FUNCTIONS ------------------- */
    
    // snips the more repo esque properties to save bandwidth
    // look at a questions_xyz.json file to see what the object looks like
    mapGameStateForClient() {
        let clone = JSON.parse(JSON.stringify(this.gameState))
        
        delete clone.qBank.loaded.questions
        delete clone.qBank.questionStack

        delete clone.time.intermission
        delete clone.time.starting
        delete clone.time.started
        delete clone.time.ending
        // delete clone.time.next
    
        return clone;
    }

    mapQBankForClient() {
        let clone = JSON.parse(JSON.stringify(gameState.qBank))
        delete clone.qBank.loaded.questions
        delete clone.qBank.questionStack

        return clone;
    }
    
    mapRepoUserToClientUser(user) {
        let clone = JSON.parse(JSON.stringify(user))
        delete clone.created
        delete clone.last
        delete clone.email
        delete clone.password
        
        clone.isRegistered = user.email == null ? false : true              // toggles whether they see logout or register/login
    
        return clone
    }
    
    // shuffle array non destructive
    shuffle(array) {
        let a = [...array];
    
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }
}    
