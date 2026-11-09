import * as chai from "chai";
import "mocha";

import { py, updated } from "./helpers";

chai.config.truncateThreshold = 0;
const expect = chai.expect;

describe("updateDocstring() with body lines indented less than the def", () => {
    const docstring = ['    """Load.', "", "    Args:", "        old (_type_): Gone.", '    """'];

    it("should keep a multi-line string at column 0 inside the function", () => {
        const source = py(
            "def load(path):",
            ...docstring,
            '    query = """',
            "SELECT *",
            "FROM t",
            '"""',
            "    return query",
        );

        expect(updated("google", source, 10)).to.contain("        path (_type_): _description_");
    });

    it("should keep a comment at column 0 inside the function", () => {
        const source = py("def load(path):", ...docstring, "# debug", "    return path");

        expect(updated("google", source, 7)).to.contain("        path (_type_): _description_");
    });

    it("should keep bracket and backslash continuations at column 0 inside the function", () => {
        const source = py(
            "def load(path):",
            ...docstring,
            "    items = [",
            "1,",
            "]",
            "    total = 1 + \\",
            "2",
            "    return path",
        );

        expect(updated("google", source, 11)).to.contain("        path (_type_): _description_");
    });
});

describe("updateDocstring() with a def inside a string", () => {
    it("should update the function around the string, not the def written in it", () => {
        const source = py(
            "def outer(x):",
            '    """Outer.',
            "",
            "    Args:",
            "        old (int): Gone.",
            '    """',
            '    template = """',
            "def fake(y):",
            "    pass",
            '"""',
            "    return template",
        );

        const result = updated("google", source, 8);

        expect(result).to.contain("        x (_type_): _description_");
        expect(result).not.to.contain("old (int)");
    });
});
