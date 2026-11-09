import * as chai from "chai";
import "mocha";

import { getDocstringIndentation } from "../../parse";

chai.config.truncateThreshold = 0;
const expect = chai.expect;

describe("getDocstringIndentation()", () => {
    it("should return 4 space indentation correctly", () => {
        const result = getDocstringIndentation(fourSpaceIndentation, 4, " ".repeat(4));

        expect(result).to.equal("    ");
    });

    it("should return 2 space indentation correctly", () => {
        const result = getDocstringIndentation(twoSpaceIndentation, 2, " ".repeat(2));

        expect(result).to.equal("  ");
    });

    it("should return 1 tab indentation correctly", () => {
        const result = getDocstringIndentation(oneTabIndentation, 4, "\t");

        expect(result).to.equal("\t");
    });

    it("should return nested indentation correctly", () => {
        const result = getDocstringIndentation(secondLayerIndentation, 2, " ".repeat(4));

        expect(result).to.equal(" ".repeat(8));
    });

    it("should return the correct indentation if there is no body", () => {
        const result = getDocstringIndentation(noBodyIndentation, 2, " ".repeat(4));

        expect(result).to.equal(" ".repeat(4));
    });

    it("should return the correct indentation if there is no body and the function is already indented", () => {
        const result = getDocstringIndentation(noBodyIndentedIndentation, 2, "\t");

        expect(result).to.equal("\t\t");
    });

    describe("when the body indentation differs from the editor tab size (#315)", () => {
        it("should use the body indentation of a function", () => {
            const result = getDocstringIndentation(fourSpaceBodyTabSizeTwo, 2, " ".repeat(2));

            expect(result).to.equal(" ".repeat(4));
        });

        it("should use the body indentation of an async function", () => {
            const result = getDocstringIndentation(asyncFourSpaceBody, 2, " ".repeat(2));

            expect(result).to.equal(" ".repeat(4));
        });

        it("should use the body indentation of a class", () => {
            const result = getDocstringIndentation(classFourSpaceBody, 2, " ".repeat(2));

            expect(result).to.equal(" ".repeat(4));
        });

        it("should use the body indentation of a nested method", () => {
            const result = getDocstringIndentation(nestedFourSpaceBody, 3, " ".repeat(2));

            expect(result).to.equal(" ".repeat(8));
        });

        it("should use the body indentation after a multiline definition", () => {
            const result = getDocstringIndentation(multilineDefinition, 5, " ".repeat(2));

            expect(result).to.equal(" ".repeat(4));
        });

        it("should use the body indentation when the cursor is on the first body line", () => {
            const result = getDocstringIndentation(fourSpaceBodyTabSizeTwo, 3, " ".repeat(2));

            expect(result).to.equal(" ".repeat(4));
        });

        it("should ignore comment lines when finding the body", () => {
            const result = getDocstringIndentation(commentBeforeBody, 2, " ".repeat(2));

            expect(result).to.equal(" ".repeat(4));
        });

        it("should fall back to the default when the next line is not part of the body", () => {
            const result = getDocstringIndentation(emptyBodyFollowedByDef, 2, " ".repeat(2));

            expect(result).to.equal(" ".repeat(2));
        });
    });

    it("should default to default indentation if no indentation is found", () => {
        const result = getDocstringIndentation("", 0, " ".repeat(4));

        expect(result).to.equal(" ".repeat(4));
    });
});

const fourSpaceIndentation = `
    return 3

def basic_function(param1, param2 = abc):

    print("HELLO WORLD")

def something_else():
`;

const twoSpaceIndentation = `
def basic_function(param1, param2 = abc):

  print("HELLO WORLD")

def something_else():
`;

const oneTabIndentation = `
def basic_function(param1, param2 = abc):

\tprint("HELLO WORLD")
\ttry:
\t\tsomething()

def something_else():
`;

const secondLayerIndentation = `
    def basic_function(param1, param2 = abc):

        print("HELLO WORLD")
`;

const noBodyIndentation = `
def basic_function(param1, param2 = abc):

`;

const noBodyIndentedIndentation = `
\tdef basic_function(param1, param2 = abc):

`;

const fourSpaceBodyTabSizeTwo = `
def basic_function(param1, param2 = abc):
  """
    print("HELLO WORLD")
    return 3
`;

const asyncFourSpaceBody = `
async def basic_function(param1):
  """
    await something(param1)
`;

const classFourSpaceBody = `
class Foo(Base):
  """
    attribute = 1
`;

const nestedFourSpaceBody = `
class Foo:
    def method(self, param1):
      """
        return param1
`;

const multilineDefinition = `
def basic_function(
    param1,
    param2,
):
  """
    return param1
`;

const commentBeforeBody = `
def basic_function(param1):
  """
  # a comment at the wrong depth
    return param1
`;

const emptyBodyFollowedByDef = `
def basic_function(param1):
  """

def something_else():
    pass
`;
