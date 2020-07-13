// --- Games engine. Requires J-Query 

class Games {

    // gameElement is id attribute of an html element
    // gameName chooses which game
    constructor(gameId, gameType, gameName) {
        this.gameId = gameId
        this.gameParentElement = document.getElementById(gameId)
        this.gameName = gameName
        this.gameType = gameType

        this.gameMarkup = null

        if(!this.gameParentElement) {
            console.error("can't find a suitable parent element with this id attribute")
            return null;
        }

        switch(this.gameType) {
            case "QA": 
                this.displayFile = "QA.html"
                break;
            default: {
                console.error("no name for template");
                return null;
            }            
        }
    }

    startGame() {
        this.loadTemplate()
            .then(() => {
                this.populateTemplate();
                this.displayTemplate();
            },() => {
                console.error("game file load failed");
            });
    }

    endGame() {
        this.gameParentElement.innerHTML = "";
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
            window.z = template.content.firstChild;
        })
    }
    populateTemplate() {

        switch(this.gameName.toUpperCase()) {
            case 'SLANG':
                this.gameMarkup.querySelector("#game-header").innerHTML = "Talk Street?";
                this.gameMarkup.querySelector("#game-sub-header").innerHTML = "GET CRED";
                break;
            default:
                console.error("no name for game")
                return false;;
        }
    }
    
    displayTemplate() {
        $(this.gameMarkup).appendTo(this.gameParentElement);
    }


}
