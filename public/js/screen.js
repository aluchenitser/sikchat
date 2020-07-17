var Screen = {
    markup: null,
    vm: {},
    load(type, name) {
        let self = this;

        if (this._models[type] == undefined) {
            throw "bogus load type"
        }

        return $.get(file, data => {
            if(!data) {
                console.error("bogus load file")
                return false;
            }

            // load current view model
            this.vm = this._models[type]

            // parse string into markup
            let template = document.createElement('template');
            data = data.trim(); 
            template.innerHTML = data;
            this.markup = template.content.firstChild;
        })
    },

    populate(property, value) {
        if(vm[property]) {
            document.querySelectorAll(`[sik=${property}]`).forEach((markup)=> {
                markup.textContent = value
            })
        } else { throw "bogus viewmodel property" }
    },

    display(id) {
        if(this.markup) {
            document.getElementById(id).innerHTML = this.markup
        } else { throw "nothing to display"}
    },

    // read only: properties here match [sik] attributes in view files
    _models: {
        init: {

        },
        intermission: {
    
        },
        starting: {

        },
        started: {

        },
        ends: {

        },
        wait: {

        }
    }
}