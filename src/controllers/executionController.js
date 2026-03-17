import { prisma } from "../config/prismaClient.js";

export async function getExecution(req, res, next) {
    try {
        const { id } = req.params;

        const execution = await prisma.execution.findUnique({
            where: { id },
        });

        if (!execution) {
            return res.status(404).json({ message: "Không tìm thấy lượt chạy" });
        }


        return res.json({
            execution_id: execution.id,
            status: execution.status,
            stdout: execution.stdout ?? "",
            stderr: execution.stderr ?? "",
            execution_time_ms: execution.executionTimeMs ?? 0,
        });
    } catch (err) {
        next(err);
    }
}

