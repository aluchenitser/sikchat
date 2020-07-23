
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


var changeControlElement = document.querySelector(".user-label-wrap .change-control")
var emailInputElement = document.getElementById("email-input-element")
var sideBarElement = document.querySelector(".side-bar")


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
        gameState.session.data = JSON.parse(data)
        gameState.session.debug = debug

        userInputElement.value = gameState.session.data.username
            ? gameState.session.data.username
            : "someone"
    }
}()

// console.log(gameState)

// tinyHeaderUserNameElement.innerHTML = user.username



/*  --------- GAME LOOP ---------- */

// client states are "intermission", "starting", "started", and "ending"
// server also has "init"
var socket = io({
    id: gameState.session.id
}) 

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
            Screen.populate("starting-h1", gameState.qBank.loaded.meta["starting-h1"])
            Screen.populate("starting-h2", gameState.qBank.loaded.meta["starting-h2"])
            Screen.populate("topic", gameState.qBank.loaded.meta.topic)
                        
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
            Screen.populate("topic", gameState.qBank.loaded.meta.topic)
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
        
        Screen.populate("topic", gameState.qBank.loaded.meta.topic)
        Screen.populate("question", gameState.qBank.currentQuestion.question)
        Screen.populate("answer", gameState.qBank.currentQuestion.answer)

        // console.log("timeAlloted: ", gameState.qBank.currentQuestion.timeAllotted, "timeLeft: ", gameState.qBank.currentQuestion.timeLeft)
    }

    if(server.time.current == "ending" && (gameState.isStarted || gameState.noFlag)) {
        console.log("ending")
        Screen.load("ending").done(() => {
            Screen.populate("topic", gameState.qBank.loaded.meta.topic)
            Screen.populate("ending-quip", gameState.qBank.loaded.meta["ending-quip"])
            
            Screen.populate("answered", gameState.session.data.answered)
            Screen.populate("points", gameState.session.data.points)
            Screen.populate("lifeTimeAnswered", gameState.session.data.lifeTimeAnswered)
            Screen.populate("lifeTimePoints", gameState.session.data.lifeTimePoints)

        })

        // flags
        gameState.noFlag = false;
        gameState.isStarted = false;
        gameState.isEnding = true;
    }
});

socket.on("stats_refresh", ()=> {
    setCookie(sik_data)
})



/* -------------------- CHAT & CHAT INTERACTIONS --------------------- */

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
    let messageClass = gameState.session.id == msg.id
        ? 'message-output is-current-user'
        : 'message-output'

    
    let username = msg.username

    // add new message to UI
    const markup = `<div id="chat_${msg.chatCount}" class='${messageClass}'><div class='user-name'><span>${username}</span></div><p class='output-text'>${msg.text}</p></div>`
    $(markup).prependTo("#messages")
    messageInputElement.value = ""
})

socket.on("success_response", successResponse => {     // {difficulty, chatCount, user}
    let className = successResponse.difficulty;
    gameState.session.data.answered = successResponse.user.answered
    gameState.session.data.points = successResponse.user.points
    gameState.session.data.lifeTimeAnswered = successResponse.user.lifeTimeAnswered
    gameState.session.data.lifeTimePoints = successResponse.user.lifeTimePoints

    document.getElementById("chat_" + successResponse.chatCount).classList.add(className)
})

/* -------------------- SESSION --------------------- */


var timeout_user;    
socket.on('username_update_response', (data)=> {    // {username, foundDuplicate}
    console.log("username_update_response")
    console.log(data)

    if(data.foundDuplicate) {
        changeControlElement.textContent = 'duplicate'
        resetChangeControl()
    }
    else {
        gameState.session.data.username = data.username
        changeControlElement.textContent = 'changed!'
        
        resetChangeControl()
        userInputElement.blur()
        
    }
})

/* ------------------- SIDE BAR --------------------- */

// registerTogglerElement = document.getElementById("register-toggle")

// clear side bar when opening it
document.querySelector(".show-side-bar").addEventListener("click", e => {
    clearSideBar()
})


loginWrapToggleElement = document.getElementById("login-wrap-toggle")
loginWrapTogglerElement = document.getElementById("login-wrap-toggler")

registerWrapToggleElement = document.getElementById("register-wrap-toggle")
registerWrapTogglerElement = document.getElementById("register-wrap-toggler")

