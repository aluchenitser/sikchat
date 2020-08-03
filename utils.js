

// windowLengths must add up to the W
exports.isValidWindow = (windowLengths) => {
    if(windowLengths.hasOwnProperty(INTERMISSION) &&
        windowLengths.hasOwnProperty(STARTING) &&
        windowLengths.hasOwnProperty(STARTED) &&
        windowLengths.hasOwnProperty(ENDING) &&
        windowLengths.hasOwnProperty(WINDOW)
        == false)
    {
        console.log("windowLengths object has incorrect properties")
        return false        
    }
    else if (windowLengths.INTERMISSION + windowLengths.STARTING + windowLengths.STARTED + windowLengths.ENDING == windowLengths.WINDOW * 60) {
        return true
    }
    else {
        console.log("windowLength components don't add up to total window length")
        return false
    }
}

exports.updateTimeWindow = (game) => {
    game.time.intermission = game.time.next;

    game.time.starting = game.time.intermission.add(timeConstants.INTERMISSION, "s");
    game.time.started = game.time.starting.add(timeConstants.STARTING, "s");
    game.time.ending = game.time.started.add(timeConstants.STARTED, "s");
    game.time.next = game.time.ending.add(timeConstants.ENDING, "s");
}