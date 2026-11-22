export type Position = {
    line: number;
    column: number;
};

export type Selection = {
    anchor: Position;
    focus: Position;
};
