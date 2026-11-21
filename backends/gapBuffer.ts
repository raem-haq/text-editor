export class GapBuffer {
    private buffer: string[];
    private gapStart: number;
    private gapEnd: number;

    constructor(text = '', initialGapSize = 16) {
        if (!Number.isInteger(initialGapSize) || initialGapSize < 0) {
            throw new RangeError('Initial gap size must be a non-negative integer.');
        }

        this.buffer = new Array<string>(text.length + initialGapSize).fill('');
        this.gapStart = text.length;
        this.gapEnd = text.length + initialGapSize;
        for (let i = 0; i < text.length; i++) {
            this.buffer[i] = text[i]!;
        }
    }

    get length(): number {
        return this.buffer.length - (this.gapEnd - this.gapStart);
    }

    get cursorPosition(): number {
        return this.gapStart;
    }

    moveCursor(position: number): void {
        this.validatePosition(position);
        if (this.gapStart === this.gapEnd) {
            this.expandGap(1);
        }
        
        while (this.gapStart > position) {
            this.buffer[this.gapEnd - 1] = this.buffer[this.gapStart - 1]!;
            this.buffer[this.gapStart - 1] = '';
            this.gapStart--;
            this.gapEnd--;
        }
        while (this.gapStart < position) {
            this.buffer[this.gapStart] = this.buffer[this.gapEnd]!;
            this.buffer[this.gapEnd] = '';
            this.gapStart++;
            this.gapEnd++;
        }
    }

    insert(text: string): void {
        this.expandGap(text.length);
        for (let i = 0; i < text.length; i++) {
            this.buffer[this.gapStart++] = text[i]!;
        }
    }

    deleteBefore(count = 1): void {
        this.validateCount(count);
        if (count > this.gapStart) {
            throw new RangeError('Delete range precedes the buffer start.');
        }

        this.gapStart -= count;
    }

    deleteAfter(count = 1): void {
        this.validateCount(count);
        if (this.gapEnd + count > this.buffer.length) {
            throw new RangeError('Delete range exceeds the buffer length.');
        }

        this.gapEnd += count;
    }

    getText(): string {
        return (
            this.buffer.slice(0, this.gapStart).join('') + this.buffer.slice(this.gapEnd).join('')
        );
    }

    private expandGap(requiredSize: number): void {
        const currentGapSize = this.gapEnd - this.gapStart;
        if (currentGapSize >= requiredSize) return;

        var newGapSize = currentGapSize;
        while (newGapSize < requiredSize) {
            newGapSize *= 2;
        };
        const newBuffer = new Array<string>(this.buffer.length + newGapSize - currentGapSize).fill('',);
        for (let i = 0; i < this.gapStart; i++) {
            newBuffer[i] = this.buffer[i]!;
        }
        const newGapEnd = this.gapEnd + (newGapSize - currentGapSize);
        for (let i = 0; i < this.buffer.length - this.gapEnd; i++) {
            newBuffer[newGapEnd + i] = this.buffer[this.gapEnd + i]!;
        }
        this.buffer = newBuffer;
        this.gapEnd = newGapEnd;
    }

    private validatePosition(position: number): void {
        if (!Number.isInteger(position) || position < 0 || position > this.length) {
            throw new RangeError('Position must be an integer within the buffer.');
        }
    }

    private validateCount(count: number): void {
        if (!Number.isInteger(count) || count < 0) {
            throw new RangeError('Count must be a non-negative integer.');
        }
    }
}
