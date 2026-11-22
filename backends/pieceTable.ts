import type {
    BackendMemento,
    PieceTableNode,
    PieceTablePiece,
    TextBackend,
} from './types.js';
import type { Position } from '../model/types.js';

type Node = PieceTableNode;
type Piece = PieceTablePiece;

type PieceTableMemento = Extract<BackendMemento, { kind: 'piece-table' }>;


export class PieceTableBackend implements TextBackend {
    readonly kind = 'piece-table';
    private original: string;
    private addBuffer = '';
    private root: Node | null = null;
    private cursorOffset = 0;
    private priorityState = 0x9e3779b9;

    constructor(text = '') {
        this.original = text;
        this.root = this.treeForSource('original', 0, text.length);
    }

    get length(): number {
        return this.subtreeLength(this.root);
    }

    get lineCount(): number {
        return this.subtreeNewlineCount(this.root) + 1;
    }

    get text(): string {
        const parts: string[] = [];
        this.appendText(this.root, parts);
        return parts.join('');
    }

    getLine(line: number): string {
        if (!Number.isInteger(line) || line < 0 || line >= this.lineCount) {
            throw new RangeError('Line is out of range.');
        }
        const start = this.lineStart(line);
        const end = line + 1 < this.lineCount ? this.newlineOffset(line) : this.length;
        return this.readRange(start, end);
    }

    getCursor(): Position {
        return this.offsetToPosition(this.cursorOffset);
    }

    moveCursor(position: Position): void {
        this.cursorOffset = this.positionToOffset(position);
    }

    insertText(position: Position, text: string): void {
        if (text === '') return;
        const bounded = this.positionToOffset(position);
        const [left, right] = this.split(this.root, bounded);
        const start = this.addBuffer.length;
        this.addBuffer += text;
        const inserted = this.treeForSource('add', start, text.length);
        this.root = this.concatenate(this.concatenate(left, inserted), right);
        this.cursorOffset = bounded + text.length;
    }

    deleteRange(start: Position, end: Position): void {
        let startOffset = this.positionToOffset(start);
        let endOffset = this.positionToOffset(end);
        if (startOffset > endOffset) [startOffset, endOffset] = [endOffset, startOffset];
        this.cursorOffset = startOffset;
        if (startOffset === endOffset) return;

        const [throughEnd, after] = this.split(this.root, endOffset);
        const [before] = this.split(throughEnd, startOffset);
        this.root = this.concatenate(before, after);
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
        const lineStart = this.lineStart(position.line);
        const lineEnd =
            position.line + 1 < this.lineCount
                ? this.newlineOffset(position.line)
                : this.length;
        if (position.column < 0 || position.column > lineEnd - lineStart) {
            throw new RangeError('Position is out of range.');
        }
        return lineStart + position.column;
    }

    offsetToPosition(offset: number): Position {
        const bounded = this.boundOffset(offset);
        let line = 0;
        let lineStart = 0;
        for (let i = 0; i < bounded; i++) {
            if (this.text[i] === '\n') {
                line++;
                lineStart = i + 1;
            }
        }
        return { line, column: bounded - lineStart };
    }

    captureMemento(): PieceTableMemento {
        return {
            kind: 'piece-table',
            original: this.original,
            addBuffer: this.addBuffer,
            root: this.root,
            cursorOffset: this.cursorOffset,
            priorityState: this.priorityState,
        };
    }

    restoreMemento(memento: BackendMemento): void {
        if (memento.kind !== 'piece-table') {
            throw new TypeError('Expected a piece-table memento.');
        }
        this.original = memento.original;
        this.addBuffer = memento.addBuffer;
        this.root = memento.root;
        this.cursorOffset = memento.cursorOffset;
        this.priorityState = memento.priorityState;
    }

    private lineStart(line: number): number {
        return line === 0 ? 0 : this.newlineOffset(line - 1) + 1;
    }

    private newlineOffset(index: number): number {
        if (index < 0 || index >= this.subtreeNewlineCount(this.root)) {
            throw new RangeError('Line is out of range.');
        }
        return this.findNewlineOffset(this.root, index);
    }

