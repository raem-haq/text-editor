const textBox = document.querySelector("#text-box");
var currentLineObj = document.querySelector("#line-1");

var allLines = [currentLineObj];
var hasWritten = false;
var currentLineNo = 0; // zero-indexed
var cursorIndex = 0; // for a line of n chars, the cursor can be in n + 1 positions
var verticalMovement = false;
var savedCursorIndex = cursorIndex;
var currentLineText = currentLineObj.textContent;

function render(lineObj, cursorI, text){
    lineObj.textContent = text;
    addCursor(lineObj, cursorI);    
}

function removeCursor(lineObj) {
    const cursor = lineObj.querySelector("span.cursor");
    if (cursor) {
        cursor.remove();
    }
}


function addCursor(line, i) {
    removeCursor(line)
    const textNode = line.firstChild || document.createTextNode("");
    if (!line.firstChild) {
        line.appendChild(textNode);
    }

    const afterNode = textNode.splitText(i+1);

    const cursor = document.createElement("span");
    cursor.className = "cursor";

    line.insertBefore(cursor, afterNode);
    return cursor;
}

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
    if (!hasWritten && (event.key.length === 1 || event.key === "Enter")) {
        currentLineText = "";
        hasWritten = true;
        cursorIndex = 0;
    }
    if (!hasWritten){
        return;
    }
    event.preventDefault();

    if (verticalMovement && event.key !== "ArrowUp" && event.key !== "ArrowDown"){
        verticalMovement = false;
    }

    switch (event.key) {
        case "Enter": 
            
            removeCursor(currentLineObj);
            newLineText = currentLineText.slice(cursorIndex);
            currentLineObj.textContent = currentLineText.slice(0, cursorIndex);

            var newLine = document.createElement("div");
            newLine.addEventListener("keydown", keyHandler);
            newLine.setAttribute("tabindex", "0");
            newLine.textContent = newLineText;
                        
            const nextSibling = currentLineObj.nextSibling ? currentLineObj.nextSibling : textBox.firstChild;
            textBox.insertBefore(newLine, nextSibling);

            cursorIndex = 0;
            allLines.splice(currentLineNo, 0, newLine);
            currentLineNo++;
            currentLineObj = newLine;
            currentLineText = newLineText;
            break;
        case "Backspace":
            if (cursorIndex > 0) {
                currentLineText = removeAt(currentLineText, cursorIndex - 1);
                cursorIndex--;
            } else if (currentLineNo > 0) {
                oldLineText = currentLineText;
                const newLine = allLines[currentLineNo-1];
                allLines = removeAt(allLines, currentLineNo);
                cursorIndex = newLine.textContent.length - 1;
                newLine.textContent += oldLineText;
                currentLineObj.remove();
                currentLineObj = newLine;
                currentLineText = newLine.textContent;
                currentLineNo--;
            }
            break;
        case "ArrowLeft":
            if (cursorIndex > 0){
                cursorIndex --;
            } else if (currentLineNo > 0) {
                removeCursor(currentLineObj);
                currentLineObj = allLines[currentLineNo-1];
                currentLineText = currentLineObj.textContent;
                cursorIndex = currentLineObj.textContent.length - 1;
                currentLineNo --;
            }
            break;
        
        case "ArrowRight":
            if (cursorIndex < currentLineText.length){
                cursorIndex ++;
            } else if (currentLineNo < allLines.length - 1) {
                removeCursor(currentLineObj);
                currentLineObj = allLines[currentLineNo+1];
                currentLineText = currentLineObj.textContent;
                cursorIndex = 0;
                currentLineNo ++;
            }
            break;
        case "ArrowUp":
            if (currentLineNo > 0){
                removeCursor(currentLineObj);
                currentLineObj = allLines[currentLineNo-1];
                currentLineText = currentLineObj.textContent;
                currentLineNo--;
                if (!verticalMovement) {
                    verticalMovement = true;
                    savedCursorIndex = cursorIndex;
                }
                cursorIndex = Math.min(savedCursorIndex, currentLineText.length - 1);
            } else {
                cursorIndex = 0;
            }
            break;
        case "ArrowDown":
            if (currentLineNo < allLines.length - 1) {
                removeCursor(currentLineObj);
                currentLineObj = allLines[currentLineNo+1];
                currentLineText = currentLineObj.textContent;
                currentLineNo++;
                if (!verticalMovement) {
                    verticalMovement = true;
                    savedCursorIndex = cursorIndex;
                }
                cursorIndex = Math.min(savedCursorIndex, currentLineText.length - 1);
            } else {
                cursorIndex = currentLineText.length-1;
            }
            break;
        default:
            if (event.key.length == 1) { 
                currentLineText = currentLineText.slice(0, cursorIndex) + event.key + currentLineText.slice(cursorIndex);
                cursorIndex++;
            }
    }
    
    render(currentLineObj, cursorIndex, currentLineText)
}

currentLineObj.addEventListener("keydown", keyHandler)