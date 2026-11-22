import type { TextBackend } from '../backends/types.js';
import type { DocumentChange, EditorMemento } from './types.js';
import type { Position, Selection } from '../model/types.js';
import type { EditorAction } from '../input/keyboard.js';

export class Editor {
    private selection: Selection | null = null;
    private savedVerticalColumn: number | null = null;

    constructor(public readonly backend: TextBackend) {}

    getSelection(): Selection | null {
        return this.selection === null
            ? null
            : {
                  anchor: { ...this.selection.anchor },
                  focus: { ...this.selection.focus },
              };
    }

    get cursor(): Position {
        return this.backend.getCursor();
    }

    get text(): string {
        return this.backend.text;
    }

    captureMemento(category: EditorMemento['category'] = null): EditorMemento {
        return {
            backend: this.backend.captureMemento(),
            selection:
                this.selection === null
                    ? null
                    : {
                          anchor: { ...this.selection.anchor },
                          focus: { ...this.selection.focus },
                      },
            time: Date.now(),
            category,
        };
    }

    setCursor(position: Position): DocumentChange {
        const before = this.cursor;
        const previousSelection = this.selection;
        this.selection = null;
        this.savedVerticalColumn = null;
        this.backend.moveCursor(position);
        return this.visualChange(before, previousSelection);
    }

    setSelection(anchor: Position, focus: Position): DocumentChange {
        const before = this.cursor;
        const previousSelection = this.selection;
        const clampedAnchor = this.backend.offsetToPosition(
            this.backend.positionToOffset(anchor),
        );
        const clampedFocus = this.backend.offsetToPosition(
            this.backend.positionToOffset(focus),
        );
        this.selection = { anchor: clampedAnchor, focus: clampedFocus };
        this.backend.moveCursor(clampedFocus);
        this.savedVerticalColumn = null;
        return this.visualChange(before, previousSelection);
    }

    apply(action: EditorAction): DocumentChange {
        switch (action.type) {
            case 'move':
                return this.move(action.key, action.shift);
            case 'insert':
                return this.insert(action.text);
            case 'paste':
                return this.insert(action.text);
            case 'enter':
                return this.insert('\n');
            case 'backspace':
                return this.backspace();
            case 'tab':
                return this.tab();
            case 'cut':
                return this.cut();
            case 'undo':
            case 'redo':
                return this.emptyChange();
        }
    }

    copyText(): string {
        if (this.selection === null) return '';
        return this.backend.getTextRange(this.selection.anchor, this.selection.focus);
    }

    restoreMemento(memento: EditorMemento): void {
        this.backend.restoreMemento(memento.backend);
        this.selection =
            memento.selection === null
                ? null
                : {
                      anchor: { ...memento.selection.anchor },
                      focus: { ...memento.selection.focus },
                  };
        this.savedVerticalColumn = null;
    }

    private insert(text: string): DocumentChange {
        if (text === '') return this.emptyChange();
        const oldLineCount = this.backend.lineCount;
        const selectedRange = this.selection === null ? null : this.normalizedSelection();
        const position = selectedRange?.start ?? this.cursor;
        const removedLineCount =
            selectedRange === null ? 0 : selectedRange.end.line - selectedRange.start.line;

        if (selectedRange !== null) {
            this.backend.deleteRange(selectedRange.start, selectedRange.end);
        }
        this.backend.insertText(position, text);
        this.selection = null;
        this.savedVerticalColumn = null;
        return this.mutationChange(position.line, removedLineCount, oldLineCount);
    }

    private backspace(): DocumentChange {
        if (this.selection !== null) return this.deleteSelection();

        const position = this.cursor;
        const oldLineCount = this.backend.lineCount;
        if (position.column > 0) {
            this.backend.deleteRange(
                { line: position.line, column: position.column - 1 },
                position,
            );
        } else if (position.line > 0) {
            const previous = this.positionAtEndOfLine(position.line - 1);
            this.backend.deleteRange(previous, position);
        } else {
            return this.emptyChange();
        }

        this.selection = null;
        this.savedVerticalColumn = null;
        const cursorAfter = this.cursor;
        return this.mutationChange(
            Math.min(position.line, cursorAfter.line),
            position.line - cursorAfter.line,
            oldLineCount,
        );
    }

    private tab(): DocumentChange {
        if (this.selection !== null) {
            const { start, end } = this.normalizedSelection();
            if (start.line === end.line) {
                const spaces = ' '.repeat(4 - (start.column % 4));
                this.backend.deleteRange(start, end);
                this.backend.insertText(start, spaces);
                this.selection = null;
                this.savedVerticalColumn = null;
            } else {
                for (let line = start.line; line <= end.line; line++) {
                    this.backend.insertText({ line, column: 0 }, '    ');
                }
                this.selection = {
                    anchor: {
                        line: this.selection.anchor.line,
                        column: this.selection.anchor.column + 4,
                    },
                    focus: {
                        line: this.selection.focus.line,
                        column: this.selection.focus.column + 4,
                    },
                };
                this.backend.moveCursor(this.selection.focus);
                this.savedVerticalColumn = null;
            }
            return this.lineChange(start.line, end.line);
        }

        const position = this.cursor;
        const spaces = ' '.repeat(4 - (position.column % 4));
        this.backend.insertText(position, spaces);
        this.savedVerticalColumn = null;
        return this.lineChange(position.line, position.line);
    }

