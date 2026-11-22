import type { BackendMemento, TextBackend } from './types.js';
import type { Position } from '../model/types.js';

type ArrayLinesMemento = Extract<BackendMemento, { kind: 'array-lines' }>;

export class ArrayLinesBackend implements TextBackend {
    readonly kind = 'array-lines';
    private lines: string[];
    private lineOffsets: number[] = [];
    private cursorPosition: Position = { line: 0, column: 0 };

    constructor(text = '') {
        this.lines = text.split('\n');
        // I am not sure if this is necessary,
        // it's there to convert from implementations that store the text as a single string to implementations that store it as an array of lines. It may be unnecessary if we always store it as an array of lines.
        this.rebuildLineOffsets();
    }

    get length(): number {
        const last = this.lineOffsets.at(-1) ?? 0;
        return last + this.lines.at(-1)!.length;
    }

    get lineCount(): number {
        return this.lines.length;
    }

    get text(): string {
        return this.lines.join('\n');
    }

    getLine(line: number): string {
        const value = this.lines[line];
        if (value === undefined) throw new RangeError('Line is out of range.');
        return value;
    }

    getCursor(): Position {
        return { ...this.cursorPosition };
    }

    moveCursor(position: Position): void {
        this.validatePosition(position);
        this.cursorPosition = { ...position };
    }

    validatePosition(position: Position): void {
        if (
            position.line < 0 ||
            position.line >= this.lines.length ||
            position.column < 0 ||
            position.column > this.lines[position.line]!.length
        ) {
            throw new RangeError('Position is out of range.');
        }
    }

    insertText(position: Position, text: string): void {
        this.validatePosition(position);
        const insertedLines = text.split('\n');
        const originalLine = this.lines[position.line]!;

        if (insertedLines.length === 1) {
            this.lines[position.line] =
                originalLine.slice(0, position.column) +
                insertedLines[0]! +
                originalLine.slice(position.column);
            this.cursorPosition = {
                line: position.line,
                column: position.column + insertedLines[0]!.length,
            };
        } else {
            this.lines[position.line] = originalLine.slice(0, position.column) + insertedLines[0];

            for (let i = 1; i < insertedLines.length; i++) {
                this.lines.splice(position.line + i, 0, insertedLines[i]!);
            }
            this.lines[position.line + insertedLines.length - 1] += originalLine.slice(position.column);
            this.cursorPosition = {
                line: position.line + insertedLines.length - 1,
                column: insertedLines.at(-1)!.length,
            };
        }

        this.rebuildLineOffsets();
    }

    deleteRange(startPosition: Position, endPosition: Position): void {
        this.validatePosition(startPosition);
        this.validatePosition(endPosition);
        let start = { ...startPosition };
        let end = { ...endPosition };
        if (this.comparePositions(start, end) > 0) [start, end] = [end, start];
        if (this.comparePositions(start, end) === 0) return;

        if (start.line === end.line) {
            const line = this.lines[start.line]!;
            this.lines[start.line] = line.slice(0, start.column) + line.slice(end.column);
        } else {
            const joined =
                this.lines[start.line]!.slice(0, start.column) +
                this.lines[end.line]!.slice(end.column);
            this.lines.splice(start.line, end.line - start.line + 1, joined);
        }

        this.cursorPosition = start;
        this.rebuildLineOffsets();
    }

    getTextRange(startPosition: Position, endPosition: Position): string {
        this.validatePosition(startPosition);
        this.validatePosition(endPosition);
        let start = { ...startPosition };
        let end = { ...endPosition };
        if (this.comparePositions(start, end) > 0) [start, end] = [end, start];
        if (start.line === end.line) {
            return this.lines[start.line]!.slice(start.column, end.column);
        }

        const pieces = [this.lines[start.line]!.slice(start.column)];
        for (let line = start.line + 1; line < end.line; line++) {
            pieces.push(this.lines[line]!);
        }
        pieces.push(this.lines[end.line]!.slice(0, end.column));
        return pieces.join('\n');
    }

    positionToOffset(position: Position): number {
        this.validatePosition(position);
        return this.lineOffsets[position.line]! + position.column;
    }

    offsetToPosition(offset: number): Position {
        if (offset < 0 || offset > this.length) {
            throw new RangeError('Offset is out of range.');
        }
        let low = 0;
        let high = this.lines.length - 1;
        while (low < high) {
            // is there a library function for this? I don't want to implement binary search myself if I don't have to.
            const mid = Math.ceil((low + high) / 2);
            if (this.lineOffsets[mid]! <= offset) low = mid;
            else high = mid - 1;
        }
        return { line: low, column: offset - this.lineOffsets[low]! };
    }

    captureMemento(): ArrayLinesMemento {
        return {
            kind: 'array-lines',
            lines: [...this.lines],
            cursor: { ...this.cursorPosition },
        };
    }

    restoreMemento(memento: BackendMemento): void {
        if (memento.kind !== 'array-lines') {
            throw new TypeError('Expected an array-lines memento.');
        }
        this.lines = [...memento.lines];
        this.cursorPosition = { ...memento.cursor };
        this.rebuildLineOffsets();
    }

    private rebuildLineOffsets(): void {
        this.lineOffsets = [];
        let offset = 0;
        for (let line = 0; line < this.lines.length; line++) {
            this.lineOffsets.push(offset);
            offset += this.lines[line]!.length + 1;
        }
    }

    private comparePositions(a: Position, b: Position): number {
        return a.line === b.line ? a.column - b.column : a.line - b.line;
    }
}
