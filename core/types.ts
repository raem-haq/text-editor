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

// Behaves like the splice() function
// As some functions mutate the lines in place, an
// endLine value is included
export type LineSplice = {
    startLine: number;
    removeNo: number;
    insertNo: number;
    endLine: number;
};
