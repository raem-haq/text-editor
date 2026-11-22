import { ArrayLinesBackend } from './backends/arrayLines.js';
import { PieceTableBackend } from './backends/pieceTable.js';
import { GapBufferBackend } from './backends/gapBuffer.js';
import { Editor } from './editor/editor.js';
import { EditorHistory } from './history/history.js';
import { keyToAction } from './input/keyboard.js';
import type { EditorAction } from './input/keyboard.js';
import { DOMRenderer } from './view/domRenderer.js';

const editor = new Editor(new ArrayLinesBackend());
const history = new EditorHistory();

const textBox = document.querySelector<HTMLDivElement>('#text-box')!;
const placeholder = document.querySelector<HTMLDivElement>('#placeholder')!;
placeholder.textContent = 'Type to edit here';

const renderer = new DOMRenderer(textBox, placeholder);
renderer.render(editor);

function dispatch(action: EditorAction): void {
    if (action.type === 'undo') {
        if (history.undo(editor)) renderer.render(editor);
        return;
    }
    if (action.type === 'redo') {
        if (history.redo(editor)) renderer.render(editor);
        return;
    }

    history.record(editor, action);
    renderer.render(editor, editor.apply(action));
}

function copyHandler(event: ClipboardEvent): void {
    if (!event.clipboardData) return;
    event.preventDefault();
    event.clipboardData.setData('text/plain', editor.copyText());
}

textBox.addEventListener('copy', copyHandler);

textBox.addEventListener('keydown', (event) => {
    const action = keyToAction(event);
    if (action === null) return;
    event.preventDefault();
    dispatch(action);
});

textBox.addEventListener('cut', (event) => {
    copyHandler(event);
    if (editor.getSelection() !== null) dispatch({ type: 'cut' });
});

textBox.addEventListener('paste', (event) => {
    if (!event.clipboardData) return;
    event.preventDefault();
    dispatch({
        type: 'paste',
        text: event.clipboardData.getData('text/plain'),
    });
});

textBox.addEventListener('mousedown', (event) => {
    const position = renderer.positionFromMouse(event);
    if (position === null) return;
    event.preventDefault();
    textBox.focus();
    renderer.render(editor, editor.setCursor(position));
});
