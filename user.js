module.exports = {
    User: class User {
        constructor(username = null, domain = null) {
            // setup
            let date = new dayjs()
            
            // user
            this.created = date.format()
            this.last = date.format()
            this.guid = Math.random()
            this.username = username
        }
    }
}


