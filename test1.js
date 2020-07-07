
const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);


app.get('/', function(req, res) {
    // res.send('Hello world!');

    res.sendFile(__dirname + '/index.html');
    // res.send("<pre>" + JSON.stringify(req.query) + "</pre>"); 
});

app.use(express.static(__dirname + "/public"));


io.on('connection', (socket) => {
    console.log('a user connected');

    socket.on('chat_message', (msg) => {
        console.log(msg);
        io.emit('chat_message', msg);
    })

    socket.on('disconnect', () => {
        console.log('user disconnected');
    });
});

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