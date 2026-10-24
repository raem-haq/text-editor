
const textBox : HTMLDivElement= document.querySelector<HTMLDivElement>("#text-box")!;

const PLACEHOLDER = "Click to edit here";
const placeholder: HTMLDivElement= document.querySelector<HTMLDivElement>("#placeholder")!;
placeholder.textContent = PLACEHOLDER;

function addCursor(line : HTMLDivElement, cursorPos : number) {
    const textNode =
        line.firstChild instanceof Text
            ? line.firstChild
            : document.createTextNode("");
    if (!(line.firstChild instanceof Text)) {
        line.appendChild(textNode);
    }

    // cursorPos is the number of characters before the cursor.
    // splitText returns the text node that begins at the cursor boundary.
    const afterNode = textNode.splitText(cursorPos);

    const cursor = document.createElement("span");
    cursor.className = "cursor";

    line.insertBefore(cursor, afterNode);
    return cursor;
}

function addSelectionToLine(lineElem : Element, startI: number, endI? :number) {
    const highlighted : HTMLSpanElement = document.createElement("span");
    highlighted.className = "selection";
    const lineText : string = lineElem.textContent;
    const end : number = endI ?? lineText.length;
    // remember cursor index is after char
    // and slice does not include end index
    const beforeSelection = lineText.slice(0, startI);
    let selectedText : string = lineText.slice(startI, end);
    const afterSelection = lineText.slice(end);
    lineElem!.textContent = beforeSelection;
    if (selectedText === ""){
        selectedText = " ";
    }
    highlighted.textContent = selectedText;
    lineElem!.appendChild(highlighted);
    lineElem.append(afterSelection);
}


function addSelection(lineElems : HTMLCollection, selection : Selection){
    if (selection === null) return;
    let {anchor: start, active: end} = selection;

    if (start.line > end.line || (start.line == end.line && start.column > end.column)){
        [start, end] = [end, start];
    }
    if (start.line == end.line){
        addSelectionToLine(lineElems[start.line]!, start.column, end.column);
    } else {
        addSelectionToLine(lineElems[start.line]!, start.column);
        for (let i = start.line + 1; i < end.line; i++){
            addSelectionToLine(lineElems[i]!,0);
        }
        addSelectionToLine(lineElems[end.line]!, 0, end.column);
    }
}



function manageTabsSelection(state: TextEditorState): LineSplice | null{
    if (state.selection === null) return null;
    let {anchor: start, active: end} = state.selection;

    if (start.line > end.line || (start.line == end.line && start.column > end.column)){
        [start, end] = [end, start];
    }
    const changes: LineSplice = {startLine: start.line, insertNo: 0, removeNo: end.line - start.line, endLine: end.line}

    if (start.line == end.line){
        const line = state.lines[start.line]!;
        const noOfSpaces = 4 - start.column % 4;
        state.lines[start.line] = line.slice(0, start.column).concat(" ".repeat(noOfSpaces)).concat(line.slice(end.column));
        state.selection = null;
        state.cursor.column = start.column + noOfSpaces;
    } else {
        for (let i = start.line; i <= end.line; i++){
            state.lines[i] = " ".repeat(4).concat(state.lines[i]!);
        }
        state.selection.anchor.column += 4;
        state.selection.active.column += 4;
        state.cursor.column += 4;
    }
    return changes;
}
function performLineSplice(change: LineSplice){
    const {startLine, removeNo, insertNo} = change;
    const linesDOM: HTMLCollection= document.getElementById("text-box")!.children;
    const startDiv: Element = linesDOM.item(startLine-1)!;
    let currLine = startDiv;
    for (let i = 0; i < removeNo; i++){
        const nextLine: Element | null = currLine.nextElementSibling;
        if (nextLine === null) throw new Error("LineSplice incorrect");
        currLine.remove();
        currLine = nextLine;
    }
    currLine = startDiv;
    for (let i = 0; i < insertNo; i++){
        const newLine = document.createAttribute("div");
        currLine = currLine.nextElementSibling!;
        document.insertBefore(newLine, currLine);
    }
}


function replaceDOMLines(state: TextEditorState, change: LineSplice){
    const {startLine, endLine} = change;
    const linesDOM: HTMLCollection= document.getElementById("text-box")!.children;
    for (let i = startLine; i <= endLine; i++){
        linesDOM.item(i)!.textContent = state.lines[i]!;
    }
    addCursor(linesDOM[state.cursor.line]! as HTMLDivElement, state.cursor.column);
    addSelection(linesDOM, state.selection);
}

function renderDOMchange(state: TextEditorState, change: LineSplice|null){
    placeholder.hidden = !(state.lines.length === 1 && state.lines[0] === "");
    if (change === null) return;
    performLineSplice(change);
    replaceDOMLines(state, change);
}

