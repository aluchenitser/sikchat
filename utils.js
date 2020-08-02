

// returns bool
exports.isValidWindow = (windowLengths) => {

    let calculatedTotal = windowLengths.INTERMISSION + windowLengths.STARTING + windowLengths.STARTED + windowLengths.ENDING;

    if (calculatedTotal == windowLengths.WINDOW * 60) {
        return true
    }
    else {
        console.log("window components don't add up to window")
        console.log(`${windowLengths.INTERMISSION} + ${windowLengths.STARTING} + ${windowLengths.STARTED} + ${windowLengths.ENDING} = ${calculatedTotal}`)
        console.log(`WINDOW: ${windowLengths.WINDOW * 60}`);
        return false
    }
}