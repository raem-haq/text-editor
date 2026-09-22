export {}

const textBox : HTMLDivElement= document.querySelector<HTMLDivElement>("#text-box")!;

type Position = {
    line: number;
    column: number;
};

type Selection = {
    anchor: Position;
    active: Position;
} | null;

/*
type TextEditorState = {
    lines: string[];
    cursor: Position;
    selection: Selection;
};
*/

let hasWritten : boolean = false;

let lines : string[] = [];
let cursor : Position = {line: 0, column: 0};
let selection : Selection;

let savedVerticalCursorIndex : number;
let verticalMovement : boolean = false;
let shiftHold : boolean = false;


function insertInString(s : string, i : number, v : string) : string {
    return s.slice(0, i) + v + s.slice(i);
}

function renderDOM(){
    textBox.replaceChildren();
    let lineElements : HTMLDivElement[] = [];
    for (const [i, line] of lines.entries()){
        const div = document.createElement("div");
        div.textContent = line;
        textBox.appendChild(div);
        lineElements.push(div)
    }
    addCursor(lineElements[cursor.line]!, cursor.column);
    addSelection(lineElements, selection);
}


function addCursor(line : HTMLDivElement, cursorPos : number) {
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

function addSelectionToLine(lineElem : HTMLDivElement, startI: number, endI? :number) {
    const highlighted : HTMLSpanElement = document.createElement("span");
    highlighted.className = "selection";
    const lineText : string = lineElem.textContent;
    const end : number = endI ?? lineText.length;
    // remember cursor index is after char
    // and slice does not include end index
    const inDiv = lineText.slice(startI, end); 
    const inSpan = lineText.slice(end);
    lineElem!.textContent = inDiv;
    highlighted.textContent = inSpan;
    lineElem!.appendChild(highlighted);
}

function addSelection(lineElems : HTMLDivElement[], selection : Selection){
    if (selection === null) return;
    let {anchor: start, active: end} = selection;

    if (start.line > end.line || (start.line == end.line && start.column > end.column)){
        [start, end] = [end, start];
    }
    if (start.line == end.line){
        addSelectionToLine(lineElems[start.line]!, start.column, end.column);
    } else {
        addSelectionToLine(lineElems[start.line]!, start.column);
        for (let i = start.line + 1; i < end.line; i++){
            addSelectionToLine(lineElems[i]!,0);
        }
        addSelectionToLine(lineElems[end.line]!, 0, end.column);
    }
}


function removeAt(value : string, i : number) : string {
    if (i < 0 || i >= value.length) {
        return value;
    }

    return value.slice(0, i) + value.slice(i + 1);
}

function keyHandler(event : KeyboardEvent) {
    if (!hasWritten && (event.key.length === 1 || event.key === "Enter" || event.key === "SpaceBar")) {
        hasWritten = true;
    }
    if (!hasWritten) return;

    /*
    if (event.altKey) return;
    if (event.ctrlKey && (event.key !== "C" && event.key !== "V")) return;
    if (event.metaKey) return;
    if (event.key === "Alt") return;
    */
    
    //if not implemented return
    if (event.key.length !== 1 || !["Enter", "Shift", "SpaceBar"].includes(event.key)) return;

    event.preventDefault();

    if (verticalMovement && event.key !== "ArrowUp" && event.key !== "ArrowDown") {
        verticalMovement = false;
    }

    if (event.shiftKey){
        if (!shiftHold){
            shiftHold = true;
            selection = {anchor: cursor, active : cursor};
        }
    } else if (event.key !== "Shift") {
        shiftHold = false;
    }

    switch (event.key) {
        case "Enter": {
            const currentLine = lines[cursor.line]!;
            const newLineText = currentLine.slice(cursor.column);
            lines[cursor.line] = currentLine.slice(0, cursor.column);

            lines.splice(cursor.line + 1, 0, newLineText);

            cursor.line += 1;
            cursor.column = 0;
            
            break;
        }
        case "Backspace":
            if (cursor.line > 0) {
                lines[cursor.line] = removeAt(lines[cursor.line]!, cursor.column - 1);
                cursor.column--;
            } else if (cursor.line > 0) {
                const previousLineNo = cursor.line - 1;
                cursor.column = lines[previousLineNo]!.length;
                lines[previousLineNo] += lines[cursor.line]!;
                lines.splice(cursor.line, 1);
                cursor.line = previousLineNo;
            }
            break;
        case "ArrowLeft":
            if (cursor.column > 0) {
                cursor.column--;
            } else if (cursor.line > 0) {
                cursor.line--;
                cursor.column = lines[cursor.line]!.length;
            }
            break;
        case "ArrowRight":
            if (cursor.column < lines[cursor.line]!.length) {
                cursor.column++;
            } else if (cursor.line < lines.length - 1) {
                cursor.line++;
                cursor.column = 0;
            }
            break;
        case "ArrowUp":
            if (cursor.line > 0) {
                cursor.line--;
                if (!verticalMovement) {
                    verticalMovement = true;
                    savedVerticalCursorIndex = cursor.column;
                }
                cursor.column = Math.min(savedVerticalCursorIndex, lines[cursor.line]!.length);
            } else {
                cursor.column = 0;
            }
            break;
        case "ArrowDown":
            if (cursor.line < lines.length - 1) {
                cursor.line++;
                if (!verticalMovement) {
                    verticalMovement = true;
                    savedVerticalCursorIndex = cursor.column;
                }
                cursor.column = Math.min(savedVerticalCursorIndex, lines[cursor.line]!.length);
            } else {
                cursor.column = lines[cursor.line]!.length;
            }
            break;
        case "Tab": {
            const noOfSpaces = 4 - cursor.column % 4;
            lines[cursor.line] = insertInString(
                lines[cursor.line]!, cursor.column, " ".repeat(noOfSpaces));
            cursor.column += noOfSpaces;
            break;
        }
        case "SpaceBar":
            lines[cursor.line] = insertInString(lines[cursor.line]!, cursor.column, " ");
            cursor.column++;
            break;
        default:
            if (event.key.length === 1) {
                lines[cursor.line] = insertInString(lines[cursor.line]!, cursor.column, event.key);
                cursor.column++;
            }
    }
    renderDOM();
}

textBox.addEventListener("keydown", keyHandler)