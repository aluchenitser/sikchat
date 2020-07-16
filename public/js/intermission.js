class Intermission {

    constructor(id, template, name) {
        this.id = id
        this.gameParentElement = document.getElementById(id)
        this.name = name
        this.template = template
        
        if(!this.gameParentElement) {
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


}