import { Router } from "express";
import codeSessionRouter from "./codeSessionRoutes.js";
import executionRouter from "./executionRoutes.js";

const router = Router();

router.use("/code-sessions", codeSessionRouter);
router.use("/executions", executionRouter);

export default router;

