import type { TextEditorState, LineSplice } from '../core/types.js';
import type { EditorAction } from '../input/keyboard.js';
import type { EditorMemento } from '../core/memento.js';
import { captureMemento, restoreMemento } from '../core/memento.js';

type BlockCategory = 'backspace' | 'cut' | 'enter' | 'insert' | 'tab' | 'space' | null;

export type EditorHistory = {
    undoStack: EditorMemento[];
    redoStack: EditorMemento[];
    openBlockCategory: BlockCategory;
};

export function initialiseHistory(): EditorHistory {
    return {
        undoStack: [],
        redoStack: [],
        openBlockCategory: null,
    };
}

function actionToBlockCategory(action: EditorAction): BlockCategory | null {
    switch (action.type) {
        case 'backspace':
        case 'cut':
        case 'enter':
            return action.type;
        case 'insert':
            return action.text === ' ' ? 'space' : 'insert';
        case 'paste':
            return 'insert';
        case 'tab':
            return action.type;
        case 'move':
        case 'redo':
        case 'undo':
            return null;
    }
}

function actionChangesDocument(state: TextEditorState, action: EditorAction): boolean {
    switch (action.type) {
        case 'insert':
        case 'paste':
            return action.text.length > 0 || state.selection !== null;
        case 'enter':
        case 'tab':
            return true;
        case 'backspace':
            return (
                state.selection !== null ||
                state.cursor.offset > 0 ||
                state.cursor.line > 0
            );
        case 'cut':
            return state.selection !== null;
        case 'move':
        case 'redo':
        case 'undo':
            return false;
    }
}

export function updateHistory(
    state: TextEditorState,
    history: EditorHistory,
    action: EditorAction,
): void {
    const category = actionToBlockCategory(action);
    if (category === null || !actionChangesDocument(state, action)) {
        history.openBlockCategory = null;
        return;
    }

    history.redoStack = [];
    if (history.undoStack.length === 0) {
        history.undoStack.push(captureMemento(state));
        history.openBlockCategory = category;
        return;
    }
    const previous: EditorMemento = history.undoStack.at(-1)!;
    if (
        history.openBlockCategory === category &&
        Date.now() - previous.time < 500
    ) {
        previous.time = Date.now();
    } else {
        history.undoStack.push(captureMemento(state));
        history.openBlockCategory = category;
    }
}

export function undo(history: EditorHistory, state: TextEditorState): LineSplice | null {
    const previous = history.undoStack.pop();
    if (previous === undefined) {
        return null;
    }
    const oldLen: number = state.lines.length;
    history.redoStack.push(captureMemento(state));
    restoreMemento(state, previous);
    history.openBlockCategory = null;
    const newLen: number = state.lines.length;
    let change: LineSplice = { startLine: 0, removeNo: 0, insertNo: 0, endLine: newLen - 1 };
    change.removeNo = Math.max(0, oldLen - newLen);
    change.insertNo = Math.max(0, newLen - oldLen);
    return change;
}

export function redo(history: EditorHistory, state: TextEditorState): LineSplice | null {
    const next = history.redoStack.pop();
    if (next === undefined) return null;
    const oldLen: number = state.lines.length;

    history.undoStack.push(captureMemento(state)); // don't call updateHistory as that clears the redo stack
    history.openBlockCategory = null;
    restoreMemento(state, next);
    const newLen: number = state.lines.length;
    let change: LineSplice = { startLine: 0, removeNo: 0, insertNo: 0, endLine: newLen - 1 };
    change.removeNo = Math.max(0, oldLen - newLen);
    change.insertNo = Math.max(0, newLen - oldLen);
    return change;
}
