export type Position = {
    line: number;
    offset: number;
};

export type Selection = {
    anchor: Position;
    focus: Position;
};

type Cursor = Position;

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

//I believe this should be defined here as this
//is dependant on the internal representation
export type EditorMemento = {
    lines: string[];
    cursor: Cursor;
    selection: Selection;
    time: number;
};
