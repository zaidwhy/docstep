import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { runTests } from "@vscode/test-electron";

async function main() {
    console.log("Running Integration tests");
    const vscodeVersion = process.env.VSCODE_VERSION || "insiders";
    console.log("Using vscode version:", vscodeVersion);

    const extensionDevelopmentPath = path.resolve(__dirname, "../../");
    const extensionTestsPath = path.resolve(__dirname, "./integration/index");

    // A fresh profile per run: the shared one restored the untitled notebook from the last
    // run (hot exit), which kept focus away from the text editors of later tests. A fresh
    // profile opens the Welcome page, so that is skipped too.
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "docstep-vscode-"));

    try {
        await runTests({
            version: vscodeVersion,
            extensionDevelopmentPath,
            extensionTestsPath,
            launchArgs: [
                "--disable-extensions",
                "--skip-welcome",
                "--skip-release-notes",
                "--disable-workspace-trust",
                `--user-data-dir=${userDataDir}`,
            ],
        });
    } catch (err) {
        console.error("Failed to run tests");
        process.exitCode = 1;
    } finally {
        fs.rmSync(userDataDir, { recursive: true, force: true, maxRetries: 5 }); // craft-guard: allow test-force because this is fs.rmSync ignoring a missing dir, not a Playwright click
    }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main();
