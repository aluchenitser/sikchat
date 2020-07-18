var Screen = {
    markup: null,
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

            // console.log(data);

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
        })
    },

    populate(property, value) {
        if(this.vm.hasOwnProperty(property)) {
            this.vm[property] = value
           
            document.querySelectorAll(`[sik=${property}]`).forEach((markup)=> {
                markup.textContent = value
            })
        } else { throw "bogus model property" }
    },
    
    display(id) {       // id optional
        if(this.markup) {
            console.log(this.markup)
            
            let windowElement = document.getElementById(id ? id : "game-window")
            windowElement.textContent = ''
            windowElement.appendChild(this.markup)
        } else { throw "nothing to display"}
    },

    // read only: properties here match [sik] attributes in view files
    _models: {
        intermission: {
            "path": "../components/intermission/intermission.html"
            
        },
        starting: {
            "path": "../components/starting/starting.html",
            "count-down": null

        },
        started: {
            "path": "../components/started/started.html"

        },
        ending: {
            "path": "../components/ending/ending.html"

        }
    }
}

console.log("Screen.js loaded")