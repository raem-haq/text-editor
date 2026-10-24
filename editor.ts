import { actionHandler } from './core/actionHandler.js';
import { copySelectionToText, initialiseState } from './core/document.js';
import type { LineSplice, TextEditorState } from './core/types.js';
import type { EditorAction } from './input/keyboard.js';
import { keyToAction } from './input/keyboard.js';
import { initialiseHistory, updateHistory, redo, undo } from './history/history.js';
import type { EditorHistory } from './history/history.js';
import { renderDOMchange } from './view/dom-renderer.js';

const state: TextEditorState = initialiseState();
const history: EditorHistory = initialiseHistory();

const textBox: HTMLDivElement = document.querySelector<HTMLDivElement>('#text-box')!;

const PLACEHOLDER = 'Click to edit here';
const placeholder: HTMLDivElement = document.querySelector<HTMLDivElement>('#placeholder')!;
placeholder.textContent = PLACEHOLDER;

function eventHandler(state: TextEditorState, action: EditorAction): void {
    if (action.type !== 'move') state.savedVerticalOffset = null;
    updateHistory(state, history, action);
    let change: LineSplice | null;
    switch (action.type) {
        case 'undo':
            change = undo(history, state);
            break;
        case 'redo':
            change = redo(history, state);
            break;
        default:
            change = actionHandler(state, action);
    }
    renderDOMchange(state, change, placeholder);
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
    eventHandler(state, {type: 'paste', text: text});
});
