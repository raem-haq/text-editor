type Piece = {
    source: 'original' | 'add';
    start: number;
    length: number;
};

export class PieceTable {
    private readonly original: string;
    private addBuffer = '';
    private pieces: Piece[];
    private cursor = 0;

    constructor(text = '') {
        this.original = text;
        this.pieces =
            text.length === 0 ? [] : [{ source: 'original', start: 0, length: text.length }];
    }

    get length(): number {
        return this.pieces.reduce((total, piece) => total + piece.length, 0);
    }

    get cursorPosition(): number {
        return this.cursor;
    }

    moveCursor(position: number): void {
        this.validatePosition(position);
        this.cursor = position;
    }

    insert(text: string): void {
        if (text.length === 0) return;

        const start = this.addBuffer.length;
        this.addBuffer += text;
        const pieceIndex = this.splitAt(this.cursor);
        this.pieces.splice(pieceIndex, 0, {
            source: 'add',
            start,
            length: text.length,
        });
        this.coalescePieces();
        this.cursor += text.length;
    }

    deleteBefore(count = 1): void {
        this.validateCount(count);
        if (count > this.cursor) {
            throw new RangeError(`Cannot delete ${count} character(s) before cursor at position ${this.cursor}.`);
        }
        this.deleteRange(this.cursor - count, count);
    }

    deleteAfter(count = 1): void {
        this.validateCount(count);
        this.deleteRange(this.cursor, count);
    }

    getText(): string {
        return this.pieces.map((piece) => this.readPiece(piece)).join('');
    }

    private deleteRange(position: number, count: number): void {
        this.validatePosition(position);
        if (position + count > this.length) {
            throw new RangeError('Delete range exceeds the buffer length.');
        }

        this.cursor = position;
        if (count === 0) return;

        const firstPiece = this.splitAt(position);
        const afterLastPiece = this.splitAt(position + count);
        this.pieces.splice(firstPiece, afterLastPiece - firstPiece);
        this.coalescePieces();
    }

    private splitAt(position: number): number {
        let currentPosition = 0;
        for (let i = 0; i < this.pieces.length; i++) {
            const piece = this.pieces[i]!;
            const pieceEnd = currentPosition + piece.length;
            if (position === currentPosition) return i;
            if (position < pieceEnd) { 
                const leftLength = position - currentPosition;
                this.pieces.splice( //split the piece into two pieces
                    i,
                    1,
                    { source: piece.source, start: piece.start, length: leftLength },
                    {
                        source: piece.source,
                        start: piece.start + leftLength,
                        length: piece.length - leftLength,
                    },
                );
                return i + 1;
            }
            currentPosition = pieceEnd;
        }
        return this.pieces.length;
    }

    private coalescePieces(): void {
        const merged: Piece[] = [];
        for (const piece of this.pieces) {
            const previous = merged.at(-1);
            if (
                previous !== undefined &&
                previous.source === piece.source &&
                previous.start + previous.length === piece.start
            ) {
                previous.length += piece.length;
            } else {
                merged.push(piece);
            }
        }
        this.pieces = merged;
    }

    private readPiece(piece: Piece): string {
        const buffer = piece.source === 'original' ? this.original : this.addBuffer;
        return buffer.slice(piece.start, piece.start + piece.length);
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
