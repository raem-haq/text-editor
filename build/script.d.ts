export {};
export type Position = {
    line: number;
    column: number;
};
export type Selection = {
    anchor: Position;
    active: Position;
} | null;
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