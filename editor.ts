import { actionHandler } from './core/actionHandler';
import { copySelectionToText, initialiseState } from './core/document';
import type { LineSplice, TextEditorState } from './core/types';
import type { EditorAction } from './input/keyboard';
import { keyToAction } from './input/keyboard';
import { initialiseHistory, updateHistory, redo, undo } from './history/history';
import type { EditorHistory } from './history/history';
import { renderDOMchange } from './view/dom-renderer';

const state: TextEditorState = initialiseState();
const history: EditorHistory = initialiseHistory();

const textBox: HTMLDivElement = document.querySelector<HTMLDivElement>('#text-box')!;

function eventHandler(state: TextEditorState, action: EditorAction): void {
    if (action.type !== 'move') state.savedVerticalOffset = null;
    let change: LineSplice | null;
    switch (action.type) {
        case 'undo':
            change = undo(history, state);
            break;
        case 'redo':
            change = redo(history, state);
            break;
        default:
            updateHistory(state, history, action.type);
            change = actionHandler(state, action);
    }
    renderDOMchange(state, change);
}

function copyHandler(e: ClipboardEvent, state: TextEditorState) {
    // doesn't modify editor variables or undo logic
    if (!e.clipboardData) return;
    e.preventDefault();
    const text = copySelectionToText(state);
    e.clipboardData.setData('text/plain', text);
}

textBox.addEventListener('copy', (event) => copyHandler(event, state));

textBox.addEventListener('keydown', (event) => {
    const action: EditorAction | null = keyToAction(event);
    if (action === null) return;
    event.preventDefault();
    eventHandler(state, action);
});

textBox.addEventListener('cut', (event) => {
    copyHandler(event, state);
    if (state.selection === null) return;
    eventHandler(state, { type: 'cut' });
});

textBox.addEventListener('paste', (event) => {
    if (!event.clipboardData) return;
    event.preventDefault();
    const text = event.clipboardData.getData('text/plain');
    eventHandler(state, { type: 'paste', text: text });
});
