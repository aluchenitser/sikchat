

module.exports = (game) => {  

    // add counter
    game.counters.questionCount = 0

    var options = game.options
    
    // add game specific object called extension
    var extension = {}
    
    extension.qLengths = options.qLengths || {
        QUESTION_EASY: 10,
        QUESTION_MEDIUM: 15,
        QUESTION_HARD: 20,
    }

    extension.QUESTIONS_BANK_FILES_ARRAY = ["slang", "slang", "slang"];        

    
    extension.qPoints = options.qPoints || {
        "easy": 4,
        "medium": 9,
        "hard": 15
    }

    extension.qBank = {

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
    }

    extension.winners = []

    game.extension = extension

    initialTimeWindow(game)

    return setInterval(() => {
        let topWindowState = game.liveTime.current
    
        // acknowledge limbo period (init) before the first game window has started
        if(dayjs().isBefore(game.liveTime.intermission) && game.flags.isPreLoad) {
    
            // flags
            game.flags.isPreLoad = false;
            game.liveTime.current = "init";
            game.flags.isInit = true;
        }
    
        // proceed to intermission, also window update
        if(dayjs().isSameOrAfter(game.liveTime.intermission) && game.flags.isInit || dayjs().isSameOrAfter(game.liveTime.next) && game.flags.isEnding) {
            // update window
            if(game.flags.isEnding) {
               updateTimeWindow(game)
                // printTimeWindow()
            }
    
            loadQuestionBank()
            clearUserStatistics()
        
            //flags
            game.flags.isInit = false
            game.liveTime.tick = 0
            game.liveTime.ticks = timeConstants.INTERMISSION
            game.flags.isEnding = false
            game.liveTime.current = "intermission"
            game.flags.isIntermission = true
        }
    
        // proceed to starting
        if(dayjs().isSameOrAfter(game.liveTime.starting) && game.flags.isIntermission) { 
    
            // flags
            game.liveTime.tick = 0
            game.liveTime.ticks = timeConstants.STARTING
            game.flags.isIntermission = false;
            game.liveTime.current = "starting";
            game.flags.isStarting = true;
        }
        
        // proceed to started
        if(dayjs().isSameOrAfter(game.liveTime.started) && game.flags.isStarting) { 
            // console.log("started");
            
            // flags
            game.liveTime.tick = 0
            game.liveTime.ticks = timeConstants.STARTED
            game.flags.isStarting = false;
            game.liveTime.current = "started";
            game.flags.isStarted = true;
        }
        
        // detect question, then select new ones as old ones expire
        if(game.qBank.questionStack.length >= 0 && game.flags.isStarted) {
            if(game.qBank.currentQuestion.timeLeft == 0 && game.qBank.questionStack.length > 0 || game.qBank.questionStack.length == game.qBank.questionStack.originalLength) 
            {
                loadQuestion();
            }
            game.qBank.currentQuestion.timeLeft--
           
            // console.log("current question timeLeft: ", game.qBank.currentQuestion.timeLeft)
        }
    
        // proceed to ending
        if(dayjs().isSameOrAfter(game.liveTime.ending) && game.flags.isStarted) { 
        
            // flags
            game.liveTime.tick = 0
            game.liveTime.ticks = timeConstants.ENDING
            game.flags.isStarted = false;
            game.liveTime.current = "ending";
            game.flags.isEnding = true;
    
            calculateWinner()
        }    
    
        console.log(`${dayjs().format("h[h ]m[m ]s[s]\t")}top: ${topWindowState}\tbottom: ${game.liveTime.current}`)
    
        game.liveTime.tick++               // used to help the client know where we are in the window
    
        game.liveTime.secondsUntilNextGame = game.flags.isIntermission == true
            ? parseInt(game.liveTime.started.format("X")) - parseInt(dayjs().format("X"))
            : parseInt(game.liveTime.next.add(timeConstants.INTERMISSION + timeConstants.STARTING, "s").format("X")) - parseInt(dayjs().format("X"))
            
        let thisEmit = mapthisForClient()
    
        io.emit("tick", thisEmit)
    
    }, 1000)
}



