import * as chai from "chai";
import "mocha";

import { updateDocstring } from "../../update";
import { py, run } from "./helpers";

chai.config.truncateThreshold = 0;
const expect = chai.expect;

function refusal(format: string, source: string, cursorLine = 0): string {
    const result = run(format, source, cursorLine);
    expect(result.kind).to.equal("refused");
    return result.kind === "refused" ? result.message : "";
}

describe("updateDocstring() refusals", () => {
    it("should suggest Generate Docstring when there is no docstring", () => {
        const source = py("def f(a):", "    # note", "    return a");

        expect(refusal("google", source)).to.equal(
            '"f" has no docstring. Run "Generate Docstring" to create one.',
        );
    });

    it("should refuse an empty docstring", () => {
        expect(refusal("google", py("def f(a):", '    """', '    """'))).to.contain("is empty");
    });

    it("should refuse when the cursor is not in a function", () => {
        const source = py("import os", "", "def f(a):", '    """Doc."""', "", "x = 1");

        expect(refusal("google", source, 5)).to.equal(
            "Put the cursor on a def line or inside a function body, then run Update Docstring.",
        );
        expect(refusal("google", source, 0)).to.contain("Put the cursor");
    });

    it("should refuse a class body outside any method", () => {
        const source = py("class A:", '    """Doc."""', "    def f(self):", "        pass", "", "    x = 1");

        expect(refusal("google", source, 5)).to.contain("Put the cursor");
    });

    it("should refuse formats other than google, numpy and sphinx, naming the format", () => {
        const source = py("def f(a):", '    """Doc."""');

        for (const format of ["pep257", "docblockr", "doxygen", "one-line-sphinx", "unknown"]) {
            expect(refusal(format, source)).to.equal(
                "Update Docstring supports the google, numpy and sphinx formats and their -notypes " +
                    `variants. docstep.docstringFormat is "${format}".`,
            );
        }
    });

    it("should refuse when a custom template is configured", () => {
        const result = updateDocstring(py("def f(a):", '    """Doc."""'), 0, {
            docstringFormat: "google",
            customTemplatePath: "my.mustache",
            guessTypes: true,
        });

        expect(result).to.deep.equal({
            kind: "refused",
            message:
                "Update Docstring does not support custom templates. Clear docstep.customTemplatePath to use it.",
        });
    });

    it("should refuse a docstring in another format and name both formats", () => {
        const numpy = py("def f(a):", '    """Doc.', "", "    Parameters", "    ----------", "    a : int", '    """');
        const sphinx = py("def f(a):", '    """Doc.', "", "    :param a: The a.", '    """');
        const google = py("def f(a):", '    """Doc.', "", "    Args:", "        a: The a.", '    """');

        expect(refusal("google", numpy)).to.equal(
            "This docstring looks like numpy format, but docstep.docstringFormat is set to a google format. " +
                "Change the setting or the docstring, then run Update Docstring again.",
        );
        expect(refusal("numpy", sphinx)).to.contain("looks like sphinx format, but docstep.docstringFormat is set to a numpy format");
        expect(refusal("sphinx", google)).to.contain("looks like google format, but docstep.docstringFormat is set to a sphinx format");
        expect(refusal("numpy-notypes", google)).to.contain("is set to a numpy format.");
    });

    it("should refuse mixed formats in one docstring", () => {
        const mixed = py(
            "def f(a, b):",
            '    """Doc.',
            "",
            "    Args:",
            "        a: The a.",
            "",
            "    :param b: The b.",
            '    """',
        );

        expect(refusal("google", mixed)).to.contain("looks like sphinx format");
    });

    it("should refuse pep257, docBlockr and epytext style entries", () => {
        const pep257 = py("def f(a):", '    """Doc.', "", "    Arguments:", "        a -- The a.", '    """');
        const epytext = py("def f(a):", '    """Doc.', "", "    @param a: The a.", '    """');

        expect(refusal("google", pep257)).to.contain("looks like pep257 or docBlockr format");
        expect(refusal("sphinx", epytext)).to.contain("looks like epytext or doxygen format");
    });

    it("should refuse an Args entry it cannot read", () => {
        const source = py("def f(a):", '    """Doc.', "", "    Args:", "        a is the first value", '    """');

        expect(refusal("google", source)).to.equal(
            'Could not read "a is the first value" in the Args section.',
        );
    });

    it("should refuse a section header with text on the same line", () => {
        const source = py("def f(a):", '    """Doc.', "", "    Returns: the value.", '    """', "    return a");

        expect(refusal("google", source)).to.contain('"Returns: the value." puts text on the section header line');
    });

    it("should refuse sections it does not model that hold parameters", () => {
        const google = py("def f(a, b=1):", '    """Doc.', "", "    Keyword Args:", "        b: B.", '    """');
        const numpy = py(
            "def f(a):",
            '    """Doc.',
            "",
            "    Other Parameters",
            "    ----------------",
            "    a : int",
            '    """',
        );

        expect(refusal("google", google)).to.contain('The "Keyword Args" section is not supported');
        expect(refusal("numpy", numpy)).to.contain('The "Other Parameters" section is not supported');
    });

    it("should refuse a parameter documented twice", () => {
        const source = py("def f(a):", '    """Doc.', "", "    Args:", "        a: One.", "        a: Two.", '    """');

        expect(refusal("google", source)).to.equal('"a" is documented twice in the Args section.');
    });

    it("should refuse two sections of the same kind", () => {
        const source = py(
            "def f(a):",
            '    """Doc.',
            "",
            "    Args:",
            "        a: One.",
            "",
            "    Arguments:",
            "        a: Two.",
            '    """',
        );

        expect(refusal("google", source)).to.equal("The docstring has more than one Arguments section.");
    });

    it("should refuse combined numpy entries", () => {
        const source = py(
            "def f(x1, x2):",
            '    """Doc.',
            "",
            "    Parameters",
            "    ----------",
            "    x1, x2 : int",
            "        Values.",
            '    """',
        );

        expect(refusal("numpy", source)).to.equal('Could not read "x1, x2 : int" in the Parameters section.');
    });

    it("should refuse sphinx fields split by text", () => {
        const source = py(
            "def f(a, b):",
            '    """Doc.',
            "",
            "    :param a: A.",
            "",
            "    Some text.",
            "",
            "    :param b: B.",
            '    """',
        );

        expect(refusal("sphinx", source)).to.contain("text between its :param: style fields");
    });

    it("should refuse single quoted, unclosed and same line docstrings", () => {
        expect(refusal("google", py("def f(a):", '    "Doc."'))).to.contain("is not triple quoted");
        expect(refusal("google", py("def f(a):", '    """Doc.', "    return a"))).to.contain("is not closed");
        expect(refusal("google", py("def f(a):", '    """Doc."""; x = 1'))).to.contain(
            "followed by code on the same line",
        );
        expect(refusal("google", py("def f(a): return a"))).to.contain("on the same line as the def");
        const nestedOneLiner = py("def outer(a):", '    """Doc."""', "    def inner(): return 1", "    return inner");
        expect(run("google", nestedOneLiner, 3).kind).to.equal("edit");
    });

    it("should refuse mixed line endings inside the docstring", () => {
        const source = py("def f(a):\r", '    """Doc.\r', "", "    Args:\r", "        b: B.\r", '    """\r');

        expect(refusal("google", source)).to.contain("mixes CRLF and LF");
    });
});
