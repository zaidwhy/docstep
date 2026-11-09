import * as chai from "chai";
import "mocha";

import { py, run, updated } from "./helpers";

chai.config.truncateThreshold = 0;
const expect = chai.expect;

describe("updateDocstring() on a dataclass", () => {
    const point = py(
        "@dataclass(frozen=True)",
        "class Point:",
        '    """A point.',
        "",
        "    Args:",
        "        x (int): Across.",
        "        gone (str): Removed.",
        '    """',
        "",
        "    x: int",
        "    y: int = 0",
        "    tags: list[str] = field(default_factory=list)",
        "    cache: dict = field(init=False, default_factory=dict)",
        "    count: ClassVar[int] = 0",
        "    seed: InitVar[int] = 1",
        "",
        "    def norm(self) -> float:",
        "        return 0.0",
    );

    it("should document the fields __init__ takes, in order", () => {
        const result = updated("google", point, 1);

        expect(result).to.contain(
            py(
                "    Args:",
                "        x (int): Across.",
                "        y (int, optional): _description_. Defaults to 0.",
                "        tags (list[str], optional): _description_. Defaults to list().",
                "        seed (int, optional): _description_. Defaults to 1.",
                '    """',
            ),
        );
        expect(result).not.to.contain("gone (str)");
        expect(result).not.to.contain("cache (");
        expect(result).not.to.contain("count (");
    });

    it("should prefer an __init__ written in the class", () => {
        const source = py(
            "@dataclasses.dataclass(init=False)",
            "class Point:",
            '    """A point."""',
            "    x: int",
            "    def __init__(self, raw: str):",
            "        self.x = int(raw)",
        );

        const result = updated("google", source, 1);

        expect(result).to.contain("        raw (str): _description_");
        expect(result).not.to.contain("x (int)");
    });

    it("should skip fields after a KW_ONLY marker only as markers", () => {
        const source = py(
            "@dataclass",
            "class Point:",
            '    """A point."""',
            "    x: int",
            "    _: KW_ONLY",
            "    y: int = 0",
        );

        const result = updated("google", source, 1);

        expect(result).to.contain("        x (int): _description_");
        expect(result).to.contain("        y (int, optional): _description_. Defaults to 0.");
        expect(result).not.to.contain("_ (KW_ONLY)");
    });

    it("should refuse a plain class with fields but no __init__", () => {
        const source = py("class Point:", '    """A point."""', "    x: int");
        const result = run("google", source, 0);

        expect(result.kind === "refused" ? result.message : result.kind).to.equal(
            '"Point" has no __init__ and is not a dataclass. Update Docstring fills a class docstring ' +
                "from the __init__ parameters or the dataclass fields.",
        );
    });
});
