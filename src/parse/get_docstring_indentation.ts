import { blankLine, getIndentation } from "./utilities";

export function getDocstringIndentation(
    document: string,
    linePosition: number,
    defaultIndentation: string,
): string {
    const lines = document.split("\n");
    const definitionPattern = /\b(((async\s+)?\s*def)|\s*class)\b/g;

    let currentLineNum = linePosition;

    while (currentLineNum >= 0) {
        const currentLine = lines[currentLineNum];

        if (!blankLine(currentLine)) {
            if (definitionPattern.test(currentLine)) {
                const definitionIndentation = getIndentation(currentLine);
                const bodyIndentation = getBodyIndentation(lines, linePosition);

                if (bodyIndentation.length > definitionIndentation.length) {
                    return bodyIndentation;
                }

                return definitionIndentation + defaultIndentation;
            }
        }

        currentLineNum--;
    }

    // No def or class above: this is a module docstring, which sits at column 0.
    return "";
}

/**
 * Indentation of the first line of the body that follows the docstring position,
 * skipping blank lines, comments and the opening quotes of the docstring itself.
 * Returns "" if there is no such line.
 */
function getBodyIndentation(lines: string[], linePosition: number): string {
    for (let lineNum = linePosition; lineNum < lines.length; lineNum++) {
        const line = lines[lineNum];
        const content = line.trim();

        if (blankLine(line) || content.startsWith("#") || /^("""|''')/.test(content)) {
            continue;
        }

        return getIndentation(line);
    }

    return "";
}
