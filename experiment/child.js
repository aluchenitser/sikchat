const privateData = {
    a: 99,
    b: 88
}

exports.showData = function() {
    console.log("show data")
    console.log(this.data.x)
}

exports.showPrivateData = function() {
    console.log("show private data")
    console.log(privateData)
}

exports.setData = function() {
    this.data.x = 123
}

exports.setPrivateData = function() {
    privateData.b = 23444
}

exports.data = {
    x: 10,
    y: 20
}