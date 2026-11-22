import type { Editor } from '../editor/editor.js';
import type { DocumentChange } from '../editor/types.js';
import type { Position, Selection } from '../model/types.js';

export class DOMRenderer {
    private decoratedLines = new Set<number>();
    private readonly canvas = document.createElement('canvas');
    private lastEditor: Editor | null = null;

    constructor(
        private readonly textBox: HTMLDivElement,
        private readonly placeholder: HTMLDivElement,
    ) {}

    render(editor: Editor, change?: DocumentChange): void {
        this.lastEditor = editor;
        this.textBox.classList.toggle('is-empty', editor.backend.length === 0); // currently doesn't do anything
        this.placeholder.hidden = editor.backend.length !== 0;

        const linesToRender = new Set<number>();
        if (change === undefined) {
            this.textBox.replaceChildren();
            for (let line = 0; line < editor.backend.lineCount; line++) {
                this.textBox.append(this.createLine());
                linesToRender.add(line);
            }
        } else {
            this.spliceLines(change);
            const lineDelta = change.insertLineCount - change.removeLineCount;
            for (const line of this.decoratedLines) {
                if (line <= change.startLine) {
                    linesToRender.add(line);
                } else if (line > change.startLine + change.removeLineCount) {
                    linesToRender.add(line + lineDelta);
                } // else the line was removed, so don't render it
            }
            for (let line = change.startLine; line <= change.endLine; line++) {
                linesToRender.add(line);
            }
        }

        const cursor = editor.cursor;
        const selection = editor.getSelection();
        const nextDecoratedLines = this.getDecoratedLines(cursor, selection);
        for (const line of nextDecoratedLines) linesToRender.add(line);

        for (const line of linesToRender) {
            if (line < 0 || line >= editor.backend.lineCount) continue;
            this.renderLine(editor, line, cursor, selection);
        }

        this.decoratedLines = nextDecoratedLines;
    }

    positionFromMouse(event: MouseEvent): Position | null {
        if (!(event.target instanceof Element)) return null;

        let lineElement: Element | null = event.target;
        while (lineElement !== null && lineElement.parentElement !== this.textBox) {
            lineElement = lineElement.parentElement;
        }
        if (!(lineElement instanceof HTMLDivElement)) return null;

        let line = 0;
        while (
            line < this.textBox.children.length &&
            this.textBox.children.item(line) !== lineElement 
        ) {
            line++;
        }
        if (line === this.textBox.children.length) return null;

        const editor = this.lastEditor; // we want to use the editor that was last rendered, not the current one, because the mouse event may have been triggered before the current render.
        if (editor === null)
            throw new Error('Cannot map mouse positions before the initial render.');
        
        // older browsers may not support caretPositionFromPoint, so we fall back to estimating the column based on the mouse position and the width of the text.
        const documentPosition = document.caretPositionFromPoint?.(event.clientX, event.clientY);
        if (documentPosition && lineElement.contains(documentPosition.offsetNode)) {
            return {
                line,
                column: this.offsetWithinLine(
                    lineElement,
                    documentPosition.offsetNode,
                    documentPosition.offset,
                ),
            };
        }

        return { line, column: this.estimateColumn(lineElement, line, event.clientX, editor) };
    }

    private createLine(): HTMLDivElement {
        return document.createElement('div');
    }

    private spliceLines(change: DocumentChange): void {
        const { startLine, removeLineCount, insertLineCount } = change;
        const lineCount = this.textBox.children.length;
        const retainedLine = this.textBox.children.item(startLine);
        if (!retainedLine)
            throw new RangeError('Line change starts outside the rendered document.');
        if (
            startLine < 0 ||
            removeLineCount < 0 ||
            insertLineCount < 0 ||
            (removeLineCount > 0 && startLine + removeLineCount >= lineCount)
        ) {
            throw new RangeError('Line change contains invalid splice counts.');
        }

        for (let i = 0; i < removeLineCount; i++) {
            const nextLine = retainedLine.nextElementSibling;
            if (!nextLine)
                throw new RangeError('Line change removes beyond the rendered document.');
            nextLine.remove();
        }

        let lastInserted = retainedLine;
        for (let i = 0; i < insertLineCount; i++) {
            const line = this.createLine();
            this.textBox.insertBefore(line, lastInserted.nextElementSibling);
            lastInserted = line;
        }
    }

    private getDecoratedLines(cursor: Position, selection: Selection | null): Set<number> {
        const lines = new Set<number>([cursor.line]);
        if (selection !== null) {
            const { start, end } = this.normalizedSelection(selection);
            for (let line = start.line; line <= end.line; line++) lines.add(line);
        }
        return lines;
    }

