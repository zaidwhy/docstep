import * as chai from "chai";
import "mocha";

import { updateDocstring } from "../../update";
import { applyResult, py } from "./helpers";

chai.config.truncateThreshold = 0;
const expect = chai.expect;

function update(format: string, source: string, includeVariadicArgs: boolean): string {
    const result = updateDocstring(source, 0, {
        docstringFormat: format,
        customTemplatePath: "",
        guessTypes: true,
        includeVariadicArgs,
    });
    return result.kind === "edit" ? applyResult(source, result) : source;
}

describe("updateDocstring() with docstep.includeVariadicArgs", () => {
    const google = py(
        "def call(fn, *args: int, flag=False, **kwargs):",
        '    """Call fn.',
        "",
        "    Args:",
        "        fn (_type_): The target.",
        '    """',
    );

    it("should add missing *args and **kwargs in signature order when on", () => {
        expect(update("google", google, true)).to.contain(
            py(
                "    Args:",
                "        fn (_type_): The target.",
                "        *args (int): _description_",
                "        flag (bool, optional): _description_. Defaults to False.",
                "        **kwargs (_type_): _description_",
            ),
        );
    });

    it("should not add them when off", () => {
        const docstring = update("google", google, false).split('"""')[1];

        expect(docstring).to.contain("flag (bool, optional)");
        expect(docstring).not.to.contain("*args");
        expect(docstring).not.to.contain("**kwargs");
    });

    it("should add them in numpy format when on", () => {
        const numpy = py(
            "def call(fn, *args, **kwargs):",
            '    """Call fn.',
            "",
            "    Parameters",
            "    ----------",
            "    fn : _type_",
            "        The target.",
            '    """',
        );

        const result = update("numpy", numpy, true);

        expect(result).to.contain(py("    *args : _type_", "        _description_"));
        expect(result).to.contain(py("    **kwargs : _type_", "        _description_"));
    });

    it("should add them in sphinx format when on", () => {
        const sphinx = py(
            "def call(fn, *args: int, **kwargs):",
            '    """Call fn.',
            "",
            "    :param fn: The target.",
            '    """',
        );

        const result = update("sphinx", sphinx, true);

        expect(result).to.contain(py("    :param *args: _description_", "    :type *args: int"));
        expect(result).to.contain(
            py("    :param **kwargs: _description_", "    :type **kwargs: _type_"),
        );
    });

    it("should keep a documented *args description when on", () => {
        const documented = py(
            "def call(fn, *args):",
            '    """Call fn.',
            "",
            "    Args:",
            "        fn (_type_): The target.",
            "        *args: Positional values.",
            '    """',
        );

        expect(update("google", documented, true)).to.contain("        *args: Positional values.");
    });
});
