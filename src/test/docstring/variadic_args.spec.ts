import * as chai from "chai";
import "mocha";

import { DocstringFactory } from "../../docstring/docstring_factory";
import { getTemplate } from "../../docstring/get_template";
import { parse } from "../../parse";

chai.config.truncateThreshold = 0;
const expect = chai.expect;

const formats = [
    "docblockr",
    "doxygen",
    "doxygen-notypes",
    "google",
    "google-notypes",
    "numpy",
    "numpy-notypes",
    "one-line-sphinx",
    "pep257",
    "sphinx",
    "sphinx-notypes",
];

function generate(format: string, signature: string, includeVariadicArgs: boolean): string {
    const factory = new DocstringFactory(
        getTemplate(format),
        '"""',
        false,
        false,
        false,
        true,
        includeVariadicArgs,
    );
    return factory.generateDocstring(parse([signature, "", "    pass"].join("\n"), 1), "    ");
}

describe("docstep.includeVariadicArgs", () => {
    const withStars = "def send(to: str, *args: int, retries=3, **kwargs):";
    const withoutStars = "def send(to: str, retries=3):";

    for (const format of formats) {
        it(`should leave ${format} output unchanged when off`, () => {
            expect(generate(format, withStars, false)).to.equal(
                generate(format, withoutStars, false),
            );
        });

        it(`should list *args and then **kwargs in ${format} when on`, () => {
            const docstring = generate(format, withStars, true);
            const starArgs = docstring.indexOf("*args");
            const starKwargs = docstring.indexOf("**kwargs");

            expect(starArgs, docstring).to.be.greaterThan(-1);
            expect(starKwargs, docstring).to.be.greaterThan(starArgs);
        });
    }

    it("should write google entries like the other arguments", () => {
        const docstring = generate("google", withStars, true);

        expect(docstring).to.contain("        *args (${4:int}): ${5:_description_}");
        expect(docstring).to.contain("        **kwargs (${8:_type_}): ${9:_description_}");
    });

    it("should open the Args section for a function with only **kwargs", () => {
        const docstring = generate("google", "def send(**kwargs):", true);

        expect(docstring).to.contain("    Args:");
        expect(docstring).to.contain("**kwargs");
    });

    it("should document *args of a class __init__", () => {
        const source = [
            "class Pool:",
            "",
            "    def __init__(self, *workers, **options):",
            "        pass",
        ].join("\n");
        const factory = new DocstringFactory(
            getTemplate("google"),
            '"""',
            false,
            false,
            false,
            true,
            true,
        );
        const docstring = factory.generateDocstring(parse(source, 1), "    ");

        expect(docstring).to.contain("*workers");
        expect(docstring).to.contain("**options");
    });
});
