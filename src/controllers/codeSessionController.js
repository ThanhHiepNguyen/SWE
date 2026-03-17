import crypto from "node:crypto";
import { prisma } from "../config/prismaClient.js";
import { executionQueue } from "../queues/executionQueue.js";
import { validateLanguageMatch } from "../utils/languageDetect.js";

export async function createCodeSession(req, res, next) {
  try {
    const { language, source_code } = req.body || {};

    if (typeof source_code !== "string" || source_code.trim() === "") {
      return res.status(400).json({ message: "Thiếu source_code hoặc source_code rỗng" });
    }

    const sourceCode = source_code;
    const validation = validateLanguageMatch({ language, sourceCode });

    if (!validation.ok) {
      return res.status(400).json({ message: validation.message });
    }

    const session = await prisma.codeSession.create({
      data: {
        id: crypto.randomUUID(),
        language: validation.normalizedLanguage,
        sourceCode,
        status: "ACTIVE",
      },
    });

    return res.status(201).json({
      session_id: session.id,
      status: session.status,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateCodeSession(req, res, next) {
  try {
    const { id } = req.params;
    const { language, source_code } = req.body || {};

    const existing = await prisma.codeSession.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ message: "Không tìm thấy phiên code" });
    }

    const dataToUpdate = {};

    if (source_code !== undefined) {
      if (typeof source_code !== "string" || source_code.trim() === "") {
        return res.status(400).json({ message: "source_code không được rỗng" });
      }
    }

    const nextLanguage = typeof language === "string" ? language : existing.language;
    const nextSourceCode =
      typeof source_code === "string" ? source_code : existing.sourceCode;

    const validation = validateLanguageMatch({
      language: nextLanguage,
      sourceCode: nextSourceCode,
    });

    if (!validation.ok) {
      return res.status(400).json({ message: validation.message });
    }

    if (typeof source_code === "string") {
      dataToUpdate.sourceCode = source_code;
    }

    if (typeof language === "string") {
      dataToUpdate.language = validation.normalizedLanguage;
    }

    const updated = await prisma.codeSession.update({
      where: { id },
      data: dataToUpdate,
    });

    return res.json({
      session_id: updated.id,
      status: updated.status,
    });
  } catch (err) {
    next(err);
  }
}

export async function runCodeSession(req, res, next) {
  try {
    const { id } = req.params;

    const session = await prisma.codeSession.findUnique({
      where: { id },
    });

    if (!session) {
      return res.status(404).json({ message: "Không tìm thấy phiên code" });
    }

    const execution = await prisma.execution.create({
      data: {
        sessionId: id,
        status: "QUEUED",
      },
    });

    await executionQueue.add(
      "execute",
      { executionId: execution.id },
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 500 },
        removeOnComplete: true,
        removeOnFail: false,
      }
    );

    return res.status(202).json({
      execution_id: execution.id,
      status: execution.status,
    });
  } catch (err) {
    next(err);
  }
}
