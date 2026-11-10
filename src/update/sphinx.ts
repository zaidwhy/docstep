import {
    arraysEqual,
    baseIndentation,
    findRename,
    indentationOf,
    isBlank,
    isDocumented,
    newParamType,
    newValueType,
    reconcileParamType,
    stripTrailingBlanks,
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

type FieldKind = "param" | "type" | "raises" | "return" | "rtype" | "yield" | "other";

const fieldKinds: Record<string, FieldKind> = {
    param: "param",
    parameter: "param",
    arg: "param",
    argument: "param",
    key: "param",
    keyword: "param",
    type: "type",
    raises: "raises",
    raise: "raises",
    except: "raises",
    exception: "raises",
    return: "return",
    returns: "return",
    rtype: "rtype",
    yield: "yield",
    yields: "yield",
    ytype: "rtype",
    var: "other",
    ivar: "other",
    cvar: "other",
    vartype: "other",
    meta: "other",
};

interface Field {
    kind: FieldKind;
    name: string;
    argument: string;
    rest: string;
    lines: string[];
}

const fieldPattern = /^:(\w+)([^:]*):(.*)$/;

/** Updates the lines of a Sphinx (reST field list) docstring to match the signature. */
export function updateSphinx(
    lines: string[],
    signature: Signature,
    options: FormatOptions,
    indentation: string,
): string[] {
    refuseForeignFormat(lines, "sphinx");
    const base = baseIndentation(lines, indentation);
    const isField = (line: string, index: number) =>
        index >= 1 && indentationOf(line).length === base.length && readField(line) !== undefined;

    const start = lines.findIndex(isField);
    const end = start < 0 ? lines.length : fieldListEnd(lines, start, base.length, isField);
    const preamble = lines.slice(0, start < 0 ? lines.length : start);
    const tail = lines.slice(end);
    if (tail.some((line, offset) => isField(line, end + offset))) {
        throw new UpdateRefusal(
            "The docstring has text between its :param: style fields. Keep the fields in one block.",
        );
    }

    const block = start < 0 ? [] : lines.slice(start, end);
    const { fields, separator } = parseFields(block);
    let updated = updateParams(fields, signature.params, options, base);
    updated = addRaises(updated, signature.exceptions, base);
    updated = updateValue(updated, "return", signature.returns, options, base);
    updated = updateValue(updated, "yield", signature.yields, options, base);

    const newBlock: string[] = [];
    updated.forEach((field, index) => {
        if (index > 0) {
            newBlock.push(...separator);
        }
        newBlock.push(...field.lines);
    });

    if (arraysEqual(newBlock, block)) {
        return lines;
    }
    if (newBlock.length === 0) {
        return stripTrailingBlanks(preamble).concat(tailAfterRemoval(preamble, tail));
    }
    const head = [...preamble];
    if (head.length > 0 && !isBlank(head[head.length - 1])) {
        head.push("");
    }
    return [...head, ...newBlock, ...tail];
}

function tailAfterRemoval(preamble: string[], tail: string[]): string[] {
    const firstText = tail.findIndex((line) => !isBlank(line));
    if (firstText < 0) {
        return [];
    }
    const rest = tail.slice(firstText);
    return stripTrailingBlanks(preamble).length > 0 ? ["", ...rest] : rest;
}

function readField(line: string): { name: string; argument: string; rest: string } | undefined {
    const match = line.trim().match(fieldPattern);
    if (match == null || fieldKinds[match[1]] === undefined) {
        return undefined;
    }
    return { name: match[1], argument: match[2].trim(), rest: match[3] };
}

function fieldListEnd(
    lines: string[],
    start: number,
    base: number,
    isField: (line: string, index: number) => boolean,
): number {
    let index = start + 1;
    while (index < lines.length) {
        const line = lines[index];
        if (isBlank(line)) {
            let next = index;
            while (next < lines.length && isBlank(lines[next])) {
                next++;
            }
            if (next >= lines.length || !(isField(lines[next], next) || indentationOf(lines[next]).length > base)) {
                return index;
            }
            index = next;
            continue;
        }
        if (!isField(line, index) && indentationOf(line).length <= base) {
            return index;
        }
        index++;
    }
    return index;
}

function parseFields(block: string[]): { fields: Field[]; separator: string[] } {
    const fields: Field[] = [];
    for (const line of block) {
        const field = isBlank(line) || indentationOf(line).length > indentationOf(block[0]).length
            ? undefined
            : readField(line);
        if (field !== undefined) {
            fields.push({ kind: fieldKinds[field.name], ...field, lines: [line] });
        } else {
            fields[fields.length - 1].lines.push(line);
        }
    }

    let separator: string[] = [];
    fields.forEach((field, index) => {
        const trimmed = stripTrailingBlanks(field.lines);
        if (index === 0 && fields.length > 1) {
            separator = field.lines.slice(trimmed.length).map(() => "");
        }
        field.lines = trimmed;
    });
    return { fields, separator };
}

/** Name and inline type of a :param: field, e.g. ":param int count:". */
function paramParts(field: Field): { stars: string; name: string; inlineType?: string } {
    const words = field.argument.split(/\s+/);
    const last = words[words.length - 1].match(/^(\*{0,2})(\w+)$/);
    if (last == null) {
        throw new UpdateRefusal(`Could not read the field "${field.lines[0].trim()}".`);
    }
    const inlineType = words.length > 1 ? words.slice(0, -1).join(" ") : undefined;
    return { stars: last[1], name: last[2], inlineType };
}

function description(param: SignatureParam): string {
    return param.kind === "kwarg"
        ? `${descriptionPlaceholder}, defaults to ${param.default}`
        : descriptionPlaceholder;
}

const placeholderDescription = /^_description_(, defaults to .*)?$/;

function updateParams(
    fields: Field[],
    params: SignatureParam[],
    options: FormatOptions,
    base: string,
): Field[] {
    const paramFields = new Map<string, Field>();
    const typeFields = new Map<string, Field>();
    for (const field of fields) {
        if (field.kind !== "param" && field.kind !== "type") {
            continue;
        }
        const name = field.kind === "param" ? paramParts(field).name : field.argument.replace(/^\*+/, "");
        const map = field.kind === "param" ? paramFields : typeFields;
        if (map.has(name)) {
            throw new UpdateRefusal(`"${name}" has more than one :${field.name}: field.`);
        }
        map.set(name, field);
    }

    const unstarred = [...paramFields.values()].filter((field) => paramParts(field).stars === "");
    const rename =
        options.detectRenames === true
            ? findRename(
                  unstarred.map((field) => paramParts(field).name),
                  params,
              )
            : undefined;

    const group: Field[] = [];
    for (const param of params) {
        const documentedName = param.name === rename?.to ? rename.from : param.name;
        const paramField = renamedField(paramFields.get(documentedName), documentedName, param.name);
        const typeField = renamedField(typeFields.get(documentedName), documentedName, param.name);
        const skipped = param.kind === "variadic" && options.includeVariadicArgs !== true;
        if (paramField === undefined && typeField === undefined && skipped) {
            continue;
        }
        group.push(...paramGroup(param, paramField, typeField, options, base));
    }

    const first = fields.findIndex((field) => field.kind === "param" || field.kind === "type");
    const others = fields.filter((field) => field.kind !== "param" && field.kind !== "type");
    const at = first < 0 ? 0 : fields.slice(0, first).filter((field) => others.includes(field)).length;
    return [...others.slice(0, at), ...group, ...others.slice(at)];
}

/** The field with its parameter name swapped; the description and any inline type stay as written. */
function renamedField(field: Field | undefined, from: string, to: string): Field | undefined {
    if (field === undefined || from === to) {
        return field;
    }
    // The name is the argument's last word, after any inline type and stars.
    const argument = field.argument.slice(0, field.argument.length - from.length) + to;
    const head = `${indentationOf(field.lines[0])}:${field.name} ${argument}:${field.rest}`;
    return { ...field, argument, lines: [head, ...field.lines.slice(1)] };
}

function paramGroup(
    param: SignatureParam,
    paramField: Field | undefined,
    typeField: Field | undefined,
    options: FormatOptions,
    base: string,
): Field[] {
    if (paramField === undefined) {
        const created = makeField("param", `${base}:param ${param.stars}${param.name}: ${description(param)}`);
        const type = options.includeTypes ? newParamType(param, options) : undefined;
        return [created, ...typeFieldFor(param, typeField, type, options, base)];
    }

    const inlineType = paramParts(paramField).inlineType;
    const updated = updateParamField(paramField, param, options);
    if (inlineType !== undefined) {
        return typeField === undefined ? [updated] : [updated, typeField];
    }
    return [updated, ...typeFieldFor(param, typeField, reconcileParamType(undefined, param, options), options, base)];
}

/** Updates an inline type (":param int a:") from the annotation and refreshes a placeholder description. */
function updateParamField(field: Field, param: SignatureParam, options: FormatOptions): Field {
    const parts = paramParts(field);
    let type = parts.inlineType;
    if (type !== undefined && options.includeTypes && options.guessTypes && param.annotation !== undefined) {
        type = param.annotation;
    }
    let rest = field.rest;
    if (field.lines.length === 1 && placeholderDescription.test(rest.trim())) {
        rest = " " + description(param);
    }
    if (type === parts.inlineType && rest === field.rest) {
        return field;
    }
    const argument = (type === undefined ? "" : type + " ") + parts.stars + parts.name;
    const head = `${indentationOf(field.lines[0])}:${field.name} ${argument}:${rest}`;
    return { ...field, rest, lines: [head, ...field.lines.slice(1)] };
}

/** The :type: field after the update; `newType` is used when there is no :type: field yet. */
function typeFieldFor(
    param: SignatureParam,
    typeField: Field | undefined,
    newType: string | undefined,
    options: FormatOptions,
    base: string,
): Field[] {
    if (typeField === undefined) {
        return newType === undefined ? [] : [makeField("type", `${base}:type ${param.stars}${param.name}: ${newType}`)];
    }
    const existing = typeField.rest.trim();
    const type = typeField.lines.length === 1 ? reconcileParamType(existing, param, options) : existing;
    if (type === existing) {
        return [typeField];
    }
    if (type === undefined) {
        return [];
    }
    const head = `${indentationOf(typeField.lines[0])}:type ${typeField.argument}: ${type}`;
    return [{ ...typeField, rest: " " + type, lines: [head] }];
}

function makeField(kind: FieldKind, line: string): Field {
    const field = readField(line);
    return { kind, ...field, lines: [line] };
}

function addRaises(fields: Field[], exceptions: string[], base: string): Field[] {
    const names = fields.filter((field) => field.kind === "raises").map((field) => field.argument);
    const missing = exceptions.filter((exception) => !isDocumented(exception, names));
    if (missing.length === 0) {
        return fields;
    }
    const added = missing.map((exception) =>
        makeField("raises", `${base}:raises ${exception}: ${descriptionPlaceholder}`),
    );
    const lastRaises = lastIndex(fields, (field) => field.kind === "raises");
    const firstValue = fields.findIndex((field) => ["return", "rtype", "yield"].includes(field.kind));
    const at = lastRaises >= 0 ? lastRaises + 1 : firstValue >= 0 ? firstValue : fields.length;
    return [...fields.slice(0, at), ...added, ...fields.slice(at)];
}

/**
 * Adds a missing :return: or :yield: field (with :rtype: in typed formats) and updates the
 * :rtype: that follows an existing one when the signature annotates it.
 */
function updateValue(
    fields: Field[],
    kind: "return" | "yield",
    value: SignatureValue | undefined,
    options: FormatOptions,
    base: string,
): Field[] {
    const owner = (index: number) => {
        for (let i = index - 1; i >= 0; i--) {
            if (fields[i].kind === "return" || fields[i].kind === "yield") {
                return fields[i].kind;
            }
        }
        return "return";
    };
    const valueField = fields.findIndex((field) => field.kind === kind);
    const rtype = fields.findIndex((field, index) => field.kind === "rtype" && owner(index) === kind);

    if (valueField < 0 && rtype < 0) {
        if (value === undefined) {
            return fields;
        }
        const created = [makeField(kind, `${base}:${kind}: ${descriptionPlaceholder}`)];
        if (options.includeTypes) {
            created.push(makeField("rtype", `${base}:rtype: ${newValueType(value, options)}`));
        }
        const firstYield = fields.findIndex((field) => field.kind === "yield");
        const at = kind === "return" && firstYield >= 0 ? firstYield : fields.length;
        return [...fields.slice(0, at), ...created, ...fields.slice(at)];
    }

    const annotation = valueAnnotation(value, options);
    if (annotation === undefined) {
        return fields;
    }
    if (rtype >= 0) {
        const field = fields[rtype];
        if (field.lines.length > 1 || field.rest.trim() === annotation) {
            return fields;
        }
        const line = `${indentationOf(field.lines[0])}:${field.name}:${field.rest.match(/^\s*/)[0] || " "}${annotation}`;
        return fields.map((f, index) => (index === rtype ? { ...f, rest: " " + annotation, lines: [line] } : f));
    }
    const added = makeField("rtype", `${base}:rtype: ${annotation}`);
    return [...fields.slice(0, valueField + 1), added, ...fields.slice(valueField + 1)];
}

function lastIndex<T>(items: T[], predicate: (item: T) => boolean): number {
    for (let index = items.length - 1; index >= 0; index--) {
        if (predicate(items[index])) {
            return index;
        }
    }
    return -1;
}
