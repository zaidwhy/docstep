import { FormatOptions, SignatureParam, SignatureValue, typePlaceholder, UpdateRefusal } from "./types";

export function indentationOf(line: string): string {
    const match = line.match(/^[ \t]*/);
    return match == null ? "" : match[0];
}

export function isBlank(line: string): boolean {
    return line.trim() === "";
}

/** Smallest indentation of the non-blank lines after the first one, as cleandoc does. */
export function baseIndentation(lines: string[], fallback: string): string {
    let base: string | undefined;
    for (const line of lines.slice(1)) {
        if (isBlank(line)) {
            continue;
        }
        const indentation = indentationOf(line);
        if (base === undefined || indentation.length < base.length) {
            base = indentation;
        }
    }

    return base ?? fallback;
}

export function arraysEqual(a: string[], b: string[]): boolean {
    return a.length === b.length && a.every((line, index) => line === b[index]);
}

export function stripTrailingBlanks(lines: string[]): string[] {
    let end = lines.length;
    while (end > 0 && isBlank(lines[end - 1])) {
        end--;
    }
    return lines.slice(0, end);
}

/** A rough check that a piece of text is a type expression and not prose. */
export function isTypeLike(text: string): boolean {
    const part = /[\w.]+(?:\[.*\])?/.source;
    const pattern = new RegExp(`^${part}(?:\\s*\\|\\s*${part})*$`);
    return pattern.test(text.trim());
}

/** Splits a trailing ", optional" (or a bare "optional") off a docstring type. */
export function splitOptional(typeText: string): { base: string; optional: boolean } {
    const trimmed = typeText.trim();
    if (trimmed === "optional") {
        return { base: "", optional: true };
    }
    const match = trimmed.match(/^(.*?),\s*optional$/);
    if (match != null) {
        return { base: match[1].trim(), optional: true };
    }
    return { base: trimmed, optional: false };
}

function withOptional(base: string, optional: boolean): string {
    return optional ? `${base}, optional` : base;
}

/** Type text the generator would write for a parameter that is not documented yet. */
export function newParamType(param: SignatureParam, options: FormatOptions): string {
    const type = options.guessTypes ? param.type ?? typePlaceholder : typePlaceholder;
    return withOptional(type, param.kind === "kwarg");
}

export function newValueType(value: SignatureValue, options: FormatOptions): string {
    return options.guessTypes ? value.type ?? typePlaceholder : typePlaceholder;
}

/** Annotation to apply to an existing return or yield entry, if any. */
export function valueAnnotation(
    value: SignatureValue | undefined,
    options: FormatOptions,
): string | undefined {
    if (!options.includeTypes || !options.guessTypes || value === undefined) {
        return undefined;
    }
    return value.annotation;
}

/**
 * Type of an existing parameter entry after the update. The annotation wins when there is
 * one; otherwise the written type is kept. The ", optional" marker follows the default.
 * Returns `existing` itself when nothing needs to change.
 */
export function reconcileParamType(
    existing: string | undefined,
    param: SignatureParam,
    options: FormatOptions,
): string | undefined {
    if (!options.includeTypes || param.kind === "variadic") {
        return existing;
    }
    const annotation = options.guessTypes ? param.annotation : undefined;
    const optional = param.kind === "kwarg";

    if (existing === undefined) {
        return annotation === undefined ? undefined : withOptional(annotation, optional);
    }

    const current = splitOptional(existing);
    const base = annotation ?? current.base;
    if (base === current.base && optional === current.optional) {
        return existing;
    }
    if (base === "") {
        return optional ? "optional" : undefined;
    }
    return withOptional(base, optional);
}

/** Finds the documented entry for every name and refuses duplicates. */
export function indexByName<T>(items: T[], nameOf: (item: T) => string, section: string): Map<string, T> {
    const byName = new Map<string, T>();
    for (const item of items) {
        const name = nameOf(item);
        if (byName.has(name)) {
            throw new UpdateRefusal(`"${name}" is documented twice in the ${section} section.`);
        }
        byName.set(name, item);
    }
    return byName;
}

export interface Entry {
    lines: string[];
}

export interface EntryList {
    lead: string[];
    entries: Entry[];
    separator: string[];
}

/**
 * Splits a section body into entries. An entry starts on a line indented exactly
 * `entryIndentation`; deeper lines and blank lines continue it.
 */
