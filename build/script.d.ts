export {};
export type Position = {
    line: number;
    column: number;
};
export type Selection = {
    anchor: Position;
    active: Position;
} | null;
export type TextEditorState = {
    lines: string[];
    cursor: Position;
    selection: Selection;
    savedVerticalCursorIndex: number | null;
};
type EditorMemento = {
    lines: string[];
    cursor: Position;
    selection: Selection;
    time: number;
    endBlockCursor: Position;
};
export type EditorHistory = {
    undoStack: EditorMemento[];
    redoStack: EditorMemento[];
    openBlockCategory: BlockCategory | null;
};
export declare function pushToUndo(state: TextEditorState, history: EditorHistory, type: ActionType): void;
export declare function undo(history: EditorHistory, state: TextEditorState): boolean;
export declare function redo(history: EditorHistory, state: TextEditorState): boolean;
export declare function renderDOM(state: TextEditorState): void;
export declare function insertText(state: TextEditorState, text: string): void;
export declare function handleEnter(state: TextEditorState): void;
export declare function handleBackspace(state: TextEditorState): void;
export declare function handleTab(state: TextEditorState): void;
export declare function pasteText(state: TextEditorState, text: string): void;
export declare function removeSelectedText(state: TextEditorState): void;
export declare function handleMovement(state: TextEditorState, key: ArrowKey, shift: boolean): void;
type ArrowKey = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight";
export type EditorAction = {
    type: "move";
    key: ArrowKey;
    shift: boolean;
} | {
    type: "insert";
    text: string;
    paste: boolean;
} | {
    type: "enter";
} | {
    type: "backspace";
} | {
    type: "tab";
} | {
    type: "cut";
} | {
    type: "undo";
} | {
    type: "redo";
};
type ActionType = EditorAction["type"];
type BlockCategory = "insert" | "backspace" | "enter" | "tab";
//# sourceMappingURL=script.d.ts.map