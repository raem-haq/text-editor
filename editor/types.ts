import type { BackendMemento } from '../backends/types.js';
import type { Selection } from '../model/types.js';

export type DocumentChange = {
    /** Retained line where a structural splice begins. */
    startLine: number;
    /** Existing lines removed after startLine. */
    removeLineCount: number;
    /** New lines inserted after startLine. */
    insertLineCount: number;
    /** Last post-change line whose text or decoration needs repainting. */
    endLine: number;
};

export type HistoryCategory =
    | 'backspace'
    | 'cut'
    | 'enter'
    | 'insert'
    | 'space'
    | 'tab'
    | null;

export type EditorMemento = {
    readonly backend: BackendMemento;
    readonly selection: Selection | null;
    readonly time: number;
    readonly category: HistoryCategory;
};
