export type ArrowKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';

export type EditorAction =
    | { type: 'move'; key: ArrowKey; shift: boolean }
    | { type: 'insert'; text: string }
    | { type: 'paste'; text: string }
    | { type: 'enter' }
    | { type: 'backspace' }
    | { type: 'tab' }
    | { type: 'cut' }
    | { type: 'undo' }
    | { type: 'redo' };

export type ActionType = EditorAction['type'];

export function keyToAction(event: KeyboardEvent): EditorAction | null {
    const key = event.key;
    const k = key.toLowerCase();
    const isMac = navigator.platform.toUpperCase().includes('MAC');

    const isUndo = isMac
        ? event.metaKey && k === 'z' && !event.shiftKey
        : event.ctrlKey && k === 'z' && !event.shiftKey;
    if (isUndo) return { type: 'undo' };

    const isRedo = isMac
        ? event.metaKey && k === 'z' && event.shiftKey
        : event.ctrlKey && (k === 'y' || (k === 'z' && event.shiftKey));
    if (isRedo) return { type: 'redo' };

    if (event.ctrlKey || event.metaKey || event.altKey) return null;

    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
        return { type: 'move', key: key as ArrowKey, shift: event.shiftKey };
    }
    switch (key) {
        case 'Enter':
            return { type: 'enter' };
        case 'Backspace':
            return { type: 'backspace' };
        case 'Tab':
            return { type: 'tab' };
        default:
            return key.length === 1 ? { type: 'insert', text: key } : null;
    }
}
