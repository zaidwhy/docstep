import { indentationOf, isBlank } from "./lines";
import { UpdateRefusal } from "./types";

export type FormatFamily = "google" | "numpy" | "sphinx";

const sphinxField =
    /^:(param|parameter|arg|argument|key|keyword|type|raises?|except|exception|returns?|rtype|yields?)\b[^:]*:/;
const googleHeader =
    /^(Args|Arguments|Parameters|Params|Keyword Args|Keyword Arguments|Returns?|Yields?|Raises?):\s*$/;
const epytextField = /^[@\\](param|type|return|returns|rtype|raise|raises|throws)\b/;
const arrowEntry = /^\*{0,2}\w+(\s*\{[^}]*\})?\s+--\s/;

/**
 * Refuses when the docstring carries markers of a format other than the configured one,
 * naming what was found, so a mixed or mis-configured docstring is never rewritten.
 */
export function refuseForeignFormat(lines: string[], configured: FormatFamily): void {
    const found = detectFormats(lines).filter((format) => format !== configured);
    if (found.length > 0) {
        throw new UpdateRefusal(
            `This docstring looks like ${found.join(" and ")} format, but docstep.docstringFormat ` +
                `is set to a ${configured} format. Change the setting or the docstring, then run Update Docstring again.`,
        );
    }
}

function detectFormats(lines: string[]): string[] {
    const found = new Set<string>();

    lines.forEach((line, index) => {
        const text = line.trim();
        const next = lines[index + 1];

        if (sphinxField.test(text)) {
            found.add("sphinx");
        }
        if (epytextField.test(text)) {
            found.add("epytext or doxygen");
        }
        if (
            index >= 1 &&
            text !== "" &&
            next !== undefined &&
            /^-{3,}$/.test(next.trim()) &&
            indentationOf(next).length === indentationOf(line).length
        ) {
            found.add("numpy");
        }
        if (index >= 1 && googleHeader.test(text)) {
            const entry = firstIndentedLine(lines, index);
            if (entry !== undefined && arrowEntry.test(entry.trim())) {
                found.add("pep257 or docBlockr");
            } else if (entry !== undefined) {
                found.add("google");
            }
        }
    });

    return [...found];
}

/** First non-blank line after `index` if it is indented deeper than the header line. */
function firstIndentedLine(lines: string[], index: number): string | undefined {
    const headerIndentation = indentationOf(lines[index]).length;
    for (const line of lines.slice(index + 1)) {
        if (isBlank(line)) {
            continue;
        }
        return indentationOf(line).length > headerIndentation ? line : undefined;
    }
    return undefined;
}
