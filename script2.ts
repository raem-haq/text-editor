export {}



/*
export function renderDOM(state: TextEditorState): void {
    placeholder.hidden = !(state.lines.length === 1 && state.lines[0] === "");
    textBox.replaceChildren();
    let lineElements : HTMLDivElement[] = [];
    for (const line of state.lines){
        const div = document.createElement("div");
        div.textContent = line;
        textBox.appendChild(div);
        lineElements.push(div)
    }
    addCursor(lineElements[state.cursor.line]!, state.cursor.column);
    addSelection(lineElements, state.selection);
}
*/




function eventHandler(state: TextEditorState, history: EditorHistory, action : EditorAction): void {
    const {type} = action;

    if (type !== "move") state.savedVerticalCursorIndex = null;

    let change: LineSplice | null;
    switch (type){
        case "move":
            change = handleMovement(state, action.key, action.shift);
            break;
        case "undo":
            change= undo(history, state);
            break;
        case "redo":
            change= redo(history, state);
            break;
        case "cut":
            pushToUndo(state, history, type);
            change= removeSelectedText(state);
            break;
        case "insert":
            const {text, paste} = action;
            pushToUndo(state, history, type);
            change= insertText(state, text);
            break;
        case "backspace":
            pushToUndo(state, history, type);
            change= handleBackspace(state);
            break;
        case "enter":
            pushToUndo(state, history, type);
            change= handleEnter(state);
            break;
        case "tab":
            pushToUndo(state, history, type);
            change= handleTab(state);
            break;
    }
    renderDOMchange(state, change);
}



function copyHandler(e: ClipboardEvent, state: TextEditorState){ 
    // doesn't modify editor variables or undo logic
    if (!e.clipboardData) return;
    e.preventDefault();
    const text = copySelection(state);
    e.clipboardData.setData("text/plain", text);
}




type BlockCategory = "insert" | "backspace" | "enter" | "tab";

textBox.addEventListener("copy", (event) => copyHandler(event, state));

textBox.addEventListener("keydown", (event) => {
    const action: EditorAction | null = keyToAction(event);
    if (action === null) return;
    event.preventDefault();
    eventHandler(state, history, action);
});


textBox.addEventListener("cut", (event) => {
    copyHandler(event, state);
    if (state.selection === null) return;
    eventHandler(state, history, {type: "cut"});
});


textBox.addEventListener("paste", (event) => {
    if (!event.clipboardData) return;
    event.preventDefault();
    const text = event.clipboardData.getData("text/plain");

    const e: EditorAction = {
        type: "insert",
        text: text,
        paste: true,
    }
    eventHandler(state, history, e);
});
