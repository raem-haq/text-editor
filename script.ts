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

type TextEditorState = {
    lines: string[];
    cursor: Position;
    selection: Selection;
    savedVerticalCursorIndex: number | null;
    verticalMovement: boolean;
    shiftHold: boolean;
};

const state: TextEditorState = {
    lines: ["Edit Text"],
    cursor: {line: 0, column: 0},
    selection: null,
    savedVerticalCursorIndex: null,
    verticalMovement: false,
    shiftHold: false,
};


function insertInString(s : string, i : number, v : string) : string {
    return s.slice(0, i) + v + s.slice(i);
}

function renderDOM(state: TextEditorState): void {
    textBox.replaceChildren();
    let lineElements : HTMLDivElement[] = [];
    for (const line of state.lines){
        const div = document.createElement("div");
        div.textContent = line;
        textBox.appendChild(div);
        lineElements.push(div)
    }
    addCursor(lineElements[state.cursor.line]!, state.cursor.column);
    addSelection(lineElements, state.selection);
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
    // splitText returns the text node that begins at the cursor boundary.
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
    const beforeSelection = lineText.slice(0, startI);
    const selectedText = lineText.slice(startI, end);
    const afterSelection = lineText.slice(end);
    lineElem!.textContent = beforeSelection;
    highlighted.textContent = selectedText;
    lineElem!.appendChild(highlighted);
    lineElem.append(afterSelection);
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

function isArrowKey(key: string){
    return (key.length >= 6 && key.slice(0, 4) === "Arrow");
}

function prepareSelection(state: TextEditorState, event : KeyboardEvent): void {
    if (event.shiftKey && isArrowKey(event.key) && !state.shiftHold){
        state.shiftHold = true;
        state.selection = {anchor: {...state.cursor}, active : {...state.cursor}};
    } else if (event.key !== "Shift" && !event.ctrlKey && !event.shiftKey) {
        state.shiftHold = false;
        state.selection = null;
    }
}

function isSupportedKey(key: string): boolean {
    return key.length === 1 || [
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "Backspace",
        "Enter",
        "Tab"
    ].includes(key);
}

function moveCursor(state: TextEditorState, key : string): boolean {
    const {lines, cursor} = state;

    switch (key) {
        case "ArrowLeft":
            if (cursor.column > 0) {
                cursor.column--;
            } else if (cursor.line > 0) {
                cursor.line--;
                cursor.column = lines[cursor.line]!.length;
            }
            return true;
        case "ArrowRight":
            if (cursor.column < lines[cursor.line]!.length) {
                cursor.column++;
            } else if (cursor.line < lines.length - 1) {
                cursor.line++;
                cursor.column = 0;
            }
            return true;
        case "ArrowUp":
            if (cursor.line > 0) {
                cursor.line--;
                if (!state.verticalMovement) {
                    state.verticalMovement = true;
                    state.savedVerticalCursorIndex = cursor.column;
                }
                cursor.column = Math.min(state.savedVerticalCursorIndex!, lines[cursor.line]!.length);
            } else {
                cursor.column = 0;
            }
            return true;
        case "ArrowDown":
            if (cursor.line < lines.length - 1) {
                cursor.line++;
                if (!state.verticalMovement) {
                    state.verticalMovement = true;
                    state.savedVerticalCursorIndex = cursor.column;
                }
                cursor.column = Math.min(state.savedVerticalCursorIndex!, lines[cursor.line]!.length);
            } else {
                cursor.column = lines[cursor.line]!.length;
            }
            return true;
        default:
            return false;
    }
}

function editText(state: TextEditorState, key : string): void {
    const {lines, cursor} = state;

    switch (key) {
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
            if (cursor.column > 0) {
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
            if (key.length === 1) {
                lines[cursor.line] = insertInString(lines[cursor.line]!, cursor.column, key);
                cursor.column++;
            }
    }
}

function removeSelectedText(state: TextEditorState) : void {
    const selection : Selection = state.selection;
    if (selection === null) return;
    let {anchor: start, active: end} = selection;

    if (start.line > end.line || (start.line == end.line && start.column > end.column)){
        [start, end] = [end, start];
    }

    if (start.line == end.line){
        state.lines[start.line] = state.lines[start.line]!.slice(start.column, end.column);
    } else {
        state.lines[start.line] = state.lines[start.line]!.slice(0, start.column);
        state.lines[end.line] = state.lines[end.line]!.slice(end.column);
        state.lines = state.lines.slice(0, start.line+1).concat(state.lines.slice(end.line)); 
    }
    state.shiftHold = false;
    state.selection = null;
}

function keyHandler(state: TextEditorState, event : KeyboardEvent): void {

    if (!isSupportedKey(event.key)) return;

    event.preventDefault();

    if (state.verticalMovement && event.key !== "ArrowUp" && event.key !== "ArrowDown") {
        state.verticalMovement = false;
    }

    prepareSelection(state, event);

    const moved = moveCursor(state, event.key);

    if (moved && state.shiftHold && state.selection !== null) {
        state.selection.active = {...state.cursor};
    }

    if (!moved) {
        if (state.shiftHold && state.selection !== null){
            removeSelectedText(state);
        }
        editText(state, event.key);
    }

    
    renderDOM(state);
}

textBox.addEventListener("keydown", (event) => keyHandler(state, event));
renderDOM(state);