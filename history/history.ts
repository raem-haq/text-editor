import type { EditorAction } from '../input/keyboard.js';
import type { Editor } from '../editor/editor.js';
import type { EditorMemento, HistoryCategory } from '../editor/types.js';

export class EditorHistory {
    readonly undoStack: EditorMemento[] = [];
    readonly redoStack: EditorMemento[] = [];
    private openBlockCategory: HistoryCategory = null;

    constructor(private readonly maxEntries = 100) {
        if (!Number.isInteger(maxEntries) || maxEntries < 1) {
            throw new RangeError('History limit must be a positive integer.');
        }
    }
    
    record(editor: Editor, action: EditorAction): void {
        const category = this.actionToCategory(action);
        if (category === null || !this.actionChangesDocument(editor, action)) {
            this.openBlockCategory = null;
            return;
        }

        this.redoStack.length = 0;
        if (this.undoStack.length === 0) {
            this.undoStack.push(editor.captureMemento(category));
            this.openBlockCategory = category;
            return;
        }

        const previous = this.undoStack.at(-1)!;
        if (this.openBlockCategory === category && Date.now() - previous.time < 500) {
            this.undoStack[this.undoStack.length - 1] = {
                ...previous,
                time: Date.now(),
            };// this is only needed because time is read-only, is this an O(1) because it feels O(n)
        } else {
            this.undoStack.push(editor.captureMemento(category));
            this.openBlockCategory = category;
        }
        this.trim(this.undoStack);
    }

    undo(editor: Editor): boolean {
        const previous = this.undoStack.pop();
        if (previous === undefined) return false;
        this.redoStack.push(editor.captureMemento());
        this.trim(this.redoStack);
        editor.restoreMemento(previous);
        this.openBlockCategory = null;
        return true;
    }

    redo(editor: Editor): boolean {
        const next = this.redoStack.pop();
        if (next === undefined) return false;
        this.undoStack.push(editor.captureMemento());
        this.trim(this.undoStack);
        editor.restoreMemento(next);
        this.openBlockCategory = null;
        return true;
    }

    private actionToCategory(action: EditorAction): HistoryCategory {
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
                return 'tab';
            case 'move':
            case 'undo':
            case 'redo':
                return null;
        }
    }

    private actionChangesDocument(editor: Editor, action: EditorAction): boolean {
        const hasSelection = editor.getSelection() !== null;
        switch (action.type) {
            case 'insert':
            case 'paste':
                return action.text.length > 0 || hasSelection;
            case 'enter':
            case 'tab':
                return true;
            case 'backspace':
                return hasSelection || editor.cursor.column > 0 || editor.cursor.line > 0;
            case 'cut':
                return hasSelection;
            case 'move':
            case 'redo':
            case 'undo':
                return false;
        }
    }

    private trim(stack: EditorMemento[]): void {
        if (stack.length > this.maxEntries) {
            stack.splice(0, stack.length - this.maxEntries); // removes the oldest entries
        }
    }
}