    private renderLine(
        editor: Editor,
        line: number,
        cursor: Position,
        selection: Selection | null,
    ): void {
        const element = this.textBox.children.item(line);
        if (!(element instanceof HTMLDivElement)) return;

        const text = editor.backend.getLine(line);
        let selectedStart: number | null = null;
        let selectedEnd: number | null = null;

        if (selection !== null) {
            const normalized = this.normalizedSelection(selection);
            if (line >= normalized.start.line && line <= normalized.end.line) {
                selectedStart = line === normalized.start.line ? normalized.start.column : 0;
                selectedEnd = line === normalized.end.line ? normalized.end.column : text.length;
            }
        }

        const cursorColumn =
            cursor.line === line ? Math.max(0, Math.min(cursor.column, text.length)) : null;
        element.replaceChildren();

        const appendText = (start: number, end: number, selected = false): void => {
            const contents = text.slice(start, end);
            if (contents.length === 0) return;
            if (selected) {
                const selectionElement = document.createElement('span');
                selectionElement.className = 'selection';
                selectionElement.textContent = contents;
                element.append(selectionElement);
            } else {
                element.append(document.createTextNode(contents));
            }
        };
        const appendCursor = (): void => {
            const cursorElement = document.createElement('span');
            cursorElement.className = 'cursor';
            element.append(cursorElement);
        };

        if (selectedStart === null || selectedEnd === null) {
            if (cursorColumn === null) {
                appendText(0, text.length);
            } else {
                appendText(0, cursorColumn);
                appendCursor();
                appendText(cursorColumn, text.length);
            }
        } else {
            appendText(0, selectedStart);
            // The editor keeps its cursor at the selection focus, which is one of its edges.
            const cursorAtStart = cursorColumn === selectedStart;
            const cursorAtEnd = !cursorAtStart && cursorColumn === selectedEnd; // added !cursorAtStart to avoid double cursor when selection is empty
            if (cursorAtStart) appendCursor();
            appendText(selectedStart, selectedEnd, true);
            if (selectedStart === selectedEnd) {
                const selectionElement = document.createElement('span');
                selectionElement.className = 'selection';
                selectionElement.dataset.emptySelection = 'true';
                selectionElement.textContent = ' ';
                element.append(selectionElement);
            }
            if (cursorAtEnd) appendCursor();
            appendText(selectedEnd, text.length);
        }
    }
    
    offsetWithinLine(line: HTMLDivElement, target: Node, targetOffset: number): number {
        const countBefore = (node: Node): number => {
            if (node === target) {
                if (node.nodeType === Node.TEXT_NODE) {
                    if (node.parentElement?.dataset.emptySelection === 'true') return 0;
                    return Math.max(0, Math.min(targetOffset, node.textContent?.length ?? 0));
                }
                let offset = 0;
                for (let i = 0; i < targetOffset; i++) {
                    const child = node.childNodes.item(i);
                    if (child) offset += this.logicalTextLength(child);
                }
                return offset;
            }

            let offset = 0;
            for (const child of node.childNodes) {
                if (child === target || child.contains(target)) {
                    return offset + countBefore(child);
                }
                offset += this.logicalTextLength(child);
            }
            return offset;
        };

        return Math.max(0, Math.min(countBefore(line), line.textContent?.length ?? 0));
    }

    private logicalTextLength(node: Node): number {
        if (node instanceof HTMLElement && node.dataset.emptySelection === 'true') return 0;
        if (node.nodeType === Node.TEXT_NODE) return node.textContent?.length ?? 0;
        let length = 0;
        for (const child of node.childNodes) length += this.logicalTextLength(child);
        return length;
    }

    private estimateColumn(
        lineElement: HTMLElement,
        line: number,
        clientX: number,
        editor: Editor,
    ): number {
        const text = editor.backend.getLine(line);
        const context = this.canvas.getContext('2d');
        if (!context) return 0;
        const style = getComputedStyle(lineElement);
        context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;

        const target = clientX - lineElement.getBoundingClientRect().left;
        let low = 0;
        let high = text.length;
        while (low < high) {
            const mid = Math.ceil((low + high) / 2);
            if (context.measureText(text.slice(0, mid)).width <= target) low = mid;
            else high = mid - 1;
        }
        return low;
    }

    private normalizedSelection(selection: Selection): { start: Position; end: Position } {
        const { anchor, focus } = selection;
        const comparison =
            anchor.line === focus.line ? anchor.column - focus.column : anchor.line - focus.line;
        return comparison <= 0 ? { start: anchor, end: focus } : { start: focus, end: anchor };
    }
}
