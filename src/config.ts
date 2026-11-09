import * as vs from "vscode";
import { extensionID, legacyExtensionID } from "./constants";
import { readSetting } from "./settings";

/**
 * Reads a `docstep.*` setting, falling back to the user's `autoDocstring.*` value
 * when the `docstep.*` one is unset.
 */
export function getSetting(key: string): unknown {
    return readSetting(
        key,
        vs.workspace.getConfiguration(extensionID),
        vs.workspace.getConfiguration(legacyExtensionID),
    );
}
