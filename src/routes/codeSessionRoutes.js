import { Router } from "express";
import {
    createCodeSession,
    updateCodeSession,
    runCodeSession,
} from "../controllers/codeSessionController.js";

const codeSessionRouter = Router();

codeSessionRouter.post("/", createCodeSession);
codeSessionRouter.patch("/:id", updateCodeSession);
codeSessionRouter.post("/:id/run", runCodeSession);

export default codeSessionRouter;

