import fs from "node:fs/promises";
import path from "node:path";
import { fileManager } from "../../services/storage/fileManager.js";

export const projectController = {
  async saveProject(req, res) {
    const { id, projectData } = req.body;
    const projectId = id || `project_${Date.now()}`;
    const filePath = fileManager.getFilePath("temp", `${projectId}.json`);

    try {
      await fs.writeFile(filePath, JSON.stringify(projectData, null, 2), "utf8");
      res.json({ success: true, id: projectId, filePath });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async loadProject(req, res) {
    const { id } = req.params;
    const filePath = fileManager.getFilePath("temp", `${id}.json`);

    try {
      const content = await fs.readFile(filePath, "utf8");
      res.json({ success: true, projectData: JSON.parse(content) });
    } catch {
      res.status(404).json({ error: `Project ${id} not found` });
    }
  },

  async deleteProject(req, res) {
    const { id } = req.params;
    const filePath = fileManager.getFilePath("temp", `${id}.json`);
    try {
      await fs.unlink(filePath);
      res.json({ success: true, id });
    } catch {
      res.status(404).json({ error: `Project ${id} not found` });
    }
  },
};
