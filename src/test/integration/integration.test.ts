import * as chai from "chai";
import fs = require("fs");
import "mocha";
import * as path from "path";
import * as vsc from "vscode";
import { generateDocstringCommand, updateDocstringCommand } from "../../constants";

chai.config.truncateThreshold = 0;
const expect = chai.expect;

/** Extension identifier. */
const identifier = "zaidwhy.docstep";
const settingsIdentifier = "docstep";

describe("Basic Integration Tests", function () {
    this.timeout(30000);

    this.beforeAll(function () {
        expect(vsc.window.showInformationMessage("Start all tests."));
    });

    it("should have installed successfully", () => {
        expect(vsc.extensions.getExtension(identifier)).to.not.equal(undefined);
    });

    it("should not be activated on startup", () => {
        const extension = vsc.extensions.getExtension(identifier);
        expect(extension.isActive).to.equal(false);
    });

    describe("Completion Item", function () {
        const extension = vsc.extensions.getExtension(identifier);
        let document: vsc.TextDocument;
        let editor: vsc.TextEditor;

        beforeEach(async function () {
            const settings = vsc.workspace.getConfiguration(settingsIdentifier);
            await Promise.all([
                settings.update("generateDocstringOnEnter", true, true),
                settings.update("quoteStyle", '"""', true),
            ]);
            await extension.activate();

            document = await vsc.workspace.openTextDocument({ language: "python" });
            editor = await showFocused(document);
        });

        it("will activate the Generate Docstring completion item after triple quotes", async function () {
            await editor.edit((edit) => edit.setEndOfLine(vsc.EndOfLine.LF));

            await editor.edit((edit) => {
                edit.insert(new vsc.Position(0, 0), '\n    """');
            });

            await acceptSuggestion(document);
            expect(document.getText().split('"""')).to.have.length(3);
            expect(document.getText()).to.contain("_summary_");
        });

        it("will activate the Generate Docstring completion item when the body holds a triple quoted string", async function () {
            await editor.edit((edit) => edit.setEndOfLine(vsc.EndOfLine.LF));

            await editor.edit((edit) => {
                edit.insert(
                    new vsc.Position(0, 0),
                    'def greet(name):\n    """\n    text = """hello"""\n    return text',
                );
            });
            editor.selection = new vsc.Selection(new vsc.Position(1, 7), new vsc.Position(1, 7));

            await acceptSuggestion(document);
            // A plain word suggestion can also insert "_summary_"; only the generated docstring closes its quotes.
            expect(document.getText().split('"""')).to.have.length(5);
            expect(document.getText()).to.contain("_summary_");
        });

        it("will activate the Generate Docstring completion item after triple single quotes", async function () {
            const settings = vsc.workspace.getConfiguration(settingsIdentifier);
            await settings.update("quoteStyle", "'''", true);

            await editor.edit((edit) => {
                edit.insert(new vsc.Position(0, 0), "\n    '''");
            });

            await acceptSuggestion(document);
            expect(document.getText().split("'''")).to.have.length(3);
            expect(document.getText()).to.contain("_summary_");
        });

        it("will activate the Generate Docstring completion item if using CRLF line endings", async function () {
            await editor.edit((edit) => edit.setEndOfLine(vsc.EndOfLine.CRLF));

            await editor.edit((edit) => {
                edit.insert(new vsc.Position(0, 0), '\r\n    """');
            });

            await acceptSuggestion(document);
            expect(document.getText().split('"""')).to.have.length(3);
            expect(document.getText()).to.contain("_summary_");
        });
    });

    describe("Docstring Generation", function () {
        const extension = vsc.extensions.getExtension(identifier);

        before(async function () {
            const settings = vsc.workspace.getConfiguration(settingsIdentifier);
            await Promise.all([
                settings.update("docstringFormat", "sphinx", true),
                settings.update("includeExtendedSummary", false, true),
                settings.update("guessTypes", true, true),
                settings.update("quoteStyle", '"""', true),
            ]);

            await extension.activate();
        });

        it("generates a docstring for the function in file 1", async function () {
            await testDocstringGeneration({
                expectedOutputFilePath: path.resolve(
                    __dirname,
                    "./python_test_files/file_1_output.py",
                ),
                inputFilePath: path.resolve(__dirname, "./python_test_files/file_1.py"),
                position: new vsc.Position(2, 0),
            });
        });

        it("generates a docstring using type hints in file 2", async function () {
            await testDocstringGeneration({
                expectedOutputFilePath: path.resolve(
                    __dirname,
                    "./python_test_files/file_2_output.py",
                ),
                inputFilePath: path.resolve(__dirname, "./python_test_files/file_2.py"),
                position: new vsc.Position(8, 0),
            });
        });

        it("ignores the comments in file 3", async function () {
            await testDocstringGeneration({
                expectedOutputFilePath: path.resolve(
                    __dirname,
                    "./python_test_files/file_3_output.py",
                ),
                inputFilePath: path.resolve(__dirname, "./python_test_files/file_3.py"),
                position: new vsc.Position(2, 0),
            });
        });

        it("Deals with type hints split across lines in file 4", async function () {
            await testDocstringGeneration({
                expectedOutputFilePath: path.resolve(
                    __dirname,
                    "./python_test_files/file_4_output.py",
                ),
                inputFilePath: path.resolve(__dirname, "./python_test_files/file_4.py"),
                position: new vsc.Position(6, 0),
            });
        });

        it("Correctly indents docstring for empty function in file 5", async function () {
            await testDocstringGeneration({
                expectedOutputFilePath: path.resolve(
                    __dirname,
                    "./python_test_files/file_5_output.py",
                ),
                inputFilePath: path.resolve(__dirname, "./python_test_files/file_5.py"),
                position: new vsc.Position(8, 0),
            });
        });

        it("Respects the tabbed indentation in the empty function in file 6", async function () {
            await testDocstringGeneration({
                expectedOutputFilePath: path.resolve(
                    __dirname,
                    "./python_test_files/file_6_output.py",
                ),
                inputFilePath: path.resolve(__dirname, "./python_test_files/file_6.py"),
                position: new vsc.Position(4, 0),
            });
        });

        it("generates a docstring using PEP 604 style type hints in file 7", async function () {
            await testDocstringGeneration({
                expectedOutputFilePath: path.resolve(
                    __dirname,
                    "./python_test_files/file_7_output.py",
                ),
                inputFilePath: path.resolve(__dirname, "./python_test_files/file_7.py"),
                position: new vsc.Position(8, 0),
            });
        });

        it("generates a docstring for the starlark function", async function () {
            await testDocstringGeneration({
                expectedOutputFilePath: path.resolve(
                    __dirname,
                    "./python_test_files/file_starlark_output.sky",
                ),
                inputFilePath: path.resolve(__dirname, "./python_test_files/file_starlark.sky"),
                position: new vsc.Position(2, 0),
            });
        });

        it("generates a docstring for the bazel macro", async function () {
            await testDocstringGeneration({
                expectedOutputFilePath: path.resolve(
                    __dirname,
                    "./python_test_files/file_bazel_output.bzl",
                ),
                inputFilePath: path.resolve(__dirname, "./python_test_files/file_bazel.bzl"),
                position: new vsc.Position(2, 0),
            });
        });
    });

    describe("Google Docstring Generation", function () {
        before(async function () {
            await vsc.workspace
                .getConfiguration(settingsIdentifier)
                .update("docstringFormat", "google", true);
        });

        after(async function () {
            await vsc.workspace
                .getConfiguration(settingsIdentifier)
                .update("docstringFormat", "sphinx", true);
        });

        it("leaves the blank lines between sections empty", async function () {
            const document = await vsc.workspace.openTextDocument({
                language: "python",
                content:
                    "def pick(mode: int = 1) -> str:\n\n    if mode:\n        raise ValueError()\n    return str(mode)\n",
            });
            const editor = await showFocused(document);
            editor.selection = new vsc.Selection(new vsc.Position(1, 0), new vsc.Position(1, 0));

            expect(await vsc.commands.executeCommand(generateDocstringCommand)).to.equal(true);

            const text = editor.document.getText();
            expect(text).to.contain("Raises:");
            expect(text.split("\n").filter((line) => /^[ \t]+$/.test(line))).to.deep.equal([]);
        });

        it("lists *args and **kwargs only when includeVariadicArgs is on", async function () {
            const settings = vsc.workspace.getConfiguration(settingsIdentifier);
            const generateFor = async () => {
                const document = await vsc.workspace.openTextDocument({
                    language: "python",
                    content: "def send(to, *args, **kwargs):\n\n    pass\n",
                });
                const editor = await showFocused(document);
                editor.selection = new vsc.Selection(
                    new vsc.Position(1, 0),
                    new vsc.Position(1, 0),
                );
                expect(await vsc.commands.executeCommand(generateDocstringCommand)).to.equal(true);
                return document.getText().split('"""')[1];
            };

            expect(await generateFor()).not.to.contain("*args");

            await settings.update("includeVariadicArgs", true, true);
            try {
                const docstring = await generateFor();
                expect(docstring).to.contain("*args (_type_): _description_");
                expect(docstring).to.contain("**kwargs (_type_): _description_");
            } finally {
                await settings.update("includeVariadicArgs", undefined, true);
            }
        });

        it("leaves no trailing whitespace when the cursor is indented on a blank line", async function () {
            const document = await vsc.workspace.openTextDocument({
                language: "python",
                content: "def pick(mode):\n    \n    return mode\n",
            });
            const editor = await showFocused(document);
            editor.selection = new vsc.Selection(new vsc.Position(1, 4), new vsc.Position(1, 4));

            expect(await vsc.commands.executeCommand(generateDocstringCommand)).to.equal(true);

            const text = editor.document.getText();
            expect(text).to.contain("_summary_");
            expect(text.split("\n").filter((line) => /[ \t]$/.test(line))).to.deep.equal([]);
        });
    });

    describe("Jupyter Notebook", function () {
        it("generates a docstring inside a notebook code cell", async function () {
            const notebook = await vsc.workspace.openNotebookDocument(
                "jupyter-notebook",
                new vsc.NotebookData([
                    new vsc.NotebookCellData(
                        vsc.NotebookCellKind.Code,
                        "def pick(mode: int):\n\n    return mode",
                        "python",
                    ),
                ]),
            );
            await vsc.commands.executeCommand("vscode.open", notebook.uri);
            await vsc.commands.executeCommand("notebook.cell.edit");
            await waitFor(
                () => vsc.window.activeTextEditor?.document.uri.scheme === "vscode-notebook-cell",
                5000,
            );
            const editor = vsc.window.activeTextEditor;
            expect(editor.document.uri.scheme).to.equal("vscode-notebook-cell");
            editor.selection = new vsc.Selection(new vsc.Position(1, 0), new vsc.Position(1, 0));

            expect(await vsc.commands.executeCommand(generateDocstringCommand)).to.equal(true);
            expect(notebook.cellAt(0).document.getText()).to.contain(":param mode:");
        });
    });

    describe("Module Docstring Generation", function () {
        it("does not indent a module docstring", async function () {
            await testDocstringGeneration({
                expectedOutputFilePath: path.resolve(
                    __dirname,
                    "./python_test_files/file_module_output.py",
                ),
                inputFilePath: path.resolve(__dirname, "./python_test_files/file_module.py"),
                position: new vsc.Position(1, 0),
            });
        });
    });

    describe("Class Docstring Generation", function () {
        it("documents the fields of a dataclass", async function () {
            await testDocstringGeneration({
                expectedOutputFilePath: path.resolve(
                    __dirname,
                    "./python_test_files/file_dataclass_output.py",
                ),
                inputFilePath: path.resolve(__dirname, "./python_test_files/file_dataclass.py"),
                position: new vsc.Position(2, 0),
            });
        });

        it("documents the __init__ parameters, not the base classes", async function () {
            await testDocstringGeneration({
                expectedOutputFilePath: path.resolve(
                    __dirname,
                    "./python_test_files/file_class_output.py",
                ),
                inputFilePath: path.resolve(__dirname, "./python_test_files/file_class.py"),
                position: new vsc.Position(1, 0),
            });
        });
    });

    describe("Docstring Update", function () {
        const extension = vsc.extensions.getExtension(identifier);

        before(async function () {
            const settings = vsc.workspace.getConfiguration(settingsIdentifier);
            await Promise.all([
                settings.update("docstringFormat", "google", true),
                settings.update("guessTypes", true, true),
            ]);

            await extension.activate();
        });

        it("updates a function docstring to its signature", async function () {
            await testDocstringUpdate({
                expectedOutputFilePath: path.resolve(
                    __dirname,
                    "./python_test_files/update_function_output.py",
                ),
                inputFilePath: path.resolve(__dirname, "./python_test_files/update_function.py"),
                position: new vsc.Position(4, 0),
            });
        });

        it("updates a class docstring from __init__ with the cursor on its decorator", async function () {
            await testDocstringUpdate({
                expectedOutputFilePath: path.resolve(
                    __dirname,
                    "./python_test_files/update_class_output.py",
                ),
                inputFilePath: path.resolve(__dirname, "./python_test_files/update_class.py"),
                position: new vsc.Position(0, 0),
            });
        });
    });
});

