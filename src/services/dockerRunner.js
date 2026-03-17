import path from "node:path";
import fs from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import crypto from "node:crypto";

const execFileAsync = promisify(execFile);

async function ensureDir(p) {
    await fs.mkdir(p, { recursive: true });
}

async function writeFile(p, content) {
    await ensureDir(path.dirname(p));
    await fs.writeFile(p, content, { encoding: "utf8" });
}

async function rmDir(p) {
    try {
        await fs.rm(p, { recursive: true, force: true });
    } catch {
        // ignore
    }
}


export async function runInDocker({
    language,
    sourceCode,
    timeLimitMs = 2000,
    memoryLimitMb = 128,
}) {
    // IMPORTANT: worker runs in a container but calls host Docker via /var/run/docker.sock.
    // So bind-mounting a container-only path won't work. Use a named Docker volume instead.
    const runnerVolume = process.env.RUNNER_DOCKER_VOLUME ?? "runner_tmp";
    const runnerMountPath = process.env.RUNNER_MOUNT_PATH ?? "/runner-tmp";

    const jobId = crypto.randomUUID();
    const jobDirInWorker = path.join(runnerMountPath, jobId);

    try {
        let image;
        let cmd = [];
        let entryPathInContainer;

        if (language === "javascript") {
            image = "node:20-alpine";
            entryPathInContainer = `/workspace/${jobId}/main.js`;
            await writeFile(path.join(jobDirInWorker, "main.js"), sourceCode);
            cmd = ["node", entryPathInContainer];
        } else if (language === "python") {
            image = "python:3.12-alpine";
            entryPathInContainer = `/workspace/${jobId}/main.py`;
            await writeFile(path.join(jobDirInWorker, "main.py"), sourceCode);
            cmd = ["python", entryPathInContainer];
        } else {
            return {
                status: "FAILED",
                stdout: "",
                stderr: `Ngôn ngữ '${language}' chưa được hỗ trợ chạy. Chỉ hỗ trợ: python, javascript`,
                executionTimeMs: 0,
            };
        }

        try {
            await execFileAsync("docker", ["image", "inspect", image], {
                timeout: 15_000,
                maxBuffer: 1024 * 1024,
                windowsHide: true,
            });
        } catch {

            await execFileAsync("docker", ["pull", image], {
                timeout: 5 * 60_000,
                maxBuffer: 10 * 1024 * 1024,
                windowsHide: true,
            });
        }

        const dockerArgs = [
            "run",
            "--rm",
            "--pull",
            "never",
            "--network",
            "none",
            "--memory",
            `${memoryLimitMb}m`,
            "--pids-limit",
            "128",
            "-v",
            `${runnerVolume}:/workspace:ro`,
            image,
            ...cmd,
        ];

        const start = Date.now();
        try {
            const { stdout, stderr } = await execFileAsync("docker", dockerArgs, {
                timeout: timeLimitMs,
                maxBuffer: 1024 * 1024,
                windowsHide: true,
            });

            return {
                status: "COMPLETED",
                stdout: stdout ?? "",
                stderr: stderr ?? "",
                executionTimeMs: Date.now() - start,
            };
        } catch (err) {
            const executionTimeMs = Date.now() - start;
            const isTimeout = err?.killed === true || err?.signal === "SIGTERM";

            return {
                status: isTimeout ? "TIMEOUT" : "FAILED",
                stdout: err?.stdout ?? "",
                stderr: err?.stderr ?? String(err?.message ?? err),
                executionTimeMs,
            };
        }
    } finally {
        await rmDir(jobDirInWorker);
    }
}

