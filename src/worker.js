import "dotenv/config";
import { Worker } from "bullmq";
import { prisma } from "./config/prismaClient.js";
import { runInDocker } from "./services/dockerRunner.js";

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

const connection =
    process.env.REDIS_URL != null
        ? { url: process.env.REDIS_URL }
        : {
            host: process.env.REDIS_HOST ?? "localhost",
            port: Number(process.env.REDIS_PORT ?? 6379),
            password: process.env.REDIS_PASSWORD,
        };

const QUEUE_NAME = "code-executions";

const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
        const { executionId } = job.data;

        const execution = await prisma.execution.findUnique({
            where: { id: executionId },
            include: { session: true },
        });

        if (!execution || !execution.session) {
            console.warn(`[worker] Execution not found or missing session: ${executionId}`);
            return;
        }

        const minRunningMs = Number(process.env.MIN_RUNNING_MS ?? 0);
        const runningStartMs = Date.now();

        await prisma.execution.update({
            where: { id: executionId },
            data: {
                status: "RUNNING",
                startedAt: new Date(),
            },
        });

        console.log(
            `[worker] ${executionId} status=RUNNING (timeout=${process.env.EXECUTION_TIMEOUT_MS ?? 5000}ms, minRunning=${process.env.MIN_RUNNING_MS ?? 0}ms)`
        );

        const langRaw = (execution.session.language ?? "").toLowerCase();
        const lang = langRaw === "js" ? "javascript" : langRaw;
        const source = execution.session.sourceCode ?? "";

        const timeLimitMs = Number(process.env.EXECUTION_TIMEOUT_MS ?? 5000);
        const memoryLimitMb = Number(process.env.EXECUTION_MEMORY_MB ?? 128);

        const { status, stdout, stderr, executionTimeMs } = await runInDocker({
            language: lang,
            sourceCode: source,
            timeLimitMs,
            memoryLimitMb,
        });

        const elapsedRunningMs = Date.now() - runningStartMs;
        if (minRunningMs > 0 && elapsedRunningMs < minRunningMs) {
            await sleep(minRunningMs - elapsedRunningMs);
        }

        const finishedAt = Date.now();

        console.log(
            `[worker] ${executionId} status=${status} (stdout=${(stdout ?? "").length} chars, stderr=${(stderr ?? "").length} chars, execMs=${executionTimeMs ?? 0})`
        );

        await prisma.execution.update({
            where: { id: executionId },
            data: {
                status,
                stdout,
                stderr,
                finishedAt: new Date(finishedAt),
                executionTimeMs,
            },
        });
    },
    { connection }
);

worker.on("completed", (job) => {
    console.log(
        `[worker] Job completed: ${job.id} (executionId=${job.data.executionId})`
    );
});

worker.on("failed", (job, err) => {
    console.error(
        `[worker] Job failed: ${job?.id} (executionId=${job?.data?.executionId})`,
        err
    );
});

console.log(`[worker] Worker started for queue "${QUEUE_NAME}"`);

