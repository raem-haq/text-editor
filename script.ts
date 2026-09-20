export {}

const textBox : HTMLDivElement= document.querySelector<HTMLDivElement>("#text-box")!;
const initialLine : HTMLDivElement = document.querySelector<HTMLDivElement>("#line-1")!;

let hasWritten : boolean = false;
let currentLineNo : number = 0; // zero-indexed
let lineElements : HTMLDivElement[] = [initialLine];
let allLines : string[] = [initialLine.textContent ?? ""];

// For a line of n chars, the cursor can be in n + 1 positions:
// the valid boundaries are 0..n, inclusive.
// cursorIndex is the number of characters before the cursor, so
// cursorIndex ==== currentLineText.slice(0, cursorIndex).length.
let cursorIndex : number = 0; 


let savedCursorIndex : number = cursorIndex;
let verticalMovement : boolean = false;

function insertInString(s : string, i : number, v : string) : string {
    return s.slice(0, i) + v + s.slice(i);
}

function renderLine(lineNo : number, withCursor : boolean) {
    const line = lineElements[lineNo]!;
    line.textContent = allLines[lineNo]!;
    if (withCursor) {
        addCursor(line, cursorIndex);
    }
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

function removeAt(value : string, i : number) : string {
    if (i < 0 || i >= value.length) {
        return value;
    }

    return value.slice(0, i) + value.slice(i + 1);
}

function keyHandler(event : KeyboardEvent) {
    if (!hasWritten && (event.key.length === 1 || event.key === "Enter" || event.key === "SpaceBar")) {
        allLines = [""];
        lineElements[0]!.textContent = "";
        hasWritten = true;
        cursorIndex = 0;
    }
    if (!hasWritten) return;

    event.preventDefault();

    if (verticalMovement && event.key !== "ArrowUp" && event.key !== "ArrowDown") {
        verticalMovement = false;
    }

    removeCursor(lineElements[currentLineNo]!);

    switch (event.key) {
        case "Enter": {
            const currentLine = allLines[currentLineNo]!;
            const newLineText = currentLine.slice(cursorIndex);
            allLines[currentLineNo] = currentLine.slice(0, cursorIndex);

            const newLine = document.createElement("div");
            newLine.setAttribute("tabindex", "0");
            textBox.insertBefore(newLine, lineElements[currentLineNo]!.nextElementSibling);
            allLines.splice(currentLineNo + 1, 0, newLineText);
            lineElements.splice(currentLineNo + 1, 0, newLine);
            currentLineNo++;
            cursorIndex = 0;
            break;
        }
        case "Backspace":
            if (cursorIndex > 0) {
                allLines[currentLineNo] = removeAt(allLines[currentLineNo]!, cursorIndex - 1);
                cursorIndex--;
            } else if (currentLineNo > 0) {
                const previousLineNo = currentLineNo - 1;
                cursorIndex = allLines[previousLineNo]!.length;
                allLines[previousLineNo] += allLines[currentLineNo]!;
                allLines.splice(currentLineNo, 1);
                lineElements[currentLineNo]!.remove();
                lineElements.splice(currentLineNo, 1);
                currentLineNo = previousLineNo;
            }
            break;
        case "ArrowLeft":
            if (cursorIndex > 0) {
                cursorIndex--;
            } else if (currentLineNo > 0) {
                currentLineNo--;
                cursorIndex = allLines[currentLineNo]!.length;
            }
            break;
        case "ArrowRight":
            if (cursorIndex < allLines[currentLineNo]!.length) {
                cursorIndex++;
            } else if (currentLineNo < allLines.length - 1) {
                currentLineNo++;
                cursorIndex = 0;
            }
            break;
        case "ArrowUp":
            if (currentLineNo > 0) {
                currentLineNo--;
                if (!verticalMovement) {
                    verticalMovement = true;
                    savedCursorIndex = cursorIndex;
                }
                cursorIndex = Math.min(savedCursorIndex, allLines[currentLineNo]!.length);
            } else {
                cursorIndex = 0;
            }
            break;
        case "ArrowDown":
            if (currentLineNo < allLines.length - 1) {
                currentLineNo++;
                if (!verticalMovement) {
                    verticalMovement = true;
                    savedCursorIndex = cursorIndex;
                }
                cursorIndex = Math.min(savedCursorIndex, allLines[currentLineNo]!.length);
            } else {
                cursorIndex = allLines[currentLineNo]!.length;
            }
            break;
        case "Tab": {
            const noOfSpaces = 4 - cursorIndex % 4;
            allLines[currentLineNo] = insertInString(
                allLines[currentLineNo]!, cursorIndex, " ".repeat(noOfSpaces));
            cursorIndex += noOfSpaces;
            break;
        }
        case "SpaceBar":
            allLines[currentLineNo] = insertInString(allLines[currentLineNo]!, cursorIndex, " ");
            cursorIndex++;
            break;
        default:
            if (event.key.length === 1) {
                allLines[currentLineNo] = insertInString(allLines[currentLineNo]!, cursorIndex, event.key);
                cursorIndex++;
            }
    }

    renderLine(currentLineNo, true);
}

textBox.addEventListener("keydown", keyHandler)