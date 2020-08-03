var utils = require('./utils.js')

var dayjs = require('dayjs')
    var isSameOrAfter = require('dayjs/plugin/isSameOrAfter')
    var advancedFormat = require('dayjs/plugin/advancedFormat')
    dayjs.extend(isSameOrAfter)
    dayjs.extend(advancedFormat)

class Game {
   
    constructor({
        roomName, 
        windowLengths = defaultWindowLengths, 
        questionLengths = defaultQuestionLengths, 
        questionPoints = defaultQuestionLengths
    })
    {
        utils.isValidWindow(windowLengths) == true
            ? this.windowLengths = windowLengths
            : process.exit(1)
       

        this.roomName = roomName                                    
        this.questionLengths = questionLengths              // how long the players are given to answer xyz difficulty level questions
        this.questionPoints = questionPoints            // how many points are assigned for xyz difficulty questions

        // game loop flags
        this.flags = {
            isPreLoad: true,            // first iteration
            isInit: false,              // purgatory before first real window
            isIntermission: false,      // start of time window
            isStarting: false,          // countdown
            isStarted: false,           // game is in session
            isEnding: false,            // outro
        }

        // live time data
        this.time = {
            intermission: null,
            starting: null,
            started: null,
            ending: null,
            next: null,
            current: "",
            tick: null,
            ticks: null,
            secondsUntilNextGame: null
        }

        // live question data for the game
        this.qBank = {                  

            // from JSON file
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
            
            // questions are popped from this stack as they're asked
            questionStack: []
        }

        this.winners = []               // will contain one or more winners one scores are calculated

        this.counters = {
            chatCount: 0,               // increments for each chat sent in the room
            questionCount: 0            // increments for each new question asked
        }

        // portion of the userRepo for this room
        this.users = {                  
            
        }

        this.intervalId = null         // the game loop setInterval will be assigned to this
    }

    start() {

    }

    end() {

    }

    /* --- DEFAULTS --- */
    
    static get defaultWindowLengths() {
        return {
            WINDOW: 2, // total length of game in minutes. sections must add up to equal this.
        
            // length of game sections in seconds
            INTERMISSION: 10,
            STARTING: 10,
            STARTED: 90,
            ENDING: 10,
        }
    }

    static get defaultQuestionLengths() {
        return {
            QUESTION_EASY: 10,
            QUESTION_MEDIUM: 15,
            QUESTION_HARD: 20,
        }
    }

    static get defaultQuestionPoints() {
        return {
            "easy": 4,
            "medium": 9,
            "hard": 15
        }
    }
}

setInterval(() => {
    let topWindowState = this.time.current

    // acknowledge limbo period (init) before the first game window has started
    if(dayjs().isBefore(this.time.intermission) && this.flags.isPreLoad) {

        // flags
        this.flags.isPreLoad = false;
        this.time.current = "init";
        this.flags.isInit = true;
    }

    // proceed to intermission, also window update
    if(dayjs().isSameOrAfter(this.time.intermission) && this.flags.isInit || dayjs().isSameOrAfter(this.time.next) && this.flags.isEnding) {
        // update window
        if(this.flags.isEnding) {
           utils.updateTimeWindow()
            // printTimeWindow()
        }

        loadQuestionBank()
        clearUserStatistics()
    
        //flags
        this.flags.isInit = false
        this.time.tick = 0
        this.time.ticks = timeConstants.INTERMISSION
        this.flags.isEnding = false
        this.time.current = "intermission"
        this.flags.isIntermission = true
    }

    // proceed to starting
    if(dayjs().isSameOrAfter(this.time.starting) && this.flags.isIntermission) { 

        // flags
        this.time.tick = 0
        this.time.ticks = timeConstants.STARTING
        this.flags.isIntermission = false;
        this.time.current = "starting";
        this.flags.isStarting = true;
    }
    
    // proceed to started
    if(dayjs().isSameOrAfter(this.time.started) && this.flags.isStarting) { 
        // console.log("started");
        
        // flags
        this.time.tick = 0
        this.time.ticks = timeConstants.STARTED
        this.flags.isStarting = false;
        this.time.current = "started";
        this.flags.isStarted = true;
    }
    
    // detect question, then select new ones as old ones expire
    if(this.qBank.questionStack.length >= 0 && this.flags.isStarted) {
        if(this.qBank.currentQuestion.timeLeft == 0 && this.qBank.questionStack.length > 0 || this.qBank.questionStack.length == this.qBank.questionStack.originalLength) 
        {
            loadQuestion();
        }
        this.qBank.currentQuestion.timeLeft--
       
        // console.log("current question timeLeft: ", this.qBank.currentQuestion.timeLeft)
    }

    // proceed to ending
    if(dayjs().isSameOrAfter(this.time.ending) && this.flags.isStarted) { 
    
        // flags
        this.time.tick = 0
        this.time.ticks = timeConstants.ENDING
        this.flags.isStarted = false;
        this.time.current = "ending";
        this.flags.isEnding = true;

        calculateWinner()
    }    

    console.log(`${dayjs().format("h[h ]m[m ]s[s]\t")}top: ${topWindowState}\tbottom: ${this.time.current}`)

    this.time.tick++               // used to help the client know where we are in the window

    this.time.secondsUntilNextGame = this.flags.isIntermission == true
        ? parseInt(this.time.started.format("X")) - parseInt(dayjs().format("X"))
        : parseInt(this.time.next.add(timeConstants.INTERMISSION + timeConstants.STARTING, "s").format("X")) - parseInt(dayjs().format("X"))
        
    let thisEmit = mapthisForClient()

    io.emit("tick", thisEmit)

}, 1000)
module.exports = Game