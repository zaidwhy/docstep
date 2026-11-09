import { getBody, getDefinition, getFunctionName, parseParameters, tokenizeDefinition } from "../parse";
import { DocstringLocation, FunctionLocation } from "./locate";
import { Signature, SignatureParam } from "./types";

/**
 * Reads the signature with the same parser the generator uses, so new entries match what
 * Generate Docstring would write. The docstring is blanked out first so its text is not
 * mistaken for return, yield or raise statements in the body.
 */
export function readSignature(
    lines: string[],
    fn: FunctionLocation,
    docstring: DocstringLocation,
): Signature {
    const blanked = lines.map((line, index) =>
        index >= docstring.startLine && index <= docstring.endLine ? "" : line,
    );
    const document = blanked.join("\n");
    const position = fn.headerEndLine + 1;

    const definition = getDefinition(document, position);
    const tokens = tokenizeDefinition(definition);
    const parts = parseParameters(tokens, getBody(document, position), getFunctionName(definition));

    const params: SignatureParam[] = [];
    for (const token of tokens) {
        const match = token.match(/^(\*{0,2})([A-Za-z_]\w*)/);
        if (match == null) {
            continue;
        }
        const [, stars, name] = match;
        if (stars !== "") {
            params.push({ name, stars, kind: "variadic" });
            continue;
        }

        const annotated = /^\w+\s*:/.test(token);
        const arg = parts.args.find((a) => a.var === name);
        const kwarg = parts.kwargs.find((k) => k.var === name);
        if (arg !== undefined) {
            params.push({ name, stars, kind: "arg", type: arg.type, annotation: annotated ? arg.type : undefined });
        } else if (kwarg !== undefined) {
            params.push({
                name,
                stars,
                kind: "kwarg",
                type: kwarg.type,
                annotation: annotated ? kwarg.type : undefined,
                default: kwarg.default,
            });
        }
    }

    // The parser only sets a return or yield type from the "->" annotation.
    return {
        params,
        returns: parts.returns && { type: parts.returns.type, annotation: parts.returns.type },
        yields: parts.yields && { type: parts.yields.type, annotation: parts.yields.type },
        exceptions: [...new Set(parts.exceptions.map((exception) => exception.type))],
    };
}
