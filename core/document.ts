import type { Position, Selection, TextEditorState, LineSplice } from './types.js';
import type { ArrowKey } from '../input/keyboard.js';

export function initialiseState(): TextEditorState {
    return {
        lines: [''],
        cursor: { line: 0, offset: 0 },
        selection: null,
        savedVerticalOffset: null,
    };
}

function insertInString(s: string, i: number, val: string): string {
    return s.slice(0, i) + val + s.slice(i);
}

function removeAt(value: string, i: number): string {
    if (i < 0 || i >= value.length) return value;

    return value.slice(0, i) + value.slice(i + 1);
}

function moveCursor(state: TextEditorState, key: ArrowKey): void {
    const { lines, cursor } = state;

    switch (key) {
        case 'ArrowLeft':
            if (cursor.offset > 0) {
                cursor.offset--;
            } else if (cursor.line > 0) {
                cursor.line--;
                cursor.offset = lines[cursor.line]!.length;
            }
            break;
        case 'ArrowRight':
            if (cursor.offset < lines[cursor.line]!.length) {
                cursor.offset++;
            } else if (cursor.line < lines.length - 1) {
                cursor.line++;
                cursor.offset = 0;
            }
            break;
        case 'ArrowUp':
            if (cursor.line > 0) {
                cursor.line--;
                if (state.savedVerticalOffset === null) {
                    state.savedVerticalOffset = cursor.offset;
                }
                cursor.offset = Math.min(state.savedVerticalOffset!, lines[cursor.line]!.length);
            } else {
                cursor.offset = 0;
            }
            break;
        case 'ArrowDown':
            if (cursor.line < lines.length - 1) {
                cursor.line++;
                if (state.savedVerticalOffset === null) {
                    state.savedVerticalOffset = cursor.offset;
                }
                cursor.offset = Math.min(state.savedVerticalOffset!, lines[cursor.line]!.length);
            } else {
                cursor.offset = lines[cursor.line]!.length;
            }
            break;
    }
}

function insertCharacters(state: TextEditorState, text: string): void {
    state.savedVerticalOffset = null;
    const { lines, cursor, selection } = state;
    if (selection !== null) removeSelectedText(state);
    lines[cursor.line] = insertInString(lines[cursor.line]!, cursor.offset, text);
    cursor.offset += text.length;
}

function performEnter(state: TextEditorState): void {
    state.savedVerticalOffset = null;
    if (state.selection !== null) removeSelectedText(state);
    const { lines, cursor } = state;
    const currentLine = lines[cursor.line]!;
    const newLineText = currentLine.slice(cursor.offset);
    lines[cursor.line] = currentLine.slice(0, cursor.offset);

    lines.splice(cursor.line + 1, 0, newLineText);
    cursor.line += 1;
    cursor.offset = 0;
}

export function handleBackspace(state: TextEditorState): LineSplice | null {
    state.savedVerticalOffset = null;
    if (state.selection !== null) return removeSelectionAndGetLineSplice(state);

    const { lines, cursor } = state;

    if (cursor.offset > 0) {
        lines[cursor.line] = removeAt(lines[cursor.line]!, cursor.offset - 1);
        cursor.offset--;
        return { startLine: cursor.line, insertNo: 0, removeNo: 0, endLine: cursor.line };
    }
    if (cursor.line > 0) {
        const previousLineNo = cursor.line - 1;
        cursor.offset = lines[previousLineNo]!.length;
        lines[previousLineNo] += lines[cursor.line]!;
        lines.splice(cursor.line, 1);
        cursor.line = previousLineNo;
        return { startLine: cursor.line, insertNo: 0, removeNo: 1, endLine: cursor.line };
    }
    return null;
}

function getRemovedSelectionLineSplice(state: TextEditorState): LineSplice | null {
    const selection = state.selection;
    if (selection === null) return null;
    let { anchor: start, focus: end } = selection;

    if (start.line > end.line || (start.line == end.line && start.offset > end.offset)) {
        [start, end] = [end, start];
    }

    return {
        startLine: start.line,
        insertNo: 0,
        removeNo: end.line - start.line,
        endLine: end.line,
    };
}

function insertTabsNoSelection(state: TextEditorState): void {
    const { lines, cursor } = state;
    state.savedVerticalOffset = null;
    const noOfSpaces = 4 - (cursor.offset % 4);
    lines[cursor.line] = insertInString(lines[cursor.line]!, cursor.offset, ' '.repeat(noOfSpaces));
    cursor.offset += noOfSpaces;
}

export function handleTab(state: TextEditorState): LineSplice | null {
    const { cursor, selection } = state;
    if (state.selection !== null) {
        const startLine = Math.min(selection!.anchor.line, selection!.focus.line);
        const endLine = Math.max(selection!.anchor.line, selection!.focus.line);
        manageTabsSelection(state);
        return { startLine, insertNo: 0, removeNo: 0, endLine };
    }
    insertTabsNoSelection(state);
    return { startLine: cursor.line, insertNo: 0, removeNo: 0, endLine: cursor.line };
}

