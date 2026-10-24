import type { TextEditorState, Cursor, Selection } from './types';

export type EditorMemento = {
    lines: string[];
    cursor: Cursor;
    selection: Selection | null;
    time: number;
};

export function captureMemento(state: TextEditorState): EditorMemento {
    return {
        lines: [...state.lines],
        cursor: { ...state.cursor },
        selection:
            state.selection === null
                ? null
                : {
                      anchor: { ...state.selection.anchor },
                      focus: { ...state.selection.focus },
                  },
        time: Date.now(),
    };
}

export function restoreMemento(state: TextEditorState, memento: EditorMemento): void {
    state.lines = [...memento.lines];
    state.cursor = { ...memento.cursor };
    state.selection =
        memento.selection === null
            ? null
            : {
                  anchor: { ...memento.selection.anchor },
                  focus: { ...memento.selection.focus },
              };
    state.savedVerticalOffset = null;
}
