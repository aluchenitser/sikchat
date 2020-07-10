module.exports = {
    User: class User {
        constructor(moniker = null, domain = null) {
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
            this.moniker = moniker
        }
    }
}

