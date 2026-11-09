import * as vs from "vscode";
import { AutoDocstring } from "./generate_docstring";
import { validEnterActivation } from "./enter_activation";
import { extensionRoot, generateDocstringCommand, extensionID } from "./constants";
import { getStackTrace } from "./telemetry";
import { logInfo, logError } from "./logger";

export function activate(context: vs.ExtensionContext): void {
    extensionRoot.path = context.extensionPath;

    context.subscriptions.push(
        vs.commands.registerCommand(generateDocstringCommand, () => {
            const editor = vs.window.activeTextEditor;
            const autoDocstring = new AutoDocstring(editor);

            try {
                return autoDocstring.generateDocstring();
            } catch (error) {
                const errorString = JSON.stringify(error);
                let stackTrace = "";
                if (error instanceof Error) {
                    stackTrace = "\n\t" + getStackTrace(error);
                }
                return logError(errorString + stackTrace);
            }
        }),
    );

    ["python", "starlark"].map((language) => {
        context.subscriptions.push(
            vs.languages.registerCompletionItemProvider(
                language,
                {
                    provideCompletionItems: (document: vs.TextDocument, position: vs.Position) => {
                        const enabled = vs.workspace
                            .getConfiguration(extensionID)
                            .get("generateDocstringOnEnter");
                        if (
                            validEnterActivation(
                                document.getText(),
                                position.line,
                                position.character,
                                getQuoteStyle(),
                                enabled !== false,
                            )
                        ) {
                            return [new AutoDocstringCompletionItem(document, position)];
                        }
                    },
                },
                '"',
                "'",
                "#",
            ),
        );
    });

    logInfo("autoDocstring was activated");
}

/**
 * This method is called when the extension is deactivated
 */
export function deactivate() {
    return;
}

/**
 * Completion item to trigger generate docstring command on docstring prefix
 */
class AutoDocstringCompletionItem extends vs.CompletionItem {
    constructor(_: vs.TextDocument, position: vs.Position) {
        super("Generate Docstring", vs.CompletionItemKind.Snippet);
        this.insertText = "";
        this.filterText = getQuoteStyle();
        this.sortText = "\0";

        this.range = new vs.Range(new vs.Position(position.line, 0), position);

        this.command = {
            command: generateDocstringCommand,
            title: "Generate Docstring",
        };
    }
}

function getQuoteStyle(): string {
    return vs.workspace.getConfiguration(extensionID).get("quoteStyle").toString();
}
