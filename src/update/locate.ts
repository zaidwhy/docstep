import { indentationOf, isBlank } from "./lines";
import { UpdateRefusal } from "./types";

export interface FunctionLocation {
    defLine: number;
    /** Line holding the colon that ends the def header. */
    headerEndLine: number;
    name: string;
}

export interface DocstringLocation {
    startLine: number;
    startCharacter: number;
    endLine: number;
    /** Character after the closing quotes. */
    endCharacter: number;
    prefix: string;
    quote: string;
    /** Indentation of the line holding the opening quotes. */
    indentation: string;
    /** Text between the quotes, split into lines. The closing line is left out when it holds only whitespace. */
    lines: string[];
    /** Whitespace before the closing quotes when they sit on their own line, else undefined. */
    closingIndentation?: string;
}

const defPattern = /^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)/;

/** Finds the innermost function whose def header or body contains `cursorLine`. */
export function locateFunction(lines: string[], cursorLine: number): FunctionLocation {
    // A cursor on a decorator means the function it decorates, never the one around it.
    cursorLine = decoratedDefLine(lines, Math.min(cursorLine, lines.length - 1)) ?? cursorLine;
    for (let line = Math.min(cursorLine, lines.length - 1); line >= 0; line--) {
        const match = lines[line].match(defPattern);
        if (match == null) {
            continue;
        }
        const header = findHeaderEnd(lines, line);
        if (header === undefined) {
            throw new UpdateRefusal(`Could not find the end of the def header of "${match[1]}".`);
        }
        const headerEndLine = header.line;
        if (header.bodyOnSameLine) {
            if (cursorLine <= headerEndLine) {
                throw new UpdateRefusal(
                    "The function body is on the same line as the def. Move it to its own line first.",
                );
            }
            continue;
        }
        if (cursorLine <= bodyEnd(lines, line, headerEndLine)) {
            return { defLine: line, headerEndLine, name: match[1] };
        }
    }

    throw new UpdateRefusal(
        "Put the cursor on a def line or inside a function body, then run Update Docstring.",
    );
}

const decoratorPattern = /^\s*@/;

/**
 * When `cursorLine` sits inside a decorator, returns the def line that decorator applies to.
 * Returns undefined when the cursor is not in a decorator; refuses when a decorator decorates no def.
 */
function decoratedDefLine(lines: string[], cursorLine: number): number | undefined {
    let decoratorStart: number | undefined;
    for (let line = cursorLine; line >= 0; line--) {
        if (decoratorPattern.test(lines[line])) {
            if (statementEnd(lines, line) >= cursorLine) {
                decoratorStart = line;
            }
            break;
        }
        if (line !== cursorLine && !isBlank(lines[line]) && indentationOf(lines[line]).length <= indentationOf(lines[cursorLine]).length) {
            break;
        }
    }
    if (decoratorStart === undefined) {
        return undefined;
    }

    const indentation = indentationOf(lines[decoratorStart]).length;
    for (let line = statementEnd(lines, decoratorStart) + 1; line < lines.length; line++) {
        const text = lines[line];
        if (isBlank(text) || text.trim().startsWith("#")) {
            continue;
        }
        if (decoratorPattern.test(text) && indentationOf(text).length === indentation) {
            line = statementEnd(lines, line);
            continue;
        }
        if (defPattern.test(text) && indentationOf(text).length === indentation) {
            return line;
        }
        break;
    }
    throw new UpdateRefusal("The decorator under the cursor does not decorate a function.");
}

/** Last line of the statement starting at `start`, following open brackets across lines. */
function statementEnd(lines: string[], start: number): number {
    let depth = 0;
    let quote: string | undefined;
    for (let lineNumber = start; lineNumber < lines.length; lineNumber++) {
        const line = lines[lineNumber];
        let continued = false;
        for (let index = 0; index < line.length; index++) {
            const char = line[index];
            if (quote !== undefined) {
                if (char === "\\") {
                    index++;
                } else if (line.startsWith(quote, index)) {
                    index += quote.length - 1;
                    quote = undefined;
                }
                continue;
            }
            if (char === "#") {
                break;
            }
            if (char === "\\") {
                continued = index === line.trimEnd().length - 1;
            } else if (char === '"' || char === "'") {
                quote = line.startsWith(char.repeat(3), index) ? char.repeat(3) : char;
                index += quote.length - 1;
            } else if ("([{".includes(char)) {
                depth++;
            } else if (")]}".includes(char)) {
                depth--;
            }
        }
        if (quote !== undefined && quote.length === 1) {
            quote = undefined;
        }
        if (depth <= 0 && quote === undefined && !continued) {
            return lineNumber;
        }
    }
    return lines.length - 1;
}

