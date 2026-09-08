const textBox = document.querySelector(".text-box");
var currentLine = document.querySelector(".line-1");


var allLines = [currentLine];
var hasWritten = false;
var currentLineNo = 1;
var cursorIndex = 0;


function keyHandler(event){
    if (!hasWritten) {
        currentLine.textContent = "";
        hasWritten = true;
    }

    switch (event.key) {
        case "Enter": 
            event.preventDefault();
            currentLineNo++;

            var newLine = document.createElement("div");
            newLine.classList.add("line-"+currentLineNo);
            newLine.addEventListener("keypress", keyHandler);
            newLine.setAttribute("tabindex", "0");
            newLine.textContent = "I'm a new line";
            textBox.appendChild(newLine);
            console.log("New LINE!")            

            cursorIndex = 0;
            allLines.push(newLine);
            currentLine = newLine;

        default:
            currentLine.textContent = currentLine.textContent + event.key;
            cursorIndex++;
    }
}

currentLine.addEventListener("keypress", keyHandler)
