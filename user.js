module.exports = {
    User: class User {
        constructor(username = null, domain = null) {
            // setup
            let date = new dayjs()

            // cookie
            this.path = "/"
            this.expires = date.add(50,"y").format()
            if(domain) this.domain = domain
            
            // user
            this.created = date.format()
            this.last = date.format()
            this.guid = Math.random()
            this.username = username
        }
    }
}


