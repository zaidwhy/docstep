import {
    arraysEqual,
    assembleSections,
    changedBody,
    baseIndentation,
    Entry,
    EntryList,
    indentationOf,
    findRename,
    indexByName,
    isBlank,
    isDocumented,
    isTypeLike,
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
    parameters: "params",
    params: "params",
    arguments: "params",
    args: "params",
    returns: "returns",
    return: "returns",
    yields: "yields",
    yield: "yields",
    raises: "raises",
    raise: "raises",
    "other parameters": "unsupported",
    "keyword arguments": "unsupported",
    "keyword args": "unsupported",
};

const order: SectionKind[] = ["params", "returns", "yields", "raises"];
const defaultUnit = "    ";

/** Updates the lines of a NumPy style docstring to match the signature. */
export function updateNumpy(
    lines: string[],
    signature: Signature,
    options: FormatOptions,
    indentation: string,
): string[] {
    refuseForeignFormat(lines, "numpy");
    const base = baseIndentation(lines, indentation);
    const doc = parseNumpy(lines, base.length);
    const unit = descriptionUnit(doc, base);

    const edits = new Map<Section, string[] | null>();
    const added: NewSection[] = [];
    const section = (kind: SectionKind) => doc.sections.find((s) => s.kind === kind);
    const add = (existing: Section | undefined, body: string[] | null | undefined, kind: SectionKind, title: string) => {
        if (body === undefined) {
            return;
        }
        if (existing !== undefined) {
            edits.set(existing, body);
        } else if (body !== null && body.length > 0) {
            added.push({ kind, lines: [base + title, base + "-".repeat(title.length), ...body] });
        }
    };

    const params = section("params");
    add(params, updateParams(params, signature.params, options, base, unit), "params", "Parameters");

    for (const [kind, title, value] of [
        ["returns", "Returns", signature.returns],
        ["yields", "Yields", signature.yields],
    ] as [SectionKind, string, SignatureValue | undefined][]) {
        const existing = section(kind);
        add(existing, updateValue(existing, value, options, base, unit), kind, title);
    }

    const raises = section("raises");
    add(raises, updateRaises(raises, signature.exceptions, base, unit), "raises", "Raises");

    return assembleSections(doc, edits, added, order);
}

function parseNumpy(lines: string[], base: number): SectionedDocstring {
    const doc: SectionedDocstring = { preamble: [], sections: [] };
    const seen = new Set<SectionKind>();
    let current: Section | undefined;

    for (let index = 0; index < lines.length; index++) {
        const line = lines[index];
        const next = lines[index + 1];
        const isHeader =
            index >= 1 &&
            !isBlank(line) &&
            indentationOf(line).length === base &&
            next !== undefined &&
            /^-{3,}$/.test(next.trim()) &&
            indentationOf(next).length === base;

        if (isHeader) {
            const title = line.trim();
            const kind = headers[title.toLowerCase()] ?? "other";
            if (kind === "unsupported") {
                throw new UpdateRefusal(
                    `The "${title}" section is not supported by Update Docstring. Move those entries to Parameters.`,
                );
            }
            if (kind !== "other" && seen.has(kind)) {
                throw new UpdateRefusal(`The docstring has more than one ${title} section.`);
            }
            seen.add(kind);
            current = { kind, title, header: [line, next], body: [], tail: [] };
            doc.sections.push(current);
            index++;
            continue;
        }

        if (current === undefined) {
            doc.preamble.push(line);
        } else {
            current.body.push(line);
        }
    }

    for (const section of doc.sections) {
        while (section.body.length > 0 && isBlank(section.body[section.body.length - 1])) {
            section.tail.unshift(section.body.pop());
        }
    }

    return doc;
}

function descriptionUnit(doc: SectionedDocstring, base: string): string {
    for (const section of doc.sections) {
        if (section.kind === "other") {
            continue;
        }
        const deeper = section.body.find(
            (line) => !isBlank(line) && indentationOf(line).length > base.length,
        );
        const indentation = deeper === undefined ? "" : indentationOf(deeper);
        if (indentation.startsWith(base) && indentation.length > base.length) {
            return indentation.slice(base.length);
        }
    }
    return defaultUnit;
}

interface ParamHead {
    stars: string;
    name: string;
    type?: string;
    optionalOnly: boolean;
}

