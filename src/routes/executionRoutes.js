import { Router } from "express";
import { getExecution } from "../controllers/executionController.js";

const executionRouter = Router();

executionRouter.get("/:id", getExecution);

export default executionRouter;

