
exports.printUserRepo = (userRepo, msg) => {
    console.log("_exports.printUserRepo")
    console.log(msg)
    console.log(`\tkey, username, email, password, guid, answered, points`)
    for(var key in userRepo) {
        let user = userRepo[key]
        console.log("\t", key, user.username, user.email, user.password, user.guid, user.answered, user.points)
    }
}

exports.printSessions = (store, msg) => {

    console.log("_exports.printSessions")
    console.log(msg)
    console.log(`\tusername, email, password, guid, answered, points`)
    store.all(function(err, sessions) {
        console.log("ENTERED STORE.ALL")

        console.log("\tsessions:", Object.keys(sessions).length)
        Object.keys(sessions).forEach(sess => {
            if(sessions[sess].user) {
                let user = sessions[sess].user
                console.log("\t", user.username, user.email, user.password, user.guid, user.answered, user.points)
            }
        })
    });
}


exports.printSocketSessions = (io, msg) => {
    console.log("_exports.printSocketSessions")
    console.log(msg)
    console.log(`\tsockets: ${Object.keys(io.sockets.sockets).length}`)
    console.log(`\tusername, email, password, guid, answered, points`)

    Object.keys(io.sockets.sockets).forEach(key => {
        let socket = io.sockets.sockets[key]
        if(socket.handshake.session && socket.handshake.session.user) {
            let user = socket.handshake.session.user
            console.log("\t", user.username, user.email, user.password, user.guid, user.answered, user.points)
        }
        else {
            console.log("\t\t", "--no sess or no user--")
        }
    })
}

exports.getUserSocket = (io, username) => {
    console.log("_exports.getUserSocket")
    
    let userSocket = undefined;

    Object.keys(io.sockets.sockets).forEach(guid => {
        let socket = io.sockets.sockets[key]
        if(socket.handshake.session && socket.handshake.session.user && socket.handshake.session.user.guid == guid) {
            userSocket = socket.handshake.session.user
        }
    })

    return userSocket
}

exports.getRoomUsers = (io, room) => {
    let roomUsers = []

    Object.keys(io.sockets.sockets).forEach(key => {
        let socket = io.sockets.sockets[key]
        if(socket.handshake.session && socket.handshake.session.user && socket.handshake.session.user.room == room) {
            roomUsers.push({ username: socket.handshake.session.user.username, guid: socket.handshake.session.user.username})
        }
    })

    return roomUsers
}
