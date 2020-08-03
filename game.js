var utils = require('./utils.js')

var dayjs = require('dayjs')
    var isSameOrAfter = require('dayjs/plugin/isSameOrAfter')
    var advancedFormat = require('dayjs/plugin/advancedFormat')
    dayjs.extend(isSameOrAfter)
    dayjs.extend(advancedFormat)

class Game {
   
    constructor({
        roomName, 
        windowLengths = defaultWindowLengths,    // { WINDOW, INTERMISSION, STARTING, STARTED, ENDING }
        loopFunction,
        loopOptions
    })
    {
        utils.isValidWindow(windowLengths) == true
            ? this.windowLengths = windowLengths
            : process.exit(1)
       
        this.roomName = roomName
        this.loopFunction = loopFunction
        this.loopOptions = loopOptions

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
        this.liveTime = {
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

        this.winners = []               // will contain one or more winners one scores are calculated

        this.counters = {
            chatCount: 0,               // increments for each chat sent in the room
            questionCount: 0            // increments for each new question asked
        }

        this.intervalId = null         // the game loop setInterval will be assigned to this
    }

    // insert game function 
    start() {
        this.intervalId = this.loopFunction(this) 
    }

    endLoop() {
        clearInterval(this.intervalId)
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

