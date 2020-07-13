module.exports = {
    User: class User {
        constructor(username = null, domain = null) {
            // setup
            let d = new Date()
            let createdDate = JSON.stringify(d)
            d.setFullYear(2050)
            let expiresDate = JSON.stringify(d)

            // browser
            this.path = "/"
            this.expires = expiresDate
            if(domain) this.domain = domain
            
            // user info
            this.created = createdDate
            this.last = createdDate
            this.guid = Math.random()
            this.username = username
        }
    },
    GameCreate: class GameCreate {
        constructor(name, startTime, questions = {}) {
            this.startTime  = startTime
            this.name = name
            this.topPlayer = null
            this.questions = questions
        }
    
        startGame() {
    
        }
    },
    /* ------------- QUESTION BANK ------------- */
    questions: {
        // template
        QA: {
            //game
            slang: [
                { qeustion: null,
                answer: null
                },
                { qeustion: null,
                    answer: null
                },
                { qeustion: null,
                answer: null
                },
                { qeustion: null,
                answer: null
                },
                { qeustion: null,
                answer: null
                },
                { qeustion: null,
                answer: null
                },
                { qeustion: null,
                answer: null
                },
                { qeustion: null,
                answer: null
                },
                { qeustion: null,
                answer: null
                },
                { qeustion: null,
                answer: null
                }
            ]
        }
    }
}