async function testDocstringUpdate(testCase: TestCase) {
    const inputDocument = await vsc.workspace.openTextDocument(testCase.inputFilePath);
    const expectedOutput = fs.readFileSync(testCase.expectedOutputFilePath, "utf8");

    const editor = await showFocused(inputDocument);
    editor.selection = new vsc.Selection(testCase.position, testCase.position);

    const success = await vsc.commands.executeCommand(updateDocstringCommand);
    expect(success).to.equal(true);
    expect(editor.document.getText()).to.equal(expectedOutput);

    // One undo must restore the original: the update is a single edit.
    await vsc.commands.executeCommand("undo");
    expect(editor.document.getText()).to.equal(fs.readFileSync(testCase.inputFilePath, "utf8"));
}

async function testDocstringGeneration(testCase: TestCase) {
    const inputDocument = await vsc.workspace.openTextDocument(testCase.inputFilePath);
    const expectedOutput = fs.readFileSync(testCase.expectedOutputFilePath, "utf8");

    const editor = await showFocused(inputDocument);
    editor.selection = new vsc.Selection(testCase.position, testCase.position);

    const success = await vsc.commands.executeCommand(generateDocstringCommand);
    expect(success).to.equal(true);

    const documentText = editor.document.getText();
    expect(documentText).to.equal(expectedOutput);
}

