import { arraysEqual } from "./lines";
import { dataclassFields, isDataclass } from "./dataclass";
import {
    DocstringLocation,
    FunctionLocation,
    locateDocstring,
    locateFunction,
    locateInit,
} from "./locate";
import { readSignature } from "./signature";
import { updateGoogle } from "./google";
import { updateNumpy } from "./numpy";
import { updateSphinx } from "./sphinx";
import { FormatOptions, Signature, SignatureParam, UpdateRefusal } from "./types";

export interface UpdateSettings {
    docstringFormat: string;
    customTemplatePath: string;
    guessTypes: boolean;
    /** docstep.includeVariadicArgs: add missing *args and **kwargs. Off unless set. */
    includeVariadicArgs?: boolean;
    /** docstep.detectRenames: carry the description of a parameter renamed in place. Off unless set. */
    detectRenames?: boolean;
}

export type UpdateResult =
    | {
          kind: "edit";
          startLine: number;
          startCharacter: number;
          endLine: number;
          endCharacter: number;
          text: string;
      }
    | { kind: "unchanged"; message: string }
    | { kind: "refused"; message: string };

type FormatUpdater = (
    lines: string[],
    signature: Signature,
    options: FormatOptions,
    indentation: string,
) => string[];

const updaters: Record<string, FormatUpdater> = {
    google: updateGoogle,
    numpy: updateNumpy,
    sphinx: updateSphinx,
};

/**
 * Brings the docstring of the function at `cursorLine` in line with its signature.
 * Returns a single replacement for the docstring literal, or the reason nothing was changed.
 */
export function updateDocstring(
    document: string,
    cursorLine: number,
    settings: UpdateSettings,
): UpdateResult {
    try {
        return update(document, cursorLine, settings);
    } catch (error) {
        if (error instanceof UpdateRefusal) {
            return { kind: "refused", message: error.message };
        }
        throw error;
    }
}

function update(document: string, cursorLine: number, settings: UpdateSettings): UpdateResult {
    if (settings.customTemplatePath !== "") {
        throw new UpdateRefusal(
            "Update Docstring does not support custom templates. Clear docstep.customTemplatePath to use it.",
        );
    }
    const format = settings.docstringFormat;
    const family = format.replace(/-notypes$/, "");
    const updater = updaters[family];
    if (updater === undefined) {
        throw new UpdateRefusal(
            `Update Docstring supports the google, numpy and sphinx formats and their -notypes ` +
                `variants. docstep.docstringFormat is "${format}".`,
        );
    }

    const rawLines = document.split("\n");
    const lines = rawLines.map((line) => line.replace(/\r$/, ""));
    const fn = locateFunction(lines, cursorLine);
    const docstring = locateDocstring(lines, fn);
    const eol = lineEnding(rawLines, docstring);

    const signature =
        fn.kind === "class"
            ? classSignature(lines, fn, docstring)
            : readSignature(lines, fn, docstring);
    const options: FormatOptions = {
        includeTypes: family === format,
        guessTypes: settings.guessTypes,
        includeVariadicArgs: settings.includeVariadicArgs === true,
        detectRenames: settings.detectRenames === true,
    };
    const updated = updater(docstring.lines, signature, options, docstring.indentation);

    if (arraysEqual(updated, docstring.lines)) {
        return {
            kind: "unchanged",
            message: `The docstring of "${fn.name}" is already up to date.`,
        };
    }

    return {
        kind: "edit",
        startLine: docstring.startLine,
        startCharacter: docstring.startCharacter,
        endLine: docstring.endLine,
        endCharacter: docstring.endCharacter,
        text: docstringText(docstring, updated, eol),
    };
}

/**
 * A class docstring documents the constructor's parameters: those of its own __init__, or the
 * fields of a dataclass. What __init__ returns or raises stays in the __init__ docstring.
 */
function classSignature(
    lines: string[],
    cls: FunctionLocation,
    docstring: DocstringLocation,
): Signature {
    const init = locateInit(lines, cls);
    if (init !== undefined) {
        return { params: readSignature(lines, init, docstring).params, exceptions: [] };
    }
    if (isDataclass(lines, cls)) {
        const params = dataclassFields(lines, cls).map((field): SignatureParam =>
            field.default === undefined
                ? {
                      name: field.name,
                      stars: "",
                      kind: "arg",
                      type: field.annotation,
                      annotation: field.annotation,
                  }
                : {
                      name: field.name,
                      stars: "",
                      kind: "kwarg",
                      type: field.annotation,
                      annotation: field.annotation,
                      default: field.default,
                  },
        );
        return { params, exceptions: [] };
    }
    throw new UpdateRefusal(
        `"${cls.name}" has no __init__ and is not a dataclass. Update Docstring fills a class docstring ` +
            "from the __init__ parameters or the dataclass fields.",
    );
}

/** The docstring's own line ending. Mixed endings inside the docstring are refused. */
function lineEnding(rawLines: string[], docstring: DocstringLocation): string {
    const endings = rawLines
        .slice(docstring.startLine, docstring.endLine)
        .map((line) => (line.endsWith("\r") ? "\r\n" : "\n"));
    if (new Set(endings).size > 1) {
        throw new UpdateRefusal(
            "The docstring mixes CRLF and LF line endings. Normalize them first.",
        );
    }
    return endings[0] ?? (rawLines[docstring.startLine].endsWith("\r") ? "\r\n" : "\n");
}

function docstringText(docstring: DocstringLocation, lines: string[], eol: string): string {
    const original = docstring.lines;
    let closing = docstring.closingIndentation;
    const grewAtEnd =
        original.length === 1 || lines[lines.length - 1] !== original[original.length - 1];
    if (closing === undefined && lines.length > 1 && grewAtEnd) {
        closing = docstring.indentation;
    }

    const body = closing === undefined ? lines.join(eol) : lines.join(eol) + eol + closing;
    return docstring.prefix + docstring.quote + body + docstring.quote;
}
