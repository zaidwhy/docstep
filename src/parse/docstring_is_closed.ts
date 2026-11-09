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
        if (line.includes("def ") || line.includes("class ")) {
            break;
        }

        numberOfTripleQuotes += quoteTokens(line, quoteStyle);
    }

    return numberOfTripleQuotes % 2 === 0;
}

/**
 * Whether the typed quotes reopen a docstring that is already closed further down. Every
 * string in the body adds an even number of quote tokens, so an odd count left before the
 * function ends means one of them is the closing quote of that docstring. Deciding by parity
 * rather than line by line is what tells `text = """hello"""` (a string) apart from prose
 * like `value = """` that ends an existing docstring.
 */
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

    let quotes = 0;
    for (const line of linesAfterPosition.slice(1)) {
        // A line left of the docstring is outside the function, so its quotes are not ours.
        if (!blankLine(line) && indentationOf(line) < originalIndentation) {
            break;
        }
        quotes += quoteTokens(line, quoteStyle);
    }

    return quotes % 2 === 1;
}

/**
 * Quote tokens on the line, leaving out a comment. A `#` starts a comment only when it stands
 * alone (`x = 1  # note`), so docstring prose like `see issue #3"""` keeps its closing quotes.
 */
function quoteTokens(line: string, quoteStyle: string): number {
    const comment = line.search(/(?:^|\s)#(?:\s|$)/);
    return occurrences(comment === -1 ? line : line.slice(0, comment), quoteStyle);
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
