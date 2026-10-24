import type {EditorMemento, Cursor} from "./build/core/type.js"
import type {ActionType} from "./build/keyboard.js"


type EditorHistory = {
    undoStack: EditorMemento[];
    redoStack: EditorMemento[];
    openBlockCategory: BlockCategory | null;
    endBlockCursor: Cursor | null;
};

function initialiseHistory(): EditorHistory {
    return {
        undoStack: [],
        redoStack: [],
        openBlockCategory: null,
        endBlockCursor: null,
    };
}

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

function pushToUndo(state: TextEditorState, history: EditorHistory, type: ActionType): void {
    history.redoStack = [];

    const category = actionToBlockCategory(type);
    if (history.undoStack.length === 0) {
        history.undoStack.push(captureMemento(state));
        history.openBlockCategory = category;
        history.endBlockCursor = {...state.cursor};
        return;
    }
    const previous : EditorMemento = history.undoStack.at(-1)!;
    if (
        category !== null &&
        history.openBlockCategory === category &&
        Date.now() - previous.time < 500 && // 500 ms - 0.5 s
        history.endBlockCursor !== null &&
        history.endBlockCursor.line === state.cursor.line &&
        history.endBlockCursor.column === state.cursor.column
    ) {
        previous.time = Date.now();
    } else {
        history.undoStack.push(captureMemento(state));
        history.openBlockCategory = category;
    }
    history.endBlockCursor = {...state.cursor};
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

function undo(history: EditorHistory, state: TextEditorState): LineSplice | null {
    const previous = history.undoStack.pop();
    if (previous === undefined) {
        return null;
    }
    const oldLen:number = state.lines.length;
    history.redoStack.push(captureMemento(state));
    restoreMemento(state, previous);
    history.openBlockCategory = null;
    const newLen: number = state.lines.length;
    let change: LineSplice = {startLine: 0, removeNo: 0, insertNo: 0, endLine: newLen-1};
    change.removeNo = Math.max(0, oldLen-newLen);
    change.insertNo = Math.max(0, newLen-oldLen);
    return change;
}

function redo(history: EditorHistory, state: TextEditorState): LineSplice | null {
    const next = history.redoStack.pop();
    if (next === undefined) return null;
    const oldLen:number = state.lines.length;

    history.undoStack.push(captureMemento(state)); // don't call pushToUndo as that clears the redo stack
    history.openBlockCategory = null;
    restoreMemento(state, next);
    const newLen: number = state.lines.length;
    let change: LineSplice = {startLine: 0, removeNo: 0, insertNo: 0, endLine: newLen-1};
    change.removeNo = Math.max(0, oldLen-newLen);
    change.insertNo = Math.max(0, newLen-oldLen);
    return change;
}

