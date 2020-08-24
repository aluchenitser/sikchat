
/* ------------------ SETUP -------------------- */

// validator regex
var validEmailPattern = /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/
var validatePasswordPattern = /^(?=.*\d).{4,8}$/;   

// DOM objects
var messageInputElement = document.getElementById('message-input')
var submitButtonElement = document.getElementById('submit-button')
var drawerHandleElement = document.querySelector('.drawer-handle')

var userInputElement = document.getElementById('username')

// var tinyHeaderUserNameElement = document.querySelector('.tiny-header-user-name')

var gameWindowElement = document.getElementById("game-window")
var messagesElement = document.getElementById("messages")


var changeUsernameElement = document.querySelector(".user-label-wrap .change-username")

var sideBarElement = document.querySelector(".side-bar")
var openSideBar = document.querySelector(".open-side-bar")

var PMBarElement = document.querySelector(".pm-bar")
var openPMBar = document.querySelector(".open-pm-bar")

var closeSideBar = document.querySelector(".close-side-bar")
var closePMBar = document.querySelector(".close-pm-bar")



var sideBarToggle = document.getElementById("side-bar-toggle")
var tabSegue1 = document.getElementById("tab-segue-1")

var logOutWrapElement = document.querySelector(".logout-wrap")
var logOutElement = document.querySelector(".logout-wrap .logout")
var logOutToggleElement = document.getElementById("logout-toggle")

var loginChoosersElement = document.querySelector(".login-choosers")
var loginChoosersToggleElement = document.getElementById("login-choosers-toggle")

var roomsWrapperElement = document.querySelector(".rooms-wrapper")
var PMUsersWrapperElement = document.querySelector(".pm-users-wrapper")

var progressBarElement
var startedWrapStartedElement

// game state
var gameState = {

    // live time checkpoints
    time: {
        current: "",
        tick: null,
        ticks: null,
        secondsUntilNextGame: null
    },

    //user 
    session: {
        id: null,
        user: null,
        debug: false
    },

    // game loop flags
    isIntermission: false,      // start of time window
    isStarting: false,          // countdown
    isStarted: false,           // game is in session
    isEnding: false,            // outro
    alreadyInProgress: false,
    noFlag: true,                // similar to isInit on the backend, but doesn't explicitly receive a signal
    winners: []
}

// read session
!function() {
    let debug = getCookie("sik_debug")
    let rooms = getCookie("sik_rooms")
    let data = getCookie("sik_user")
    
    if (data == undefined || debug == undefined || rooms == undefined) {
        throw "bogus cookies: browser may have cookies disabled"
    }
    else {
        console.log(data);

        gameState.session.user = JSON.parse(data)
        gameState.session.rooms = JSON.parse(rooms)
        gameState.session.debug = debug

        userInputElement.value = gameState.session.user.username

        logOutToggleElement.checked = gameState.session.user.isRegistered
            ? true
            : false

        let markup = ""
        gameState.session.rooms.forEach(room => {
            markup += "<div class='room' tabindex='0' sik-room='" + room + "'><div class='room-inner'>" + room + "</div></div>"
        })

        roomsWrapperElement.innerHTML = markup
        roomsWrapperElement.querySelector("[sik-room=" + gameState.session.user.room + "]").classList.add("chosen")

        console.log(gameState.session.rooms)
    }
}()

/*  --------- GAME LOOP ---------- */

// client states are "intermission", "starting", "started", "ending", and "inprogress"
// server also has "init"
var socket = io() 

socket.on("reload_page", () => {
    console.log("received reload_page")
    location.reload()
})

if(gameState.session.debug == "host") {
    socket.close()
}

disableAlreadyInProgress = true           // set to true when developing

