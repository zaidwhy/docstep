import { updateDocstring, UpdateResult } from "../../update";

export function py(...lines: string[]): string {
    return lines.join("\n");
}

export function applyResult(document: string, result: UpdateResult): string {
    if (result.kind !== "edit") {
        throw new Error(`Expected an edit, got ${result.kind}: ${result.message}`);
    }
    const lines = document.split("\n");
    const before = lines.slice(0, result.startLine).concat(lines[result.startLine].slice(0, result.startCharacter));
    const after = [lines[result.endLine].slice(result.endCharacter)].concat(lines.slice(result.endLine + 1));
    return before.join("\n") + result.text + after.join("\n");
}

export function run(
    format: string,
    document: string,
    cursorLine = 0,
    guessTypes = true,
): UpdateResult {
    return updateDocstring(document, cursorLine, { docstringFormat: format, customTemplatePath: "", guessTypes });
}

/** Runs the update and returns the whole document after the edit. */
export function updated(format: string, document: string, cursorLine = 0, guessTypes = true): string {
    return applyResult(document, run(format, document, cursorLine, guessTypes));
}