    private findNewlineOffset(node: Node | null, index: number): number {
        if (!node) throw new RangeError('Line is out of range.');

        const leftNewlines = this.subtreeNewlineCount(node.left);
        const leftLength = this.subtreeLength(node.left);
        if (index < leftNewlines) return this.findNewlineOffset(node.left, index);

        const pieceIndex = index - leftNewlines;
        if (pieceIndex < node.pieceNewlineCount) {
            return leftLength + this.newlineOffsetInPiece(node.piece, pieceIndex);
        }

        return (
            leftLength +
            node.piece.length +
            this.findNewlineOffset(node.right, pieceIndex - node.pieceNewlineCount)
        );
    }

    private newlineOffsetInPiece(piece: Piece, index: number): number {
        const source = this.sourceFor(piece);
        let newline = source.indexOf('\n', piece.start);
        for (let count = 0; count < index; count++) {
            newline = source.indexOf('\n', newline + 1);
        }
        if (newline < piece.start || newline >= piece.start + piece.length) {
            throw new RangeError('Line is out of range.');
        }
        return newline - piece.start;
    }

    private countNewlinesInSource(source: string, start: number, end: number): number {
        let count = 0;
        for (
            let newline = source.indexOf('\n', start);
            newline !== -1 && newline < end;
            newline = source.indexOf('\n', newline + 1)
        ) {
            count++;
        }
        return count;
    }

    private readRange(start: number, end: number): string {
        if (start === end) return '';
        const parts: string[] = [];
        this.appendRange(this.root, start, end, 0, parts);
        return parts.join('');
    }

    private boundOffset(offset: number): number {
        if (!Number.isInteger(offset)) throw new RangeError('Offset must be an integer.');
        return Math.max(0, Math.min(offset, this.length));
    }

    private appendRange(
        node: Node | null,
        start: number,
        end: number,
        baseOffset: number,
        parts: string[],
    ): void {
        if (!node || start >= end) return;

        const leftLength = this.subtreeLength(node.left);
        const pieceStart = baseOffset + leftLength;
        const pieceEnd = pieceStart + node.piece.length;
        if (start < pieceStart) {
            this.appendRange(node.left, start, end, baseOffset, parts);
        }

        const overlapStart = Math.max(start, pieceStart);
        const overlapEnd = Math.min(end, pieceEnd);
        if (overlapStart < overlapEnd) {
            const sourceStart = node.piece.start + overlapStart - pieceStart;
            parts.push(
                this.sourceFor(node.piece).slice(
                    sourceStart,
                    sourceStart + overlapEnd - overlapStart,
                ),
            );
        }

        if (end > pieceEnd) {
            this.appendRange(node.right, start, end, pieceEnd, parts);
        }
    }

    private appendText(node: Node | null, parts: string[]): void {
        if (!node) return;
        this.appendText(node.left, parts);
        parts.push(this.readPiece(node.piece));
        this.appendText(node.right, parts);
    }

    private readPiece(piece: Piece): string {
        return this.sourceFor(piece).slice(piece.start, piece.start + piece.length);
    }

    private sourceFor(piece: Piece): string {
        return piece.source === 'original' ? this.original : this.addBuffer;
    }

    private treeForSource(sourceName: Piece['source'], start: number, length: number): Node | null {
        const source = sourceName === 'original' ? this.original : this.addBuffer;
        const end = start + length;
        let pieceStart = start;
        let root: Node | null = null;
        for (
            let newline = source.indexOf('\n', pieceStart);
            newline !== -1 && newline < end;
            newline = source.indexOf('\n', newline + 1)
        ) {
            const piece = this.createNode({
                source: sourceName,
                start: pieceStart,
                length: newline + 1 - pieceStart,
            });
            root = this.merge(root, piece);
            pieceStart = newline + 1;
        }
        if (pieceStart < end) {
            root = this.merge(
                root,
                this.createNode({
                    source: sourceName,
                    start: pieceStart,
                    length: end - pieceStart,
                }),
            );
        }
        return root;
    }

