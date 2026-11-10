import {
    assembleSections,
    baseIndentation,
    Entry,
    EntryList,
    indentationOf,
    indexByName,
    isBlank,
    isTypeLike,
    changedBody,
    isDocumented,
    joinEntries,
    newParamType,
    newValueType,
    NewSection,
    parseEntries,
    reconcileParamType,
    Section,
    SectionedDocstring,
    SectionKind,
    valueAnnotation,
} from "./lines";
import { refuseForeignFormat } from "./foreign_format";
import {
    descriptionPlaceholder,
    FormatOptions,
    Signature,
    SignatureParam,
    SignatureValue,
    UpdateRefusal,
} from "./types";

const headers: Record<string, SectionKind | "unsupported"> = {
    args: "params",
    arguments: "params",
    parameters: "params",
    params: "params",
    raises: "raises",
    raise: "raises",
    returns: "returns",
    return: "returns",
    yields: "yields",
    yield: "yields",
    "keyword args": "unsupported",
    "keyword arguments": "unsupported",
    "other parameters": "unsupported",
    attention: "other",
    attributes: "other",
    caution: "other",
    danger: "other",
    error: "other",
    example: "other",
    examples: "other",
    hint: "other",
    important: "other",
    methods: "other",
    note: "other",
    notes: "other",
    receive: "other",
    receives: "other",
    references: "other",
    "see also": "other",
    tip: "other",
    todo: "other",
    usage: "other",
    warning: "other",
    warnings: "other",
    warns: "other",
};

// Google's style guide orders the sections Args, Returns or Yields, then Raises.
const order: SectionKind[] = ["params", "returns", "yields", "raises"];
const defaultUnit = "    ";
const inlineHeader = /^(Args|Arguments|Parameters|Params|Returns?|Yields?|Raises?):\s+\S/;

/** Updates the lines of a Google style docstring to match the signature. */
export function updateGoogle(
    lines: string[],
    signature: Signature,
    options: FormatOptions,
    indentation: string,
): string[] {
    refuseForeignFormat(lines, "google");
    const base = baseIndentation(lines, indentation);
    const doc = parseGoogle(lines, base.length);
    const unit = entryUnit(doc, base);

    const edits = new Map<Section, string[] | null>();
    const added: NewSection[] = [];
    const section = (kind: SectionKind) => doc.sections.find((s) => s.kind === kind);

    const params = section("params");
    const paramEntries = updateParams(params, signature.params, options, base, unit);
    record(params, paramEntries, "params", "Args:", base, edits, added);

    const raises = section("raises");
    const raiseEntries = updateRaises(raises, signature.exceptions, base, unit);
    record(raises, raiseEntries, "raises", "Raises:", base, edits, added);

    for (const [kind, title, value] of [
        ["returns", "Returns:", signature.returns],
        ["yields", "Yields:", signature.yields],
    ] as [SectionKind, string, SignatureValue | undefined][]) {
        const existing = section(kind);
        const body = updateValue(existing, value, options, base, unit);
        record(existing, body, kind, title, base, edits, added);
    }

    return assembleSections(doc, edits, added, order);
}

/**
 * `body` is undefined for no change, null to remove the section, or the new body.
 * A section that does not exist yet is added when the body is not empty.
 */
function record(
    existing: Section | undefined,
    body: string[] | null | undefined,
    kind: SectionKind,
    title: string,
    base: string,
    edits: Map<Section, string[] | null>,
    added: NewSection[],
): void {
    if (body === undefined) {
        return;
    }
    if (existing !== undefined) {
        edits.set(existing, body);
    } else if (body !== null && body.length > 0) {
        added.push({ kind, lines: [base + title, ...body] });
    }
}

function parseGoogle(lines: string[], base: number): SectionedDocstring {
    const doc: SectionedDocstring = { preamble: [], sections: [] };
    let current: Section | undefined;
    const seen = new Set<SectionKind>();

    lines.forEach((line, index) => {
        const atBase = index >= 1 && !isBlank(line) && indentationOf(line).length === base;
        const text = line.trim();
        if (atBase && inlineHeader.test(text)) {
            throw new UpdateRefusal(
                `"${text}" puts text on the section header line. Move it to an indented line below "${
                    text.split(":")[0]
                }:".`,
            );
        }

        const title = atBase ? text.match(/^([A-Za-z][A-Za-z ]*):$/) : null;
        const kind = title == null ? undefined : headers[title[1].toLowerCase()];
        if (kind === "unsupported") {
            throw new UpdateRefusal(
                `The "${title[1]}" section is not supported by Update Docstring. Move those entries to Args.`,
            );
        }
        if (kind !== undefined) {
            if (kind !== "other" && seen.has(kind)) {
                throw new UpdateRefusal(`The docstring has more than one ${title[1]} section.`);
            }
            seen.add(kind);
            current = { kind, title: title[1], header: [line], body: [], tail: [] };
            doc.sections.push(current);
            return;
        }

        if (current === undefined) {
            doc.preamble.push(line);
        } else if (current.tail.length === 0 && (isBlank(line) || indentationOf(line).length > base)) {
            current.body.push(line);
        } else {
            current.tail.push(line);
        }
    });

    for (const section of doc.sections) {
        while (section.body.length > 0 && isBlank(section.body[section.body.length - 1])) {
            section.tail.unshift(section.body.pop());
        }
    }

    return doc;
}

function entryUnit(doc: SectionedDocstring, base: string): string {
    for (const section of doc.sections) {
        const first = section.body.find((line) => !isBlank(line));
        if (section.kind !== "other" && first !== undefined) {
            const indentation = indentationOf(first);
            if (indentation.startsWith(base) && indentation.length > base.length) {
                return indentation.slice(base.length);
            }
        }
    }
    return defaultUnit;
}

