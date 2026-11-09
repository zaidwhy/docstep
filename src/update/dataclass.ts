import { indentationOf, isBlank } from "./lines";
import { bodyEnd, FunctionLocation, statementEnd } from "./locate";

/** A field the generated dataclass __init__ takes as a parameter. */
export interface DataclassField {
    name: string;
    annotation: string;
    default?: string;
}

const dataclassDecorator = /^@(?:dataclasses\.)?dataclass\b/;
const fieldPattern = /^([A-Za-z_]\w*)\s*:\s*(.+)$/;

/** True when one of the decorators directly above the class is @dataclass. */
export function isDataclass(lines: string[], cls: FunctionLocation): boolean {
    const indentation = indentationOf(lines[cls.defLine]).length;
    for (let line = cls.defLine - 1; line >= 0; line--) {
        const text = lines[line];
        const trimmed = text.trim();
        if (isBlank(text)) {
            return false;
        }
        if (indentationOf(text).length > indentation || trimmed.startsWith("#")) {
            continue;
        }
        if (indentationOf(text).length < indentation) {
            return false;
        }
        if (dataclassDecorator.test(trimmed)) {
            return true;
        }
        // Another decorator, or the closing bracket of a multi-line one.
        if (!trimmed.startsWith("@") && !/^[)\]}]/.test(trimmed)) {
            return false;
        }
    }
    return false;
}

/**
 * The fields of a dataclass that its generated __init__ takes, in order. ClassVar fields,
 * fields declared with init=False and the KW_ONLY marker are not parameters; InitVar fields are.
 * Fields inherited from a base dataclass are not visible here.
 */
export function dataclassFields(lines: string[], cls: FunctionLocation): DataclassField[] {
    const end = bodyEnd(lines, cls.defLine, cls.headerEndLine);
    const fields: DataclassField[] = [];
    let bodyIndentation: number | undefined;
    for (let line = cls.headerEndLine + 1; line <= end; line++) {
        const text = lines[line];
        if (isBlank(text) || text.trim().startsWith("#")) {
            continue;
        }
        const statementLast = statementEnd(lines, line);
        bodyIndentation ??= indentationOf(text).length;
        if (indentationOf(text).length === bodyIndentation) {
            const statement = lines
                .slice(line, statementLast + 1)
                .map((part) => part.trim())
                .join(" ");
            const field = readField(statement);
            if (field !== undefined) {
                fields.push(field);
            }
        }
        line = statementLast;
    }
    return fields;
}

function readField(statement: string): DataclassField | undefined {
    const match = statement.replace(/\s+#.*$/, "").match(fieldPattern);
    if (match == null) {
        return undefined;
    }
    const [annotationText, defaultText] = splitTopLevel(match[2], "=");
    let annotation = annotationText.trim();
    if (
        /^(?:typing\.)?ClassVar\b/.test(annotation) ||
        /^(?:dataclasses\.)?KW_ONLY$/.test(annotation)
    ) {
        return undefined;
    }
    const initVar = annotation.match(/^(?:dataclasses\.)?InitVar\[(.*)\]$/);
    if (initVar != null) {
        annotation = initVar[1].trim();
    }

    if (defaultText === undefined) {
        return { name: match[1], annotation };
    }
    const value = defaultText.trim();
    const fieldCall = value.match(/^(?:dataclasses\.)?field\((.*)\)$/);
    if (fieldCall == null) {
        return { name: match[1], annotation, default: value };
    }
    const keywords = keywordArguments(fieldCall[1]);
    if (keywords.get("init") === "False") {
        return undefined;
    }
    const factory = keywords.get("default_factory");
    const fieldDefault =
        keywords.get("default") ?? (factory === undefined ? undefined : `${factory}()`);
    return { name: match[1], annotation, default: fieldDefault };
}

/** Keyword arguments of a call, split at top-level commas. */
function keywordArguments(argumentText: string): Map<string, string> {
    const keywords = new Map<string, string>();
    for (const part of splitAllTopLevel(argumentText, ",")) {
        const [key, value] = splitTopLevel(part, "=");
        if (value !== undefined) {
            keywords.set(key.trim(), value.trim());
        }
    }
    return keywords;
}

/** Splits at the first `separator` outside brackets and strings. A `=` that is part of `==` does not count. */
function splitTopLevel(text: string, separator: string): [string, string | undefined] {
    const index = topLevelIndices(text, separator)[0];
    return index === undefined ? [text, undefined] : [text.slice(0, index), text.slice(index + 1)];
}

function splitAllTopLevel(text: string, separator: string): string[] {
    const parts: string[] = [];
    let start = 0;
    for (const index of topLevelIndices(text, separator)) {
        parts.push(text.slice(start, index));
        start = index + 1;
    }
    parts.push(text.slice(start));
    return parts;
}

function topLevelIndices(text: string, separator: string): number[] {
    const indices: number[] = [];
    let depth = 0;
    let quote: string | undefined;
    for (let index = 0; index < text.length; index++) {
        const char = text[index];
        if (quote !== undefined) {
            if (char === "\\") {
                index++;
            } else if (char === quote) {
                quote = undefined;
            }
        } else if (char === '"' || char === "'") {
            quote = char;
        } else if ("([{".includes(char)) {
            depth++;
        } else if (")]}".includes(char)) {
            depth--;
        } else if (depth === 0 && char === separator) {
            const comparison =
                separator === "=" &&
                ("=!<>".includes(text[index - 1] ?? "") || text[index + 1] === "=");
            if (!comparison) {
                indices.push(index);
            }
        }
    }
    return indices;
}
