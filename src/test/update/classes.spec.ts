import * as chai from "chai";
import "mocha";

import { py, run, updated } from "./helpers";

chai.config.truncateThreshold = 0;
const expect = chai.expect;

describe("updateDocstring() on a class", () => {
    const shop = py(
        "class Shop(Base):",
        '    """A shop.',
        "",
        "    Args:",
        "        name (str): Shop name.",
        "        old (int): Gone.",
        '    """',
        "",
        "    def __init__(self, name: str, size=3):",
        "        if size < 0:",
        "            raise ValueError(size)",
        "        self.name = name",
        "",
        "    def open(self):",
        "        return True",
    );

    it("should match the Args section to the __init__ parameters", () => {
        const result = updated("google", shop, 0);

        expect(result).to.contain(
            py(
                "    Args:",
                "        name (str): Shop name.",
                "        size (int, optional): _description_. Defaults to 3.",
                '    """',
            ),
        );
        expect(result).not.to.contain("old (int)");
        expect(result).not.to.contain("Base (");
    });

    it("should not add Raises or Returns from __init__ to the class docstring", () => {
        const result = updated("google", shop, 0);

        expect(result).not.to.contain("Raises:");
        expect(result).not.to.contain("Returns:");
    });

    it("should work with the cursor inside the class docstring", () => {
        expect(updated("google", shop, 4)).to.equal(updated("google", shop, 0));
    });

    it("should update the Parameters section in numpy format", () => {
        const source = py(
            "class Shop:",
            '    """A shop.',
            "",
            "    Parameters",
            "    ----------",
            "    old : int",
            "        Gone.",
            '    """',
            "    def __init__(self, name):",
            "        self.name = name",
        );

        const result = updated("numpy", source, 0);

        expect(result).to.contain("    name : _type_");
        expect(result).not.to.contain("old : int");
    });

    it("should follow a class decorator to the class", () => {
        const source = py(
            "@register",
            "class Shop:",
            '    """A shop."""',
            "    def __init__(self, name):",
            "        self.name = name",
        );

        expect(updated("google", source, 0)).to.contain("        name (_type_): _description_");
    });

    it("should refuse a class without __init__", () => {
        const source = py("@register", "class Point:", '    """A point."""', "    x: int");
        const result = run("google", source, 0);

        expect(result.kind).to.equal("refused");
        expect(result.kind === "refused" ? result.message : "").to.equal(
            '"Point" has no __init__ and is not a dataclass. Update Docstring fills a class docstring ' +
                "from the __init__ parameters or the dataclass fields.",
        );
    });

    it("should still update __init__ itself when the cursor is inside it", () => {
        const source = py(
            "class Shop:",
            '    """A shop."""',
            "    def __init__(self, name):",
            '        """Make a shop.',
            "",
            "        Args:",
            "            old (int): Gone.",
            '        """',
            "        self.name = name",
        );

        const result = updated("google", source, 8);

        expect(result).to.contain("            name (_type_): _description_");
        expect(result).to.contain('    """A shop."""');
    });
});
