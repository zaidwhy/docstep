import * as chai from "chai";
import "mocha";

import { docstringIsClosed, parse } from "../../parse";
import { py, run, updated } from "./helpers";

chai.config.truncateThreshold = 0;
const expect = chai.expect;

describe("updateDocstring() on unusual constructors", () => {
    it("should keep a # inside a string default of a dataclass field", () => {
        const source = py(
            "@dataclass",
            "class Tag:",
            '    """A tag."""',
            '    label: str = "x # y"  # shown',
        );

        expect(updated("google", source, 1)).to.contain('Defaults to "x # y".');
    });

    it("should read the real __init__, not an @overload stub before it", () => {
        const source = py(
            "class Point:",
            '    """A point."""',
            "    @overload",
            "    def __init__(self, a: int): ...",
            "    @overload",
            "    def __init__(self, a: str, b: str): ...",
            "    def __init__(self, a, b=None):",
            "        self.a = a",
        );

        const result = updated("google", source, 0);

        expect(result).to.contain("        a (_type_): _description_");
        expect(result).to.contain("        b (_type_, optional): _description_. Defaults to None.");
        expect(result).not.to.contain("a (int)");
    });

    it("should refuse a one-line __init__ instead of calling the docstring up to date", () => {
        const source = py("class Point:", '    """A point."""', "    def __init__(self, a): pass");
        const result = run("google", source, 0);

        expect(result.kind).to.equal("refused");
    });

    it("should not document the fields of @dataclass(init=False)", () => {
        const source = py(
            "@dataclass(init=False)",
            "class Point:",
            '    """A point."""',
            "    a: int",
        );
        const result = run("google", source, 1);

        expect(result.kind).to.equal("refused");
        expect(
            parse(py("@dataclass(init=False)", "class Point:", "", "    a: int"), 2).args,
        ).to.deep.equal([]);
    });
});

describe("docstringIsClosed() on prose before closing quotes", () => {
    it("should see prose ending in return before the closing quotes as a closing line", () => {
        const compute = py(
            "def compute():",
            '    """',
            '    and the thing to return"""',
            "    return 1",
        );

        expect(docstringIsClosed(compute, 1, 7, '"""')).to.equal(true);
    });

    it("should see prose ending in a colon before the closing quotes as a closing line", () => {
        const compute = py(
            "def compute():",
            '    """',
            '    Example: f() -> 1. See:"""',
            "    return 1",
        );

        expect(docstringIsClosed(compute, 1, 7, '"""')).to.equal(true);
    });
});
