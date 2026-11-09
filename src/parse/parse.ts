import { getBody, getDefinition, getFunctionName, parseParameters, tokenizeDefinition } from ".";
import { DocstringParts } from "../docstring_parts";
import { dataclassFields, isDataclass } from "../update/dataclass";
import { FunctionLocation, locateFunction, locateInit } from "../update/locate";
import { UpdateRefusal } from "../update/types";

export function parse(document: string, positionLine: number): DocstringParts {
    const definition = getDefinition(document, positionLine);
    const functionName = getFunctionName(definition);

    if (/^class\b/.test(definition)) {
        return parseClass(document, positionLine, functionName);
    }

    const body = getBody(document, positionLine);
    const parameterTokens = tokenizeDefinition(definition);
    return parseParameters(parameterTokens, body, functionName);
}

/**
 * A class docstring documents the constructor, so its arguments come from the class's own
 * __init__, never from the base classes in the class header. What __init__ returns or raises
 * belongs in the __init__ docstring.
 */
function parseClass(document: string, positionLine: number, className: string): DocstringParts {
    const constructor: DocstringParts = {
        name: className,
        decorators: [],
        args: [],
        kwargs: [],
        exceptions: [],
        returns: undefined,
        yields: undefined,
    };

    // The line being documented may hold an unclosed """ that would swallow the class body.
    const lines = document
        .split("\n")
        .map((line, index) => (index === positionLine ? "" : line.replace(/\r$/, "")));
    let cls: FunctionLocation;
    try {
        cls = locateFunction(lines, positionLine - 1);
    } catch (error) {
        if (error instanceof UpdateRefusal) {
            return constructor;
        }
        throw error;
    }

    const init = locateInit(lines, cls);
    if (init !== undefined) {
        const initDefinition = getDefinition(lines.join("\n"), init.headerEndLine + 1);
        const initParts = parseParameters(tokenizeDefinition(initDefinition), [], "__init__");
        return { ...constructor, args: initParts.args, kwargs: initParts.kwargs };
    }
    if (isDataclass(lines, cls)) {
        const fields = dataclassFields(lines, cls);
        return {
            ...constructor,
            args: fields
                .filter((f) => f.default === undefined)
                .map((f) => ({ var: f.name, type: f.annotation })),
            kwargs: fields
                .filter((f) => f.default !== undefined)
                .map((f) => ({ var: f.name, default: f.default, type: f.annotation })),
        };
    }
    return constructor;
}
