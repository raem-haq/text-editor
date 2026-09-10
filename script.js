const textBox = document.querySelector(".text-box");
var currentLine = document.querySelector(".line-1");


var allLines = [currentLine];
var hasWritten = false;
var currentLineNo = 0; // zero-indexed
var cursorIndex = 0;

function removeAt(value, i) {   
    if (i < 0 || i >= value.length) {
        return value;
    }

    if (typeof value === "string") {
        return value.slice(0, i) + value.slice(i + 1);
    }

    return value.slice(0, i).concat(value.slice(i + 1));
}

function keyHandler(event){
    if (!hasWritten) {
        currentLine.textContent = "";
        hasWritten = true;
    }
    event.preventDefault();

    switch (event.key) {
        case "Enter": 
            currentLineNo++;

            var newLine = document.createElement("div");
            newLine.classList.add("line-"+currentLineNo);
            newLine.addEventListener("keypress", keyHandler);
            newLine.setAttribute("tabindex", "0");
            textBox.appendChild(newLine);       
            cursorIndex = 0;
            allLines.push(newLine);
            currentLine = newLine;
            break;
        case Backspace:
            if (cursorIndex > 0) {
                currentLine.textContent = removeAt(currentLine.textContent, cursorIndex - 1);
                cursorIndex--;
            } else if (currentLineNo > 0) {
                oldLineText = currentLine.textContent;
                newLine = allLines[currentLineNo-1];
                allLines = removeAt(allLines, currentLineNo);
                cursorIndex = newLine.textContent.length - 1;
                newLine.textContent += oldLineText;
                currentLine = newLine;
                currentLineNo--;
            }
            break;
        default:
            currentLine.textContent = currentLine.textContent + event.key;
            cursorIndex++;
    }debug
}

currentLine.addEventListener("keypress", keyHandler)
