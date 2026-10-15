/**
 * server.js — JobScout Express server
 *
 * Serves static frontend from /public and exposes a single
 * POST /api/search endpoint that calls the TinyFish Agent API.
 */

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const { scrapeJobs } = require("./scrapeJobs");

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ──────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ─── API Routes ─────────────────────────────────────────────────────

/**
 * POST /api/search
 * Body: { profile, type, location, remote }
 * Returns: { jobs: [...], meta: {...} }
 */
app.post("/api/search", async (req, res) => {
  try {
    const { profile, type, location, remote } = req.body;

    // Validate required field
    if (!profile || typeof profile !== "string" || profile.trim().length < 10) {
      return res.status(400).json({
        error: "Please provide at least 10 characters of profile information.",
      });
    }

    console.log(`\n🔍 New search: type=${type}, location=${location}, remote=${remote}`);
    console.log(`   Profile snippet: "${profile.substring(0, 80)}..."`);

    const results = await scrapeJobs(profile.trim(), type, location, remote);

    console.log(`✅ Found ${results.jobs.length} jobs from ${results.meta.boardsSearched.join(", ")}`);

    return res.json(results);
  } catch (err) {
    console.error("❌ Search error:", err.message);
    return res.status(500).json({
      error: err.message || "Something went wrong. Please try again.",
    });
  }
});

// ─── Health check ───────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", hasApiKey: !!process.env.TINYFISH_API_KEY });
});

// ─── Fallback: serve index.html for any non-API route ───────────────
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ─── Start ──────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🐟 JobScout running at http://localhost:${PORT}`);
  console.log(`   API key loaded: ${process.env.TINYFISH_API_KEY ? "Yes ✓" : "No ✗  — add TINYFISH_API_KEY to .env"}\n`);
});
