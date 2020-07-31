var dayjs = require('dayjs')

module.exports = {
    User: class User {
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
            
            /* items sent to client */

            this.username = username

            // current round          
            this.answered = 0
            this.points = 0
            
            // lifetime achievement
            this.lifeTimeAnswered = 0
            this.lifeTimePoints = 0

            this.lastQuestionAnswered = 0         // used to avoid repeat successes during the current question
        }
    }
}


