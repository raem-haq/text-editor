export type Position = {
    line: number;
    offset: number;
};

export type Selection = {
    anchor: Position;
    focus: Position;
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
