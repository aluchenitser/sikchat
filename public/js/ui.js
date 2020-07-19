
/* ------------------ SETUP -------------------- */

// DOM objects
var messageInputElement = document.getElementById('message-input')
var submitButtonElement = document.getElementById('submit-button')
var drawerHandleElement = document.querySelector('.drawer-handle')

var userInputElement = document.getElementById('username')
var bogusUsernameElement = document.querySelector('.bogus-username')
var inUseUsernameElement = document.querySelector('.in-use-username')
var checkingUsernameElement = document.querySelector('.checking-username')
var usernameLookupSuccessElement = document.querySelector('.username-lookup-success')
// var tinyHeaderUserNameElement = document.querySelector('.tiny-header-user-name')
var gameWindowElement = document.getElementById("game-window")

var messagesElement = document.getElementById("messages")

// game state
var gameState = {

    // live time checkpoints
    time: {
        current: "",
        tick: null,
        ticks: null
    },

    //user 
    session: {
        id: null,
        data: null,
        debug: false
    },

    // game loop flags
    isIntermission: false,      // start of time window
    isStarting: false,          // countdown
    isStarted: false,           // game is in session
    isEnding: false,            // outro
    noFlag: true                // similar to isInit on the backend, but doesn't explicitly receive a signal
}


// read session
!function() {
    let id = getCookie("sik_id")
    let data = getCookie("sik_data")
    let debug = getCookie("sik_debug")
    
    if (id == undefined || data == undefined || debug == undefined) {
        throw "bogus cookies: browser may have cookies disabled"
    }
    else {
        gameState.session.id = id
        gameState.session.data = data
        gameState.session.debug = debug

        userInputElement.value = gameState.session.id
    }
}()

// console.log(gameState)

// tinyHeaderUserNameElement.innerHTML = user.username
/*  --------- GAME LOOP ---------- */
// client states are "intermission", "starting", "started", and "ending"
// server also has "init"
var socket = io() 
if(gameState.session.debug == "host") {
    socket.close()
}

socket.on('tick', server => {

    gameState.time = server.time
    gameState.qBank = server.qBank
    // console.log(gameState.time)
    // console.log(gameState.qBank)

    if(server.time.current == "intermission" && (gameState.isEnding || gameState.noFlag)) {
        console.log("intermission")
        Screen.load("intermission")

        // flags
        gameState.noFlag = false;
        gameState.isEnding = false;
        gameState.isIntermission = true;
    }

    if(server.time.current == "starting" && (gameState.isIntermission || gameState.noFlag)) {
        console.log("starting")
        Screen.load("starting").done(() => {
            Screen.populate("count-down", gameState.time.ticks - gameState.time.tick)
        })


        // flags
        gameState.noFlag = false;
        gameState.isIntermission = false;
        gameState.isStarting = true;        
    }

    if(server.time.current == "starting" && gameState.isStarting == true && gameState.time.tick > 1) {
        Screen.populate("count-down", gameState.time.ticks - gameState.time.tick)
    }

    if(server.time.current == "started" && (gameState.isStarting || gameState.noFlag)) {
        console.log("started")
        Screen.load("started").done(() => {

            // first question
            Screen.populate("topic", gameState.qBank.topic)
            Screen.populate("question", gameState.qBank.currentQuestion.question)
            Screen.populate("answer", gameState.qBank.currentQuestion.answer)
        
            // console.log("timeAlloted: ", gameState.qBank.currentQuestion.timeAllotted, "timeLeft: ", gameState.qBank.currentQuestion.timeLeft)
        })

        // flags
        gameState.noFlag = false;
        gameState.isStarting = false;
        gameState.isStarted = true;        
    }

    if(server.time.current == "started" && gameState.isStarted == true && gameState.time.tick > 1) {
        
        Screen.populate("topic", gameState.qBank.topic)
        Screen.populate("question", gameState.qBank.currentQuestion.question)
        Screen.populate("answer", gameState.qBank.currentQuestion.answer)

        // console.log("timeAlloted: ", gameState.qBank.currentQuestion.timeAllotted, "timeLeft: ", gameState.qBank.currentQuestion.timeLeft)
    }

    if(server.time.current == "ending" && (gameState.isStarted || gameState.noFlag)) {
        console.log("ending")
        Screen.load("ending")

        // flags
        gameState.noFlag = false;
        gameState.isStarted = false;
        gameState.isEnding = true;
    }
});



/* -------------------- CHAT --------------------- */

document.getElementById('chat-form').addEventListener('submit', e => {
    e.preventDefault()
    messageInputElement.focus()
    let text = messageInputElement.value
    if(!text) return false
    let id = gameState.session.id;
    console.log("egress", id)
    
    socket.emit('chat_message', { text, id })
})