function parseParamHead(line: string, section: string): ParamHead {
    const text = line.trim();
    const match = text.match(/^(\*{0,2})([A-Za-z_]\w*)(?:\s*:\s*(.*?)|(,\s*optional))?\s*$/);
    if (match == null) {
        throw new UpdateRefusal(`Could not read "${text}" in the ${section} section.`);
    }
    return { stars: match[1], name: match[2], type: match[3], optionalOnly: match[4] !== undefined };
}

function description(param: SignatureParam): string {
    return param.kind === "kwarg"
        ? `${descriptionPlaceholder}, by default ${param.default}`
        : descriptionPlaceholder;
}

const placeholderDescription = /^_description_(, by default .*)?$/;

function updateParams(
    section: Section | undefined,
    params: SignatureParam[],
    options: FormatOptions,
    base: string,
    unit: string,
): string[] | null | undefined {
    const list: EntryList =
        section === undefined
            ? { lead: [], entries: [], separator: [] }
            : parseEntries(section.body, base.length, section.title);
    const title = section?.title ?? "Parameters";
    const heads = list.entries.map((entry) => ({ entry, head: parseParamHead(entry.lines[0], title) }));
    const documented = indexByName(heads, (item) => item.head.name, title);
    const rename =
        options.detectRenames === true
            ? findRename(
                  heads.filter((item) => item.head.stars === "").map((item) => item.head.name),
                  params,
              )
            : undefined;

    const entries: Entry[] = [];
    for (const param of params) {
        const found = documented.get(param.name === rename?.to ? rename.from : param.name);
        if (found !== undefined) {
            entries.push(updateParamEntry(found.entry, found.head, param, options, base));
        } else if (param.kind !== "variadic" || options.includeVariadicArgs === true) {
            let head = base + param.stars + param.name;
            if (options.includeTypes) {
                head += ` : ${newParamType(param, options)}`;
            } else if (param.kind === "kwarg") {
                head += ", optional";
            }
            entries.push({ lines: [head, base + unit + description(param)] });
        }
    }

    return changedBody(section, list, entries);
}

function updateParamEntry(
    entry: Entry,
    head: ParamHead,
    param: SignatureParam,
    options: FormatOptions,
    base: string,
): Entry {
    const lines = [...entry.lines];
    if (head.name !== param.name) {
        const nameStart = indentationOf(lines[0]).length + head.stars.length;
        lines[0] = lines[0].slice(0, nameStart) + param.name + lines[0].slice(nameStart + head.name.length);
        head = { ...head, name: param.name };
    }
    if (!head.optionalOnly) {
        const type = reconcileParamType(head.type, param, options);
        if (type !== head.type) {
            lines[0] = base + head.stars + head.name + (type === undefined ? "" : ` : ${type}`);
        }
    }
    if (lines.length === 2 && placeholderDescription.test(lines[1].trim())) {
        lines[1] = indentationOf(lines[1]) + description(param);
    }
    return arraysEqual(lines, entry.lines) ? entry : { lines };
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
    const list: EntryList =
        section === undefined
            ? { lead: [], entries: [], separator: [] }
            : parseEntries(section.body, base.length, section.title);
    const names = list.entries.map((entry) => {
        const text = entry.lines[0].trim();
        if (!/^[\w.]+$/.test(text)) {
            throw new UpdateRefusal(`Could not read "${text}" in the ${section.title} section.`);
        }
        return text;
    });

    const entries = [...list.entries];
    for (const exception of exceptions) {
        if (!isDocumented(exception, names)) {
            entries.push({ lines: [base + exception, base + unit + descriptionPlaceholder] });
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
        const line = base + unit + descriptionPlaceholder;
        return options.includeTypes ? [base + newValueType(value, options), line] : [line];
    }

    const annotation = valueAnnotation(value, options);
    if (annotation === undefined) {
        return undefined;
    }
    const heads = section.body.filter(
        (line) => !isBlank(line) && indentationOf(line).length === base.length,
    );
    if (heads.length !== 1 || section.body[0] !== heads[0]) {
        return undefined;
    }
    const text = heads[0].trim();
    const named = text.match(/^(\w+)\s*:\s*(.+)$/);
    let head: string;
    if (named != null) {
        head = named[2].trim() === annotation ? undefined : `${base}${named[1]} : ${annotation}`;
    } else {
        head = !isTypeLike(text) || text === annotation ? undefined : base + annotation;
    }
    return head === undefined ? undefined : [head, ...section.body.slice(1)];
}
