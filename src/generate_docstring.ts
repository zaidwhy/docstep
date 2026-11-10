import * as path from "path";
import * as vs from "vscode";
import { DocstringFactory } from "./docstring/docstring_factory";
import { getCustomTemplate, getTemplate } from "./docstring/get_template";
import { getDocstringIndentation, getDefaultIndentation, parse } from "./parse";
import { getSetting } from "./config";
import { logDebug, logInfo } from "./logger";
import { docstringPartsToString } from "./docstring_parts";

export class AutoDocstring {
    private editor: vs.TextEditor;

    constructor(editor: vs.TextEditor) {
        this.editor = editor;
    }

    public generateDocstring(): Thenable<boolean> {
        if (this.editor == undefined) {
            throw new Error(
                "Cannot process this document. It is either too large or is not yet supported.",
            );
        }

        const position = this.editor.selection.active;
        const document = this.editor.document.getText();
        logInfo(`Generating Docstring at line: ${position.line}`);

        const docstringSnippet = this.generateDocstringSnippet(document, position);
        logInfo(`Docstring generated:\n${docstringSnippet.value}`);

        // The snippet carries its own indentation, so a whitespace-only line is replaced
        // rather than pushed after the closing quotes as trailing whitespace.
        const line = this.editor.document.lineAt(position.line);
        const insertLocation = line.isEmptyOrWhitespace ? line.range : position.with(undefined, 0);
        logInfo(`Inserting at line: ${position.line}`);

        const success = this.editor.insertSnippet(docstringSnippet, insertLocation);

        success.then(
            () => logInfo("Successfully inserted docstring"),
            (reason) => {
                // craft-guard: allow sec-sqli because this builds an error message, no SQL is involved
                throw new Error("Could not insert docstring: " + JSON.stringify(reason));
            },
        );

        return success;
    }

    private generateDocstringSnippet(document: string, position: vs.Position): vs.SnippetString {
        const docstringFactory = new DocstringFactory(
            this.getTemplate(),
            getSetting("quoteStyle").toString(),
            getSetting("startOnNewLine") === true,
            getSetting("includeExtendedSummary") === true,
            getSetting("includeName") === true,
            getSetting("guessTypes") === true,
            getSetting("includeVariadicArgs") === true,
            getSetting("nameReturnValues") === true,
        );
        logDebug(docstringFactory.toString());

        const docstringParts = parse(document, position.line);
        logDebug(docstringPartsToString(docstringParts));
        const defaultIndentation = getDefaultIndentation(
            this.editor.options.insertSpaces as boolean,
            this.editor.options.tabSize as number,
        );
        logDebug(`Default indentation: "${defaultIndentation}"`);
        const indentation = getDocstringIndentation(document, position.line, defaultIndentation);
        logDebug(`Indentation: "${indentation}"`);
        const docstring = docstringFactory.generateDocstring(docstringParts, indentation);

        return new vs.SnippetString(docstring);
    }

    private getTemplate(): string {
        let customTemplatePath = getSetting("customTemplatePath").toString();

        if (customTemplatePath === "") {
            const docstringFormat = getSetting("docstringFormat").toString();
            return getTemplate(docstringFormat);
        }

        if (!path.isAbsolute(customTemplatePath)) {
            customTemplatePath = path.join(vs.workspace.rootPath, customTemplatePath);
        }

        return getCustomTemplate(customTemplatePath);
    }
}
