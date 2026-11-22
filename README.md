# Text editor

## Description

This project is a browser-based text editor written in TypeScript. It separates editing behaviour, document storage, undo and redo history, keyboard input, and DOM rendering so that the data structures used for the document can be replaced independently.

The application currently stores text with `ArrayLinesBackend`, which represents the document as an array of lines. The `Editor` translates keyboard actions into document changes, `EditorHistory` records mementos for undo and redo, and `DOMRenderer` updates the visible text incrementally. Mouse selection and clipboard operations are connected in `main.ts`.

## Source map

- `main.ts` is the browser entry point: it connects keyboard and clipboard events to the editor.
- `editor/editor.ts` is the single source of editing behavior. It works through the `TextBackend` contract.
- `history/history.ts` owns undo and redo for editor mementos.
- `backends/types.ts` defines the backend contract and backend snapshot shapes.
- `backends/arrayLines.ts`, `backends/gapBuffer.ts`, and `backends/pieceTable.ts` are interchangeable storage implementations. The app currently uses `ArrayLinesBackend` and hasn't tested the others.
- `model/types.ts` contains the shared cursor and selection shapes; `editor/types.ts` contains editor changes and snapshots.
- `view/domRenderer.ts` renders the editor model in the DOM with incremental changes.

The browser entry point chooses the backend. The editing rules belong in `editor/editor.ts`; backend implementations should only provide text storage and position operations.

## To Do

- Test the gap-buffer and piece-table implementations against the shared backend contract.
- Test edge cases at every backend level: empty documents, newline boundaries, selections, large paste payloads, cursor clamping, and undo/redo mementos.
- Add the gap-buffer and piece-table implementations to the editor's browser entry point through the existing abstraction.
- Extend the performance benchmark to these backends and compare insertion, deletion, cursor movement, range lookup, and DOM updates.
- Interpret benchmark results across document size, line count, cursor position, selection size, and paste length.

## Conclusions

The main structural conclusion is that the backend abstraction has successfully separated storage from editing behavior: the editor and history operate through `TextBackend` and `EditorMemento`, rather than depending directly on a particular storage format. Incremental `DocumentChange` data also gives the renderer a narrower update boundary than redrawing the whole document.

The array-of-lines backend is the implementation currently integrated into the browser application. Gap-buffer and piece-table backends are present and conform to the interface as defined, but they have not yet been verified as a working, equivalent alternative. The piece table is also intentionally tree-backed, with piece and newline counts stored in treap nodes to support offset and line operations.

The performance work has begun through `performance_analysis/performance.ts` and baseline CSV data, but it does not yet provide a fair cross-backend conclusion. A final comparison should wait until the gap buffer and piece table are fully tested and the benchmark is run consistently for all implementations.