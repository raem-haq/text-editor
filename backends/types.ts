import type { Position } from '../model/types.js';

export type PieceTablePiece = {
    readonly source: 'original' | 'add';
    readonly start: number;
    readonly length: number;
};

export type PieceTableNode = {
    readonly piece: PieceTablePiece;
    readonly priority: number;
    readonly pieceNewlineCount: number;
    readonly subtreeLength: number;
    readonly subtreeNewlineCount: number;
    readonly left: PieceTableNode | null;
    readonly right: PieceTableNode | null;
};

export type BackendMemento =
    | {
          readonly kind: 'array-lines';
          readonly lines: readonly string[];
          readonly cursor: Position;
      }
    | {
          readonly kind: 'gap-buffer';
          readonly buffer: Uint16Array;
          readonly gapStart: number;
          readonly gapEnd: number;
          readonly cursorOffset: number;
      }
    | {
          readonly kind: 'piece-table';
          readonly original: string;
          readonly addBuffer: string;
          readonly root: PieceTableNode | null;
          readonly cursorOffset: number;
          readonly priorityState: number;
      };

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
