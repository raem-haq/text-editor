import type { BackendMemento, TextBackend } from './types.js';
import type { Position } from '../model/types.js';

export type GapBufferMemento = Extract<BackendMemento, { kind: 'gap-buffer' }>;

export class GapBufferBackend implements TextBackend {
    readonly kind = 'gap-buffer';

    // Physical storage is divided into: [text][gap][text].
    // gapStart is the first unused slot; gapEnd is just after the gap.
    // Uint16Array provides low-level array operations needed to move and resize
    // the gap; a string[] would require copying because strings are immutable.
    private buffer: Uint16Array;
    private bufferShared = false;
    private gapStart: number;
    private gapEnd: number;

    // The cursor and every public text operation use logical document offsets.
    private cursorOffset = 0;
    private textCache: string | null;

    constructor(text = '') {
        // Start with spare capacity so small insertions do not allocate often.
        this.buffer = new Uint16Array(Math.max(64, text.length * 2));
        this.gapStart = text.length;
        this.gapEnd = this.buffer.length;
        this.writeText(text, 0);
        this.cursorOffset = text.length;
        this.textCache = text;
    }

    get length(): number {
        return this.buffer.length - (this.gapEnd - this.gapStart);
    }

    get lineCount(): number {
        let count = 1;
        for (let offset = 0; offset < this.length; offset++) {
            if (this.readRange(offset, offset + 1) === '\n') count++;
        }
        return count;
    }

    getLine(line: number): string {
        if (!Number.isInteger(line) || line < 0) {
            throw new RangeError('Line is out of range.');
        }

        let currentLine = 0;
        let start = 0;
        for (let offset = 0; offset < this.length; offset++) {
            if (currentLine === line) {
                if (this.readRange(offset, offset + 1) === '\n') {
                    return this.readRange(start, offset);
                }
            } else if (this.readRange(offset, offset + 1) === '\n') {
                currentLine++;
                start = offset + 1;
            }
        }

        if (currentLine === line) return this.readRange(start, this.length);
        throw new RangeError('Line is out of range.');
    }

    get text(): string {
        if (this.textCache === null) {
            // Only the two regions outside the gap contain document text.
            this.textCache =
                this.readText(0, this.gapStart) + this.readText(this.gapEnd, this.buffer.length);
        }
        return this.textCache;
    }

    getCursor(): Position {
        return this.offsetToPosition(this.cursorOffset);
    }

    moveCursor(position: Position): void {
        const offset = this.positionToOffset(position);
        this.moveToOffset(offset);
    }

    insertText(position: Position, text: string): void {
        if (text === '') return;
        const bounded = this.positionToOffset(position);
        this.moveToOffset(bounded);
        this.ensureGapCapacity(text.length);
        this.ensureWritableBuffer();
        this.writeText(text, this.gapStart);
        this.gapStart += text.length;
        this.cursorOffset = bounded + text.length;
        this.textCache = null;
    }

    deleteRange(start: Position, end: Position): void {
        let startOffset = this.positionToOffset(start);
        let endOffset = this.positionToOffset(end);
        if (startOffset > endOffset) [startOffset, endOffset] = [endOffset, startOffset];
        if (startOffset === endOffset) return;

        this.moveToOffset(startOffset);
        this.gapEnd += endOffset - startOffset;
        this.cursorOffset = startOffset;
        this.textCache = null;
    }

    getTextRange(start: Position, end: Position): string {
        let startOffset = this.positionToOffset(start);
        let endOffset = this.positionToOffset(end);
        if (startOffset > endOffset) [startOffset, endOffset] = [endOffset, startOffset];
        return this.readRange(startOffset, endOffset);
    }

    positionToOffset(position: Position): number {
        if (!Number.isInteger(position.line) || !Number.isInteger(position.column)) {
            throw new RangeError('Position must contain integer values.');
        }
        if (position.line < 0 || position.line >= this.lineCount) {
            throw new RangeError('Position is out of range.');
        }
        const text = this.text;
        let lineStart = 0;
        for (let line = 0; line < position.line; line++) {
            const newline = text.indexOf('\n', lineStart);
            if (newline === -1) throw new RangeError('Position is out of range.');
            lineStart = newline + 1;
        }
        const newline = text.indexOf('\n', lineStart);
        const lineEnd = newline === -1 ? text.length : newline;
        if (position.column < 0 || position.column > lineEnd - lineStart) {
            throw new RangeError('Position is out of range.');
        }
        return lineStart + position.column;
    }

