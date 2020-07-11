
const express = require('express')
const app = express()
const http = require('http').Server(app)
const io = require('socket.io')(http)
const cookieParser = require('cookie-parser')
const User = require('./util.js').User

app.use(cookieParser());
app.use(express.static(__dirname + "/public/"));

var usersRepo = [];

app.get('/', function(req, res) {
    console.log(usersRepo);
    // load page
    res.sendFile(__dirname + '/index.html');

    // --- detect or create user

    // create user
    if(!req.cookies.userData) {
        let user = new User()
        usersRepo.push(user)
        
        res.cookie("userData", JSON.stringify(user));
    }
    // detect user
    else {
        let data = JSON.parse(req.cookies.userData)

        let i = 0;
        let found = false;
        while(i < usersRepo.length) {
            if (usersRepo[i].guid == data.guid) {
                found = true;
                break;
            }
            i++;
        }
        
        // should repopulate a corrupt cookie?
        res.cookie("userData", JSON.stringify(found ? usersRepo[i] : data))
        if(found == false) usersRepo.push(data)
    }
});



io.on('connection', (socket) => {
    console.log("user connected");

    // { username, text }
    socket.on('chat_message', (msg) => {
        io.emit('chat_message_response', msg);
        console.log(msg)
    })

    // { username, guid }
    socket.on('username_update', (msg) => {
        let foundDuplicate = false;

        // look for duplicate moniker
        let i = 0;
        while(i < usersRepo.length) {
            if (usersRepo[i].moniker == msg.username) {
                foundDuplicate = true;
                break;
            }
            i++;
        }

        // if all is clear, update the user with the new moniker
        let j = 0;
        if(!foundDuplicate) {
            while(j < usersRepo.length) {
                if (usersRepo[j].guid == msg.guid) {
                    usersRepo[j].moniker = msg.username;
                    break;
                }
                j++;
            }
        }

        io.emit('username_update_response', {username: msg.username, foundDuplicate});
        console.log({username: msg.username, foundDuplicate});
    })

    socket.on('disconnect', () => {
        console.log('user disconnected');
    });
});

function isUserUnique(username) 
{

}

// io.sockets.on('connection', function(socket) {
//     socket.on('username', function(username) {
//         socket.username = username;
//         io.emit('is_online', '🔵 <i>' + socket.username + ' join the chat..</i>');
//     });

//     socket.on('disconnect', function(username) {
//         io.emit('is_online', '🔴 <i>' + socket.username + ' left the chat..</i>');
//     })

//     socket.on('chat_message', function(message) {
//         io.emit('chat_message', '<strong>' + socket.username + '</strong>: ' + message);
//     });

// });

// command line port selection or default to 3000
let port = parseInt(process.argv[2]);
port = port && port >= 1023 && port <= 65535
    ? port
    : 3000;

const server = http.listen(port, function() {
    console.log(`listening on *:${port}`);
});
