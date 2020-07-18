
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
var tinyHeaderUserNameElement = document.querySelector('.tiny-header-user-name')
var gameWindowElement = document.getElementById("game-window")

var messagesElement = document.getElementById("messages")

// cookies
var user;
try {
    user = JSON.parse(getCookie("userData"))
}
catch(e) { throw "fail load: browser may have cookies disabled" }

user.username = user.username || "someone"
userInputElement.value = user.username
tinyHeaderUserNameElement.innerHTML = user.username

// game state
var fameState = {

    // live time checkpoints
    time: {
        intermission: null,
        starting: null,
        start: null,
        ending: null,
        next: null,
        current: ""
    },

    // game loop flags
    isIntermission: false,      // start of time window
    isStarting: false,          // countdown
    isStarted: false,           // game is in session
    isEnding: false,            // outro
    noFlag: true                // similar to isInit on the backend, but doesn't explicitly receive a signal
}

/*  --------- GAME LOOP ---------- */
// client states are "intermission", "starting", "started", and "ending"
// server also has "init"

var socket = io()
var states = ["init", ]
socket.on('tick', server => {
    let state = server.time.current

    if(server.time.current == "intermission" && (fameState.isEnding || fameState.noFlag)) {
        console.log("intermission")

        Screen.load("intermission").then(() => {
            Screen.display("game-window")
            // console.log(Screen.vm)
            // console.log(Screen.markup)
        })


        // flags
        fameState.noFlag = false;
        
        fameState.isEnding = false;
        fameState.isIntermission = true;
    }

    if(server.time.current == "starting" && (fameState.isIntermission || fameState.noFlag)) {
        console.log("starting")


        // flags
        fameState.noFlag = false;

        fameState.isIntermission = false;
        fameState.isStarting = true;        
    }

    if(server.time.current == "started" && (fameState.isStarting || fameState.noFlag)) {
        console.log("started")


        // flags
        fameState.noFlag = false;

        fameState.isStarting = false;
        fameState.isStarted = true;        
    }

    if(server.time.current == "ending" && (fameState.isStarted || fameState.noFlag)) {
        console.log("ending")


        // flags
        fameState.noFlag = false;

        fameState.isStarted = false;
        fameState.isEnding = true;
    }







    return;



    console.log(server);
    /* { startTime, endTime, nextGameIn, isActive, logString, startGameFlag, endGameFlag,
        isQuestionLoaded, currentQuestion } */
    
    // console.log("game.isActive", isActive, "fameState.isActive", fameState.isActive, "server.nextGameIn", server.nextGameIn);

    if(server.isActive) {

        game.startGame()
    }
    


    switch(true) {                          // TODO: switch may not be ideal here since not all scenarios are mutually exclusive

        // start game
        case server.startGameFlag == true:
            fameState.isCountDown = false;
            fameState.itsTheFinalCountDown = false;

            document.querySelector(".next-game-in-wrapper").style.visibility = "hidden"
            game.startGame()
            fameState.isActive = true;
            break;

        // end game scenario where the user had logged in mid game. removes displayInProgressScreen animation
        case server.endGameFlag == true && fameState.isActive == false:
            displayInProgressScreen(false)
            break;

        // end game
        case server.endGameFlag == true && Object.keys(game).length != 0:
            game.endGame(5)    
            fameState.isActive = false;
            break;

        // start header countdown
        case server.nextGameIn && fameState.isCountDown == false:
            fameState.isCountDown = true;
            document.querySelector(".next-game-in").innerHTML = server.nextGameIn
            document.querySelector(".next-game-in-wrapper").style.visibility = "visible"
            break;

        // update header countdown and possibly put up the intermission screen
        case server.nextGameIn && fameState.isCountDown == true:
            
            // header countdown
            document.querySelector(".next-game-in").innerHTML = server.nextGameIn

            // intermission screen, awaits a clear window from the .endGame method of Games
            if(fameState.itsTheFinalCountDown == false && fameState.isIntermission == false && gameWindowElement.childElementCount == 0){
                fameState.isIntermission = true;
                displayIntermissionScreen();
            }
            break;          

        // user logged in mid-game, show in progress screen
        case server.nextGameIn == null && server.isActive == true && fameState.isActive == false && fameState.isInProgress == false:
            console.log("logged in mid game")
            fameState.isInProgress = true;
            displayInProgressScreen()
            break;

        default:
    }
    
    // init game and start final countdown
    if (server.nextGameIn && server.nextGameIn <= 10 && fameState.itsTheFinalCountDown == true) {
        fameState.isInProgress == false;
        game.count(server.nextGameIn)
    }


    if (server.nextGameIn && server.nextGameIn <= 10 && fameState.itsTheFinalCountDown == false) {
        fameState.itsTheFinalCountDown = true;
        
        // clear intermission screen
        fameState.isIntermission = false;           
        gameWindowElement.innerHTML = "";
        
        game = new Games("game-window", "generic", "slang")
        game.startCountDown(server.nextGameIn)
    }

    // load question
    if (fameState.isActive == true) {
        fameState.question = fameState.currentQuestion
    }

    // console.log("startGameFlag:", startGameFlag, "endGameFlag:", endGameFlag)
    
});


/* -------------------- CHAT --------------------- */

document.getElementById('form').addEventListener('submit', e => {
    e.preventDefault()
    messageInputElement.focus()
    let text = messageInputElement.value
    if(!text) return false
    let username = currentUserName || 'someone';
    
    socket.emit('chat_message', { text, username })
})

// --- receive chat
socket.on('chat_message_response', msg => { 
    let user = userInputElement.value || 'someone'; 
    let messageClass = currentUserName == msg.username
        ? 'message-output is-current-user'
        : 'message-output'

    // add new message to UI
    const markup = `<div class='${messageClass}'><div class='user-name'><span>${msg.username}</span></div><p class='output-text'>${msg.text}</p></div>`
    $(markup).appendTo("#messages")
    messageInputElement.value = ""
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

function displayInProgressScreen(bool) {
    console.log("--- displayInProgressScreen ---");
    
    if(bool == false) {
        killTheGameInProgressLoop = true;           // TODO: find a way other than this global, which exists in gameinprogress.js
        gameWindowElement.innerHTML = "";
    }
    else {
        templateElement = document.getElementById("game-in-progress-template");
        var clonedElement = templateElement.content.cloneNode(true);
        gameWindowElement.appendChild(clonedElement);
    }
}


function displayIntermissionScreen(bool) {
    console.log("--- displayIntermissionScreen ---");
    
    if(bool == false) {
        let intermissionElement = document.querySelector(".intermission")
        intermissionElement.parentNode.removeChild(intermissionElement)
    }
    else {
        templateElement = document.getElementById("intermission-template");
        var clonedElement = templateElement.content.cloneNode(true);
        gameWindowElement.appendChild(clonedElement);
    }
}

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