    private split(node: Node | null, offset: number): [Node | null, Node | null] {
        if (!node) return [null, null];

        const leftLength = this.subtreeLength(node.left);
        const pieceEnd = leftLength + node.piece.length;
        if (offset < leftLength) {
            const [before, after] = this.split(node.left, offset);
            return [before, this.withChildren(node, after, node.right)];
        }
        if (offset > pieceEnd) {
            const [before, after] = this.split(node.right, offset - pieceEnd);
            return [this.withChildren(node, node.left, before), after];
        }
        if (offset === leftLength) {
            return [node.left, this.withChildren(node, null, node.right)];
        }
        if (offset === pieceEnd) {
            return [this.withChildren(node, node.left, null), node.right];
        }

        const leftPieceLength = offset - leftLength;
        const leftPiece = {
            ...node.piece,
            length: leftPieceLength,
        };
        const rightPiece = {
            ...node.piece,
            start: node.piece.start + leftPieceLength,
            length: node.piece.length - leftPieceLength,
        };
        const beforePiece = this.createNode(leftPiece);
        const afterPiece = this.createNode(rightPiece);
        return [this.merge(node.left, beforePiece), this.merge(afterPiece, node.right)];
    }

    private concatenate(left: Node | null, right: Node | null): Node | null {
        if (!left) return right;
        if (!right) return left;

        const [leftRest, last] = this.removeLast(left);
        const [first, rightRest] = this.removeFirst(right);
        if (
            last.piece.source === first.piece.source &&
            last.piece.start + last.piece.length === first.piece.start &&
            last.pieceNewlineCount + first.pieceNewlineCount <= 1
        ) {
            const combined = this.createNode(
                {
                    ...last.piece,
                    length: last.piece.length + first.piece.length,
                },
                this.nextPriority(),
                null,
                null,
                last.pieceNewlineCount + first.pieceNewlineCount,
            );
            return this.merge(this.merge(leftRest, combined), rightRest);
        }

        return this.merge(this.merge(leftRest, last), this.merge(first, rightRest));
    }

    private removeLast(node: Node): [Node | null, Node] {
        if (!node.right) {
            return [
                node.left,
                this.createNode(node.piece, node.priority, null, null, node.pieceNewlineCount),
            ];
        }
        const [rest, last] = this.removeLast(node.right);
        return [this.withChildren(node, node.left, rest), last];
    }

    private removeFirst(node: Node): [Node, Node | null] {
        if (!node.left) {
            return [
                this.createNode(node.piece, node.priority, null, null, node.pieceNewlineCount),
                node.right,
            ];
        }
        const [first, rest] = this.removeFirst(node.left);
        return [first, this.withChildren(node, rest, node.right)];
    }

    private merge(left: Node | null, right: Node | null): Node | null {
        if (!left) return right;
        if (!right) return left;
        if (left.priority >= right.priority) {
            return this.withChildren(left, left.left, this.merge(left.right, right));
        }
        return this.withChildren(right, this.merge(left, right.left), right.right);
    }

    private createNode(
        piece: Piece,
        priority = this.nextPriority(),
        left: Node | null = null,
        right: Node | null = null,
        pieceNewlineCount = this.countNewlinesInSource(
            this.sourceFor(piece),
            piece.start,
            piece.start + piece.length,
        ),
    ): Node {
        return {
            piece,
            priority,
            pieceNewlineCount,
            left,
            right,
            subtreeLength: this.subtreeLength(left) + piece.length + this.subtreeLength(right),
            subtreeNewlineCount:
                this.subtreeNewlineCount(left) +
                pieceNewlineCount +
                this.subtreeNewlineCount(right),
        };
    }

    private withChildren(node: Node, left: Node | null, right: Node | null): Node {
        return this.createNode(node.piece, node.priority, left, right, node.pieceNewlineCount);
    }

    private nextPriority(): number {
        let value = this.priorityState;
        value ^= value << 13;
        value ^= value >>> 17;
        value ^= value << 5;
        this.priorityState = value >>> 0;
        return this.priorityState;
    }

    private subtreeLength(node: Node | null): number {
        return node?.subtreeLength ?? 0;
    }

    private subtreeNewlineCount(node: Node | null): number {
        return node?.subtreeNewlineCount ?? 0;
    }
}