export function handleText(state: TextEditorState, text: string): LineSplice {
    const selectionChange =
        state.selection !== null ? removeSelectionAndGetLineSplice(state) : null;
    const startLine = selectionChange?.startLine ?? state.cursor.line;
    const linesSplit: string[] = text.split('\n');

    insertCharacters(state, linesSplit[0]!);
    for (let i = 1; i < linesSplit.length; i++) {
        performEnter(state);
        insertCharacters(state, linesSplit[i]!);
    }
    return {
        startLine,
        removeNo: selectionChange?.removeNo ?? 0,
        insertNo: linesSplit.length - 1,
        endLine: startLine + linesSplit.length - 1,
    };
}

export function removeSelectionAndGetLineSplice(state: TextEditorState): LineSplice | null {
    const changes = getRemovedSelectionLineSplice(state);
    if (changes === null) return null;
    removeSelectedText(state);
    return changes;
}

function removeSelectedText(state: TextEditorState): void {
    const { selection } = state;
    if (selection === null) return;

    let { anchor: start, focus: end } = selection;

    if (start.line > end.line || (start.line == end.line && start.offset > end.offset)) {
        [start, end] = [end, start];
    }

    if (start.line == end.line) {
        const line = state.lines[start.line]!;
        state.lines[start.line] = line.slice(0, start.offset) + line.slice(end.offset);
    } else {
        const firstLine = state.lines[start.line]!.slice(0, start.offset);
        const lastLine = state.lines[end.line]!.slice(end.offset);
        state.lines.splice(start.line, end.line - start.line + 1, firstLine + lastLine);
    }
    state.cursor = { ...start };
    state.selection = null;
}

export function copySelectionToText(state: TextEditorState): string {
    const { selection } = state;
    if (selection === null) return '';

    let { anchor: start, focus: end } = selection;

    if (start.line > end.line || (start.line == end.line && start.offset > end.offset)) {
        [start, end] = [end, start];
    }

    let copyText: string = '';

    if (start.line == end.line) {
        copyText += state.lines[start.line]!.slice(start.offset, end.offset);
    } else {
        copyText += state.lines[start.line]!.slice(start.offset);
        for (let i = start.line + 1; i < end.line; i++) {
            copyText += '\n' + state.lines[i];
        }
        copyText += '\n' + state.lines[end.line]!.slice(0, end.offset);
    }
    return copyText;
}

export function handleMovement(state: TextEditorState, key: ArrowKey, shift: boolean): LineSplice {
    const { cursor } = state;
    if (key !== 'ArrowUp' && key !== 'ArrowDown') state.savedVerticalOffset = null;

    const change: LineSplice = {
        startLine: cursor.line,
        removeNo: 0,
        insertNo: 0,
        endLine: cursor.line,
    };

    if (state.selection === null && shift) {
        state.selection = { anchor: { ...cursor }, focus: { ...cursor } };
    }

    if (!shift) {
        if (state.selection !== null) {
            let { anchor: start, focus: end } = state.selection;

            if (start.line > end.line || (start.line == end.line && start.offset > end.offset)) {
                [start, end] = [end, start];
            }
            change.startLine = start.line; // this is <= cursor.line
            change.endLine = end.line;
        }
        state.selection = null;
    }
    moveCursor(state, key);
    if (shift && state.selection !== null) {
        state.selection.focus = { ...cursor };
    }

    change.endLine = Math.max(change.endLine, cursor.line);
    change.startLine = Math.min(change.startLine, cursor.line);
    return change;
}

function manageTabsSelection(state: TextEditorState): void {
    state.savedVerticalOffset = null;
    if (state.selection === null) return;
    let { anchor: start, focus: end } = state.selection;

    if (start.line > end.line || (start.line == end.line && start.offset > end.offset)) {
        [start, end] = [end, start];
    }
    const changes: LineSplice = {
        startLine: start.line,
        insertNo: 0,
        removeNo: 0,
        endLine: end.line,
    };

    if (start.line == end.line) {
        const line = state.lines[start.line]!;
        const noOfSpaces = 4 - (start.offset % 4);
        state.lines[start.line] = line
            .slice(0, start.offset)
            .concat(' '.repeat(noOfSpaces))
            .concat(line.slice(end.offset));
        state.selection = null;
        state.cursor.offset = start.offset + noOfSpaces;
    } else {
        for (let i = start.line; i <= end.line; i++) {
            state.lines[i] = ' '.repeat(4).concat(state.lines[i]!);
        }
        state.selection.anchor.offset += 4;
        state.selection.focus.offset += 4;
        state.cursor.offset += 4;
    }
}
