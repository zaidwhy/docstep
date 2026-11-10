import * as chai from "chai";
import "mocha";

import { DocstringFactory } from "../../docstring/docstring_factory";
import { getTemplate } from "../../docstring/get_template";
import { parse } from "../../parse";
import { updateDocstring } from "../../update";

chai.config.truncateThreshold = 0;
const expect = chai.expect;

function returnsSection(format: string, source: string[], nameReturnValues = true): string[] {
    const factory = new DocstringFactory(
        getTemplate(format),
        '"""',
        false,
        false,
        false,
        true,
        false,
        nameReturnValues,
    );
    const docstring = factory.generateDocstring(parse(source.join("\n"), 1), "");
    const lines = docstring.split("\n");
    const start = lines.indexOf("Returns");
    return start < 0
        ? []
        : lines
              .slice(start + 2, lines.length - 1)
              .map((line) => line.replace(/\$\{\d+:([^}]*)\}/g, "$1"));
}

describe("docstep.nameReturnValues (upstream #62)", () => {
    const stats = [
        "def stats(values) -> tuple[float, list[int]]:",
        "",
        "    mean = 0.0",
        "    return mean, spread",
    ];

    it("should give each returned name its own numpy entry, typed from the tuple annotation", () => {
        expect(returnsSection("numpy", stats)).to.deep.equal([
            "mean : float",
            "    _description_",
            "spread : list[int]",
            "    _description_",
        ]);
    });

    it("should use the type placeholder when the annotation does not match the names", () => {
        const source = ["def split(text):", "", "    return (head, tail)"];

        expect(returnsSection("numpy", source)).to.deep.equal([
            "head : _type_",
            "    _description_",
            "tail : _type_",
            "    _description_",
        ]);
    });

    it("should list names without types in numpy-notypes", () => {
        expect(returnsSection("numpy-notypes", stats)).to.deep.equal([
            "mean",
            "    _description_",
            "spread",
            "    _description_",
        ]);
    });

    it("should keep one entry when the return statements disagree", () => {
        const source = [
            "def pick(flag):",
            "",
            "    if flag:",
            "        return a, b",
            "    return None",
        ];

        expect(returnsSection("numpy", source)).to.deep.equal(["_type_", "    _description_"]);
    });

    it("should keep one entry when the setting is off", () => {
        expect(returnsSection("numpy", stats, false)).to.deep.equal([
            "tuple[float, list[int]]",
            "    _description_",
        ]);
    });

    it("should leave named numpy Returns entries alone in Update Docstring", () => {
        const returns = [
            "    mean : float",
            "        Average.",
            "    spread : list[int]",
            "        Range.",
        ];
        const source = [
            "def stats(values, limit) -> tuple[float, list[int]]:",
            '    """Summarise.',
            "",
            "    Parameters",
            "    ----------",
            "    values : list",
            "        Input.",
            "",
            "    Returns",
            "    -------",
            ...returns,
            '    """',
            "    return mean, spread",
        ].join("\n");

        const result = updateDocstring(source, 0, {
            docstringFormat: "numpy",
            customTemplatePath: "",
            guessTypes: true,
        });
        expect(result.kind).to.equal("edit");
        expect(result.kind === "edit" ? result.text : "").to.contain(returns.join("\n"));
    });
});
