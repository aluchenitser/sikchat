// simplified versions of the program for debug & dev purposes
const express = require('express')
const app = express()
const http = require('http').Server(app)

// dayjs is a much lighter momentjs
var dayjs = require('dayjs')
// var isSameOrAfter = require('dayjs/plugin/isSameOrAfter')
// dayjs.extend(isSameOrAfter)
// var utc = require('dayjs/plugin/utc')
// dayjs.extend(utc)

const cookieParser = require('cookie-parser')
app.use(cookieParser());

exports.host = function() {
    app.use(express.static(__dirname + "/public/"));

    // console.log(dayjs().utc().format())
    app.get('/', function(req, res) {

        // res.cookie("debug", "host", {expires: dayjs().format(), path: "/"})
        res.cookie("sik_debug", "host", {path: "/"})
        res.sendFile(__dirname + '/index.html');
    })
    


    http.listen(3000, function() {
        console.log(`listening on *:${3000}`);
    });

    return;    
}