import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { removeBackground, enhancePhoto, generateImage } from "./server/ai.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // AI Routes
  app.post("/api/ai/remove-bg", async (req, res) => {
    try {
      const { image } = req.body;
      const result = await removeBackground(image);
      res.json({ image: result });
    } catch (error) {
      res.status(500).json({ error: "Failed to remove background" });
    }
  });

  app.post("/api/ai/enhance", async (req, res) => {
    try {
      const { image } = req.body;
      const result = await enhancePhoto(image);
      res.json({ image: result });
    } catch (error) {
      res.status(500).json({ error: "Failed to enhance photo" });
    }
  });

  app.post("/api/ai/generate", async (req, res) => {
    try {
      const { prompt } = req.body;
      const image = await generateImage(prompt);
      res.json({ image });
    } catch (error) {
      res.status(500).json({ error: "Failed to generate image" });
    }
  });

  // Project Routes (Mocked for now, would connect to Firestore)
  app.get("/api/projects", (req, res) => {
    res.json([]);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
