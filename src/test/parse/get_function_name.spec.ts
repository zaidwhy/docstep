import * as chai from "chai";
import "mocha";

import { getFunctionName } from "../../parse";

chai.config.truncateThreshold = 0;
const expect = chai.expect;

describe("getFunctionName()", () => {
    it("should get the function definition from a function", () => {
        const functionDefinition = 'def Func1_3(argument, kwarg="abc"):';
        const result = getFunctionName(functionDefinition);

        expect(result).to.eql("Func1_3");
    });

    it("should get the function definition from a function with weird spacing", () => {
        const functionDefinition = 'def  area  (argument, kwarg="abc"):';
        const result = getFunctionName(functionDefinition);

        expect(result).to.eql("area");
    });

    it("should get the function name from a generic function (PEP 695)", () => {
        const functionDefinition = "def first[T](items: list[T]) -> T:";
        const result = getFunctionName(functionDefinition);

        expect(result).to.eql("first");
    });

    it("should get the function name with TypeVarTuple and ParamSpec parameters", () => {
        const functionDefinition = "def call[*Ts, **P](target: Callable[P, None], *args: *Ts):";
        const result = getFunctionName(functionDefinition);

        expect(result).to.eql("call");
    });
});
