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
            this.email = null
            this.password = null

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


