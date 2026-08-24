const { execFile, execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const runOptimizer = (programId, academicTermId) => {
    return new Promise((resolve, reject) => {
        const scriptPath = path.resolve(__dirname, "optimizer.py");

        console.log("[optimizer] start");
        console.log("[optimizer] scriptPath:", scriptPath);
        console.log("[optimizer] programId:", programId);
        console.log("[optimizer] academicTermId:", academicTermId);

        if (!fs.existsSync(scriptPath)) {
            const err = new Error(`Optimizer script not found: ${scriptPath}`);
            console.error("[optimizer] file missing");
            return reject(err);
        }

        const pythonCandidates = ["py", "python", "python3"];
        let pythonCommand = null;

        for (const cmd of pythonCandidates) {
            try {
                execFileSync(cmd, ["-3", "--version"], {
                    stdio: "ignore",
                    windowsHide: true
                });
                pythonCommand = cmd;
                console.log("[optimizer] found python:", cmd);
                break;
            } catch {
                // try next
            }
        }

        if (!pythonCommand) {
            const err = new Error("No Python interpreter found.");
            console.error("[optimizer] no python interpreter found");
            return reject(err);
        }

        console.log("[optimizer] executing:", pythonCommand, ["-3", scriptPath, String(programId), String(academicTermId)]);

        execFile(
            pythonCommand,
            ["-3", scriptPath, String(programId), String(academicTermId)],
            { windowsHide: true },
            (error, stdout, stderr) => {
                if (error) {
                    console.error("[optimizer] python error:", error.message);
                    if (stderr) console.error("[optimizer] stderr:", stderr);
                    return reject(new Error(`Python failed: ${error.message}\n${stderr || ""}`));
                }

                console.log("[optimizer] python finished successfully");
                if (stdout) console.log("[optimizer] stdout:", stdout.trim());

                try {
                    const result = JSON.parse(stdout);
                    console.log("[optimizer] parsed result:", result.status || "unknown");
                    resolve(result);
                } catch (e) {
                    console.error("[optimizer] invalid stdout JSON");
                    console.error("[optimizer] stdout:", stdout);
                    console.error("[optimizer] stderr:", stderr);
                    reject(new Error(`Optimizer output invalid: ${stdout || stderr}`));
                }
            }
        );
    });
};

module.exports = {
    runOptimizer
};