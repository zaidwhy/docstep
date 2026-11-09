/**
 * Settings lookup with a fallback to the autoDocstring namespace, so users switching
 * from autoDocstring keep their configuration. Kept free of the vscode module so it
 * can be unit tested; see config.ts for the vscode binding.
 */

export interface SettingInspection {
    globalValue?: unknown;
    workspaceValue?: unknown;
    workspaceFolderValue?: unknown;
    globalLanguageValue?: unknown;
    workspaceLanguageValue?: unknown;
    workspaceFolderLanguageValue?: unknown;
}

export interface SettingsSection {
    get(key: string): unknown;
    inspect(key: string): SettingInspection | undefined;
}

export function isSetByUser(inspection: SettingInspection | undefined): boolean {
    if (inspection == undefined) {
        return false;
    }

    return [
        inspection.globalValue,
        inspection.workspaceValue,
        inspection.workspaceFolderValue,
        inspection.globalLanguageValue,
        inspection.workspaceLanguageValue,
        inspection.workspaceFolderLanguageValue,
    ].some((value) => value !== undefined);
}

/**
 * Value of `key` from the current section if the user set it there, else from the
 * legacy section if the user set it there, else the current section's default.
 */
export function readSetting(
    key: string,
    current: SettingsSection,
    legacy: SettingsSection,
): unknown {
    if (!isSetByUser(current.inspect(key)) && isSetByUser(legacy.inspect(key))) {
        return legacy.get(key);
    }

    return current.get(key);
}
