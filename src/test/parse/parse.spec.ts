import * as chai from "chai";
import "mocha";

import { parse } from "../../parse";

chai.config.truncateThreshold = 0;
const expect = chai.expect;

describe("parse() on a function", () => {
    it("should keep the arguments and return when the return type nests a forward reference", () => {
        const document = ['def build(value: "str") -> List["Node"]:', "    ", "    pass"].join("\n");

        const parts = parse(document, 1);

        expect(parts.args).to.deep.equal([{ var: "value", type: "str" }]);
        expect(parts.returns).to.deep.equal({ type: 'List["Node"]' });
    });
});

describe("parse() on a class", () => {
    it("should take the arguments from __init__, not the base classes", () => {
        const document = [
            "class Shop(Base, Mixin):",
            '    """',
            "",
            "    def __init__(self, name: str, size=3):",
            "        if size < 0:",
            "            raise ValueError(size)",
            "",
            "    def total(self):",
            "        return 1",
        ].join("\n");

        const parts = parse(document, 1);

        expect(parts.name).to.equal("Shop");
        expect(parts.args).to.deep.equal([{ var: "name", type: "str" }]);
        expect(parts.kwargs).to.deep.equal([{ var: "size", default: "3", type: "int" }]);
        expect(parts.exceptions).to.deep.equal([]);
        expect(parts.returns).to.equal(undefined);
    });

    it("should have no arguments when the class has no __init__", () => {
        const document = ["@register", "class Point(Base):", "", "    x: int"].join("\n");

        expect(parse(document, 2).args).to.deep.equal([]);
    });

    it("should take the arguments of a dataclass from its fields", () => {
        const document = [
            "@dataclass",
            "class Point:",
            "",
            "    x: int",
            "    y: float = 0.5",
            "    count: ClassVar[int] = 0",
        ].join("\n");

        const parts = parse(document, 2);

        expect(parts.args).to.deep.equal([{ var: "x", type: "int" }]);
        expect(parts.kwargs).to.deep.equal([{ var: "y", default: "0.5", type: "float" }]);
    });

    it("should leave function parsing unchanged", () => {
        const document = ["def fetch(url: str):", "", "    return url"].join("\n");

        expect(parse(document, 1).args).to.deep.equal([{ var: "url", type: "str" }]);
    });
});
