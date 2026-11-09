import { blankLine, indentationOf } from "./utilities";

export function docstringIsClosed(
    document: string,
    linePosition: number,
    charPosition: number,
    quoteStyle: string,
): boolean {
    const lines = document.split("\n");

    if (quotesCloseExistingDocstring(lines, linePosition, charPosition, quoteStyle)) {
        return true;
    }

    if (quotesOpenExistingDocstring(lines, linePosition, charPosition, quoteStyle)) {
        return true;
    }

    return false;
}

function quotesCloseExistingDocstring(
    lines: string[],
    linePosition: number,
    charPosition: number,
    quoteStyle: string,
): boolean {
    const linesBeforePosition = sliceUpToPosition(lines, linePosition, charPosition);
    let numberOfTripleQuotes = 0;

    for (const line of linesBeforePosition.reverse()) {
        if (isComment(line)) {
            continue;
        }
        if (line.includes("def ") || line.includes("class ")) {
            break;
        }

        numberOfTripleQuotes += occurrences(line, quoteStyle);
    }

    return numberOfTripleQuotes % 2 === 0;
}

function quotesOpenExistingDocstring(
    lines: string[],
    linePosition: number,
    charPosition: number,
    quoteStyle: string,
): boolean {
    const linesAfterPosition = sliceFromPosition(lines, linePosition, charPosition);
    const originalIndentation = indentationOf(lines[linePosition]);

    // Need to check first line separately because indentation was sliced off
    if (linesAfterPosition[0].includes(quoteStyle)) {
        return true;
    }

    for (const line of linesAfterPosition.slice(1)) {
        if (isComment(line)) {
            continue;
        }
        // A line left of the docstring is outside the function, so its quotes are not ours.
        if (!blankLine(line) && indentationOf(line) < originalIndentation) {
            return false;
        }
        const quotes = occurrences(line, quoteStyle);
        // An even count is a string that opens and closes on its own line, and quotes after
        // `=`, `(`, `,` or `return` open a new string; neither can close the docstring.
        if (quotes % 2 === 1) {
            return !opensString(line, quoteStyle);
        }

        if (line.includes("def ") || line.includes("class ")) {
            return false;
        }
    }

    return false;
}

function isComment(line: string): boolean {
    return line.trim().startsWith("#");
}

/**
 * True when the first quotes on the line follow code that starts a string value: an
 * assignment, a bare return or yield, or an argument inside a bracket still open on the line.
 * Prose closing a docstring ("the value to return""") matches none of these from the line start.
 */
function opensString(line: string, quoteStyle: string): boolean {
    const before = line
        .slice(0, line.indexOf(quoteStyle))
        .replace(/[rRbBfFuU]{1,2}$/, "")
        .trim();
    if (/^(?:return|yield)$/.test(before)) {
        return true;
    }
    if (/^[A-Za-z_][\w.]*(?:\[[^\]]*\])?\s*(?::[^=]+)?[-+*/|&]?=$/.test(before)) {
        return true;
    }
    const opened = (before.match(/[([{]/g) ?? []).length;
    const closed = (before.match(/[)\]}]/g) ?? []).length;
    return /[([{,]$/.test(before) && opened > closed;
}

function sliceUpToPosition(lines: string[], linePosition: number, charPosition: number): string[] {
    const slicedDocument = lines.slice(0, linePosition);
    slicedDocument.push(lines[linePosition].slice(0, charPosition));

    return slicedDocument;
}

function sliceFromPosition(lines: string[], linePosition: number, charPosition: number): string[] {
    let slicedDocument = [lines[linePosition].slice(charPosition)];
    slicedDocument = slicedDocument.concat(lines.slice(linePosition + 1));

    return slicedDocument;
}

function occurrences(str: string, word: string): number {
    return str.split(word).length - 1;
}
