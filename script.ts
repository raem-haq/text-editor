export {}

const textBox : HTMLDivElement= document.querySelector<HTMLDivElement>("#text-box")!;
let currentLineObj : HTMLDivElement = document.querySelector<HTMLDivElement>("#line-1")!;

let allLines : HTMLDivElement[] = [currentLineObj];
let hasWritten : boolean = false;
let currentLineNo : number = 0; // zero-indexed
let currentLineText : string = currentLineObj.textContent!;

// For a line of n chars, the cursor can be in n + 1 positions:
// the valid boundaries are 0..n, inclusive.
// cursorIndex is the number of characters before the cursor, so
// cursorIndex ==== currentLineText.slice(0, cursorIndex).length.
let cursorIndex : number = 0; 


let savedCursorIndex : number = cursorIndex;
let verticalMovement : boolean = false;

function insertInString(s : string, i : number, v : string){
    return s.slice(0, i) + v + s.slice(i);
}

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
    if (!(line.firstChild instanceof Text)) {
        line.appendChild(textNode);
    }



    // cursorPos is the number of characters before the cursor.
    // splitText receives that same offset directly and returns the text node
    // that begins at the cursor boundary, so the surrounding cursor span can
    // be inserted before it.    const afterNode : Text = textNode.splitText(cursorPos);
    const afterNode = textNode.splitText(cursorPos);

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
    console.log(event.key);


    if (!hasWritten && (event.key.length === 1 || event.key === "Enter" || event.key === "SpaceBar")) {
        currentLineText = "";
        hasWritten = true;
        cursorIndex = 0;
    }
    if (!hasWritten) return;

    event.preventDefault();

    if (verticalMovement && event.key !== "ArrowUp" && event.key !== "ArrowDown"){
        verticalMovement = false;
    }
    

    switch (event.key) {
        case "Enter": 
            
            removeCursor(currentLineObj);
            //slice works even when cursorIndex is out of bounds
            let newLineText : string = currentLineText.slice(cursorIndex);
            currentLineObj.textContent = currentLineText.slice(0, cursorIndex);

            let newLine : HTMLDivElement = document.createElement("div");
            //newLine.addEventListener("keydown", keyHandler);
            newLine.setAttribute("tabindex", "0");
            newLine.textContent = newLineText;

            textBox.insertBefore(newLine, currentLineObj.nextElementSibling);

            cursorIndex = 0;
            allLines.splice(currentLineNo + 1, 0, newLine);
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
                const prevLine : HTMLDivElement = allLines[currentLineNo-1]!;
                allLines = removeAt(allLines, currentLineNo) as HTMLDivElement[];
                cursorIndex = prevLine.textContent!.length;
                prevLine.textContent += oldLineText;
                currentLineObj.remove();
                currentLineObj = prevLine;
                currentLineText = prevLine.textContent!;
                currentLineNo--;
            }
            break;
        case "ArrowLeft":
            if (cursorIndex > 0){
                cursorIndex --;
            } else if (currentLineNo > 0) {
                removeCursor(currentLineObj);
                currentLineNo --;
                currentLineObj = allLines[currentLineNo] as HTMLDivElement;
                currentLineText = currentLineObj.textContent!;
                cursorIndex = currentLineObj.textContent!.length;
            }
            break;
        
        case "ArrowRight":
            if (cursorIndex < currentLineText.length){
                cursorIndex ++;
            } else if (currentLineNo < allLines.length - 1) {
                removeCursor(currentLineObj);
                currentLineObj = allLines[currentLineNo+1] as HTMLDivElement;
                currentLineText = currentLineObj.textContent!;
                cursorIndex = 0;
                currentLineNo ++;
            }
            break;
        case "ArrowUp":
            if (currentLineNo > 0){
                removeCursor(currentLineObj);
                currentLineObj = allLines[currentLineNo-1] as HTMLDivElement;
                currentLineText = currentLineObj.textContent!;
                currentLineNo--;
                if (!verticalMovement) {
                    verticalMovement = true;
                    savedCursorIndex = cursorIndex;
                }
                cursorIndex = Math.min(savedCursorIndex, currentLineText.length);
            } else {
                cursorIndex = 0;
            }
            break;
        case "ArrowDown":
            if (currentLineNo < allLines.length - 1) {
                removeCursor(currentLineObj);
                currentLineObj = allLines[currentLineNo+1] as HTMLDivElement;
                currentLineText = currentLineObj.textContent!;
                currentLineNo++;
                if (!verticalMovement) {
                    verticalMovement = true;
                    savedCursorIndex = cursorIndex;
                }
                cursorIndex = Math.min(savedCursorIndex, currentLineText.length);
            } else {
                cursorIndex = currentLineText.length;
            }
            break;
        case "Tab":
            let noOfSpaces : number = 4 - cursorIndex % 4;
            let s : string = "";
            for (let i = 0; i < noOfSpaces; i++){
                s += " ";
            }
            currentLineText = insertInString(currentLineText, cursorIndex, s);
            cursorIndex += noOfSpaces;
            break;
        case "SpaceBar": // for older browsers
            currentLineText = currentLineText.slice(0, cursorIndex) + " " + currentLineText.slice(cursorIndex);
            cursorIndex++;
            break;
        default:
            if (event.key.length === 1) { 
                currentLineText = insertInString(currentLineText, cursorIndex, event.key);
                cursorIndex++;
            }
    }
    
    render(currentLineObj, cursorIndex, currentLineText)
}

textBox.addEventListener("keydown", keyHandler)