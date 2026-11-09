import { docstringIsClosed, validDocstringPrefix } from "./parse";

/**
 * Checks that generate-on-enter is enabled, that the preceding characters of the
 * position is a valid docstring prefix and that the prefix is not part of an
 * already closed docstring
 */
export function validEnterActivation(
    document: string,
    linePosition: number,
    charPosition: number,
    quoteStyle: string,
    generateOnEnter: boolean,
): boolean {
    return (
        generateOnEnter &&
        validDocstringPrefix(document, linePosition, charPosition, quoteStyle) &&
        !docstringIsClosed(document, linePosition, charPosition, quoteStyle)
    );
}
