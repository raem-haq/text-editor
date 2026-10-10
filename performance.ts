export {}

const CSV_FILE_NAME : string = "baseline.csv"

import {
    TextEditorState,
    EditorHistory,
    Position,
    Selection,
    EditorAction,
    pushToUndo,
    insertText,
    renderDOM,
    handleEnter,
    handleBackspace,
    handleMovement,
    handleTab,
    removeSelectedText,
    pasteText,
    undo,
    redo
} from "./script.js";

const state: TextEditorState = {
    lines: [""],
    cursor: {line: 0, column: 0},
    selection: null,
    savedVerticalCursorIndex: null,
};

const history: EditorHistory = {
    undoStack: [],
    redoStack: [],
    openBlockCategory: null,
};

function timeFunction(func: () => any): number {
    const start = performance.now()
    func()
    return performance.now() - start;
}

type BenchmarkRow = {
  operation: string;
  functionName: string;
  payload: string | null;
  durationMS: number;
  cursorIndex: number;
  documentChars: number;
  documentLines: number;
  currentLineChars: number;
  payloadLength: number;
  selectionLength: number;
  timestamp: number;
};

function lengthOfSelection(selection: Selection): number {
    if (selection === null) return 0;

    let { anchor: start, active: end } = selection;

    if (start.line > end.line || (start.line === end.line && start.column > end.column)) {
        [start, end] = [end, start];
    }

    if (start.line === end.line) {
        return Math.abs(end.column - start.column);
    }

    let total = state.lines[start.line]!.length - start.column + 1;
    for (let line = start.line + 1; line < end.line; line++) {
        total += state.lines[line]!.length;
    }
    total += end.column + 1;

    return total;
}

function benchmarkCall(state: TextEditorState, action: EditorAction, functionName: string, fn: () => void,): BenchmarkRow {
  const payload = action.type === "insert" ? action.text : null;

  const currentLine = state.lines[state.cursor.line] ?? "";

  const row: BenchmarkRow = {
    operation: action.type,
    functionName,
    payload,
    durationMS: timeFunction(fn),
    cursorIndex: state.cursor.column,
    currentLineChars: currentLine.length,
    documentChars: state.lines.reduce((total, line) => total + line.length, 0),
    documentLines: state.lines.length,
    payloadLength: payload ? payload.length : 0,
    selectionLength: lengthOfSelection(state.selection),
    timestamp: Date.now(),
  };

  return row;
}

function timeHandler(state: TextEditorState, history: EditorHistory, action : EditorAction): BenchmarkRow[] {
    const returnRows : BenchmarkRow[] = [];
    const {type} = action;

    if (type !== "move") state.savedVerticalCursorIndex = null;

    switch (type){
        case "move":
            returnRows.push(benchmarkCall(state, action, "handleMovement", () => handleMovement(state, action.key, action.shift)));
            break;
        case "undo":
            returnRows.push(benchmarkCall(state, action, "undo", () => undo(history, state)));
            break;
        case "redo":
            returnRows.push(benchmarkCall(state, action, "redo", () => redo(history, state)));;
            break;
        case "cut":
            returnRows.push(benchmarkCall(state, action, "pushToUndo", () => pushToUndo(state, history, type)));
            returnRows.push(benchmarkCall(state, action, "removeSelectedText", () => removeSelectedText(state)));
            break;
        case "insert":
            const {text, paste} = action;
            returnRows.push(benchmarkCall(state, action, "pushToUndo", () => pushToUndo(state, history, type)));
            if (paste){
                returnRows.push(benchmarkCall(state, action, "pasteText", () => pasteText(state, text)));
            } else {
                returnRows.push(benchmarkCall(state, action, "insertText", () => insertText(state, text)));
            }
            break;
        case "backspace":
            returnRows.push(benchmarkCall(state, action, "pushToUndo", () => pushToUndo(state, history, type)));
            returnRows.push(benchmarkCall(state, action, "handleBackspace", () => handleBackspace(state)));
            break;
        case "enter":
            returnRows.push(benchmarkCall(state, action, "pushToUndo", () => pushToUndo(state, history, type)));
            returnRows.push(benchmarkCall(state, action, "handleEnter", () => handleEnter(state)));
            break;
        case "tab":
            returnRows.push(benchmarkCall(state, action, "pushToUndo", () => pushToUndo(state, history, type)));
            returnRows.push(benchmarkCall(state, action, "handleTab", () => handleTab(state)));
            break;
    }
    returnRows.push(benchmarkCall(state, action, "renderDOM", () => renderDOM(state)));
    return returnRows;
}


function writeCSV(rows: BenchmarkRow[]): void {
    if (rows.length === 0) return;

    const headers = Object.keys(rows[0]!) as (keyof BenchmarkRow)[];

    const escapeCSV = (value: unknown): string =>
        `"${String(value ?? "").replace(/"/g, '""')}"`;

    const csv = [
        headers.map(escapeCSV).join(","),
        ...rows.map(row =>
            headers.map(header => escapeCSV(row[header])).join(",")
        )
    ].join("\r\n");

    const blob = new Blob([csv], {
        type: "text/csv;charset=utf-8;"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = CSV_FILE_NAME;
    link.click();

    URL.revokeObjectURL(url);
}


function changeLines(state: TextEditorState, history: EditorHistory, newLines: string[]){
    state.cursor = {line: 0, column: 0};
    state.lines = newLines;
    state.selection = null;
    state.savedVerticalCursorIndex = null;
    history = {undoStack: [], redoStack: [], openBlockCategory: null};
}

function isValidPosition(state: TextEditorState, position: Position): boolean{
    const {line, column} = position;
    return (line >= 0 && line < state.lines.length &&
        column >= 0 && column < state.lines[column]!.length
    );
}

function changeCursor(state: TextEditorState, history: EditorHistory, position: Position): void{
    if (isValidPosition(state, position)){
        state.cursor = {...position};
        history.openBlockCategory = null;
    }
}

function changeSelection(state: TextEditorState, newSelection : Selection){
    if (newSelection === null){
        state.selection = null;
    } else if (isValidPosition(state, newSelection.active) && isValidPosition(state, newSelection.anchor)){
      state.selection = {...newSelection};
    }
}

state.lines = ["Lorem ipsum dolor sit amet, consectetur adipiscing elit."];
state.cursor = {line: 0, column: 5};
state.selection = {
    anchor: {line: 0, column: 0},
    active: {line: 0, column: 5},
};

const actions: EditorAction[] = [
    {type: "cut"},
    {type: "insert", text: "Lorem ipsum", paste: false},
    {type: "insert", text: " dolor", paste: true},
    {type: "move", key: "ArrowRight", shift: false},
    {type: "enter"},
    {type: "tab"},
    {type: "backspace"},
    {type: "undo"},
    {type: "redo"},
];

const rows: BenchmarkRow[] = [];
for (const action of actions) {
    rows.push(...timeHandler(state, history, action));
}
writeCSV(rows);

