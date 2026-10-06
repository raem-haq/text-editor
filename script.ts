export {}

const textBox : HTMLDivElement= document.querySelector<HTMLDivElement>("#text-box")!;

const PLACEHOLDER = "Click to edit here";
const placeholder: HTMLDivElement= document.querySelector<HTMLDivElement>("#placeholder")!;
placeholder.textContent = PLACEHOLDER;

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
};

type EditorMemento = {
    lines: string[];
    cursor: Position;
    selection: Selection;
    category: KeyCategory;
    time: number;
    endBlockCursor: Position;
};

type EditorHistory = {
    undoStack: EditorMemento[];
    redoStack: EditorMemento[];
    openBlockCategory: KeyCategory | null;
};

const state: TextEditorState = {
    lines: [""],
    cursor: {line: 0, column: 0},
    selection: null,
    savedVerticalCursorIndex: null,
};
type KeyCategory =
    | "movement" | "undo" | "redo" | "paste" | "cut"
    | "enter" | "backspace" | "type" | "other" | "tab" | "space";

const history: EditorHistory = {
    undoStack: [],
    redoStack: [],
    openBlockCategory: null,
};

function isArrowKey(key: string){
    return ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(key);
}

function pushToUndo(state: TextEditorState, history: EditorHistory, category: KeyCategory): void {
    history.redoStack = [];
    if (history.undoStack.length === 0) {
        history.undoStack.push(captureMemento(state, category));
        return;
    }
    const previous : EditorMemento = history.undoStack.at(-1)!;
    if (
        history.openBlockCategory === category &&
        Date.now() - previous.time < 500 // 500 ms - 0.5 s
    ) {
        previous.time = Date.now();
        previous.endBlockCursor = {...state.cursor};
        return;
    } else {
        history.undoStack.push(captureMemento(state, category));
    }
}

function captureMemento(state: TextEditorState, category: KeyCategory): EditorMemento {
    return {
        lines: [...state.lines],
        cursor: {...state.cursor},
        selection: state.selection === null
            ? null
            : {
                anchor: {...state.selection.anchor},
                active: {...state.selection.active},
            },
        time: Date.now(),
        category: category,
        endBlockCursor: {...state.cursor},
    };
}

function restoreMemento(state: TextEditorState, memento: EditorMemento): void {
    state.lines = [...memento.lines];
    state.cursor = {...memento.cursor};
    state.selection = memento.selection === null
        ? null
        : {
            anchor: {...memento.selection.anchor},
            active: {...memento.selection.active},
        };
    //state.hasWritten = memento.hasWritten;
    state.savedVerticalCursorIndex = null;
}


function undo(history: EditorHistory, state: TextEditorState): boolean {
    const previous = history.undoStack.pop();
    if (previous === undefined) {
        console.log("gchv");
        return false;
    }

    history.redoStack.push(captureMemento(state, "undo"));
    restoreMemento(state, previous);
    history.openBlockCategory = null;
    return true;
}

function redo(history: EditorHistory, state: TextEditorState): boolean {
    const next = history.redoStack.pop();
    if (next === undefined) return false;

    history.undoStack.push(captureMemento(state, "redo")); // redos are never coalesced
    restoreMemento(state, next);
    return true;
}


function insertInString(s : string, i : number, v : string) : string {
    return s.slice(0, i) + v + s.slice(i);
}

