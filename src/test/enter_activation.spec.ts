import * as chai from "chai";
import "mocha";

import { validEnterActivation } from "../enter_activation";

const expect = chai.expect;

describe("validEnterActivation()", () => {
    const squareSource = 'def square(side):\n    """\n    return side * side\n';

    it("should activate after an opening docstring prefix", () => {
        const result = validEnterActivation(squareSource, 1, 7, '"""', true);

        expect(result).to.equal(true);
    });

    it("should not activate when generateDocstringOnEnter is false (#312)", () => {
        const result = validEnterActivation(squareSource, 1, 7, '"""', false);

        expect(result).to.equal(false);
    });

    it("should not activate on a line without a docstring prefix", () => {
        const result = validEnterActivation(squareSource, 2, 11, '"""', true);

        expect(result).to.equal(false);
    });
});
