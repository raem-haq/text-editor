export {}

import {
    TextEditorState,
    EditorHistory,
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
    redo,
    ActionType
} from "./script.js";

const IMPLEMENTATION: string = "baseline";
const CSV_FILE_NAME : string = IMPLEMENTATION + ".csv";

function timeFunction(func: () => any): number {
    const N = 15;
    const start = performance.now();
    for (let i = 0; i < N; i++){
        func();
    }
    return (performance.now() - start) / N;
}



function createInitialState(): TextEditorState {
    return {
        lines: [""],
        cursor: {line: 0, column: 0},
        selection: null,
        savedVerticalCursorIndex: null,
    };
}

function createHistory(): EditorHistory { // function claims to do a lot, hehe
    return {
        undoStack: [],
        redoStack: [],
        openBlockCategory: null,
        endBlockCursor: null,
    };
}

function lengthOfSelection(state: TextEditorState): number {
    const {selection} = state;
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

function benchmarkCall(context: BenchmarkScenario, state: TextEditorState, 
    action: EditorAction, functionName: string, fn: () => void): BenchmarkRow {
  const payload = action.type === "insert" ? action.text : null;

  const currentLine = state.lines[state.cursor.line] ?? "";

  const {documentChars, documentLines, payloadLength} = context;

  return {
    implementation: IMPLEMENTATION,
    documentChars,
    documentLines,
    payloadLength,
    operation: action.type as string,
    functionName,
    durationMS: timeFunction(fn),
    cursorIndex: state.cursor.column,
    currentLineChars: currentLine.length,
    selectionLength: lengthOfSelection(state),
    timestamp: Date.now(),
  };
}

function timeHandler(context: BenchmarkScenario, state: TextEditorState, 
        history: EditorHistory, action : EditorAction,): BenchmarkRow[] {
    const returnRows : BenchmarkRow[] = [];
    const {type} = action;

    if (type !== "move") state.savedVerticalCursorIndex = null;

    switch (type){
        case "move":
            returnRows.push(benchmarkCall(context, state, action, "handleMovement", () => handleMovement(state, action.key, action.shift)));
            break;
        case "undo":
            returnRows.push(benchmarkCall(context, state, action, "undo", () => undo(history, state)));
            break;
        case "redo":
            returnRows.push(benchmarkCall(context, state, action, "redo", () => redo(history, state)));;
            break;
        case "cut":
            returnRows.push(benchmarkCall(context, state, action, "pushToUndo", () => pushToUndo(state, history, type)));
            returnRows.push(benchmarkCall(context, state, action, "removeSelectedText", () => removeSelectedText(state)));
            break;
        case "insert":
            const {text, paste} = action;
            returnRows.push(benchmarkCall(context, state, action, "pushToUndo", () => pushToUndo(state, history, type)));
            if (paste){
                returnRows.push(benchmarkCall(context, state, action, "pasteText", () => pasteText(state, text)));
            } else {
                returnRows.push(benchmarkCall(context, state, action, "insertText", () => insertText(state, text)));
            }
            break;
        case "backspace":
            returnRows.push(benchmarkCall(context, state, action, "pushToUndo", () => pushToUndo(state, history, type)));
            returnRows.push(benchmarkCall(context, state, action, "handleBackspace", () => handleBackspace(state)));
            break;
        case "enter":
            returnRows.push(benchmarkCall(context, state, action, "pushToUndo", () => pushToUndo(state, history, type)));
            returnRows.push(benchmarkCall(context, state, action, "handleEnter", () => handleEnter(state)));
            break;
        case "tab":
            returnRows.push(benchmarkCall(context, state, action, "pushToUndo", () => pushToUndo(state, history, type)));
            returnRows.push(benchmarkCall(context, state, action, "handleTab", () => handleTab(state)));
            break;
    }
    returnRows.push(benchmarkCall(context, state, action, "renderDOM", () => renderDOM(state)));
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

function changeLines(state: TextEditorState, history: EditorHistory, newLines: string[]): void {
    state.cursor = { line: 0, column: 0 };
    state.lines = newLines;
    state.selection = null;
    state.savedVerticalCursorIndex = null;

    history.undoStack = [];
    history.redoStack = [];
    history.openBlockCategory = null;
}

type BenchmarkScenario = {
    documentChars: number;
    documentLines: number;
    payloadLength: number;
};

type BenchmarkRow = {
  implementation: string;
  operation: string;
  functionName: string;
  durationMS: number;
  cursorIndex: number;
  documentChars: number;
  documentLines: number;
  currentLineChars: number;
  payloadLength: number;
  selectionLength: number;
  timestamp: number;
};

function prepareState(state: TextEditorState, history: EditorHistory, documentLines: number, 
        lineLength: number, cursorPercent: number): void {
    const lines = Array.from({ length: Math.max(1, documentLines) }, () => "x".repeat(Math.max(1, lineLength)));

    changeLines(state, history, lines);

    const targetLine = Math.floor((lines.length - 1) / 2);
    const targetColumn = Math.round(lines[targetLine]!.length * cursorPercent);

    state.cursor = { line: targetLine, column: targetColumn };
    state.selection = null;
    state.savedVerticalCursorIndex = null;
}

function createPayload(length: number): string {
    return "x".repeat(Math.max(0, length));
}

function constructAction(type: ActionType, payloadLength: number): EditorAction {
    switch (type) {
        case "insert":
            return { type: "insert", text: createPayload(payloadLength), paste: false };
        case "enter":
            return { type: "enter" };
        case "backspace":
            return { type: "backspace" };
        case "tab":
            return { type: "tab" };
        case "cut":
            return { type: "cut" };
        case "undo":
            return { type: "undo" };
        case "redo":
            return { type: "redo" };
        case "move":
            return {
                type: "move",
                key: payloadLength % 2 === 0 ? "ArrowLeft" : "ArrowRight", // doesn't test vertical movement
                shift: false,
            };
        default:
            return { type: "insert", text: "", paste: false };
    }
}

function yieldToBrowser(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 0));
}

async function test(): Promise<void> {
    const documentNoLinesScales = [1, 10, 100, 1000];
    const lineLengthScales = [10, 100, 1000, 10000];
    const cursorPosScales = [0.0, 0.3, 0.6, 1.0];
    // for simplicity we don't allow payload to have multiple lines
    // but it would be useful to measure say paste.
    const payloadLengthScales = [10, 100, 1000, 10000];
    const rows: BenchmarkRow[] = [];

    let state = createInitialState();
    let history = createHistory();

    for (const documentLines of documentNoLinesScales) {
        for (const lineLength of lineLengthScales) {
            for (const cursorPercent of cursorPosScales) {
                for (const payloadLength of payloadLengthScales) {
                    const context: BenchmarkScenario = {
                        documentChars: documentLines * lineLength,
                        documentLines,
                        payloadLength,
                    };

                    for (const type of ["insert", "enter", "backspace", "tab", "cut", "undo", "redo", "move"] as ActionType[]) {
                        const action: EditorAction = constructAction(type, payloadLength);
                        prepareState(state, history, documentLines, lineLength, cursorPercent);
                        rows.push(...timeHandler(context, state, history, action));
                        await yieldToBrowser();
                    }
                }
            }
        }
    }

    writeCSV(rows);
}

export const benchmarkRun = test();