socket.on('tick', server => {
    // console.log('tick!')

    gameState.time = server.time
    gameState.qBank = server.qBank
    gameState.winners = server.winners

    Screen.nextGameIn(server.time.secondsUntilNextGame)
    // console.log("timeLeft",gameState.qBank.currentQuestion.timeLeft, "timeAlloted",gameState.qBank.currentQuestion.timeAlloted)

    setBodyClass(server.time.current)

    if(server.time.current == "intermission" && (gameState.isEnding || gameState.noFlag)) {
        console.log("intermission")

        // clear stats
        // gameState.session.user.answered = 0
        // gameState.session.user.points = 0

        if(disableAlreadyInProgress == false) {
            alreadyInProgressBallsAnimation(false)
        }

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
    
    if(server.time.current == "started" && (gameState.isStarting || gameState.noFlag) && gameState.alreadyInProgress == false) {
        // console.log("started")

        if(gameState.noFlag == true && disableAlreadyInProgress == false) {
            Screen.load("already-in-progress").done(() => {
                alreadyInProgressBallsAnimation(true)
                gameState.isStarting = false;
                gameState.isStarted = true;      
            })
        }
        else {
            Screen.load("started").done(() => {
                
                // first question
                Screen.populate("topic", gameState.qBank.loaded.meta.topic)
                Screen.populate("question", gameState.qBank.currentQuestion.question)
                Screen.populate("answer", gameState.qBank.currentQuestion.answer)
    
                progressBarElement = document.querySelector(".progress-bar")
                startedWrapStartedElement = document.querySelector(".started-wrap .started")
                
                // console.log("timeAlloted: ", gameState.qBank.currentQuestion.timeAlloted, "timeLeft: ", gameState.qBank.currentQuestion.timeLeft)
            })
    
            // flags
            gameState.noFlag = false;
            gameState.isStarting = false;
            gameState.isStarted = true;        
        }
    }

    if(server.time.current == "started" && gameState.isStarted == true && gameState.time.tick > 1 && gameState.alreadyInProgress == false) {

        // console.log("inside")
        
        if(gameState.noFlag == true && disableAlreadyInProgress == false) {
            Screen.load("already-in-progress").done(() => {
                alreadyInProgressBallsAnimation(true)
            })
        }
        else {
            Screen.populate("topic", gameState.qBank.loaded.meta.topic)
            Screen.populate("question", gameState.qBank.currentQuestion.question)
            Screen.populate("answer", gameState.qBank.currentQuestion.answer)
    
            // progress bar
            let percent = gameState.qBank.currentQuestion.timeLeft / (gameState.qBank.currentQuestion.timeAlloted - 1) * 100
    
            if(progressBarElement) {
                progressBarElement.style.width = "calc(" + percent + "% + " + 20 * percent / 100 + "px)"
            }
    
            if(startedWrapStartedElement && gameState.qBank.currentQuestion.timeLeft <= 2) {
                startedWrapStartedElement.classList.add("answered")
            }
            else if(startedWrapStartedElement) {
                startedWrapStartedElement.classList.remove("answered")
            }
        }
        // console.log("timeAlloted: ", gameState.qBank.currentQuestion.timeAlloted, "timeLeft: ", gameState.qBank.currentQuestion.timeLeft)
    }

    if(server.time.current == "ending" && (gameState.isStarted || gameState.noFlag) && gameState.alreadyInProgress == false) {
        

        console.log("ending")

        if(gameState.noFlag == true && disableAlreadyInProgress == false) {
            Screen.load("already-in-progress").done(() => {
                alreadyInProgressBallsAnimation(true)
                gameState.isStarted = false;
                gameState.isEnding = true;
            })
        }
        else {
            Screen.load("ending").done(() => {
                Screen.populate("topic", gameState.qBank.loaded.meta.topic)
                Screen.populate("ending-quip", gameState.qBank.loaded.meta["ending-quip"])
                
                Screen.populate("answered", gameState.session.user.answered)
                Screen.populate("points", gameState.session.user.points)
                Screen.populate("lifeTimeAnswered", gameState.session.user.lifeTimeAnswered)
                Screen.populate("lifeTimePoints", gameState.session.user.lifeTimePoints)

                for(user in gameState.winners) {
                    let markup = "<div class='winner'>WINNER: <span>" + gameState.winners[user] + "</span></div>"
                    Screen.insertMarkup("winners_container", markup)
                }

            })

            // flags
            gameState.noFlag = false;
            gameState.isStarted = false;
            gameState.isEnding = true;
        }
    }
});

/* -------------------- CHAT & CHAT INTERACTIONS --------------------- */

// chat bar that the user inputs text into
document.getElementById('chat-form').addEventListener('submit', e => {
    e.preventDefault()
    messageInputElement.focus()
    let text = messageInputElement.value
    if(!text) return false
    
    socket.emit('chat_message', text )
})

// open pm window
$(PMUsersWrapperElement).on("click", ".fa-comment", e => {
    let guid = e.target.parentElement.getAttribute("sik-pm-guid")
     if(document.querySelector(`[id$=pm_window_${guid.substring(2)}]`) == undefined) {
         socket.emit('pm_request', guid)
     }
})

let mouseCoordinates = { x: 0, y: 0 }

document.onmousemove = e => {
    mouseCoordinates.x = e.pageX
    mouseCoordinates.y = e.pageX
}

socket.on('pm_request_success', data => {   // { guid, username, socket }
        let markup = `
            <div class='pm-window' id='pm_window_${data.guid.substring(2)}'>
                <div class="exit">
                    <div></div>
                </div>
                <div class="header">${data.username}</div>
                <div class="chat-area"></div>
                <div class="input">
                    <input type="text" />
                </div>
            </div>
        `
        let PMWindowElement = FEUtils.stringToHTML(markup)
        FEUtils.dragElement(PMWindowElement)
        PMWindowElement.querySelector(".exit").addEventListener("click", () => {

            PMWindowElement.classList.add('exiting')
        })
        
        PMWindowElement.addEventListener("transitionend", () => {
            PMWindowElement.parentNode.removeChild(PMWindowElement);
        })

        document.body.appendChild(PMWindowElement)
})

// open pm menu
document.getElementById('pm-bar-toggle').addEventListener('change', e => {
    if(e.target.checked) {
        socket.emit('pm_bar_opened')
    }
})

// receive who's on chat
socket.on('chat_list_update', users => {
    console.log("chat_list_update")
    console.log(users)

    let markup = ""
    users.forEach(user => {
        markup += "<div class='pm-user' tabindex='0' sik-pm-guid='" + user.guid + "'><div class='pm-user-inner'>" + user.username + "</div><i class='fa fa-comment'></i></div>"
    })

    PMUsersWrapperElement.innerHTML = markup
})


// --- receive chat
socket.on('chat_message_response', chatMessage => {       // { text, chatCount, guid, username }
    let messageClass = gameState.session.user.guid == chatMessage.guid
        ? 'message-output is-current-user'
        : 'message-output'

    console.log("gameState.session.user.guid", gameState.session.user.guid, "chatMessage.guid", chatMessage.guid)

    // add new message to UI
    const markup = `<div id="chat_${chatMessage.chatCount}" class='${messageClass}'><div class='user-name'><span class="user-name-wrap">${chatMessage.username}<span class="stars"><i class="fa fa-star"></i><i class="fa fa-star"></i><i class="fa fa-star"></i></span></span></div><p class='output-text'><span>${chatMessage.text}</span></p></div>`
    $(markup).prependTo("#messages")
    messageInputElement.value = ""
})

// answered a question correctly
socket.on("success_response", successResponse => {     // {difficulty, chatCount, user}

    // add starts to the chat message that succeeded
    let className = successResponse.difficulty;
    document.getElementById("chat_" + successResponse.chatCount).classList.add(className)
    
    // shine effect
    animateOrRepeat(document.getElementById("logo"))
    animateOrRepeat(document.querySelector(".chat-bar"))
    
    let selector = sideBarToggle.checked 
        ? '.side-bar'
        : '.open-side-bar'
    
    animateOrRepeat(document.querySelector(selector), "shine")

    if(successResponse.whoGotIt == gameState.session.user.username) {
        gameState.session.user.answered = successResponse.user.answered
        gameState.session.user.points = successResponse.user.points
        gameState.session.user.lifeTimeAnswered = successResponse.user.lifeTimeAnswered
        gameState.session.user.lifeTimePoints = successResponse.user.lifeTimePoints
        animateOrRepeat(document.querySelector(".success-overlay svg"), "success")
    }
})

socket.on("clear_user_statistics", () => {     // {difficulty, chatCount, user}
    gameState.session.user.answered = 0
    gameState.session.user.points = 0
})


/* -------------------- SESSION --------------------- */

var timeout_user;    
socket.on('username_update_response', data => {    // {username, foundDuplicate}

    changeUsernameElement.textContent = 'checking..'

    setTimeout(() => {
        if(data.foundDuplicate) {
            changeUsernameElement.textContent = 'duplicate'
        }
        else {
            gameState.session.user.username = data.username
            setCookie("sik_user", JSON.stringify(gameState.session.user))
            changeUsernameElement.textContent = 'changed!'
        }

        setTimeout(() => {
            changeUsernameElement.textContent = 'save'
            changeUsernameElement.classList.remove('active')
        }, 2000)
    }, 2000)

})

socket.on("room_change_response", new_room => {
    console.log("room_change_response", new_room)

    roomsWrapperElement.querySelectorAll('.room').forEach(el => el.classList.remove('chosen'))
    document.querySelector(`[sik-room='${new_room}']`).classList.add('chosen')
})

/* ------------------- SIDE BAR --------------------- */

var registerPasswordToggleElement = document.getElementById("register-password-toggle")
var loginWrapToggleElement = document.getElementById("login-wrap-toggle")
var loginWrapTogglerElement = document.getElementById("login-wrap-toggler")
var registerWrapTogglerElement = document.getElementById("register-wrap-toggler")
var registerWrapToggleElement = document.getElementById("register-wrap-toggle")

var emailInputLoginElement = document.getElementById("email-input-login")
var passwordLoginElement = document.getElementById("password-login")
var loginSubmitElement = document.querySelector(".login-submit-wrap .login-submit")
 
var emailInputRegisterElement = document.getElementById("email-input-register")
var passwordRegisterElement = document.getElementById("password-register")
var retypePasswordRegisterElement = document.getElementById("retype-password-register")

var registerSubmitElement = document.querySelector('.register-submit-wrap .register-submit')
var registerSubmitStatusElement = document.querySelector('.register-submit-wrap .register-submit-status')

// --- ROOMS

$(roomsWrapperElement).on("keydown", ".room", e => {
    if(e.key == "Enter" || e.key == "NumpadEnter" || e.key == ' ' || e.key == 'Spacebar') {
        socket.emit("room_change", e.target.textContent)

        // roomsWrapperElement.querySelectorAll('.room').forEach(el => el.classList.remove('chosen'))
        // e.target.classList.add('chosen')
    }
})

$(roomsWrapperElement).on("click", ".room", e => {
    socket.emit("room_change", e.target.textContent)

    // roomsWrapperElement.querySelectorAll('.room').forEach(el => el.classList.remove('chosen'))
    // e.currentTarget.classList.add('chosen')
})


// --- TABBING & TOGGLERS

openSideBar.addEventListener("focus", e => {
    if(sideBarToggle.checked == true && e.relatedTarget == closeSideBar) {
        messageInputElement.focus()
    }
    else if(sideBarToggle.checked == true) {
       closeSideBar.focus()
    }
})

tabSegue1.addEventListener("focus", e => {
    if(e.relatedTarget == messageInputElement && sideBarToggle.checked == false) {
        openSideBar.focus()
    }
    else if (e.relatedTarget == messageInputElement && sideBarToggle.checked == true) {
        closeSideBar.focus()
    }
    else {
        messageInputElement.focus()
    }
})

messageInputElement.addEventListener("blur", e => {
    if(e.shiftKey && sideBarToggle.checked == false) {
        openSideBar.focus()
    }
})

openSideBar.addEventListener("keyup", e => {
    if(e.key == "Enter" || e.key == "NumpadEnter" || e.key == ' ' || e.key == 'Spacebar') {
        sideBarToggle.checked = true
        closeSideBar.focus()
    }
})

closeSideBar.addEventListener("focus", e => {
    if (e.relatedTarget == openSideBar && sideBarToggle.checked == false) {
        messageInputElement.focus()
    }
})

closeSideBar.addEventListener("keyup", e => {
    if(e.key == "Enter" || e.key == "NumpadEnter" || e.key == ' ' || e.key == 'Spacebar') {
        sideBarToggle.checked = false
        openSideBar.focus()
    }
})

openSideBar.addEventListener("click", clearSideBar)

loginWrapTogglerElement.addEventListener("click", toggleLogin)

loginWrapTogglerElement.addEventListener("keydown", e => {
    if(e.key == "Enter" || e.key == "NumpadEnter" || e.key == ' ' || e.key == 'Spacebar') {
        toggleLogin()
    }
    else if (e.key == "ArrowRight") {
        registerWrapTogglerElement.focus()
    }
})

registerWrapTogglerElement.addEventListener("click", toggleRegister)

registerWrapTogglerElement.addEventListener("keydown", e => {
    if(e.key == "Enter" || e.key == "NumpadEnter" || e.key == ' ' || e.key == 'Spacebar') {
        toggleRegister()
    }
    else if (e.key == "ArrowLeft") {
        loginWrapTogglerElement.focus()
    }    
})

// --- USERNAME

changeUsernameElement.addEventListener("click", e => {
    if(changeUsernameElement.classList.contains("active")) {
        submitUserNameChange(e)
    }
})

changeUsernameElement.addEventListener("keyup", e => {
    if(changeUsernameElement.classList.contains("active") && e.key == "Enter" || e.key == "NumpadEnter") {
        submitUserNameChange(e)
    }
})

changeUsernameElement.addEventListener("blur", e => {
    if(changeUsernameElement.textContent == 'save' && e.relatedTarget != userInputElement) {
        changeUsernameElement.classList.remove("active")
        userInputElement.value = gameState.session.user.username
    }
})

var originalValue = userInputElement.value
userInputElement.addEventListener("focus", e => { 
    originalValue = userInputElement.value
})

userInputElement.addEventListener("keydown", e => {
    if(e.key == "Enter" || e.key == "NumpadEnter") {
        e.preventDefault()
        submitUserNameChange(e)
    } 
})

userInputElement.addEventListener("keyup", e => { 
    if(originalValue != e.target.value) {
        changeUsernameElement.classList.add("active")
    }
    console.log("KEYUP: e.target.value", e.target.value, "userInputElement.value", userInputElement.value);
})

userInputElement.addEventListener("blur", e => { 

    if(changeUsernameElement.textContent == 'save' && e.relatedTarget != changeUsernameElement) {
        changeUsernameElement.classList.remove("active")
        userInputElement.value = gameState.session.user.username
    }
})

// --- REGISTER

emailInputRegisterElement.addEventListener("keyup", e => {
    if(validEmailPattern.test(e.target.value)) {
        registerPasswordToggleElement.checked = true;
        sideBarElement.classList.add("square");
    }
    else {
        registerPasswordToggleElement.checked = false;
        sideBarElement.classList.remove("square");        
    }
})

emailInputRegisterElement.addEventListener("keydown", e => {
    if(e.key == "Enter" || e.key == "NumpadEnter") {
        submitRegistration()
    } 
})

passwordRegisterElement.addEventListener("keyup", registerPasswordsAreValid)
passwordRegisterElement.addEventListener("keydown", e => {
    if(e.key == "Enter" || e.key == "NumpadEnter") {
        submitRegistration()
    } 
})

retypePasswordRegisterElement.addEventListener("keyup", registerPasswordsAreValid)
retypePasswordRegisterElement.addEventListener("keydown", e => {
    if(e.key == "Enter" || e.key == "NumpadEnter") {
        submitRegistration()
    } 
})

registerSubmitElement.addEventListener("click", submitRegistration)

registerSubmitElement.addEventListener("keyup", e => {
    if(e.key == "Enter" || e.key == "NumpadEnter") {
        submitRegistration()
    } 
})


// --- LOGIN

emailInputLoginElement.addEventListener("keyup", e => {
    validEmailPattern.test(e.target.value) && passwordLoginElement.value.length > 0
        ? loginSubmitElement.classList.add('valid')
        : loginSubmitElement.classList.remove('valid')
})

emailInputLoginElement.addEventListener("keydown", e => {
    if(e.key == "Enter" || e.key == "NumpadEnter") {
        submitLogin()
    } 
})

passwordLoginElement.addEventListener("keyup", e => {
    validEmailPattern.test(emailInputLoginElement.value) && passwordLoginElement.value.length > 0
       ? loginSubmitElement.classList.add('valid')
       : loginSubmitElement.classList.remove('valid')
})

passwordLoginElement.addEventListener("keydown", e => {
    if(e.key == "Enter" || e.key == "NumpadEnter") {
        submitLogin()
    } 
})

loginSubmitElement.addEventListener("click", submitLogin);
loginSubmitElement.addEventListener("keyup", e => {

    if(e.key == "Enter" || e.key == "NumpadEnter") {
        submitLogin()
    }
})

// --- LOGOUT

logOutElement.addEventListener("click", e => {
    window.location.href = window.location.href + "logout"
})

logOutElement.addEventListener("keyup", e => {
    if(e.key == "Enter" || e.key == "NumpadEnter") {
        window.location.href = window.location.href + "logout"
    }
})


/* -------------------- FUNCTIONS --------------------- */
/* -------------------- FUNCTIONS --------------------- */
/* -------------------- FUNCTIONS --------------------- */

function alreadyInProgressBallsAnimation(bool) {

    console.log("-- alreadyInProgressBallsAnimation --")
    if(bool == false) {
        console.log("cancelling alreadyInProgressBallsAnimation")
        gameState.alreadyInProgress = false
        return
    }

    var ballsWrapElement = document.querySelector(".balls-wrap")

    if(ballsWrapElement instanceof Element && bool == true) {
        gameState.alreadyInProgress = true
    }
    else {
        gameState.alreadyInProgress = false
        return
    }
    
    var propertyValues = ["flex-start", "flex-end", "center", "space-between", "space-around"]
    
    var rand;
    (function loop() {
        rand = Math.floor(Math.random() * 3000 + 250);
        setTimeout(function() {
            if(ballsWrapElement instanceof Element) {
                let jcValue = propertyValues[Math.floor(Math.random() * 5)]
                ballsWrapElement.style.justifyContent = jcValue
            }
            if(gameState.alreadyInProgress == false) {
                return;
            }
            loop();  
        }, rand);
    }());
}

function registerPasswordsAreValid(e) {

    if(validatePasswordPattern.test(passwordRegisterElement.value) && 
        validatePasswordPattern.test(retypePasswordRegisterElement.value) &&
        passwordRegisterElement.value == retypePasswordRegisterElement.value) {

        registerSubmitElement.classList.add("valid")
    }
    else {
        registerSubmitElement.classList.remove("valid")
    }
}

function clearSideBar() {
    loginWrapToggleElement.checked = false
    registerWrapToggleElement.checked = false
    emailInputRegisterElement.value = ""
    emailInputLoginElement.value = ""
    passwordRegisterElement.value = ""
    retypePasswordRegisterElement.value = ""
    userInputElement.value = gameState.session.user.username

    registerSubmitElement.classList.remove("valid")
    // userInputElement.value = gameState.session.user.username || "someone"
}

// username functions
function submitUserNameChange(e) {
    // var validUserPattern = /^[a-z0-9_-]{1,16}$/

    var validUserPattern = /^[a-zA-Z0-9 ]*$/
    let username = userInputElement.value;

    if(validUserPattern.test(username) && username != gameState.session.user.username) {
        changeUsernameElement.textContent = "checking.."
        socket.emit('username_update', username)
    }
}

function toggleLogin() {
    registerWrapToggleElement.checked = false;
    loginWrapToggleElement.checked = !loginWrapToggleElement.checked

    if(loginWrapToggleElement.checked) {
        sideBarElement.classList.add("square")
        emailInputLoginElement.focus()
    }
    else {
        sideBarElement.classList.remove("square")
    }
}

function toggleRegister() {
    loginWrapToggleElement.checked = false;
    registerWrapToggleElement.checked = !registerWrapToggleElement.checked    
    
    if(registerWrapToggleElement.checked == true) {
        emailInputRegisterElement.focus()
    }
    
    if(registerPasswordToggleElement.checked == true) {
        sideBarElement.classList.add("square")
    }
    else {
        sideBarElement.classList.remove("square")
    }
}

function submitLogin() {
    if(loginSubmitElement.classList.contains('valid')) {
        
        console.log(emailInputLoginElement.value,passwordLoginElement.value)
        loginSubmitElement.textContent = "checking.."
        loginSubmitElement.setAttribute("disabled", true)
        
        $.ajax({ url: '/', type: 'POST', contentType: 'application/json',
            data: JSON.stringify({email: emailInputLoginElement.value, password: passwordLoginElement.value, username: gameState.session.user.username, register: false }),
            success: function(response){                // {msg, username}
                if(response.msg == "success") {
                    // registerSubmitStatusElement.value = ""
                    setTimeout(() => {
                        loginSubmitElement.textContent="success!"
                        setTimeout(() => {
                            loginSubmitElement.removeAttribute("disabled")
                            document.querySelectorAll(".toggles").forEach( el => el.checked = false )
                            emailInputLoginElement.value = ""
                            passwordLoginElement.value = ""
                            loginSubmitElement.textContent="submit"
                            logOutToggleElement.checked = true;
                            sideBarElement.classList.remove("square")
                            userInputElement.value = response.username
                        }, 2000)
                    }, 2000)
                }
                else {
                    loginSubmitElement.textContent="failed login"
                    setTimeout(() => {
                        loginSubmitElement.removeAttribute("disabled")
                        loginSubmitElement.textContent="submit"
                    }, 2000)
                }
            },
            error: function(err) {
                console.log("error returned from login")
                console.log(err);
            }
        })
    }
}

function submitRegistration() {
    if(registerSubmitElement.classList.contains('valid')) {
        // console.log(emailInputRegisterElement.value,passwordRegisterElement.value)
        registerSubmitElement.textContent = "checking.."
        registerSubmitElement.setAttribute("disabled", true)

        $.ajax({
            url: '/',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({email: emailInputRegisterElement.value, password: passwordRegisterElement.value, username: gameState.session.user.username, register: true}),
            success: function(response){
                if(response.msg == "registration success") {
                    // registerSubmitStatusElement.value = ""
                    setTimeout(() => {
                        registerSubmitElement.textContent="success!"
                        setTimeout(() => {
                            document.querySelectorAll(".toggles").forEach( el => el.checked = false )
                            sideBarElement.classList.remove("square")
                            registerSubmitElement.removeAttribute("disabled")
                            registerSubmitElement.textContent="submit"
                            registerSubmitElement.classList.remove("valid")
                            logOutToggleElement.checked = true;
                            
                            passwordRegisterElement.value = ''
                            passwordLoginElement.value = ''
                            emailInputRegisterElement.value = ''
                            userInputElement.value = response.username
                        }, 2000)
                    }, 2000)
                }
                else {
                    registerSubmitElement.textContent="duplicate email!"
                    setTimeout(() => {
                        registerSubmitElement.textContent="submit"
                        registerSubmitElement.removeAttribute("disabled")
                        registerSubmitElement.classList.remove("valid")

                        emailInputRegisterElement.value = ''
                        passwordRegisterElement.value = ''
                        retypePasswordRegisterElement.value = ''

                        emailInputRegisterElement.focus()
                    }, 2000)
                }
            }
        })
    }
}

//UI functions
function animateOrRepeat(element, addOnClass = null) {
    if(addOnClass == null || element.classList.contains(addOnClass)) {
        element.style.animation = 'none'
        setTimeout(() => {
            element.style.animation = ''
        }, 15)
    }
    else {
        element.classList.add(addOnClass)
    }
}

function setBodyClass(current) {
    if(document.body.classList.contains(current) == false) {
        document.body.classList.remove('init', 'intermission', 'starting', 'started', 'ending')
        document.body.classList.add(current)
    }
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