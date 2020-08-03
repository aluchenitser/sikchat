

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

exports.updateTimeWindow = (liveTime, windowLengths) => {
    liveTime.intermission = liveTime.next;

    liveTime.starting = liveTime.intermission.add(windowLengths.INTERMISSION, "s");
    liveTime.started = liveTime.starting.add(windowLengths.STARTING, "s");
    liveTime.ending = liveTime.started.add(windowLengths.STARTED, "s");
    liveTime.next = liveTime.ending.add(windowLengths.ENDING, "s");
}