function entriesOf(section: Section, base: string): EntryList {
    const first = section.body.find((line) => !isBlank(line));
    const indentation = first === undefined ? base.length + 1 : indentationOf(first).length;
    return parseEntries(section.body, indentation, section.title);
}

interface ParamHead {
    indentation: string;
    stars: string;
    name: string;
    type?: string;
    rest: string;
}

function parseParamHead(line: string, section: string): ParamHead {
    const indentation = indentationOf(line);
    const text = line.slice(indentation.length);
    const name = text.match(/^(\*{0,2})([A-Za-z_]\w*)\s*/);
    let position = name == null ? -1 : name[0].length;
    let type: string | undefined;

    if (position >= 0 && text[position] === "(") {
        const close = matchingParen(text, position);
        type = close < 0 ? undefined : text.slice(position + 1, close);
        position = close < 0 ? -1 : close + 1;
        while (position >= 0 && text[position] === " ") {
            position++;
        }
    }

    if (position < 0 || text[position] !== ":") {
        throw new UpdateRefusal(`Could not read "${text}" in the ${section} section.`);
    }

    return { indentation, stars: name[1], name: name[2], type, rest: text.slice(position + 1) };
}

function matchingParen(text: string, open: number): number {
    let depth = 0;
    for (let index = open; index < text.length; index++) {
        if (text[index] === "(") {
            depth++;
        } else if (text[index] === ")") {
            depth--;
            if (depth === 0) {
                return index;
            }
        }
    }
    return -1;
}

function formatHead(head: ParamHead, type: string | undefined, rest: string): string {
    const typePart = type === undefined ? "" : ` (${type})`;
    return `${head.indentation}${head.stars}${head.name}${typePart}:${rest}`;
}

function description(param: SignatureParam): string {
    return param.kind === "kwarg"
        ? `${descriptionPlaceholder}. Defaults to ${param.default}.`
        : descriptionPlaceholder;
}

const placeholderDescription = /^_description_(\. Defaults to .*\.)?$/;

function updateParams(
    section: Section | undefined,
    params: SignatureParam[],
    options: FormatOptions,
    base: string,
    unit: string,
): string[] | null | undefined {
    const list =
        section === undefined
            ? { lead: [], entries: [], separator: [] }
            : entriesOf(section, base);
    const title = section?.title ?? "Args";
    const heads = list.entries.map((entry) => ({ entry, head: parseParamHead(entry.lines[0], title) }));
    const documented = indexByName(heads, (item) => item.head.name, title);
    const indentation = heads.length > 0 ? heads[0].head.indentation : base + unit;

    const entries: Entry[] = [];
    for (const param of params) {
        const found = documented.get(param.name);
        if (found !== undefined) {
            entries.push(updateParamEntry(found.entry, found.head, param, options));
        } else if (param.kind !== "variadic" || options.includeVariadicArgs === true) {
            const type = options.includeTypes ? ` (${newParamType(param, options)})` : "";
            entries.push({ lines: [`${indentation}${param.stars}${param.name}${type}: ${description(param)}`] });
        }
    }

    return changedBody(section, list, entries);
}

function updateParamEntry(
    entry: Entry,
    head: ParamHead,
    param: SignatureParam,
    options: FormatOptions,
): Entry {
    const type = reconcileParamType(head.type, param, options);
    let rest = head.rest;
    if (entry.lines.length === 1 && placeholderDescription.test(rest.trim())) {
        rest = " " + description(param);
    }
    if (type === head.type && rest === head.rest) {
        return entry;
    }
    return { lines: [formatHead(head, type, rest), ...entry.lines.slice(1)] };
}

function updateRaises(
    section: Section | undefined,
    exceptions: string[],
    base: string,
    unit: string,
): string[] | undefined {
    if (exceptions.length === 0) {
        return undefined;
    }
    const list =
        section === undefined
            ? { lead: [], entries: [], separator: [] }
            : entriesOf(section, base);
    const names = list.entries.map((entry) => {
        const match = entry.lines[0].trim().match(/^([\w.]+)\s*:/);
        if (match == null) {
            throw new UpdateRefusal(
                `Could not read "${entry.lines[0].trim()}" in the ${section.title} section.`,
            );
        }
        return match[1];
    });
    const indentation = list.entries.length > 0 ? indentationOf(list.entries[0].lines[0]) : base + unit;

    const entries = [...list.entries];
    for (const exception of exceptions) {
        if (!isDocumented(exception, names)) {
            entries.push({ lines: [`${indentation}${exception}: ${descriptionPlaceholder}`] });
        }
    }

    return changedBody(section, list, entries) ?? undefined;
}

/** Adds a missing Returns or Yields section, and updates the type of a single typed entry. */
function updateValue(
    section: Section | undefined,
    value: SignatureValue | undefined,
    options: FormatOptions,
    base: string,
    unit: string,
): string[] | undefined {
    if (section === undefined) {
        if (value === undefined) {
            return undefined;
        }
        const type = options.includeTypes ? `${newValueType(value, options)}: ` : "";
        return [`${base}${unit}${type}${descriptionPlaceholder}`];
    }

    const annotation = valueAnnotation(value, options);
    if (annotation === undefined) {
        return undefined;
    }
    const list = entriesOf(section, base);
    if (list.entries.length !== 1) {
        return undefined;
    }
    const first = list.entries[0].lines[0];
    const indentation = indentationOf(first);
    const match = first.slice(indentation.length).match(/^([^:]+):(\s.*|)$/);
    if (match == null || !isTypeLike(match[1]) || match[1].trim() === annotation) {
        return undefined;
    }
    const entry = { lines: [`${indentation}${annotation}:${match[2]}`, ...list.entries[0].lines.slice(1)] };
    return joinEntries(list, [entry]);
}
