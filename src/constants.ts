// Will be set in extension activation.
type ExtensionRoot = { path?: string };
export const extensionRoot: ExtensionRoot = { path: "" };

export const debug = false;
export const extensionID = "docstep";
export const legacyExtensionID = "autoDocstring";
export const generateDocstringCommand = "docstep.generateDocstring";
export const updateDocstringCommand = "docstep.updateDocstring";
