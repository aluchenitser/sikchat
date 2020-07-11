
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
    repoDisplay("simple");
    
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

        // look for duplicate username
        let i = 0;
        while(i < usersRepo.length) {
            if (usersRepo[i].username == msg.username) {
                foundDuplicate = true;
                break;
            }
            i++;
        }

        // if all is clear, update the user with the new username
        let j = 0;
        if(!foundDuplicate) {
            while(j < usersRepo.length) {
                if (usersRepo[j].guid == msg.guid) {
                    usersRepo[j].username = msg.username;
                    break;
                }
                j++;
            }
        }

        socket.emit('username_update_response', {username: msg.username, foundDuplicate});
        console.log(`username_update_response\n\t${msg.username} foundDuplicate: ${foundDuplicate}`);
    })

    socket.on('disconnect', () => {
        console.log('user disconnected');
    });
});

function repoDisplay(mode) 
{
    console.log("%cuserRepo", "color: green")
    switch(mode) {
        case "simple":
            if(usersRepo.length == 0) {
                console.log("%cempty", "color: green");
                return;
            }
            usersRepo.forEach(item => {
                console.log("%c" + item.username + " " + item.guid, "color: green");
            })
            break;
        // show whole object
        default:
            console.log(usersRepo);
    }
}

// command line port selection or default to 3000
let port = parseInt(process.argv[2]);
port = port && port >= 1023 && port <= 65535
    ? port
    : 3000;

const server = http.listen(port, function() {
    console.log(`listening on *:${port}`);
});