    private cut(): DocumentChange {
        if (this.selection === null) return this.emptyChange();
        return this.deleteSelection();
    }

    private deleteSelection(): DocumentChange {
        if (this.selection === null) return this.emptyChange();
        const { start, end } = this.normalizedSelection();
        const oldLineCount = this.backend.lineCount;
        this.selection = null;
        this.backend.deleteRange(start, end);
        this.savedVerticalColumn = null;
        return this.mutationChange(start.line, end.line - start.line, oldLineCount);
    }

    private move(
        key: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight',
        extendSelection: boolean,
    ): DocumentChange {
        const before = this.cursor;
        const previousSelection = this.selection;
        const anchor = this.selection?.anchor ?? before;
        if (key === 'ArrowLeft' || key === 'ArrowRight') this.savedVerticalColumn = null;
        if (extendSelection && this.selection === null) {
            this.selection = { anchor: { ...before }, focus: { ...before } };
        }

        const cursor = { ...this.cursor };
        if (key === 'ArrowLeft') {
            if (cursor.column > 0) cursor.column--;
            else if (cursor.line > 0) {
                cursor.line--;
                cursor.column = this.positionAtEndOfLine(cursor.line).column;
            }
        } else if (key === 'ArrowRight') {
            const end = this.positionAtEndOfLine(cursor.line);
            if (cursor.column < end.column) cursor.column++;
            else if (this.lineCount() > cursor.line + 1) {
                cursor.line++;
                cursor.column = 0;
            }
        } else {
            if (key === 'ArrowUp') {
                if (cursor.line === 0) {
                    cursor.column = 0;
                    this.savedVerticalColumn = null;
                    return this.finishMove(
                        anchor,
                        cursor,
                        extendSelection,
                        before,
                        previousSelection,
                    );
                }
                cursor.line--;
            } else if (cursor.line >= this.lineCount() - 1) {
                cursor.column = this.positionAtEndOfLine(cursor.line).column;
                this.savedVerticalColumn = null;
                return this.finishMove(
                    anchor,
                    cursor,
                    extendSelection,
                    before,
                    previousSelection,
                );
            } else {
                cursor.line++;
            }

            const target = this.positionAtEndOfLine(cursor.line);
            if (this.savedVerticalColumn === null) this.savedVerticalColumn = before.column;
            cursor.column = Math.min(this.savedVerticalColumn, target.column);
        }

        return this.finishMove(anchor, cursor, extendSelection, before, previousSelection);
    }

    private finishMove(
        anchor: Position,
        cursor: Position,
        extendSelection: boolean,
        before: Position,
        previousSelection: Selection | null,
    ): DocumentChange {
        if (!extendSelection) this.selection = null;
        else this.selection = { anchor, focus: cursor };
        this.backend.moveCursor(cursor);
        return this.visualChange(before, previousSelection);
    }

    private normalizedSelection(): { start: Position; end: Position } {
        if (this.selection === null) throw new Error('Selection is required.');
        const { anchor, focus } = this.selection;
        const comparison =
            anchor.line === focus.line ? anchor.column - focus.column : anchor.line - focus.line;
        return comparison <= 0 ? { start: anchor, end: focus } : { start: focus, end: anchor };
    }

    private positionAtEndOfLine(line: number): Position {
        return { line, column: this.backend.getLine(line).length };
    }

    private lineCount(): number {
        return this.backend.lineCount;
    }

    private emptyChange(): DocumentChange {
        const cursor = this.cursor;
        return {
            startLine: cursor.line,
            removeLineCount: 0,
            insertLineCount: 0,
            endLine: cursor.line,
        };
    }

    private lineChange(startLine: number, endLine: number): DocumentChange {
        return {
            startLine,
            removeLineCount: 0,
            insertLineCount: 0,
            endLine,
        };
    }

    private mutationChange(
        startLine: number,
        removeLineCount: number,
        oldLineCount: number,
    ): DocumentChange {
        const insertLineCount = this.backend.lineCount - (oldLineCount - removeLineCount);
        return {
            startLine,
            removeLineCount,
            insertLineCount,
            endLine: startLine + insertLineCount,
        };
    }

    private visualChange(before: Position, previousSelection: Selection | null): DocumentChange {
        const positions = [before, this.cursor];
        if (previousSelection !== null) {
            positions.push(previousSelection.anchor, previousSelection.focus);
        }
        if (this.selection !== null) {
            positions.push(this.selection.anchor, this.selection.focus);
        }
        const startLine = Math.min(...positions.map((position) => position.line));
        const endLine = Math.max(...positions.map((position) => position.line));
        return this.lineChange(startLine, endLine);
    }
}
