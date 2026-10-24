import type { TextEditorState, LineSplice } from '../core/types';
import type { EditorAction } from '../input/keyboard';
import {
    handleMovement,
    handleBackspace,
    removeSelectionAndGetLineSplice,
    handleTab,
    handleText,
} from './document';

export function actionHandler(state: TextEditorState, action: EditorAction): LineSplice | null {
    switch (action.type) {
        case 'move':
            return handleMovement(state, action.key, action.shift);
        case 'undo':
        case 'redo':
            return null;
        case 'cut':
            return removeSelectionAndGetLineSplice(state);
        case 'backspace':
            return handleBackspace(state);
        case 'insert':
        case 'paste':
            return handleText(state, action.text);
        case 'enter':
            return handleText(state, '\n');
        case 'tab':
            return handleTab(state);
    }
}
