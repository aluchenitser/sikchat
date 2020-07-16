// --- Games engine. Requires J-Query 

class Game {

    // gameElement is id attribute of an html element
    // name chooses which game
    constructor(id, template, name) {
        this.id = id
        this.parentElement = document.getElementById(id)
        this.name = name
        this.template = template
        
        if(!this.parentElement) {
            console.error("can't find a suitable parent element with this id attribute")
            return null;
        }

        switch(this.template) {
            case "generic": 
                this.displayFile = "generic.html"
                break;
            default: {
                console.error("no name for template");
                return null;
            }            
        }
    }

    /* ------- MAJOR CONTROLS ------- */

    startCountDown(nextGameIn) {
        var self = this;

        return this.loadTemplate()
            .then(() => {
                self.populateTemplate();
                $(self.gameMarkup).appendTo(self.parentElement)
                self.gameMarkup.classList.add("intro")
                self.count(nextGameIn)

                return true;
            },() => {
                console.error("game file load failed");
            });
    }
    
    startGame() {
        this.gameMarkup.classList.remove("intro")
        this.gameMarkup.classList.add("active")
    }

    endGame(timeAlloted) {                              // how long is the outro in seconds
        this.gameMarkup.classList.remove("active")
        this.gameMarkup.classList.add("outro")        

        // fade then delete
        setTimeout(() => {
            this.gameMarkup.querySelector(".outro").style.opacity = 0;

            setTimeout(()=> {
                delete this.gameMarkup
                this.parentElement.innerHTML = "";
            }, 2000)
        }, timeAlloted * 1000)
    }

    count(nextGameIn) {
        this.gameMarkup.querySelector(".game-main .intro .count-down").innerHTML = nextGameIn ? nextGameIn : "";
    }

    loadTemplate() {   
        let self = this;

        return $.get(this.displayFile, data => {
            if(!data) {
                console.error("game file exists but has no markup")
                return false;
            }

            // parse string into markup
            let template = document.createElement('template');
            data = data.trim(); 
            template.innerHTML = data;
            self.gameMarkup = template.content.firstChild;
        })
    }
    populateTemplate() {

        switch(this.name.toUpperCase()) {
            case 'SLANG':
                this.gameMarkup.querySelector(".intro-h1").innerHTML = "Talk Street?";
                this.gameMarkup.querySelector(".intro-h2").innerHTML = "GET CRED";
                break;
            default:
                console.error("no name for game")
                return false;;
        }
    }

    getGameMarkup() {
        return this.gameMarkup || "no game Markup"
    }
}