function initialTimeWindow(game) {
    /* time window sequence is like so:
        1. intermission 2. game starting (countdown) 3. game started 4. game ending (tally stats) 5. new time window  */

    let now = dayjs()
    
    // calculates time up to the next multiple
    game.liveTime.intermission = dayjs().minute(Math.ceil(now.minute() / timeConstants.WINDOW) * timeConstants.WINDOW).second(0)    // rounds up to next multiple of WINDOW

    // adds a WINDOW length if it's the same minute
    if(now.minute() == game.liveTime.intermission.minute()) {
        game.liveTime.intermission = game.liveTime.intermission.add(timeConstants.WINDOW, "m")
    }

    // setup window sub components
    game.liveTime.starting = game.liveTime.intermission.add(timeConstants.INTERMISSION, "s");
    game.liveTime.started = game.liveTime.starting.add(timeConstants.STARTING, "s");
    game.liveTime.ending = game.liveTime.started.add(timeConstants.STARTED, "s");
    game.liveTime.next = game.liveTime.ending.add(timeConstants.ENDING, "s");
}

function updateTimeWindow() {
    game.liveTime.intermission = game.liveTime.next;

    game.liveTime.starting = game.liveTime.intermission.add(timeConstants.INTERMISSION, "s");
    game.liveTime.started = game.liveTime.starting.add(timeConstants.STARTING, "s");
    game.liveTime.ending = game.liveTime.started.add(timeConstants.STARTED, "s");
    game.liveTime.next = game.liveTime.ending.add(timeConstants.ENDING, "s");
}

function printIntermissionStartTime(game) {
    console.log(`intermission begins at ${game.liveTime.intermission.format("h[h] m[m] s[s]")}`)
}

function loadQuestionBank(game) {  // returns original number of questions before question stack 
    console.log("loading question bank...")


    let name = QUESTIONS_BANK_FILES_ARRAY[Math.floor(Math.random() * QUESTIONS_BANK_FILES_ARRAY.length)];
    let path = `./questions/questions_${name}.json`;

    fs.readFile(path, (err, raw) => {

        if (err) {
            console.log("failed bank load")
            throw err;
        }
        game.extension.qBank.loaded = JSON.parse(raw)

        // --- scrambles then builds questionStack
        let timeLeft = timeConstants.STARTED  // 30
        let shuffled = shuffle(game.extension.qBank.loaded.questions)
        
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
            game.extension.qBank.questionStack.push(question)
        }
        
        // make up the rest by adding time to the final question
        if(timeLeft > 0) {
            game.extension.qBank.questionStack[game.extension.qBank.questionStack.length - 1].timeAllotted += timeLeft
        }

        game.extension.qBank.questionStack.originalLength = game.extension.qBank.questionStack.length

        // logging
        // console.log(`question bank "${game.extension.qBank.loaded.meta.name}" loaded ${game.extension.qBank.questionStack.length} questions`)
        // console.log(game.extension.qBank.questionStack)
        // let totalSeconds = game.extension.qBank.questionStack.reduce((acc, curr) => { return acc + curr.timeAllotted}, 0)
        // console.log(`question bank "${game.extension.qBank.loaded.meta.name}" is ${totalSeconds}s long vs a STARTED of ${timeConstants.STARTED}s`)

        return 
    });
}

function loadQuestion(game) {
  // load question
  
  game.extension.qBank.currentQuestion = game.extension.qBank.questionStack.pop()
  game.extension.qBank.currentQuestion.timeLeft = game.extension.qBank.currentQuestion.timeAllotted
  game.extension.qBank.currentQuestion.questionNumber = ++game.extension.questionCount
  
  game.extension.qBank.currentQuestion.q = game.extension.qBank.questionStack.length + 1
  game.extension.qBank.currentQuestion.of = game.extension.qBank.questionStack.originalLength

//   console.log("question chosen\n", gameState.qBank.currentQuestion);
}
