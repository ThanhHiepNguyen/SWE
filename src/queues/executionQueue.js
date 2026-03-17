import { Queue } from "bullmq";

const connection =
  process.env.REDIS_URL != null
    ? { url: process.env.REDIS_URL }
    : {
        host: process.env.REDIS_HOST ?? "localhost",
        port: Number(process.env.REDIS_PORT ?? 6379),
        password: process.env.REDIS_PASSWORD,
      };

export const executionQueue = new Queue("code-executions", {
  connection,
});

