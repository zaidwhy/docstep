import * as vs from "vscode";
import { getSetting } from "./config";
import { logInfo } from "./logger";
import { updateDocstring } from "./update";

/**
 * Runs Update Docstring on the function or class under the cursor. The whole change is applied as
 * one WorkspaceEdit, so a single undo reverts it.
 */
export function updateDocstringAtCursor(editor: vs.TextEditor | undefined): Thenable<boolean> {
    if (editor == undefined) {
        throw new Error("Cannot process this document. It is either too large or is not yet supported.");
    }

    const document = editor.document;
    const line = editor.selection.active.line;
    logInfo(`Updating docstring at line: ${line}`);

    const result = updateDocstring(document.getText(), line, {
        docstringFormat: getSetting("docstringFormat").toString(),
        customTemplatePath: getSetting("customTemplatePath").toString(),
        guessTypes: getSetting("guessTypes") === true,
    });

    if (result.kind !== "edit") {
        logInfo(`Docstring not updated: ${result.message}`);
        if (result.kind === "refused") {
            void vs.window.showWarningMessage(`Docstep: ${result.message}`);
        } else {
            void vs.window.showInformationMessage(`Docstep: ${result.message}`);
        }
        return Promise.resolve(false);
    }

    const edit = new vs.WorkspaceEdit();
    const range = new vs.Range(result.startLine, result.startCharacter, result.endLine, result.endCharacter);
    edit.replace(document.uri, range, result.text);

    return vs.workspace.applyEdit(edit).then((success) => {
        logInfo(success ? "Successfully updated docstring" : "Could not apply the docstring update");
        return success;
    });
}
