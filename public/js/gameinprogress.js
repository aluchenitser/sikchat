      var element = document.querySelector(".balls");
        var propertyValues = ["flex-start", "flex-end", "center", "space-between", "space-around"]
        
        function changeFlex() {
            element.style.justifyContent = propertyValues[Math.floor(Math.random() * 5)]
        }

        (function loop() {
            var rand = Math.floor(Math.random() * 3000);
            setTimeout(function() {
                    changeFlex();
                    loop();  
            }, rand);
        }());