interface TestCase {
    inputFilePath: string;
    position: vsc.Position;
    expectedOutputFilePath: string;
}

/**
 * Shows `document` and waits until it is the active editor. The commands act on the active
 * editor, and a notebook cell editor from an earlier test can keep that role for a moment.
 */
async function showFocused(document: vsc.TextDocument): Promise<vsc.TextEditor> {
    const editor = await vsc.window.showTextDocument(document);
    const focused = await waitFor(() => vsc.window.activeTextEditor?.document === document, 5000);
    expect(focused, "the document never became the active editor").to.equal(true);
    return editor;
}

/**
 * Opens the suggest widget and accepts the top suggestion, then waits for the docstring.
 * The widget fills asynchronously, so an early accept is a no-op and is repeated until the
 * document changes; a fixed wait instead let a late accept land in the next test's editor.
 */
async function acceptSuggestion(document: vsc.TextDocument): Promise<void> {
    const before = document.getText();
    await vsc.commands.executeCommand("editor.action.triggerSuggest");
    const deadline = Date.now() + 5000;
    while (document.getText() === before && Date.now() < deadline) {
        await vsc.commands.executeCommand("acceptSelectedSuggestion");
        await waitFor(() => document.getText() !== before, 100);
    }
    await waitFor(() => document.getText().includes("_summary_"), deadline - Date.now());
}

/** Polls `condition` every 20 ms until it holds or `timeout` ms pass. Returns whether it held. */
async function waitFor(condition: () => boolean, timeout: number): Promise<boolean> {
    const deadline = Date.now() + timeout;
    while (!condition()) {
        if (Date.now() >= deadline) {
            return false;
        }
        await delay(20);
    }
    return true;
}

function delay(timeout: number) {
    return new Promise<void>((resolve) => {
        setTimeout(resolve, timeout);
    });
}