loginWrapTogglerElement.addEventListener("click", e => {
    registerWrapToggleElement.checked = false;
    loginWrapToggleElement.checked = !loginWrapToggleElement.checked
})

registerWrapTogglerElement.addEventListener("click", e => {
    loginWrapToggleElement.checked = false;
    registerWrapToggleElement.checked = !registerWrapToggleElement.checked    
})


// -- username mouse logic
changeControlElement.addEventListener("click", (e)=> {
    if(e.target.textContent == "change") {
        userInputElement.removeAttribute("disabled")
        changeControlElement.classList.add("save")
        changeControlElement.textContent = "save"
        userInputElement.focus()
        userInputElement.select()
    }
    else if (e.target.textContent == "save") {
        submitUserNameChange(e)
    }
})


// --- username keyboard logic
userInputElement.addEventListener("keydown", e => {
    if(e.key == "Enter" || e.key == "NumpadEnter") {
        e.preventDefault()
        submitUserNameChange(e)
        userInputElement.removeAttribute("disabled")
    } 
})

userInputElement.addEventListener("blur", e => {    
    userInputElement.setAttribute("disabled", "true")
    if(changeControlElement.textContent == 'save') {
        changeControlElement.textContent = 'change'
        changeControlElement.classList.remove("save")
        userInputElement.value = gameState.session.data.username
    }
})

// just whoah
var validEmailPattern = /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/
var passwordTogglerElement = document.getElementById("password-toggler")

// --- email input logic
emailInputElement.addEventListener("keyup", (e)=> {
    console.log("tap", e.target.value)
    if(validEmailPattern.test(e.target.value)) {
        passwordTogglerElement.checked = true;
        sideBarElement.classList.add("square");
    }
    else {
        passwordTogglerElement.checked = false;
        sideBarElement.classList.remove("square");        
    }
})

var passwordElement = document.getElementById("password");
var retypePasswordElement = document.getElementById("retype-password")

emailInputElement.addEventListener("blur", (e)=> {
    if(emailInputElement.value == "") {
        passwordElement.value = ""
        retypePasswordElement.value = ""
        document.getElementById("register-toggler").checked = false
        document.getElementById("password-toggler").checked = false
    }
})

registerLabelElement = document.querySelector("label.register")
registerLabelElement.addEventListener("click", e => {
    e.preventDefault()
    registerTogglerElement.checked = true
    emailInputElement.focus()
})

passwordElement.addEventListener("keyup", passwordsAreValid)
retypePasswordElement.addEventListener("keyup", passwordsAreValid)




var emailSubmitControlElement = document.querySelector(".email-submit-control");
emailSubmitControlElement.addEventListener("click", e => {

})



/* -------------------- FUNCTIONS --------------------- */
// sidebar functions

var validatePasswordPattern = /^(?=.*\d).{4,8}$/;   

function passwordsAreValid(e) {
    validatePasswordPattern.test(passwordElement.value) && validatePasswordPattern.test(retypePasswordElement.value)
        ? emailSubmitControlElement.classList.add("valid")
        : emailSubmitControlElement.classList.remove("valid")
}

function clearSideBar() {

    document.getElementById("register-toggler").checked = false
    document.getElementById("password-toggler").checked = false
    emailInputElement.value = ""
    passwordElement.value = ""
    retypePasswordElement.value = ""
    emailSubmitControlElement.classList.remove("valid")
    userInputElement.value = gameState.session.data.username || "someone"
}


// email functions 
function submitEmail(e) {
    
    let email = e.target.value;

    if(validUserPattern.test(username)) {
        
        // .. open 2 password fields before submission

    }
}


// username functions
function submitUserNameChange(e) {
    // var validUserPattern = /^[a-z0-9_-]{1,16}$/

    var validUserPattern = /^[a-zA-Z0-9 ]*$/
    let username = e.target.value;

    if(username == gameState.session.id) return;

    if(validUserPattern.test(username)) {
        changeControlElement.textContent = "checking.."
        socket.emit('username_update', {username, id: gameState.session.id})
    }
}


function resetChangeControl() {
    clearTimeout(timeout_user)
    timeout_user = setTimeout(()=> {
        if(document.activeElement != userInputElement) {
            changeControlElement.textContent = 'change'
            changeControlElement.classList.remove("save")

        }
    }, 2000)
}


// cookie functions
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