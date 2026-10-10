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
    const N = 30;
    const start = performance.now();
    for (let i = 0; i < N; i++){
        func();
    }
    return (performance.now() - start) / N;
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


//Each of these is repeated N times.
const actions: EditorAction[] = [
    { type: "insert", text: "The quick brown fox jumps over the lazy dog.", paste: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: true },
    { type: "insert", text: "cat", paste: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "insert", text: "very ", paste: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: true },
    { type: "move", key: "ArrowLeft", shift: true },
    { type: "cut" },
    { type: "insert", text: "beautiful", paste: false },
    { type: "move", key: "ArrowRight", shift: false },
    { type: "move", key: "ArrowRight", shift: false },
    { type: "insert", text: " and incredibly ", paste: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "backspace" },
    { type: "insert", text: "remarkably", paste: false },
    { type: "move", key: "ArrowUp", shift: false },
    { type: "move", key: "ArrowDown", shift: false },
    { type: "move", key: "ArrowLeft", shift: true },
    { type: "move", key: "ArrowRight", shift: true },
    { type: "undo" },
    { type: "redo" },
    { type: "insert", text: " Once upon a time, in a small village surrounded by green hills and ancient forests, there lived a curious young explorer named Alex. Every morning, Alex would wander through the winding streets, greeting neighbors and wondering what lay beyond the distant mountains. One sunny afternoon, while exploring an overgrown garden behind an abandoned cottage, Alex discovered a mysterious wooden door hidden beneath thick vines. The door had strange symbols carved into its surface, and a tiny brass handle that glimmered in the sunlight. With a deep breath and a little hesitation, Alex turned the handle and stepped into a world unlike anything they had ever imagined.", paste: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "insert", text: " incredibly", paste: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: true },
    { type: "move", key: "ArrowLeft", shift: true },
    { type: "move", key: "ArrowLeft", shift: true },
    { type: "move", key: "ArrowLeft", shift: true },
    { type: "insert", text: "wonderfully", paste: false },
    { type: "move", key: "ArrowRight", shift: false },
    { type: "move", key: "ArrowRight", shift: false },
    { type: "move", key: "ArrowRight", shift: false },
    { type: "insert", text: " unexpectedly", paste: false },
    { type: "enter" },
    { type: "insert", text: "This is a new paragraph that contains enough text to exercise cursor placement throughout a long line. Moving the cursor backward and forward should allow edits at the beginning, middle, and end of the paragraph, rather than only at the boundaries. We can also select portions of text, replace them, and test how the editor handles changes to existing content.", paste: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: true },
    { type: "move", key: "ArrowLeft", shift: true },
    { type: "move", key: "ArrowLeft", shift: true },
    { type: "move", key: "ArrowLeft", shift: true },
    { type: "cut" },
    { type: "insert", text: "a carefully rewritten section", paste: false },
    { type: "move", key: "ArrowUp", shift: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowRight", shift: true },
    { type: "move", key: "ArrowRight", shift: true },
    { type: "insert", text: "XX", paste: false },
    { type: "undo" },
    { type: "undo" },
    { type: "redo" },
    { type: "insert", text: " additional details", paste: false },
    { type: "move", key: "ArrowDown", shift: false },
    { type: "move", key: "ArrowRight", shift: false },
    { type: "move", key: "ArrowRight", shift: false },
    { type: "move", key: "ArrowRight", shift: false },
    { type: "move", key: "ArrowRight", shift: false },
    { type: "insert", text: " inserted midway ", paste: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "backspace" },
    { type: "insert", text: "e", paste: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: true },
    { type: "move", key: "ArrowLeft", shift: true },
    { type: "insert", text: "edited", paste: false },
    { type: "move", key: "ArrowRight", shift: false },
    { type: "move", key: "ArrowRight", shift: false },
    { type: "move", key: "ArrowLeft", shift: true },
    { type: "cut" },
    { type: "insert", text: "replacement text", paste: true },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "insert", text: " pasted in the middle", paste: true },
    { type: "move", key: "ArrowUp", shift: false },
    { type: "move", key: "ArrowUp", shift: true },
    { type: "move", key: "ArrowLeft", shift: true },
    { type: "backspace" },
    { type: "undo" },
    { type: "redo" },
    { type: "enter" },
    { type: "insert", text: "A multiline block follows, including several paragraphs, punctuation, numbers, and symbols.\nThe second line begins here and contains enough words to test horizontal cursor movement, text selection, and insertion in the middle of a sentence.\nThe third line includes 1234567890, brackets [a, b, c], braces {x: 1}, and symbols !@#$%^&*().\nThe fourth line deliberately contains repeated words: alpha alpha beta beta gamma gamma delta delta.\nThe final line concludes this pasted block and gives us a useful place to test undo and redo.", paste: true },
    { type: "move", key: "ArrowUp", shift: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "insert", text: "MIDDLE ", paste: false },
    { type: "move", key: "ArrowRight", shift: true },
    { type: "move", key: "ArrowRight", shift: true },
    { type: "move", key: "ArrowRight", shift: true },
    { type: "cut" },
    { type: "insert", text: "replaced selection", paste: false },
    { type: "move", key: "ArrowDown", shift: false },
    { type: "move", key: "ArrowDown", shift: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "insert", text: "123", paste: false },
    { type: "tab" },
    { type: "insert", text: "Indented content after a tab, followed by enough text to make the line long and provide multiple cursor positions for subsequent edits.", paste: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: true },
    { type: "move", key: "ArrowLeft", shift: true },
    { type: "backspace" },
    { type: "insert", text: " corrected phrase", paste: false },
    { type: "undo" },
    { type: "redo" },
    { type: "move", key: "ArrowRight", shift: false },
    { type: "move", key: "ArrowRight", shift: false },
    { type: "move", key: "ArrowRight", shift: false },
    { type: "move", key: "ArrowRight", shift: false },
    { type: "move", key: "ArrowRight", shift: false },
    { type: "move", key: "ArrowRight", shift: false },
    { type: "move", key: "ArrowRight", shift: false },
    { type: "insert", text: " in the center", paste: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: true },
    { type: "move", key: "ArrowLeft", shift: true },
    { type: "move", key: "ArrowLeft", shift: true },
    { type: "insert", text: "central", paste: false },
    { type: "move", key: "ArrowUp", shift: false },
    { type: "move", key: "ArrowRight", shift: false },
    { type: "move", key: "ArrowRight", shift: false },
    { type: "move", key: "ArrowRight", shift: false },
    { type: "move", key: "ArrowRight", shift: false },
    { type: "move", key: "ArrowRight", shift: false },
    { type: "move", key: "ArrowRight", shift: false },
    { type: "move", key: "ArrowRight", shift: false },
    { type: "move", key: "ArrowRight", shift: false },
    { type: "insert", text: "XYZ", paste: false },
    { type: "undo" },
    { type: "redo" },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "backspace" },
    { type: "insert", text: "Q", paste: false },
    { type: "move", key: "ArrowDown", shift: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: true },
    { type: "move", key: "ArrowLeft", shift: true },
    { type: "cut" },
    { type: "insert", text: "a different ending", paste: true },
    { type: "move", key: "ArrowRight", shift: false },
    { type: "move", key: "ArrowRight", shift: false },
    { type: "move", key: "ArrowRight", shift: false },
    { type: "insert", text: " with a continuation", paste: false },
    { type: "enter" },
    { type: "insert", text: "The editor should now contain a substantial amount of content across multiple lines. This sequence intentionally moves the cursor back and forth before inserting, deleting, selecting, cutting, and replacing text. The edits target locations throughout the document so that cursor behavior can be tested away from line boundaries, while the history operations exercise undo and redo after several different kinds of changes.", paste: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: true },
    { type: "move", key: "ArrowLeft", shift: true },
    { type: "move", key: "ArrowLeft", shift: true },
    { type: "insert", text: "modified", paste: false },
    { type: "move", key: "ArrowUp", shift: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowLeft", shift: false },
    { type: "move", key: "ArrowRight", shift: true },
    { type: "cut" },
    { type: "insert", text: "final edit", paste: false },
    { type: "undo" },
    { type: "undo" },
    { type: "redo" },
    { type: "redo" },
];

const rows: BenchmarkRow[] = [];
for (let i = 0; i < 3; i++){
    for (const action of actions) {
        rows.push(...timeHandler(state, history, action));
    }
}
writeCSV(rows);

