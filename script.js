const textBox = document.querySelector("#text-box");
var currentLine = document.querySelector("#line-1");
/*
const cursor = document.createElement('span');
cursor.className = 'cursor';
currentLine.appendChild(cursor);
*/

var allLines = [currentLine];
var hasWritten = false;
var currentLineNo = 0; // zero-indexed
var cursorIndex = 0;
var verticalMovement = false;
var savedCursorIndex = cursorIndex;

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
            newLine.setAttribute("id", "line-"+currentLineNo);
            newLine.addEventListener("keypress", keyHandler);
            newLine.setAttribute("tabindex", "0");
            textBox.appendChild(newLine);       
            cursorIndex = 0;
            allLines.push(newLine);
            currentLine = newLine;
            break;
        case "Backspace":
            if (cursorIndex > 0) {
                currentLine.textContent = removeAt(currentLine.textContent, cursorIndex - 1);
                cursorIndex--;
            } else if (currentLineNo > 0) {
                oldLineText = currentLine.textContent;
                newLine = allLines[currentLineNo-1];
                allLines = removeAt(allLines, currentLineNo);
                cursorIndex = newLine.textContent.length - 1;
                newLine.textContent += oldLineText;
                currentLine.remove();
                currentLine = newLine;
                currentLineNo--;
            }
            break;
        case "ArrowLeft":
            if (cursorIndex > 0){
                cursorIndex --;
            } else {
                currentLine = allLines[currentLineNo-1];
                cursorIndex = newLine.textContent.length - 1;
                currentLineNo --;
            }
            break;
        
        case "ArrowRight":
            if (cursorIndex < currentLine.length - 1){
                cursorIndex ++;
            } else if (currentLineNo < allLines.length - 1) {
                currentLine = allLines[currentLineNo+1];
                cursorIndex = 0;
                currentLineNo ++;
            }
            break;
        case "ArrowUp":
            if (currentLineNo > 0){
                currentLine = allLines[currentLineNo-1];
                if (verticalMovement){
                    cursorIndex = Math.min(savedCursorIndex, currentLine.length - 1);
                } else {
                    verticalMovement = true;
                    savedCursorIndex = cursorIndex;
                }
            } else {
                cursorIndex = 0;
            }
            break;
        case "ArrowDown":
            if (currentLine < allLines.length - 1) {
                currentLine = allLines[currentLineNo+1];
                if (!verticalMovement) {
                    verticalMovement = true;
                    savedCursorIndex = cursorIndex;
                }
                cursorIndex = Math.min(savedCursorIndex, currentLine.length - 1);
            } else {
                cursorIndex = currentLine.length - 1
            }
            break;
        default:
            currentLine.textContent = currentLine.textContent + event.key;
            cursorIndex++;
    }
}

currentLine.addEventListener("keydown", keyHandler)