import fs from "node:fs/promises";
import path from "node:path";
import { fileManager } from "../../services/storage/fileManager.js";

export const projectController = {
  async saveProject(req, res) {
    const { id, projectData } = req.body;
    const projectId = id || `project_${Date.now()}`;
    const filePath = fileManager.getFilePath("projects", `${projectId}.json`);

    try {
      await fs.writeFile(filePath, JSON.stringify(projectData, null, 2), "utf8");
      res.json({ success: true, id: projectId, filePath });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async loadProject(req, res) {
    const { id } = req.params;
    let filePath = fileManager.getFilePath("projects", `${id}.json`);

    try {
      let content;
      try {
        content = await fs.readFile(filePath, "utf8");
      } catch {
        // Fallback check in temp directory for legacy saved projects
        filePath = fileManager.getFilePath("temp", `${id}.json`);
        content = await fs.readFile(filePath, "utf8");
      }
      res.json({ success: true, projectData: JSON.parse(content) });
    } catch {
      res.status(404).json({ error: `Project ${id} not found` });
    }
  },

  async deleteProject(req, res) {
    const { id } = req.params;
    const projectPath = fileManager.getFilePath("projects", `${id}.json`);
    const tempPath = fileManager.getFilePath("temp", `${id}.json`);
    try {
      try {
        await fs.unlink(projectPath);
      } catch {
        await fs.unlink(tempPath);
      }
      res.json({ success: true, id });
    } catch {
      res.status(404).json({ error: `Project ${id} not found` });
    }
  },

  async listProjects(_req, res) {
    try {
      const files = await fileManager.listFiles("projects");
      res.json({ success: true, projects: files });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
};
