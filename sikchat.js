
const express = require('express')
const app = express()
const http = require('http').Server(app)
const io = require('socket.io')(http)
const cookieParser = require('cookie-parser')
const User = require('./classes.js').User

app.use(cookieParser());
app.use(express.static(__dirname + "/public/"));

var usersRepo = [];

app.get('/', function(req, res) {
    
    // load page
    res.sendFile(__dirname + '/index.html');
    console.log("req.cookie--------", req.cookies);

    // detect or create user
    if(!req.cookies.userData) {
        let user = new User()
        usersRepo.push(user)
        
        res.cookie("userData", JSON.stringify(user));
    }
    else {


    }




    // res.cookie(name_of_cookie, value_of_cookie);
    // res.send("<pre>" + JSON.stringify(req.query) + "</pre>"); 
});



io.on('connection', (socket) => {
    console.log("user connected");

    socket.on('chat_message', (msg) => {
        io.emit('chat_message', msg);
        console.log(msg)
    })

    socket.on('moniker_update', (msg) => {
        io.emit('moniker_update', msg);
        console.log(msg)
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
