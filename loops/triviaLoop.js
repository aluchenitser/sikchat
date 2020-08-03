module.exports = function triviaLoop(game) {              
    return setInterval(() => {
        let topWindowState = this.liveTime.current
    
        // acknowledge limbo period (init) before the first game window has started
        if(dayjs().isBefore(this.liveTime.intermission) && this.flags.isPreLoad) {
    
            // flags
            this.flags.isPreLoad = false;
            this.liveTime.current = "init";
            this.flags.isInit = true;
        }
    
        // proceed to intermission, also window update
        if(dayjs().isSameOrAfter(this.liveTime.intermission) && this.flags.isInit || dayjs().isSameOrAfter(this.liveTime.next) && this.flags.isEnding) {
            // update window
            if(this.flags.isEnding) {
               utils.updateTimeWindow(this)
                // printTimeWindow()
            }
    
            loadQuestionBank()
            clearUserStatistics()
        
            //flags
            this.flags.isInit = false
            this.liveTime.tick = 0
            this.liveTime.ticks = timeConstants.INTERMISSION
            this.flags.isEnding = false
            this.liveTime.current = "intermission"
            this.flags.isIntermission = true
        }
    
        // proceed to starting
        if(dayjs().isSameOrAfter(this.liveTime.starting) && this.flags.isIntermission) { 
    
            // flags
            this.liveTime.tick = 0
            this.liveTime.ticks = timeConstants.STARTING
            this.flags.isIntermission = false;
            this.liveTime.current = "starting";
            this.flags.isStarting = true;
        }
        
        // proceed to started
        if(dayjs().isSameOrAfter(this.liveTime.started) && this.flags.isStarting) { 
            // console.log("started");
            
            // flags
            this.liveTime.tick = 0
            this.liveTime.ticks = timeConstants.STARTED
            this.flags.isStarting = false;
            this.liveTime.current = "started";
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
        if(dayjs().isSameOrAfter(this.liveTime.ending) && this.flags.isStarted) { 
        
            // flags
            this.liveTime.tick = 0
            this.liveTime.ticks = timeConstants.ENDING
            this.flags.isStarted = false;
            this.liveTime.current = "ending";
            this.flags.isEnding = true;
    
            calculateWinner()
        }    
    
        console.log(`${dayjs().format("h[h ]m[m ]s[s]\t")}top: ${topWindowState}\tbottom: ${this.liveTime.current}`)
    
        this.liveTime.tick++               // used to help the client know where we are in the window
    
        this.liveTime.secondsUntilNextGame = this.flags.isIntermission == true
            ? parseInt(this.liveTime.started.format("X")) - parseInt(dayjs().format("X"))
            : parseInt(this.liveTime.next.add(timeConstants.INTERMISSION + timeConstants.STARTING, "s").format("X")) - parseInt(dayjs().format("X"))
            
        let thisEmit = mapthisForClient()
    
        io.emit("tick", thisEmit)
    
    }, 1000)
}
