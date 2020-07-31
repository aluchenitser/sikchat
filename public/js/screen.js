var Screen = {
    markup: null,
    tick: 0,
    vm: {},
    load(type, name, display = true) {
        let self = this;

        this.vm = this._models[type]
        if (this.vm == undefined) throw "bogus type"

        return $.get(this.vm.path, data => {
            if(!data) {
                console.error("bogus file")
                return false;
            }

            // load current view model
            this.vm = this._models[type]

            // parse string into markup
            let template = document.createElement('template');
            data = data.trim(); 
            template.innerHTML = data;
            this.markup = template.content.firstChild;

            if(display == true) {
                this.display()
            }

            if(name == "filler") {
                this.populateFiller()
            }
        })
    },

    populate(property, value) {
        if(this.vm.hasOwnProperty(property)) {
            this.vm[property] = value
           
            document.querySelectorAll(`[sik=${property}]`).forEach((element)=> {
                element.textContent = value
            })
        } else { throw "bogus model property" }
    },
    
    // property should read xyz_container (for example: winners_container)
    insertMarkup(property, markup) {
        if(this.vm.hasOwnProperty(property)) {
            this.vm[property] = markup
           
            document.querySelectorAll(`[sik=${property}]`).forEach((element)=> {
                element.innerHTML += markup
            })
        } else { throw "bogus model property" }
    },
    // used for dev / debug purposes
    populateFiller() {
        document.querySelectorAll(`[sik]`).forEach((markup)=> {
            markup.textContent = "FILLER"
        })
    },
    display(id) {       // id optional
        if(this.markup) {

            let windowElement = document.getElementById(id ? id : "game-window")
            windowElement.textContent = ''
            windowElement.appendChild(this.markup)
        } else { throw "nothing to display"}
    },
    nextGameIn(seconds) {
        document.getElementById("next-game-in").textContent = seconds
    },

    // properties here match [sik] attributes in view files
    _models: {
        intermission: {
            "path": "../components/intermission/intermission.html"
        },
        starting: {
            "path": "../components/starting/starting.html",
            "topic": null,
            "count-down": null,
            "starting-h1": null,
            "starting-h2": null
        },
        started: {
            "path": "../components/started/started.html",
            "topic": null,
            "question": null,
            "answer": null,
            
            // question # of total #
            "q": null,
            "of": null

        },
        ending: {
            "path": "../components/ending/ending.html",
            "topic": null,
            "ending-quip": null,
            "answered": null,
            "points": null,
            "lifeTimeAnswered": null,
            "lifeTimePoints": null,

            "winners_container": null
        },
        debug: {

        }
    }
}

console.log("Screen.js loaded")