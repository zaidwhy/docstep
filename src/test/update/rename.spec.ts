import * as chai from "chai";
import "mocha";

import { updateDocstring } from "../../update";
import { applyResult, py } from "./helpers";

chai.config.truncateThreshold = 0;
const expect = chai.expect;

function update(format: string, source: string, detectRenames = true): string {
    const result = updateDocstring(source, 0, {
        docstringFormat: format,
        customTemplatePath: "",
        guessTypes: true,
        detectRenames,
    });
    if (result.kind !== "edit") {
        throw new Error(`Expected an edit, got ${result.kind}: ${result.message}`);
    }
    return applyResult(source, result);
}

describe("updateDocstring() with docstep.detectRenames (upstream #177)", () => {
    it("should move a google description to the renamed parameter", () => {
        const source = py(
            "def greet(person):",
            '    """Say hello.',
            "",
            "    Args:",
            "        name (str): Who to greet.",
            '    """',
        );

        expect(update("google", source)).to.contain("        person (str): Who to greet.");
    });

    it("should keep every line of a multi-line description on a parameter renamed in the middle", () => {
        const source = py(
            "def send(to, payload, retries=3):",
            '    """Send.',
            "",
            "    Args:",
            "        to: Address.",
            "        body: What to send.",
            "            Bytes or text.",
            "        retries: Attempts.",
            '    """',
        );

        expect(update("google-notypes", source)).to.contain(
            py("        to: Address.", "        payload: What to send.", "            Bytes or text.", "        retries: Attempts."),
        );
    });

    it("should move a numpy description and type to the renamed parameter", () => {
        const source = py(
            "def greet(person):",
            '    """Say hello.',
            "",
            "    Parameters",
            "    ----------",
            "    name : str",
            "        Who to greet.",
            '    """',
        );

        expect(update("numpy", source)).to.contain(py("    person : str", "        Who to greet."));
    });

    it("should rename both the :param: and the :type: field in sphinx", () => {
        const source = py(
            "def greet(person):",
            '    """Say hello.',
            "",
            "    :param name: Who to greet.",
            "    :type name: str",
            '    """',
        );

        expect(update("sphinx", source)).to.contain(py("    :param person: Who to greet.", "    :type person: str"));
    });

    it("should rename a sphinx field with an inline type", () => {
        const source = py(
            "def greet(person):",
            '    """Say hello.',
            "",
            "    :param str name: Who to greet.",
            '    """',
        );

        expect(update("sphinx", source)).to.contain("    :param str person: Who to greet.");
    });

    it("should not guess when two parameters changed", () => {
        const source = py(
            "def greet(first, last):",
            '    """Say hello.',
            "",
            "    Args:",
            "        given: Given name.",
            "        family: Family name.",
            '    """',
        );

        const result = update("google", source);
        expect(result).to.contain("first (_type_): _description_");
        expect(result).to.contain("last (_type_): _description_");
        expect(result).not.to.contain("Given name.");
    });

    it("should not guess when the new parameter sits somewhere else", () => {
        const source = py(
            "def move(x, speed):",
            '    """Move.',
            "",
            "    Args:",
            "        y: Down.",
            "        x: Across.",
            '    """',
        );

        const result = update("google", source);
        expect(result).to.contain("speed (_type_): _description_");
        expect(result).not.to.contain("Down.");
    });

    it("should not move a starred description onto a plain parameter", () => {
        const source = py(
            "def run(task):",
            '    """Run.',
            "",
            "    Args:",
            "        *jobs: Everything to run.",
            '    """',
        );

        expect(update("google", source)).not.to.contain("Everything to run.");
    });

    it("should drop the old entry and add a placeholder when the setting is off", () => {
        const source = py(
            "def greet(person):",
            '    """Say hello.',
            "",
            "    Args:",
            "        name (str): Who to greet.",
            '    """',
        );

        const result = update("google", source, false);
        expect(result).to.contain("person (_type_): _description_");
        expect(result).not.to.contain("Who to greet.");
    });
});
