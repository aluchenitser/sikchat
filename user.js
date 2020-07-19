var dayjs = require('dayjs')

module.exports = {
    User: class User {
        constructor(username = null, domain = null) {
            // setup
            let date = new dayjs()
            
            // meta
            this.created = date.format()
            this.last = date.format()
            this.username = username
            this.password = null

            // current round          
            this.answered = 0
            this.points = 0
            
            // lifetime achievement
            this.totalAnswered = 0
            this.totalPoints = 0

            this.lastQuestionAnswered = 0         // used to avoid repeat successes during the current question
        }
    }
}


