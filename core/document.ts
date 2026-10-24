import * from "./types";

export function initialiseState(): TextEditorState {
    return {
        lines: [""],
        cursor: {line: 0, column: 0},
        selection: null,
        savedVerticalCursorIndex: null,
    };
}

function insertInString(s : string, i : number, v : string) : string {
    return s.slice(0, i) + v + s.slice(i);
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

export function insertCharacters(state: TextEditorState, text: string): void {
    const {lines, cursor, selection} = state;
    if (selection !== null) removeSelectedText(state);
    lines[cursor.line] = insertInString(lines[cursor.line]!, cursor.column, text);
    cursor.column += text.length;
}

export function handleEnter(state: TextEditorState): LineSplice | null {
    if (state.selection !== null) {
        return removeSelectedText(state);
    }
    const {lines, cursor} = state;
    const currentLine = lines[cursor.line]!;
    const newLineText = currentLine.slice(cursor.column);
    lines[cursor.line] = currentLine.slice(0, cursor.column);

    lines.splice(cursor.line + 1, 0, newLineText);

    cursor.line += 1;
    cursor.column = 0;
    return {startLine: cursor.line - 1, removeNo: 0, insertNo: 1, endLine: cursor.line};
}

export function handleBackspace(state: TextEditorState): LineSplice | null{
    
    if (state.selection !== null){
        return removeSelectedText(state);
    }

    const {lines, cursor} = state;

    if (cursor.column > 0) {
        lines[cursor.line] = removeAt(lines[cursor.line]!, cursor.column - 1);
        cursor.column--;
        return {startLine: cursor.line, insertNo:0, removeNo:0, endLine: cursor.line};
    }
    if (cursor.line > 0) {
        const previousLineNo = cursor.line - 1;
        cursor.column = lines[previousLineNo]!.length;
        lines[previousLineNo] += lines[cursor.line]!;
        lines.splice(cursor.line, 1);
        cursor.line = previousLineNo;
        return {startLine: cursor.line, insertNo:0, removeNo:1, endLine: cursor.line};
    }
    return null;
}

export function handleTab(state: TextEditorState): LineSplice | null {
    const {lines, cursor} = state;
    if (state.selection !== null){
        return manageTabsSelection(state);
    }
    const noOfSpaces = 4 - cursor.column % 4;
    lines[cursor.line] = insertInString(
        lines[cursor.line]!, cursor.column, " ".repeat(noOfSpaces));
    cursor.column += noOfSpaces;
    return {startLine: cursor.line, insertNo:0, removeNo:0, endLine: cursor.line};
}

export function insertText(state: TextEditorState, text : string): LineSplice {
    const selectionChange = state.selection !== null ? removeSelectedText(state) : null;
    const startLine = selectionChange?.startLine ?? state.cursor.line;
    const linesSplit : string[] = text.split("\n");
    
    insertCharacters(state, linesSplit[0]!);
    for (let i = 1; i < linesSplit.length; i++){
        handleEnter(state);
        insertCharacters(state, linesSplit[i]!);
    }
    return {
        startLine,
        removeNo: selectionChange?.removeNo ?? 0,
        insertNo: linesSplit.length - 1,
        endLine: startLine + linesSplit.length - 1,
    };
}

export function removeSelectedText(state: TextEditorState) : LineSplice | null {
    const selection : Selection = state.selection;
    if (selection === null) return null;
    let {anchor: start, active: end} = selection;

    if (start.line > end.line || (start.line == end.line && start.column > end.column)){
        [start, end] = [end, start];
    }
    // removeNo is not end.line - start.line + 1
    const changes: LineSplice = {startLine: start.line, insertNo: 0, removeNo: end.line - start.line, endLine: end.line}

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
    return changes;
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

export function handleMovement(state: TextEditorState, key: ArrowKey, shift: boolean): LineSplice {
    let {selection, cursor} = state;
    if (key !== "ArrowUp" && key !== "ArrowDown") state.savedVerticalCursorIndex = null;
    
    const change: LineSplice = {startLine: cursor.line, removeNo: 0, insertNo: 0, endLine: cursor.line};

    if (selection === null && shift) {
        selection = {anchor: {...cursor}, active: {...cursor}};
    }

    if (!shift){
        if (selection !== null){
            let {anchor: start, active: end} = selection;

            if (start.line > end.line || (start.line == end.line && start.column > end.column)){
                [start, end] = [end, start];
            }
            change.startLine = start.line // this is <= cursor.line
            change.endLine = end.line
        }
        state.selection = null;
    }
    moveCursor(state, key)

    change.endLine = Math.max(change.endLine, cursor.line);
    change.startLine = Math.min(change.startLine, cursor.line);
    return change;
}