
/* ------------------ UI SETUP -------------------- */

// -- DOM objects
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

// --- USER DATA
var currentUserName = "";
var currentUserGUID = "";
var cookieData;
var game = {}

try {
    cookieData = JSON.parse(getCookie("userData"));
}
catch(e) { } 

if(cookieData) {
    currentUserName = cookieData.username;
    userInputElement.value = cookieData.username;
    tinyHeaderUserNameElement.innerHTML = cookieData.username || "someone";
    currentUserGUID = cookieData.guid;
}
else {
    tinyHeaderUserNameElement.innerHTML = "someone"
}

// --- MISCELLANEOUS

var networkPort = 3000
var validUserPattern = /^[a-z0-9_-]{1,16}$/
var socket = io()


/* -------------------- USERNAME DRAWER --------------------- */

// --- username & drawer logic
userInputElement.addEventListener("keydown", e => {
    if(e.key == "Enter" || e.key == "NumpadEnter" || e.key == "Tab") {
        e.preventDefault()
        
        if(e.key == "Enter" || e.key == "NumpadEnter") {
            closeDrawerFocusMessageInput()
        }
        else if (e.key == "Tab") {
            messageInputElement.focus()
        }
    } 
})

// --- change user name + validation
let timer = null;
userInputElement.addEventListener("keyup", e => {
    
    let username = e.target.value;
    clearUsernameValidationDisplays()
    if(username == currentUserName) return;

    if(validUserPattern.test(username)) {
        checkingUsernameElement.style.display = "inline"
        
        // buffer for UX, lookup waits a second
        clearTimeout(timer)
        timer = setTimeout(()=> {
            socket.emit('username_update', {username, guid: currentUserGUID})
        }, 1000)
    }
    else {
        bogusUsernameElement.style.display = "inline";
    }
})

var userInputMouseDown = false
var userInputArrivedByTab = false

document.body.addEventListener('mousedown', function (e) {
    if(e.targetid != "username") {
        userInputArrivedByTab = false
    }
})

userInputElement.addEventListener('mousedown', function () {
    userInputMouseDown = true
})

userInputElement.addEventListener('focusin', function () {
    if(!userInputMouseDown && !drawerIsOpen()) {
        openDrawer()
        userInputArrivedByTab = true
    }
    userInputMouseDown = false
})

userInputElement.addEventListener("blur", e => {
    if(userInputArrivedByTab)
    closeDrawer()
    
    userInputArrivedByTab = false
    tinyHeaderUserNameElement.innerHTML = currentUserName || "someone"
})

drawerHandleElement.addEventListener("click", toggleDrawerFreeFLoat)

socket.on("username_update_response", msg => {          // { username, foundDuplicate }

    if(msg.foundDuplicate) {
        clearUsernameValidationDisplays();
        inUseUsernameElement.style.display = "inline"
    }
    else {
        // fun effect for successful lookup
        currentUserName = msg.username
        tinyHeaderUserNameElement.innerHTML = currentUserName || "someone"
        clearUsernameValidationDisplays();
        usernameLookupSuccessElement.classList.remove("off")
        setTimeout(() => { usernameLookupSuccessElement.classList.add("off") }, 0)
    }
})

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


/*  --------- GAME SETUP ---------- */

frontEnd = {
    isCountDown: false,
    itsTheFinalCountDown: false,
    isActive: false,
    isInProgress: false,
    isIntermission: false,
    question: {}
}

/*  --------- GAME LOOP ---------- */
socket.on('tick', server => {
    /* { startTime, endTime, nextGameIn, isActive, logString, startGameFlag, endGameFlag,
        isQuestionLoaded, currentQuestion } */
    
    // console.log("game.isActive", isActive, "frontEnd.isActive", frontEnd.isActive, "server.nextGameIn", server.nextGameIn);

    if(server.isActive) {

        game.startGame()
    }


    


    switch(true) {                          // TODO: switch may not be ideal here since not all scenarios are mutually exclusive

        // start game
        case server.startGameFlag == true:
            frontEnd.isCountDown = false;
            frontEnd.itsTheFinalCountDown = false;

            document.querySelector(".next-game-in-wrapper").style.visibility = "hidden"
            game.startGame()
            frontEnd.isActive = true;
            break;

        // end game scenario where the user had logged in mid game. removes displayInProgressScreen animation
        case server.endGameFlag == true && frontEnd.isActive == false:
            displayInProgressScreen(false)
            break;

        // end game
        case server.endGameFlag == true && Object.keys(game).length != 0:
            game.endGame(5)    
            frontEnd.isActive = false;
            break;

        // start header countdown
        case server.nextGameIn && frontEnd.isCountDown == false:
            frontEnd.isCountDown = true;
            document.querySelector(".next-game-in").innerHTML = server.nextGameIn
            document.querySelector(".next-game-in-wrapper").style.visibility = "visible"
            break;

        // update header countdown and possibly put up the intermission screen
        case server.nextGameIn && frontEnd.isCountDown == true:
            
            // header countdown
            document.querySelector(".next-game-in").innerHTML = server.nextGameIn

            // intermission screen, awaits a clear window from the .endGame method of Games
            if(frontEnd.itsTheFinalCountDown == false && frontEnd.isIntermission == false && gameWindowElement.childElementCount == 0){
                frontEnd.isIntermission = true;
                displayIntermissionScreen();
            }
            break;          

        // user logged in mid-game, show in progress screen
        case server.nextGameIn == null && server.isActive == true && frontEnd.isActive == false && frontEnd.isInProgress == false:
            console.log("logged in mid game")
            frontEnd.isInProgress = true;
            displayInProgressScreen()
            break;

        default:
    }
    
    // init game and start final countdown
    if (server.nextGameIn && server.nextGameIn <= 10 && frontEnd.itsTheFinalCountDown == true) {
        frontEnd.isInProgress == false;
        game.count(server.nextGameIn)
    }


    if (server.nextGameIn && server.nextGameIn <= 10 && frontEnd.itsTheFinalCountDown == false) {
        frontEnd.itsTheFinalCountDown = true;
        
        // clear intermission screen
        frontEnd.isIntermission = false;           
        gameWindowElement.innerHTML = "";
        
        game = new Games("game-window", "generic", "slang")
        game.startCountDown(server.nextGameIn)
    }

    // load question
    if (frontEnd.isActive == true) {
        frontEnd.question = frontEnd.currentQuestion
    }

    // console.log("startGameFlag:", startGameFlag, "endGameFlag:", endGameFlag)
    
});

/* ------------------ FUNCTIONS ------------------ */

// --- drawer functions
function openDrawer() {
    document.body.classList.add("drawer-is-open");
    document.getElementById("username").value = currentUserName || "";
    clearUsernameValidationDisplays();
}

function closeDrawer() {
    document.body.classList.remove("drawer-is-open");
    tinyHeaderUserNameElement.innerHTML = currentUserName || "someone"
}

function toggleDrawerFreeFLoat() {
    drawerIsOpen() ? closeDrawer() : openDrawer()
}

function closeDrawerFocusMessageInput() {
    closeDrawer();
    messageInputElement.focus()
}

function drawerIsOpen() {
    return document.body.classList.contains("drawer-is-open")
        ? true
        : false
}

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