function renderDOM(state: TextEditorState): void {
    placeholder.hidden = state.lines.length === 1 && state.lines[0] === "";
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
    let selectedText : string = lineText.slice(startI, end);
    const afterSelection = lineText.slice(end);
    lineElem!.textContent = beforeSelection;
    if (selectedText === ""){
        selectedText = " ";
    }
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

function manageTabsSelection(state: TextEditorState){
    if (state.selection === null) return;
    let {anchor: start, active: end} = state.selection;

    if (start.line > end.line || (start.line == end.line && start.column > end.column)){
        [start, end] = [end, start];
    }

    if (start.line == end.line){
        const line = state.lines[start.line]!;
        const noOfSpaces = 4 - start.column % 4;
        state.lines[start.line] = line.slice(0, start.column).concat(" ".repeat(noOfSpaces)).concat(line.slice(end.column));
        state.selection = null;
        state.cursor.column = start.column + noOfSpaces;
    } else {
        for (let i = start.line; i <= end.line; i++){
            state.lines[i] = " ".repeat(4).concat(state.lines[i]!);
        }
        state.selection.anchor.column += 4;
        state.selection.active.column += 4;
        state.cursor.column += 4;
    }
}


function removeAt(value : string, i : number) : string {
    if (i < 0 || i >= value.length) {
        return value;
    }

    return value.slice(0, i) + value.slice(i + 1);
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
                if (state.savedVerticalCursorIndex === null) {
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
                if (state.savedVerticalCursorIndex === null) {
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

function handleText(state: TextEditorState, text: string): void {
    const {lines, cursor} = state;
    lines[cursor.line] = insertInString(lines[cursor.line]!, cursor.column, text);
    cursor.column += text.length;
}

function handleEnter(state: TextEditorState){
    const {lines, cursor} = state;
    const currentLine = lines[cursor.line]!;
    const newLineText = currentLine.slice(cursor.column);
    lines[cursor.line] = currentLine.slice(0, cursor.column);

    lines.splice(cursor.line + 1, 0, newLineText);

    cursor.line += 1;
    cursor.column = 0;
}

function editText(state: TextEditorState, key : string): void {
    console.log("Entering "+ key);
    const {lines, cursor} = state;
    switch (key) {
        case "enter": {
            handleEnter(state);
            break;
        }
        case "backspace":
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
        case "tab":
            if (state.selection !== null){
                manageTabsSelection(state);
            } else {
            const noOfSpaces = 4 - cursor.column % 4;
            lines[cursor.line] = insertInString(
                lines[cursor.line]!, cursor.column, " ".repeat(noOfSpaces));
            cursor.column += noOfSpaces;
            }
            break;
        default:
            if (key.length === 1) handleText(state, key);
    }
}

function pasteText(state: TextEditorState, text : string): void {
    const lines = text.split("\n");
    if (!lines) return;
    handleText(state, lines[0]!);
    if (lines.length > 1){
        for (let i = 1; i < lines.length; i++){
            handleEnter(state);
            handleText(state, lines[i]!);
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
        const line = state.lines[start.line]!;
        state.lines[start.line] = line.slice(0, start.column) + line.slice(end.column);
    } else {
        const firstLine = state.lines[start.line]!.slice(0, start.column);
        const lastLine = state.lines[end.line]!.slice(end.column);
        state.lines.splice(start.line, end.line - start.line + 1, firstLine + lastLine);
    }
    state.cursor = {...start};
    state.selection = null;
}

function copySelection(state: TextEditorState) : string {
    const selection : Selection = state.selection;

    if (selection === null) return "";
    let {anchor: start, active: end} = selection;

    if (start.line > end.line || (start.line == end.line && start.column > end.column)){
        [start, end] = [end, start];
    }

    let copyText : string = "";

    if (start.line == end.line){
        copyText += state.lines[start.line]!.slice(start.column, end.column);
    } else {
        copyText += state.lines[start.line]!.slice(start.column);
        for (let i = start.line + 1; i < end.line; i++){
            copyText += "\n" + state.lines[i]
        }
        copyText += "\n" + state.lines[end.line]!.slice(0, end.column);
    }
    return copyText;
}

function eventHandler(state: TextEditorState, history: EditorHistory, action : EditorAction): void {
    const {type} = action;

    if (type !== "move") state.savedVerticalCursorIndex = null;

    switch (type){
        case "move":
            const {key, shift} = action;
            if (key !== "ArrowUp" && key !== "ArrowDown") state.savedVerticalCursorIndex = null;

            if (state.selection === null && (shift && isArrowKey(key))) {
                state.selection = {anchor: {...state.cursor}, active: {...state.cursor}};
            }

            if (!shift){
                state.selection = null;
            }

            moveCursor(state, key);
        case "undo":
            undo(history, state);
            break;
        case "redo":
            redo(history, state);
            break;
        case "cut":
            pushToUndo(state, history, type);
            removeSelectedText(state);
            break;
        case "insert":
            const {text, paste} = action;
            pushToUndo(state, history, type);
            removeSelectedText(state); // internally checks if text is even being selected
            if (paste){
                pasteText(state, text); // key is text to paste when category === "paste"
            } else {
                editText(state, text)
            }
            break;
        case "backspace":
        case "enter":
        case "tab":
            if (state.selection !== null && type !== "tab") {
                removeSelectedText(state);
                if (type !== "backspace") editText(state, type);
            } else {
                editText(state, type);
            }
            break;
    }
    renderDOM(state);
}


function copyHandler(e: ClipboardEvent, state: TextEditorState){ 
    // doesn't modify editor variables or undo logic
    if (!e.clipboardData) return;
    e.preventDefault();
    const text = copySelection(state);
    e.clipboardData.setData("text/plain", text);
}


textBox.addEventListener("copy", (event) => copyHandler(event, state));

type ArrowKey = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight";

type EditorAction =
    | { type: "move"; key: ArrowKey; shift: boolean }
    | { type: "insert"; text: string; paste: boolean }  // typing, space, paste
    | { type: "enter" }
    | { type: "backspace" }
    | { type: "tab" }
    | { type: "cut" }
    | { type: "undo" }
    | { type: "redo" };

type BlockCategory = "insert" | "backspace" | "enter";

function keyToAction(event: KeyboardEvent): EditorAction | null {
    const key = event.key;
    const k = key.toLowerCase();
    const isMac = navigator.platform.toUpperCase().includes("MAC");

    const isUndo = isMac
        ? event.metaKey && k === "z" && !event.shiftKey
        : event.ctrlKey && k === "z"; // allows ctrl+shift+z on windows, maybe other sticky keys shouldn't match
    if (isUndo) return {type: "undo"};
    
    const isRedo = isMac
        ? event.metaKey && k === "z" && event.shiftKey
        : event.ctrlKey && k === "y";
    if (isRedo) return {type: "redo"};


    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(key)){
        return { type: "move", key: key as ArrowKey, shift: event.shiftKey };
    }
    switch (key) {
        case "Enter":     return { type: "enter" };
        case "Backspace": return { type: "backspace" };
        case "Tab":       return { type: "tab" };
        default:
            return key.length === 1 ? { type: "insert", text: key, paste: false } : null;
    }
}

textBox.addEventListener("keydown", (event) => {
    const action: EditorAction | null = keyToAction(event);
    if (action === null) return;
    event.preventDefault();
    eventHandler(state, history, action);
});


textBox.addEventListener("cut", (event) => {
    copyHandler(event, state);
    if (state.selection === null) return;
    eventHandler(state, history, {type: "cut"});
});


textBox.addEventListener("paste", (event) => {
    if (!event.clipboardData) return;
    event.preventDefault();
    const text = event.clipboardData.getData("text/plain");

    const e: EditorAction = {
        type: "insert",
        text: "text",
        paste: true,
    }
    eventHandler(state, history, e);
});



