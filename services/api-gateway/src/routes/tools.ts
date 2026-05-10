import { Router } from "express";
import { TOOL_CONFIGS } from "@apna/constants";

export const toolsRouter: Router = Router();

toolsRouter.get("/", (_req, res) => {
  res.json(Object.values(TOOL_CONFIGS));
});
