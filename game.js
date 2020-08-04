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
            WINDOW: 3,              // components in seconds must add up to this window in minutes

            // in seconds
            INTERMISSION: 10,
            STARTING: 10,
            STARTED: 150,
            ENDING: 10,

            // seconds given to answer a question
            QUESTION_EASY: 10,
            QUESTION_MEDIUM: 15,
            QUESTION_HARD: 20,
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
            chatCount: 0,
            questionCount: 0,

            // logging
            logString: null,
        }



    }

    submitAnswer(answerText, socket) {
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
                    chatCount: gameState.chatCount,
                    user: socket.handshake.session.user // update the client
                }
                
                console.log("correct!!")
                socket.emit("success_response", successReponse)    // { difficulty, chatCount }
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
            
            // detect question, then select new ones as old ones expire
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

            console.log(`${dayjs().format("h[h ]m[m ]s[s]\t")}top: ${topWindowState}\tbottom: ${gameState.time.current}`)

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
        let timeConstants = this.timeConstants
        
        console.log("loading question bank...")
    
    
        let name = this.QUESTIONS_BANK_FILES_ARRAY[Math.floor(Math.random() * this.QUESTIONS_BANK_FILES_ARRAY.length)];
        let path = `./questions/questions_${name}.json`;
    
        fs.readFile(path, (err, raw) => {
    
            if (err) {
                console.log("failed bank load")
                throw err;
            }
            gameState.qBank.loaded = JSON.parse(raw)
    
            // --- scrambles then builds questionStack
            let timeLeft = timeConstants.STARTED  // 30
            let shuffled = tjos/shuffle(gameState.qBank.loaded.questions)
            
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

            return 
        });
    }

    loadQuestion() {
        let gameState = this.gameState

        // load question
        
        gameState.qBank.currentQuestion = gameState.qBank.questionStack.pop()
        gameState.qBank.currentQuestion.timeLeft = gameState.qBank.currentQuestion.timeAllotted
        gameState.qBank.currentQuestion.questionNumber = ++gameState.questionCount
        
        gameState.qBank.currentQuestion.q = gameState.qBank.questionStack.length + 1
        gameState.qBank.currentQuestion.of = gameState.qBank.questionStack.originalLength
      
      //   console.log("question chosen\n", gameState.qBank.currentQuestion);
      }

      clearUserStatistics() {
        let userRepo = this.userRepo
        let gameState = this.gameState
        
        console.log("clear user statistics_______")
    
        for (var user in userRepo) {
            if(userRepo.hasOwnProperty(user)) {
                userRepo[user].answered = 0
                userRepo[user].points = 0
            }
        }
    
        gameState.winners = []
    }

    printUserRepo() {
        console.log("--- user repo ---")
        for(var email in userRepo) {
            user = userRepo[email]
            console.log(user.username, user.email, user.password, user.guid)
        }
    }

    intUser(user) {
        console.log(user.username, user.email, user.password, user.guid)
    }
    
    /* ------------------ UTILITY FUNCTIONS ------------------- */
    
    // snips the more repo esque properties to save bandwidth
    // look at a questions_xyz.json file to see what the object looks like
    mapGameStateForClient() {
        let clone = JSON.parse(JSON.stringify(this.gameState))
    
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
