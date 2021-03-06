
exports.printUserRepo = (userRepo, msg) => {
    console.log(msg)
    console.log(`\tkey, username, email, password, guid, answered, points`)

    for(var key in userRepo) {
        let user = userRepo[key]
        console.log("\trepouser:", key, user.username, user.email, user.password, user.guid, user.answered, user.points)
    }
}

exports.printSessions = (store, msg) => {
    console.log(msg)

    store.all(function(err, sessions) {
        console.log("\tsessions:", Object.keys(sessions).length)
        Object.keys(sessions).forEach(sess => {
            if(sessions[sess].user) {
                let user = sessions[sess].user
                console.log("\tsessionuser:", user.username, user.email, user.password, user.guid, user.answered, user.points)
            }
        })
    });
}


exports.printSocketSessions = (io, msg) => {
    console.log(msg)

    Object.keys(io.sockets.sockets).forEach(key => {
        let socket = io.sockets.sockets[key]
        if(socket.handshake.session && socket.handshake.session.user) {
            let user = socket.handshake.session.user
            console.log("\tsocketuser:", user.username, user.email, user.password, user.guid, user.answered, user.points)
        }
        else {
            console.log("\t\t", "--socket without session--")
        }
    })
}

exports.getUserSocket = (io, guid) => {
    // console.log("_exports.getUserSocket")
    
    let info = undefined;

    Object.keys(io.sockets.sockets).forEach(key => {
        let socket = io.sockets.sockets[key]
        if(socket.handshake.session && socket.handshake.session.user && socket.handshake.session.user.guid == guid) {
            info = {
                guid: guid,
                username: socket.handshake.session.user.username,
                socket: socket
            }
        }
    })

    return info
}

exports.getRoomUsers = (io, room, requestingGuid) => {  // requestingGuid optionally that user
    let roomUsers = []

    Object.keys(io.sockets.sockets).forEach(key => {
        let socket = io.sockets.sockets[key]
        if(socket.handshake.session && 
            socket.handshake.session.user && 
            socket.handshake.session.user.room == room) {

            if(requestingGuid && requestingGuid == socket.handshake.session.user.guid) {
                return;
            }

            roomUsers.push({ username: socket.handshake.session.user.username, guid: socket.handshake.session.user.guid})
        }
    })

    return roomUsers
}


