/**
 * Settings lookup with a fallback to the autoDocstring namespace, so users switching
 * from autoDocstring keep their configuration. Kept free of the vscode module so it
 * can be unit tested; see config.ts for the vscode binding.
 */

export interface SettingInspection {
    defaultValue?: unknown;
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
 * A null value (`"docstep.quoteStyle": null` in settings.json) also gets the default,
 * since every caller expects the setting's own type.
 */
export function readSetting(
    key: string,
    current: SettingsSection,
    legacy: SettingsSection,
): unknown {
    const inspection = current.inspect(key);
    const value =
        !isSetByUser(inspection) && isSetByUser(legacy.inspect(key))
            ? legacy.get(key)
            : current.get(key);

    return value ?? inspection?.defaultValue;
}
