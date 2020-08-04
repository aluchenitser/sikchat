var dayjs = require('dayjs')

class User {
    constructor(email = null, password = null, username = "someone", isRegistered = false) {

        // setup
        let date = new dayjs()
        
        // meta
        this.created = date.format()
        this.last = date.format()
        this.email = email
        this.password = password
        this.guid = Math.random()
        this.isRegistered = isRegistered
        this.username = username

        this.room = "lobby"


        // questions
        this.answered = 0
        this.points = 0
        
        this.lifeTimeAnswered = 0
        this.lifeTimePoints = 0

        this.lastQuestionAnswered = 0         // used to avoid repeat successes during the current question
    }
}

module.exports = User
