#!/usr/bin/env node

/**
 * Transcription Companion Server
 *
 * Bridges the Transcription Workflow app with your local Whisper instance.
 *
 * SETUP:
 *   1. Save this file inside your Transcriptions/ folder
 *   2. npm install express multer cors
 *   3. node server.js
 *
 * ENDPOINTS:
 *   GET  /health          → server status check
 *   POST /transcribe      → accepts audio file, saves to Audio/, polls for output
 *   GET  /status/:jobId   → check if a transcription is done
 *   GET  /transcriptions  → list completed transcriptions
 */

const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const CONFIG = {
  port: 3456,
  audioInputDir: path.resolve(__dirname, "audio"),
  transcriptOutputDir: path.resolve(__dirname, "output"),
  timeout: 600000, // 10 minutes
};

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const jobs = new Map();

// --- Claude API proxy (avoids browser CORS restrictions) ---
app.post("/api/claude", async (req, res) => {
  const apiKey = req.headers["x-api-key"];
  if (!apiKey) return res.status(400).json({ error: "Missing x-api-key header" });

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error("[api/claude] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(CONFIG.audioInputDir)) {
      fs.mkdirSync(CONFIG.audioInputDir, { recursive: true });
    }
    cb(null, CONFIG.audioInputDir);
  },
  filename: (req, file, cb) => cb(null, file.originalname),
});
const upload = multer({ storage });

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    audioInputDir: CONFIG.audioInputDir,
    transcriptOutputDir: CONFIG.transcriptOutputDir,
    audioInputExists: fs.existsSync(CONFIG.audioInputDir),
    transcriptOutputExists: fs.existsSync(CONFIG.transcriptOutputDir),
  });
});

app.post("/transcribe", upload.single("audio"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No audio file provided" });

  const audioFilename = req.file.originalname;
  const baseName = path.parse(audioFilename).name;
  const jobId = baseName;

  console.log(`[transcribe] Received: ${audioFilename}`);
  console.log(`[transcribe] Saved to: ${path.join(CONFIG.audioInputDir, audioFilename)}`);

  const possibleOutput = findTranscriptFile(baseName);
  if (possibleOutput) {
    const transcript = fs.readFileSync(possibleOutput, "utf-8");
    console.log(`[transcribe] Transcript already exists!`);
    return res.json({ jobId, status: "done", transcript });
  }

  jobs.set(jobId, { status: "processing", audioFile: audioFilename, startedAt: Date.now() });
  res.json({ jobId, status: "processing" });
});

app.get("/status/:jobId", (req, res) => {
  const jobId = decodeURIComponent(req.params.jobId);

  const outputFile = findTranscriptFile(jobId);
  if (outputFile) {
    const transcript = fs.readFileSync(outputFile, "utf-8");
    jobs.delete(jobId);
    return res.json({ jobId, status: "done", transcript });
  }

  const job = jobs.get(jobId);
  if (job) {
    if (Date.now() - job.startedAt > CONFIG.timeout) {
      jobs.delete(jobId);
      return res.json({ jobId, status: "timeout", error: "Transcription timed out" });
    }
    return res.json({ jobId, status: "processing" });
  }
  return res.json({ jobId, status: "unknown" });
});

app.get("/transcriptions", (req, res) => {
  if (!fs.existsSync(CONFIG.transcriptOutputDir)) return res.json({ transcriptions: [] });

  const files = fs.readdirSync(CONFIG.transcriptOutputDir)
    .filter(f => f.endsWith(".txt"))
    .map(f => {
      const fullPath = path.join(CONFIG.transcriptOutputDir, f);
      const stat = fs.statSync(fullPath);
      return { name: path.parse(f).name, filename: f, size: stat.size, modified: stat.mtime };
    })
    .sort((a, b) => new Date(b.modified) - new Date(a.modified));

  res.json({ transcriptions: files });
});

app.get("/transcriptions/:name", (req, res) => {
  const name = decodeURIComponent(req.params.name);
  const outputFile = findTranscriptFile(name);
  if (outputFile) return res.json({ name, transcript: fs.readFileSync(outputFile, "utf-8") });
  res.status(404).json({ error: "Transcript not found" });
});

function findTranscriptFile(baseName) {
  if (!fs.existsSync(CONFIG.transcriptOutputDir)) return null;
  const exact = path.join(CONFIG.transcriptOutputDir, `${baseName}.txt`);
  if (fs.existsSync(exact)) return exact;
  const files = fs.readdirSync(CONFIG.transcriptOutputDir);
  const match = files.find(f => {
    const fBase = path.parse(f).name.toLowerCase();
    return fBase === baseName.toLowerCase() || fBase.includes(baseName.toLowerCase());
  });
  return match ? path.join(CONFIG.transcriptOutputDir, match) : null;
}

app.listen(CONFIG.port, () => {
  console.log(`
╔══════════════════════════════════════════════════╗
║   Transcription Companion Server                 ║
║   http://localhost:${CONFIG.port}                        ║
╠══════════════════════════════════════════════════╣
║   Audio input:   ${CONFIG.audioInputDir.substring(0, 30).padEnd(30)}║
║   Output dir:    ${CONFIG.transcriptOutputDir.substring(0, 30).padEnd(30)}║
╚══════════════════════════════════════════════════╝
  `);
});
