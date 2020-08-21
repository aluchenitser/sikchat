
exports.printUser = user => {
    console.log("\t", user.username, user.email, user.password, user.guid, user.answered, user.points)
}

exports.printUserRepo = (userRepo, msg) => {
    console.log(msg)
    console.log("\tkey, username, email, password, guid, answered, points")
    for(var key in userRepo) {
        exports.printUser(userRepo[key])
    }
}

exports.printSessions = (store, msg) => {
    console.log(msg)
    store.all(function(err, sessions) {
        console.log("\tsessions:", Object.keys(sessions).length)
        Object.keys(sessions).forEach(sess => {
            if(sessions[sess].user) {
                let user = sessions[sess].user
                exports.printUser(user)
            }
        })
    });
}


exports.printSocketSessions = (io, msg) => {
    console.log(msg)
    console.log(`\tsockets: ${Object.keys(io.sockets.sockets).length}\n\tdata, guid, views`)

    Object.keys(io.sockets.sockets).forEach(key => {
        let socket = io.sockets.sockets[key]
        if(socket.handshake.session) {
            console.log("\t\t", "data", socket.handshake.session.data, "guid", socket.handshake.session.guid, "views", socket.handshake.session.views)
        }
        else {
            console.log("\t\t", "--empty--")
        }
    })
}
