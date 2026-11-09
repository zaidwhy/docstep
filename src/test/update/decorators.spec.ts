import * as chai from "chai";
import "mocha";

import { py, run, updated } from "./helpers";

chai.config.truncateThreshold = 0;
const expect = chai.expect;

describe("updateDocstring() with the cursor on a decorator", () => {
    const nested = py(
        "def outer(x):",
        '    """Outer.',
        "",
        "    Args:",
        "        x (_type_): Outer arg.",
        '    """',
        "    @cache",
        "    def inner(y):",
        '        """Inner.',
        "",
        "        Args:",
        "            old (_type_): Gone.",
        '        """',
        "        return y",
        "    return inner",
    );

    it("should update the decorated function, not the one around it", () => {
        const result = updated("google", nested, 6);

        expect(result).to.contain("            y (_type_): _description_");
        expect(result).not.to.contain("old (_type_)");
        expect(result).to.contain("        x (_type_): Outer arg.");
    });

    it("should follow a multi-line decorator and stacked decorators to the def", () => {
        const source = py(
            "class Api:",
            "    @route(",
            '        "/items",',
            '        methods=["GET"],',
            "    )",
            "    # cached for a minute",
            "    @cache(60)",
            "    def items(self, page):",
            '        """List items."""',
            "        return []",
        );

        for (const cursorLine of [1, 2, 4, 6]) {
            expect(updated("google", source, cursorLine)).to.contain("            page (_type_): _description_");
        }
    });

    it("should refuse a decorator that decorates a class", () => {
        const source = py("@dataclass", "class Point:", "    x: int");
        const result = run("google", source, 0);

        expect(result.kind).to.equal("refused");
        expect(result.kind === "refused" ? result.message : "").to.equal(
            "The decorator under the cursor does not decorate a function.",
        );
    });
});