export function parseEntries(body: string[], entryIndentation: number, section: string): EntryList {
    const lead: string[] = [];
    const entries: Entry[] = [];

    for (const line of body) {
        if (isBlank(line)) {
            if (entries.length === 0) {
                lead.push(line);
            } else {
                entries[entries.length - 1].lines.push(line);
            }
            continue;
        }

        const indentation = indentationOf(line).length;
        if (indentation === entryIndentation) {
            entries.push({ lines: [line] });
        } else if (indentation > entryIndentation && entries.length > 0) {
            entries[entries.length - 1].lines.push(line);
        } else {
            throw new UpdateRefusal(
                `The ${section} section is not indented consistently at "${line.trim()}".`,
            );
        }
    }

    let separator: string[] = [];
    entries.forEach((entry, index) => {
        const trimmed = stripTrailingBlanks(entry.lines);
        if (index === 0 && entries.length > 1) {
            separator = entry.lines.slice(trimmed.length).map(() => "");
        }
        entry.lines = trimmed;
    });

    return { lead, entries, separator };
}

export function joinEntries(list: EntryList, entries: Entry[]): string[] {
    const lines = [...list.lead];
    entries.forEach((entry, index) => {
        if (index > 0) {
            lines.push(...list.separator);
        }
        lines.push(...entry.lines);
    });
    return lines;
}

export type SectionKind = "params" | "raises" | "returns" | "yields" | "other";

export interface Section {
    kind: SectionKind;
    title: string;
    header: string[];
    body: string[];
    tail: string[];
}

export interface SectionedDocstring {
    preamble: string[];
    sections: Section[];
}

export interface NewSection {
    kind: SectionKind;
    lines: string[];
}

const GAP = "\u0000gap";

/**
 * Rebuilds the docstring lines. `edits` maps a section to its new body, or to null to
 * remove the section. New sections go next to the modeled sections according to `order`,
 * or right after the summary when there are none.
 */
export function assembleSections(
    doc: SectionedDocstring,
    edits: Map<Section, string[] | null>,
    newSections: NewSection[],
    order: SectionKind[],
): string[] {
    const sections = doc.sections;
    const inserts = new Map<number, NewSection[]>();
    for (const section of [...newSections].sort(
        (a, b) => order.indexOf(a.kind) - order.indexOf(b.kind),
    )) {
        const index = insertIndex(sections, section.kind, order);
        inserts.set(index, [...(inserts.get(index) ?? []), section]);
    }

    const out: string[] = [...doc.preamble];
    for (let index = 0; index <= sections.length; index++) {
        for (const inserted of inserts.get(index) ?? []) {
            if (out.length > 0 && !isBlank(out[out.length - 1])) {
                out.push("");
            }
            out.push(...inserted.lines);
            if (index < sections.length) {
                out.push("");
            }
        }

        if (index === sections.length) {
            break;
        }
        const section = sections[index];
        const edit = edits.get(section);
        if (edit === null) {
            out.push(GAP, ...section.tail);
        } else {
            out.push(...section.header, ...(edit ?? section.body), ...section.tail);
        }
    }

    return closeGaps(out);
}

function insertIndex(sections: Section[], kind: SectionKind, order: SectionKind[]): number {
    const rank = order.indexOf(kind);
    let after = -1;
    let before = -1;
    sections.forEach((section, index) => {
        const sectionRank = order.indexOf(section.kind);
        if (section.kind === "other" || sectionRank < 0) {
            return;
        }
        if (sectionRank < rank) {
            after = index;
        } else if (before < 0) {
            before = index;
        }
    });

    if (after >= 0) {
        return after + 1;
    }
    if (before >= 0) {
        return before;
    }
    return 0;
}

/** Collapses the blank lines around a removed section to one, or to none at the end. */
function closeGaps(lines: string[]): string[] {
    const out = [...lines];
    let gap = out.indexOf(GAP);
    while (gap >= 0) {
        let start = gap;
        while (start > 0 && isBlank(out[start - 1])) {
            start--;
        }
        let end = gap + 1;
        while (end < out.length && isBlank(out[end])) {
            end++;
        }
        const blanks = gap - start + (end - gap - 1);
        const atEnd = end >= out.length;
        const replacement = !atEnd && start > 0 && blanks > 0 ? [""] : [];
        out.splice(start, end - start, ...replacement);
        gap = out.indexOf(GAP);
    }
    return out;
}

/** True when an exception is already listed, comparing the last dotted component. */
export function isDocumented(exception: string, names: string[]): boolean {
    const short = (name: string) => name.split(".").pop();
    return names.some((name) => name === exception || short(name) === short(exception));
}

/** New section body, null to remove the section, or undefined when nothing changed. */
export function changedBody(
    section: Section | undefined,
    list: EntryList,
    entries: Entry[],
): string[] | null | undefined {
    if (entries.length === 0) {
        return section === undefined ? undefined : null;
    }
    const body = joinEntries(list, entries);
    if (section !== undefined && arraysEqual(body, section.body)) {
        return undefined;
    }
    return body;
}
