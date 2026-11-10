import { guessType } from ".";
import {
    Argument,
    Decorator,
    DocstringParts,
    Exception,
    KeywordArgument,
    Returns,
    Yields,
} from "../docstring_parts";

export function parseParameters(
    parameterTokens: string[],
    body: string[],
    functionName: string,
): DocstringParts {
    return {
        name: functionName,
        decorators: parseDecorators(parameterTokens),
        args: parseArguments(parameterTokens),
        kwargs: parseKeywordArguments(parameterTokens),
        starArgs: parseStarred(parameterTokens, "*"),
        starKwargs: parseStarred(parameterTokens, "**"),
        returns: parseReturn(parameterTokens, body),
        yields: parseYields(parameterTokens, body),
        exceptions: parseExceptions(body),
    };
}

function parseDecorators(parameters: string[]): Decorator[] {
    const decorators: Decorator[] = [];
    const pattern = /^@(\w+)/;

    for (const param of parameters) {
        const match = param.trim().match(pattern);

        if (match == null) {
            continue;
        }

        decorators.push({
            name: match[1],
        });
    }

    return decorators;
}

function parseArguments(parameters: string[]): Argument[] {
    const args: Argument[] = [];
    const excludedArgs = ["self", "cls"];
    const pattern = /^(\w+)/;

    for (const param of parameters) {
        const match = param.trim().match(pattern);

        if (match == null || param.includes("=") || inArray(param, excludedArgs)) {
            continue;
        }

        args.push({
            var: match[1],
            type: guessType(param),
        });
    }

    return args;
}

/** `*args` or `**kwargs` parameters; a bare `*` marks keyword-only parameters and is skipped. */
function parseStarred(parameters: string[], stars: "*" | "**"): Argument[] {
    const pattern = stars === "*" ? /^\*(?!\*)(\w+)/ : /^\*\*(\w+)/;
    const starred: Argument[] = [];
    for (const param of parameters) {
        const match = param.trim().match(pattern);
        if (match != null) {
            starred.push({
                var: stars + match[1],
                type: guessType(param.trim().slice(stars.length)),
            });
        }
    }
    return starred;
}

function parseKeywordArguments(parameters: string[]): KeywordArgument[] {
    const kwargs: KeywordArgument[] = [];
    const pattern = /^(\w+)(?:\s*:[^=]+)?\s*=\s*(.+)/;

    for (const param of parameters) {
        const match = param.trim().match(pattern);

        if (match == null) {
            continue;
        }

        kwargs.push({
            var: match[1],
            default: match[2],
            type: guessType(param),
        });
    }

    return kwargs;
}

function parseReturn(parameters: string[], body: string[]): Returns {
    const returnType = parseReturnFromDefinition(parameters);
    const returns =
        returnType == null || isIterator(returnType.type)
            ? parseFromBody(body, /return /)
            : returnType;

    const values = returns === undefined ? undefined : returnedNames(body, returns.type);
    return values === undefined ? returns : { ...returns, values };
}

/**
 * The names of a tuple returned as plain names (`return mean, spread`), when every return
 * statement in the body returns those same names; any other return makes the names a guess.
 * Each name takes its type from a `tuple[...]` annotation with one element per name.
 */
function returnedNames(body: string[], annotation: string | undefined): Argument[] | undefined {
    const statements = body.filter((line) => /^\s*return\b/.test(line));
    const tuples = statements.map((line) =>
        line.match(/^\s*return\s+\(?\s*(\w+(?:\s*,\s*\w+)+)\s*,?\s*\)?\s*(?:#.*)?$/),
    );
    if (statements.length === 0 || tuples.some((match) => match == null)) {
        return undefined;
    }

    const names = tuples[0][1].split(",").map((name) => name.trim());
    if (tuples.some((match) => match[1].replace(/\s/g, "") !== names.join(","))) {
        return undefined;
    }

    const types = tupleElementTypes(annotation);
    return names.map((name, index) => ({
        var: name,
        type: types?.length === names.length ? types[index] : undefined,
    }));
}

/** `tuple[int, str]` or `Tuple[int, str]` split into its element types, nested brackets kept whole. */
function tupleElementTypes(annotation: string | undefined): string[] | undefined {
    const inner = annotation?.match(/^[Tt]uple\[(.*)\]$/)?.[1];
    if (inner === undefined) {
        return undefined;
    }
    const elements: string[] = [];
    let depth = 0;
    let start = 0;
    for (let index = 0; index < inner.length; index++) {
        const char = inner[index];
        if (char === "[") {
            depth++;
        } else if (char === "]") {
            depth--;
        } else if (char === "," && depth === 0) {
            elements.push(inner.slice(start, index).trim());
            start = index + 1;
        }
    }
    elements.push(inner.slice(start).trim());
    return elements;
}

function parseYields(parameters: string[], body: string[]): Yields {
    const returnType = parseReturnFromDefinition(parameters);

    if (returnType != null && isIterator(returnType.type)) {
        return returnType as Yields;
    }

    // To account for functions that yield but don't have a yield signature
    const yieldType = returnType ? returnType.type : undefined;
    const yieldInBody = parseFromBody(body, /yield /);

    if (yieldInBody != null && yieldType != undefined) {
        yieldInBody.type = `Iterator[${yieldType}]`;
    }

    return yieldInBody;
}

function parseReturnFromDefinition(parameters: string[]): Returns | null {
    const pattern = /^->\s*(["']?)(['"\w\[\], |\.]*)\1/;

    for (const param of parameters) {
        const match = param.trim().match(pattern);

        if (match == null) {
            continue;
        }

        // Skip "-> None" annotations
        return match[2] === "None" ? null : { type: match[2] };
    }

    return null;
}

function parseExceptions(body: string[]): Exception[] {
    const exceptions: Exception[] = [];
    const pattern = /(?<!#.*)raise\s+([\w.]+)/;

    for (const line of body) {
        const match = line.match(pattern);

        if (match == null) {
            continue;
        }

        exceptions.push({ type: match[1] });
    }

    return exceptions;
}

export function inArray<type>(item: type, array: type[]) {
    return array.some((x) => item === x);
}

function parseFromBody(body: string[], pattern: RegExp): Returns | Yields {
    for (const line of body) {
        const match = line.match(pattern);

        if (match == null) {
            continue;
        }

        return { type: undefined };
    }

    return undefined;
}

function isIterator(type: string): boolean {
    return type.startsWith("Generator") || type.startsWith("Iterator");
}
