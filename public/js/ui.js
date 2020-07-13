
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

var messagesElement = document.getElementById("messages")

// cookie data
var currentUserName = "";
var currentUserGUID = "";
var cookieData;
var gameObject = {}

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

var networkPort = 3000
var validUserPattern = /^[a-z0-9_-]{1,16}$/
var socket = io()

/* -------------------- UI --------------------- */

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


// --- username validation and send to server
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

// { username, foundDuplicate }
socket.on("username_update_response", msg => {

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

// --- send chat
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

// --- receive server tick
socket.on('tick', time => {
    console.log(time);
});

socket.on('start_game', data => {
    gameObject = new Games("game-window", "QA", "slang");
    gameObject.startGame();
});

socket.on('end_game', data => {
    gameObject.endGame();
    gameObject = {};
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
