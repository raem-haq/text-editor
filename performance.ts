export {}

import {TextEditorState, EditorHistory,  EditorAction, pushToUndo, insertText, renderDOM } from "./script"

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

let paste = {type:"insert", text: "bjhbjkbjbjb", paste: true}

function timeFunction(func: () => any): number {
    const start = performance.now()
    func()
    return performance.now() - start;
}

timeFunction(() => pushToUndo(state, history, "insert"));
timeFunction(() => insertText(state, paste.text));
timeFunction(() => renderDOM(state));