/** Line of the colon that closes the def header, skipping brackets, strings and comments. */
function findHeaderEnd(lines: string[], defLine: number): { line: number; bodyOnSameLine: boolean } | undefined {
    let depth = 0;
    let quote: string | undefined;

    for (let lineNumber = defLine; lineNumber < lines.length; lineNumber++) {
        const line = lines[lineNumber];
        for (let index = 0; index < line.length; index++) {
            const char = line[index];
            if (quote !== undefined) {
                if (char === "\\") {
                    index++;
                } else if (line.startsWith(quote, index)) {
                    index += quote.length - 1;
                    quote = undefined;
                }
                continue;
            }
            if (char === "#") {
                break;
            }
            if (char === '"' || char === "'") {
                quote = line.startsWith(char.repeat(3), index) ? char.repeat(3) : char;
                index += quote.length - 1;
            } else if ("([{".includes(char)) {
                depth++;
            } else if (")]}".includes(char)) {
                depth--;
            } else if (char === ":" && depth === 0) {
                const rest = line.slice(index + 1).trim();
                return { line: lineNumber, bodyOnSameLine: rest !== "" && !rest.startsWith("#") };
            }
        }
        if (quote !== undefined && quote.length === 1) {
            quote = undefined;
        }
    }

    return undefined;
}

/**
 * Last line of the function: the end of the last statement that starts deeper than the def.
 * Walks whole statements, so string, bracket and backslash continuations and comments
 * may sit at any indentation without ending the function.
 */
function bodyEnd(lines: string[], defLine: number, headerEndLine: number): number {
    const defIndentation = indentationOf(lines[defLine]).length;
    let end = headerEndLine;
    for (let line = headerEndLine + 1; line < lines.length; line++) {
        if (isBlank(lines[line]) || lines[line].trim().startsWith("#")) {
            continue;
        }
        if (indentationOf(lines[line]).length <= defIndentation) {
            break;
        }
        end = statementEnd(lines, line);
        line = end;
    }
    return end;
}

const tripleQuoteOpening = /^([ \t]*)([rRuU]?)("""|''')/;

/** Finds the docstring that is the first statement of the function. */
export function locateDocstring(lines: string[], fn: FunctionLocation): DocstringLocation {
    const noDocstring = new UpdateRefusal(
        `"${fn.name}" has no docstring. Run "Generate Docstring" to create one.`,
    );
    const defIndentation = indentationOf(lines[fn.defLine]).length;

    let startLine = fn.headerEndLine + 1;
    while (
        startLine < lines.length &&
        (isBlank(lines[startLine]) || lines[startLine].trim().startsWith("#"))
    ) {
        startLine++;
    }
    if (startLine >= lines.length || indentationOf(lines[startLine]).length <= defIndentation) {
        throw noDocstring;
    }

    const opening = lines[startLine].match(tripleQuoteOpening);
    if (opening == null) {
        if (/^\s*[rRuU]?["']/.test(lines[startLine])) {
            throw new UpdateRefusal(
                `The docstring of "${fn.name}" is not triple quoted. Update Docstring only edits """ or ''' docstrings.`,
            );
        }
        throw noDocstring;
    }

    const [, indentation, prefix, quote] = opening;
    const contentStart = opening[0].length;
    const close = findClosingQuote(lines, startLine, contentStart, quote);
    if (close == undefined) {
        throw new UpdateRefusal(`The docstring of "${fn.name}" is not closed.`);
    }

    const after = lines[close.line].slice(close.character + 3).trim();
    if (after !== "" && !after.startsWith("#")) {
        throw new UpdateRefusal(
            `The docstring of "${fn.name}" is followed by code on the same line as the closing quotes.`,
        );
    }

    let content: string[];
    if (close.line === startLine) {
        content = [lines[startLine].slice(contentStart, close.character)];
    } else {
        content = [
            lines[startLine].slice(contentStart),
            ...lines.slice(startLine + 1, close.line),
            lines[close.line].slice(0, close.character),
        ];
    }

    let closingIndentation: string | undefined;
    if (close.line > startLine && isBlank(content[content.length - 1])) {
        closingIndentation = content.pop();
    }

    if (content.every(isBlank)) {
        throw new UpdateRefusal(
            `The docstring of "${fn.name}" is empty. Run "Generate Docstring" to fill it.`,
        );
    }

    return {
        startLine,
        startCharacter: indentation.length,
        endLine: close.line,
        endCharacter: close.character + 3,
        prefix,
        quote,
        indentation,
        lines: content,
        closingIndentation,
    };
}

function findClosingQuote(
    lines: string[],
    startLine: number,
    startCharacter: number,
    quote: string,
): { line: number; character: number } | undefined {
    for (let line = startLine; line < lines.length; line++) {
        const text = lines[line];
        for (let index = line === startLine ? startCharacter : 0; index < text.length; index++) {
            if (text[index] === "\\") {
                index++;
            } else if (text.startsWith(quote, index)) {
                return { line, character: index };
            }
        }
    }
    return undefined;
}
