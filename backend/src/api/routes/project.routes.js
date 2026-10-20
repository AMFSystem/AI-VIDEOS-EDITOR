import { Router } from "express";
import { projectController } from "../controllers/project.controller.js";

export const projectRouter = Router();

projectRouter.post("/save", projectController.saveProject);
projectRouter.get("/load/:id", projectController.loadProject);
projectRouter.delete("/project/:id", projectController.deleteProject);
