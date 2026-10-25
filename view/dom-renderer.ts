import type { TextEditorState, LineSplice, Selection } from '../core/types.js';

function addCursor(line: HTMLDivElement, cursorPos: number) {
    const textNode =
        line.firstChild instanceof Text ? line.firstChild : document.createTextNode('');
    if (!(line.firstChild instanceof Text)) {
        line.appendChild(textNode);
    }

    // cursorPos is the number of characters before the cursor.
    // splitText returns the text node that begins at the cursor boundary.
    const afterNode = textNode.splitText(cursorPos);

    const cursor = document.createElement('span');
    cursor.className = 'cursor';

    line.insertBefore(cursor, afterNode);
    return cursor;
}

function addSelectionToLine(lineElem: Element, startI: number, endI?: number) {
    const highlighted: HTMLSpanElement = document.createElement('span');
    highlighted.className = 'selection';
    const lineText: string = lineElem.textContent;
    const end: number = endI ?? lineText.length;
    // remember cursor index is after char
    // and slice does not include end index
    const beforeSelection = lineText.slice(0, startI);
    let selectedText: string = lineText.slice(startI, end);
    const afterSelection = lineText.slice(end);
    lineElem!.textContent = beforeSelection;
    if (selectedText === '') {
        selectedText = ' ';
    }
    highlighted.textContent = selectedText;
    lineElem!.appendChild(highlighted);
    lineElem.append(afterSelection);
}

function addSelection(lineElems: HTMLCollection, selection: Selection | null) {
    if (selection === null) return;
    let { anchor: start, focus: end } = selection;

    if (start.line > end.line || (start.line == end.line && start.offset > end.offset)) {
        [start, end] = [end, start];
    }
    if (start.line == end.line) {
        addSelectionToLine(lineElems[start.line]!, start.offset, end.offset);
    } else {
        addSelectionToLine(lineElems[start.line]!, start.offset);
        for (let i = start.line + 1; i < end.line; i++) {
            addSelectionToLine(lineElems[i]!, 0);
        }
        addSelectionToLine(lineElems[end.line]!, 0, end.offset);
    }
}

function performLineSplice(change: LineSplice) {
    const { startLine, removeNo, insertNo } = change;
    const textBox = document.getElementById('text-box')!;
    const linesDOM: HTMLCollection = textBox.children;
    const startDiv = linesDOM.item(startLine);
    if (startDiv === null) throw new Error('LineSplice startLine is out of range');
    let currLine: Element = startDiv;

    for (let i = 0; i < removeNo; i++) {
        const nextLine: Element | null = currLine.nextElementSibling;
        if (nextLine === null) throw new Error('LineSplice incorrect');
        nextLine.remove();
    }

    for (let i = 0; i < insertNo; i++) {
        const newLine = document.createElement('div');
        textBox.insertBefore(newLine, currLine.nextElementSibling);
        currLine = newLine;
    }
}

function replaceDOMLines(state: TextEditorState, change: LineSplice) {
    const { startLine, endLine } = change;
    const linesDOM: HTMLCollection = document.getElementById('text-box')!.children;
    for (let i = startLine; i <= endLine; i++) {
        linesDOM.item(i)!.textContent = state.lines[i]!;
    }
    addCursor(linesDOM[state.cursor.line]! as HTMLDivElement, state.cursor.offset);
    addSelection(linesDOM, state.selection);
}

export function renderDOMchange(state: TextEditorState, change: LineSplice | null, placeholder: HTMLDivElement): void {
    placeholder.hidden = !(state.lines.length === 1 && state.lines[0] === '');
    if (change === null) return;
    performLineSplice(change);
    replaceDOMLines(state, change);
}
