import type { BackendMemento, Position } from './types.js';

export interface TextBackend {
    readonly kind: BackendMemento['kind'];
    readonly length: number;
    readonly lineCount: number;
    readonly text: string;

    getCursor(): Position;
    getLine(line: number): string;
    moveCursor(position: Position): void;
    insertText(position: Position, text: string): void;
    deleteRange(start: Position, end: Position): void;
    getTextRange(start: Position, end: Position): string;

    positionToOffset(position: Position): number;
    offsetToPosition(offset: number): Position;
    captureMemento(): BackendMemento;
    restoreMemento(memento: BackendMemento): void;
}
