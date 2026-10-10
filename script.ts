export {}

const textBox : HTMLDivElement= document.querySelector<HTMLDivElement>("#text-box")!;

const PLACEHOLDER = "Click to edit here";
const placeholder: HTMLDivElement= document.querySelector<HTMLDivElement>("#placeholder")!;
placeholder.textContent = PLACEHOLDER;

export type Position = {
    line: number;
    column: number;
};

export type Selection = {
    anchor: Position;
    active: Position;
} | null;

export type TextEditorState = {
    lines: string[];
    cursor: Position;
    selection: Selection;
    savedVerticalCursorIndex: number | null;
};

type EditorMemento = {
    lines: string[];
    cursor: Position;
    selection: Selection;
    time: number;
    endBlockCursor: Position;
};

export type EditorHistory = {
    undoStack: EditorMemento[];
    redoStack: EditorMemento[];
    openBlockCategory: BlockCategory | null;
};


const state: TextEditorState = {
    lines: [""],
    cursor: {line: 0, column: 0},
    selection: null,
    savedVerticalCursorIndex: null,
};

const history: EditorHistory = {
    undoStack: [],
    redoStack: [],
    openBlockCategory: null,
};

function actionToBlockCategory(type: ActionType): BlockCategory | null {
    switch (type){
        case "backspace":
        case "enter":
        case "insert":
        case "tab":
            return type;
        default:
            return null;
    }
}

export function pushToUndo(state: TextEditorState, history: EditorHistory, type: ActionType): void {
    history.redoStack = [];

    const category = actionToBlockCategory(type);
    if (history.undoStack.length === 0) {
        history.undoStack.push(captureMemento(state));
        history.openBlockCategory = category;
        return;
    }
    const previous : EditorMemento = history.undoStack.at(-1)!;
    if (
        category !== null &&
        history.openBlockCategory === category &&
        Date.now() - previous.time < 500 && // 500 ms - 0.5 s
        previous.endBlockCursor === state.cursor
    ) {
        previous.time = Date.now();
        previous.endBlockCursor = {...state.cursor};
        return;
    } else {
        history.undoStack.push(captureMemento(state));
        history.openBlockCategory = category;
    }
}

function captureMemento(state: TextEditorState): EditorMemento {
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
    state.savedVerticalCursorIndex = null;
}


export function undo(history: EditorHistory, state: TextEditorState): boolean {
    const previous = history.undoStack.pop();
    if (previous === undefined) {
        return false;
    }

    history.redoStack.push(captureMemento(state));
    restoreMemento(state, previous);
    history.openBlockCategory = null;
    return true;
}

export function redo(history: EditorHistory, state: TextEditorState): boolean {
    const next = history.redoStack.pop();
    if (next === undefined) return false;

    pushToUndo(state, history, "redo");
    restoreMemento(state, next);
    return true;
}


function insertInString(s : string, i : number, v : string) : string {
    return s.slice(0, i) + v + s.slice(i);
}

export function renderDOM(state: TextEditorState): void {
    placeholder.hidden = !(state.lines.length === 1 && state.lines[0] === "");
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





function moveCursor(state: TextEditorState, key : ArrowKey): void {
    const {lines, cursor} = state;

    switch (key) {
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
                if (state.savedVerticalCursorIndex === null) {
                    state.savedVerticalCursorIndex = cursor.column;
                }
                cursor.column = Math.min(state.savedVerticalCursorIndex!, lines[cursor.line]!.length);
            } else {
                cursor.column = 0;
            }
            break;
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
            break;
    }
}

export function insertText(state: TextEditorState, text: string): void {
    const {lines, cursor, selection} = state;
    if (selection !== null) removeSelectedText(state);
    lines[cursor.line] = insertInString(lines[cursor.line]!, cursor.column, text);
    cursor.column += text.length;
}

export function handleEnter(state: TextEditorState){
    if (state.selection !== null) {
        removeSelectedText(state);
    }
    const {lines, cursor} = state;
    const currentLine = lines[cursor.line]!;
    const newLineText = currentLine.slice(cursor.column);
    lines[cursor.line] = currentLine.slice(0, cursor.column);

    lines.splice(cursor.line + 1, 0, newLineText);

    cursor.line += 1;
    cursor.column = 0;
}

export function handleBackspace(state: TextEditorState){
    if (state.selection !== null){
        removeSelectedText(state);
        return;
    }

    const {lines, cursor} = state;

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
}

export function handleTab(state: TextEditorState): void {
    const {lines, cursor} = state;
    if (state.selection !== null){
        manageTabsSelection(state);
    } else {
        const noOfSpaces = 4 - cursor.column % 4;
        lines[cursor.line] = insertInString(
            lines[cursor.line]!, cursor.column, " ".repeat(noOfSpaces));
        cursor.column += noOfSpaces;
    }
}

export function pasteText(state: TextEditorState, text : string): void {
    if (state.selection !== null) removeSelectedText(state);
    const linesSplit : string[] = text.split("\n");
    
    insertText(state, linesSplit[0]!);
    for (let i = 1; i < linesSplit.length; i++){
        handleEnter(state);
        insertText(state, linesSplit[i]!);
    }
}

export function removeSelectedText(state: TextEditorState) : void {
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
    const {selection} = state;

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

export function handleMovement(state: TextEditorState, key: ArrowKey, shift: boolean) {
    if (key !== "ArrowUp" && key !== "ArrowDown") state.savedVerticalCursorIndex = null;

    if (state.selection === null && shift) {
        state.selection = {anchor: {...state.cursor}, active: {...state.cursor}};
    }

    if (!shift){
        state.selection = null;
    }

    moveCursor(state, key);
}

function eventHandler(state: TextEditorState, history: EditorHistory, action : EditorAction): void {
    const {type} = action;

    if (type !== "move") state.savedVerticalCursorIndex = null;

    switch (type){
        case "move":
            handleMovement(state, action.key, action.shift);
            break;
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
            if (paste){
                pasteText(state, text);
            } else {
                insertText(state, text)
            }
            break;
        case "backspace":
            pushToUndo(state, history, type);
            handleBackspace(state);
            break;
        case "enter":
            pushToUndo(state, history, type);
            handleEnter(state);
            break;
        case "tab":
            pushToUndo(state, history, type);
            handleTab(state);
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



type ArrowKey = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight";

export type EditorAction =
    | { type: "move"; key: ArrowKey; shift: boolean }
    | { type: "insert"; text: string; paste: boolean }  // typing, space, paste
    | { type: "enter" }
    | { type: "backspace" }
    | { type: "tab" }
    | { type: "cut" }
    | { type: "undo" }
    | { type: "redo" };

type ActionType = EditorAction["type"];

type BlockCategory = "insert" | "backspace" | "enter" | "tab";

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


textBox.addEventListener("copy", (event) => copyHandler(event, state));

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
        text: text,
        paste: true,
    }
    eventHandler(state, history, e);
});