    offsetToPosition(offset: number): Position {
        const bounded = this.boundOffset(offset);
        const text = this.text;
        let line = 0;
        let lineStart = 0;
        for (let i = 0; i < bounded; i++) {
            if (text[i] === '\n') {
                line++;
                lineStart = i + 1;
            }
        }
        return { line, column: bounded - lineStart };
    }

    captureMemento(): GapBufferMemento {
        // Copy-on-write keeps saved mementos independent of later mutations.
        this.bufferShared = true;
        return {
            kind: 'gap-buffer',
            buffer: this.buffer,
            gapStart: this.gapStart,
            gapEnd: this.gapEnd,
            cursorOffset: this.cursorOffset,
        };
    }

    restoreMemento(memento: BackendMemento): void {
        if (memento.kind !== 'gap-buffer') {
            throw new TypeError('Expected a gap-buffer memento.');
        }
        this.buffer = memento.buffer;
        this.bufferShared = true;
        this.gapStart = memento.gapStart;
        this.gapEnd = memento.gapEnd;
        this.cursorOffset = memento.cursorOffset;
        this.textCache = null;
    }

    private moveToOffset(offset: number): void {
        const bounded = this.boundOffset(offset);
        if (bounded < this.gapStart) {
            this.ensureWritableBuffer();
            const distance = this.gapStart - bounded;
            this.buffer.copyWithin(this.gapEnd - distance, bounded, this.gapStart);
            this.gapStart = bounded;
            this.gapEnd -= distance;
        } else if (bounded > this.gapStart) {
            this.ensureWritableBuffer();
            const distance = bounded - this.gapStart;
            this.buffer.copyWithin(this.gapStart, this.gapEnd, this.gapEnd + distance);
            this.gapStart += distance;
            this.gapEnd += distance;
        }
        this.cursorOffset = bounded;
    }

    private ensureWritableBuffer(): void {
        // Memento buffers are copy-on-write; slice() duplicates all physical slots.
        if (!this.bufferShared) return;
        this.buffer = this.buffer.slice();
        this.bufferShared = false;
    }

    private ensureGapCapacity(required: number): void {
        const available = this.gapEnd - this.gapStart;
        if (available >= required) return;

        const rightLength = this.buffer.length - this.gapEnd;
        const capacity = Math.max(this.buffer.length * 2, this.length + required, 64);
        const expanded = new Uint16Array(capacity);
        expanded.set(this.buffer.subarray(0, this.gapStart), 0);
        const newGapEnd = capacity - rightLength;
        expanded.set(this.buffer.subarray(this.gapEnd), newGapEnd);
        this.buffer = expanded;
        this.gapEnd = newGapEnd;
        this.bufferShared = false;
    }

    private writeText(text: string, offset: number): void {
        for (let i = 0; i < text.length; i++) {
            // Store UTF-16 code units, matching JavaScript string indexing.
            this.buffer[offset + i] = text.charCodeAt(i);
        }
    }

    private readText(start: number, end: number): string {
        let text = '';
        // Chunking avoids exceeding JavaScript's argument limit for spread calls.
        for (let offset = start; offset < end; offset += 8192) {
            text += String.fromCharCode(
                ...this.buffer.subarray(offset, Math.min(offset + 8192, end)),
            );
        }
        return text;
    }

    private readRange(start: number, end: number): string {
        if (start === end) return '';

        const parts: string[] = [];

        // Before the gap, logical offsets and buffer indexes are the same.
        const leftEnd = Math.min(end, this.gapStart);
        if (start < leftEnd) {
            parts.push(this.readText(start, leftEnd));
        }

        // After the gap, convert logical offsets to buffer indexes.
        const rightStart = Math.max(start, this.gapStart);
        if (rightStart < end) {
            const physicalStart = this.gapEnd + (rightStart - this.gapStart);
            const physicalEnd = this.gapEnd + (end - this.gapStart);
            parts.push(this.readText(physicalStart, physicalEnd));
        }

        return parts.join('');
    }

    private boundOffset(offset: number): number {
        if (!Number.isInteger(offset)) throw new RangeError('Offset must be an integer.');
        return Math.max(0, Math.min(offset, this.length));
    }
}
