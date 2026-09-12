const textBox : HTMLDivElement= document.querySelector<HTMLDivElement>("#text-box")!;
let currentLineObj : HTMLDivElement = document.querySelector<HTMLDivElement>("#line-1")!;

let allLines : HTMLDivElement[] = [currentLineObj];
let hasWritten : boolean = false;
let currentLineNo : number = 0; // zero-indexed
let verticalMovement : boolean = false;
let savedCursorIndex : number = cursorIndex;
let currentLineText : string = currentLineObj.textContent;

// for a line of n chars, the cursor can be in n + 1 positions
// cursorIndex == currentLineText.slice(0, cursorIndex).length + 1
let cursorIndex : number = 0; 



function render(lineObj : HTMLDivElement, cursorI : number, text: string){
    lineObj.textContent = text;
    addCursor(lineObj, cursorI);    
}

// Must work even when line has no cursor
function removeCursor(lineObj : HTMLDivElement) {
    const cursor = lineObj.querySelector("span.cursor");
    if (cursor) {
        cursor.remove();
    }
}


function addCursor(line : HTMLDivElement, cursorPos : number) {
    removeCursor(line);
    const textNode =
        line.firstChild instanceof Text
            ? line.firstChild
            : document.createTextNode("");

    const afterNode : Text = textNode.splitText(cursorPos+1);

    const cursor = document.createElement("span");
    cursor.className = "cursor";

    line.insertBefore(cursor, afterNode);
    return cursor;
}

function removeAt(value : string | unknown[], i : number) : (string | unknown[]) {   
    if (i < 0 || i >= value.length) {
        return value;
    }

    if (typeof value === "string") {
        return value.slice(0, i) + value.slice(i + 1);
    }

    return value.slice(0, i).concat(value.slice(i + 1));
}

function keyHandler(event : KeyboardEvent){
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
            let newLineText : string = currentLineText.slice(cursorIndex);
            currentLineObj.textContent = currentLineText.slice(0, cursorIndex);

            let newLine : HTMLDivElement = document.createElement("div");
            newLine.addEventListener("keydown", keyHandler);
            newLine.setAttribute("tabindex", "0");
            newLine.textContent = newLineText;
            
            textBox.insertBefore(newLine, currentLineObj.nextElementSibling);

            cursorIndex = 0;
            allLines.splice(currentLineNo, 0, newLine);
            currentLineNo++;
            currentLineObj = newLine;
            currentLineText = newLineText;
            break;
        case "Backspace":
            if (cursorIndex > 0) {
                currentLineText = removeAt(currentLineText, cursorIndex - 1) as string;
                cursorIndex--;
            } else if (currentLineNo > 0) {
                let oldLineText : string = currentLineText;
                const newLine : HTMLDivElement = allLines[currentLineNo-1]!;
                allLines = removeAt(allLines, currentLineNo) as HTMLDivElement[];
                cursorIndex = newLine.textContent.length;
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