import * as chai from "chai";
import "mocha";

import { DocstringFactory } from "../../docstring/docstring_factory";
import { getTemplate } from "../../docstring/get_template";
import { parse } from "../../parse";

const expect = chai.expect;

function sectionTitles(format: string): string[] {
    const factory = new DocstringFactory(getTemplate(format), '"""', false, false, false, true, false);
    const source = [
        "def fetch(url: str) -> bytes:",
        "",
        "    if not url:",
        "        raise ValueError(url)",
        "    return b''",
    ].join("\n");
    const docstring = factory.generateDocstring(parse(source, 1), "    ");
    return docstring
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => /^(Args|Returns|Yields|Raises):$/.test(line));
}

describe("google section order", () => {
    for (const format of ["google", "google-notypes"]) {
        it(`should write ${format} sections as Args, Returns, Raises (upstream #244)`, () => {
            expect(sectionTitles(format)).to.deep.equal(["Args:", "Returns:", "Raises:"]);
        });
    }
});
