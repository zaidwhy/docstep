import * as chai from "chai";
import "mocha";

import { readSetting, SettingInspection, SettingsSection } from "../settings";

const expect = chai.expect;

function section(
    defaults: Record<string, unknown>,
    userValues: Record<string, unknown>,
): SettingsSection {
    return {
        get: (key) => (key in userValues ? userValues[key] : defaults[key]),
        inspect: (key): SettingInspection => ({
            defaultValue: defaults[key],
            globalValue: userValues[key],
        }),
    };
}

describe("readSetting()", () => {
    it("should use the docstep value when the user set it", () => {
        const current = section({ quoteStyle: '"""' }, { quoteStyle: "'''" });
        const legacy = section({}, { quoteStyle: '"""' });

        expect(readSetting("quoteStyle", current, legacy)).to.equal("'''");
    });

    it("should fall back to the autoDocstring value when the docstep value is unset", () => {
        const current = section({ docstringFormat: "google" }, {});
        const legacy = section({}, { docstringFormat: "numpy" });

        expect(readSetting("docstringFormat", current, legacy)).to.equal("numpy");
    });

    it("should keep a false autoDocstring value instead of the docstep default", () => {
        const current = section({ generateDocstringOnEnter: true }, {});
        const legacy = section({}, { generateDocstringOnEnter: false });

        expect(readSetting("generateDocstringOnEnter", current, legacy)).to.equal(false);
    });

    it("should use the docstep default when a setting is null, not crash on it", () => {
        const current = section({ customTemplatePath: "" }, { customTemplatePath: null });
        const legacy = section({}, { customTemplatePath: null });

        expect(readSetting("customTemplatePath", current, legacy)).to.equal("");
    });

    it("should use the docstep default when neither namespace is set", () => {
        const current = section({ guessTypes: true }, {});
        const legacy = section({}, {});

        expect(readSetting("guessTypes", current, legacy)).to.equal(true);
    });

    it("should use the docstep default when the legacy section cannot be inspected", () => {
        const current = section({ includeName: false }, {});
        const legacy: SettingsSection = { get: () => undefined, inspect: () => undefined };

        expect(readSetting("includeName", current, legacy)).to.equal(false);
    });

    it("should prefer a workspace docstep value over a global autoDocstring value", () => {
        const current: SettingsSection = {
            get: () => "sphinx",
            inspect: () => ({ workspaceValue: "sphinx" }),
        };
        const legacy = section({}, { docstringFormat: "numpy" });

        expect(readSetting("docstringFormat", current, legacy)).to.equal("sphinx");
    });
});
