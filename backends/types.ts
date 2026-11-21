export type Position = {
    line: number;
    offset: number;
};

export type Selection = {
    anchor: Position;
    focus: Position;
};

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

export type Cursor = Position;

export type TextEditorState = {
    lines: string[];
    cursor: Cursor;
    selection: Selection | null;
    savedVerticalOffset: number | null;
};

// The start line is preserved; removeNo and insertNo count following lines.
export type LineSplice = {
    startLine: number;
    removeNo: number;
    insertNo: number;
    endLine: number;
};
