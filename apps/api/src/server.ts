import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";

const app = express();

const PORT = process.env.PORT || 4000;

app.use(helmet());

app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    message: "Raven Oracle API is alive 🐦‍⬛",
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`
🐦‍⬛ Raven Oracle API
-------------------------
Server: http://localhost:${PORT}
Health: http://localhost:${PORT}/api/health
  `);
});