// --- receive chat
socket.on('chat_message_response', msg => {       // { username, text }
console.log(msg)
    let user = userInputElement.value || 'someone'; 
    let messageClass = user.id == msg.id
        ? 'message-output is-current-user'
        : 'message-output'

    // add new message to UI
    const markup = `<div id="chat_${msg.chatNumber}" class='${messageClass}'><div class='user-name'><span>${msg.id}</span></div><p class='output-text'>${msg.text}</p></div>`
    $(markup).prependTo("#messages")
    messageInputElement.value = ""
})

socket.on("correct_answer", msg => {     // {difficulty, chatNumber}
    let className = msg.difficulty;

    document.getElementById("chat_" + msg.chatNumber).classList.add(className)
})

/* -------------------- SESSION --------------------- */



/* -------------------- DRAWER --------------------- */
var validUserPattern = /^[a-z0-9_-]{1,16}$/

// // --- username & drawer logic
// userInputElement.addEventListener("keydown", e => {
//     if(e.key == "Enter" || e.key == "NumpadEnter" || e.key == "Tab") {
//         e.preventDefault()
        
//         if(e.key == "Enter" || e.key == "NumpadEnter") {
//             closeDrawerFocusMessageInput()
//         }
//         else if (e.key == "Tab") {
//             messageInputElement.focus()
//         }
//     } 
// })

// // --- change user name + validation
// let timer = null;
// userInputElement.addEventListener("keyup", e => {
    
//     let username = e.target.value;
//     clearUsernameValidationDisplays()
//     if(username == currentUserName) return;

//     if(validUserPattern.test(username)) {
//         checkingUsernameElement.style.display = "inline"
        
//         // buffer for UX, lookup waits a second
//         clearTimeout(timer)
//         timer = setTimeout(()=> {
//             socket.emit('username_update', {username, guid: currentUserGUID})
//         }, 1000)
//     }
//     else {
//         bogusUsernameElement.style.display = "inline";
//     }
// })

// var userInputMouseDown = false
// var userInputArrivedByTab = false

// document.body.addEventListener('mousedown', function (e) {
//     if(e.targetid != "username") {
//         userInputArrivedByTab = false
//     }
// })

// userInputElement.addEventListener('mousedown', function () {
//     userInputMouseDown = true
// })

// userInputElement.addEventListener('focusin', function () {
//     if(!userInputMouseDown && !drawerIsOpen()) {
//         openDrawer()
//         userInputArrivedByTab = true
//     }
//     userInputMouseDown = false
// })

// userInputElement.addEventListener("blur", e => {
//     if(userInputArrivedByTab)
//     closeDrawer()
    
//     userInputArrivedByTab = false
//     tinyHeaderUserNameElement.innerHTML = currentUserName || "someone"
// })

// drawerHandleElement.addEventListener("click", toggleDrawerFreeFLoat)

// socket.on("username_update_response", msg => {          // { username, foundDuplicate }

//     if(msg.foundDuplicate) {
//         clearUsernameValidationDisplays();
//         inUseUsernameElement.style.display = "inline"
//     }
//     else {
//         // fun effect for successful lookup
//         currentUserName = msg.username
//         tinyHeaderUserNameElement.innerHTML = currentUserName || "someone"
//         clearUsernameValidationDisplays();
//         usernameLookupSuccessElement.classList.remove("off")
//         setTimeout(() => { usernameLookupSuccessElement.classList.add("off") }, 0)
//     }
// })

/* ------------------ FUNCTIONS ------------------ */

// --- drawer functions
// function openDrawer() {
//     document.body.classList.add("drawer-is-open");
//     document.getElementById("username").value = currentUserName || "";
//     clearUsernameValidationDisplays();
// }

// function closeDrawer() {
//     document.body.classList.remove("drawer-is-open");
//     tinyHeaderUserNameElement.innerHTML = currentUserName || "someone"
// }

// function toggleDrawerFreeFLoat() {
//     drawerIsOpen() ? closeDrawer() : openDrawer()
// }

// function closeDrawerFocusMessageInput() {
//     closeDrawer();
//     messageInputElement.focus()
// }

// function drawerIsOpen() {
//     return document.body.classList.contains("drawer-is-open")
//         ? true
//         : false
// }



// --- username functions

function clearUsernameValidationDisplays() {
    inUseUsernameElement.style.display = "none"
    bogusUsernameElement.style.display = "none"
    checkingUsernameElement.style.display = "none"
}

// --- cookie functions

function getCookie(name) {
    let matches = document.cookie.match(new RegExp(
        "(?:^|; )" + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + "=([^;]*)"
    ));
    return matches ? decodeURIComponent(matches[1]) : undefined;
}

function setCookie(name, value, options = {}) {

    options = {
        path: '/',
        // add other defaults here if necessary
        ...options
    };

    if (options.expires instanceof Date) {
        options.expires = options.expires.toUTCString();
    }

    let updatedCookie = encodeURIComponent(name) + "=" + encodeURIComponent(value);

    for (let optionKey in options) {
        updatedCookie += "; " + optionKey;
        let optionValue = options[optionKey];
        if (optionValue !== true) {
            updatedCookie += "=" + optionValue;
        }
    }

    document.cookie = updatedCookie;
}