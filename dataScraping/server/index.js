const { execFile } = require("child_process");
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();

app.use(cors());
app.use(express.json());


// -----------------------------
// DIRECTORY PATHS
// -----------------------------
const STAGING_DIR = path.join(__dirname, "..", "staging");
const DATA_ROOT = path.join(__dirname, "..", "staging", "boss_html_dump");
const ROOT_DIR = path.join(__dirname, "..");
const MANUAL_FIXES_PATH = path.join(__dirname, "..", "helpers", "manual_gear_fixes.json");

const METADATA_PATH = path.join(__dirname, "data", "boss_metadata.json");
const STAT_SCRAPE_DIR = path.join(__dirname, "..", "staging", "boss_stat_scrape");
const GEAR_SCRAPE_DIR = path.join(__dirname, "..", "staging", "boss_gear_scrape");

// -----------------------------
// RELEASE PIPELINE PATHS
// -----------------------------
const MERGED_DIR = path.join(__dirname, "..", "staging", "merged_boss_data");
const LIVE_MONSTER_DIR = path.resolve(
  __dirname,
  "..", "..", "src", "assets", "monsters"
).replace(/\//g, "\\");


// Ensure metadata folder exists
const metadataDir = path.dirname(METADATA_PATH);
if (!fs.existsSync(metadataDir)) fs.mkdirSync(metadataDir, { recursive: true });

// Ensure folders exist
if (!fs.existsSync(MERGED_DIR)) fs.mkdirSync(MERGED_DIR, { recursive: true });
if (!fs.existsSync(LIVE_MONSTER_DIR)) fs.mkdirSync(LIVE_MONSTER_DIR, { recursive: true });

// -----------------------------
// DEBUG LOGS FOR PATH VALIDATION
// -----------------------------
console.log("LIVE_MONSTER_DIR =", LIVE_MONSTER_DIR);
console.log("Exists?", fs.existsSync(LIVE_MONSTER_DIR));


// -----------------------------
// STAGING ROOT LISTING
// -----------------------------
app.get("/staging/files", (req, res) => {
  const entries = fs.readdirSync(STAGING_DIR, { withFileTypes: true });
  res.json(entries.map(e => ({
    name: e.name,
    type: e.isDirectory() ? "dir" : "file"
  })));
});


// -----------------------------
// DIRECT FILE SERVING
// -----------------------------
app.get("/staging/file/:name", (req, res) => {
  const filePath = path.join(STAGING_DIR, req.params.name);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File not found" });
  }
  res.sendFile(filePath);
});


// -----------------------------
// NESTED FILE SERVING (Express 5 Safe RegExp)
// -----------------------------
app.get(/^\/staging\/(.*)$/, (req, res) => {
  const relPath = req.params[0];
  const filePath = path.join(STAGING_DIR, relPath);

  console.log("Request for:", relPath);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: `Not found: ${relPath}` });
  }

  res.sendFile(filePath);
});


// -----------------------------
// BOSS FOLDER LIST
// -----------------------------
app.get("/api/boss-list", (req, res) => {
  try {
    const dirs = fs.readdirSync(DATA_ROOT)
      .filter(name => fs.lstatSync(path.join(DATA_ROOT, name)).isDirectory());

    res.json(dirs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// -----------------------------
// BOSS FILE LISTING
// -----------------------------
app.get("/api/boss/:bossName", (req, res) => {
  const boss = req.params.bossName;
  const dir = path.join(DATA_ROOT, boss);

  if (!fs.existsSync(dir)) {
    return res.status(404).json({ error: "Boss folder not found", boss });
  }

  const files = fs.readdirSync(dir).filter(f => f.endsWith(".html"));

  res.json({
    boss,
    files
  });
});


// -----------------------------
// METADATA ROUTES
// -----------------------------

// Load entire boss_metadata.json
app.get("/api/boss-metadata", (req, res) => {
  try {
    const json = fs.readFileSync(METADATA_PATH, "utf8");
    res.json(JSON.parse(json));
  } catch (err) {
    res.status(500).json({ error: "Failed to read boss_metadata.json", details: err });
  }
});

// Save entire boss_metadata.json
app.post("/api/boss-metadata", (req, res) => {
  try {
    fs.writeFileSync(METADATA_PATH, JSON.stringify(req.body, null, 2));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to write boss_metadata.json", details: err });
  }
});

// Update JUST one boss entry
app.post("/api/boss-metadata/:bossName", (req, res) => {
  try {
    const bossName = req.params.bossName;

    const raw = fs.readFileSync(METADATA_PATH, "utf8");
    const data = JSON.parse(raw);

    data[bossName] = req.body;

    fs.writeFileSync(METADATA_PATH, JSON.stringify(data, null, 2));
    res.json({ success: true });

  } catch (err) {
    res.status(500).json({ error: "Failed to update boss entry", details: err });
  }
});

//DOWNLOAD HTML
app.post("/api/download-html", (req, res) => {
  console.log("⚡ Starting HTML download...");

  // Use the correct absolute script path:
  const scriptPath = path.join(__dirname, "..", "fetchHtmlDumps.js");

  execFile("node", [scriptPath], (error, stdout, stderr) => {
    if (error) {
      console.error("❌ Downloader error:", error);
      return res.status(500).json({ error: error.message });
    }

    console.log(stdout);
    console.log(stderr);

    res.json({ status: "Download completed" });
  });
});

//STAT SCRAPPER
app.get("/api/stat-scrape/list", (req, res) => {
  try {
    if (!fs.existsSync(STAT_SCRAPE_DIR)) {
      return res.json([]);
    }

    const files = fs.readdirSync(STAT_SCRAPE_DIR)
      .filter(f => f.endsWith(".json") && f !== "scrape_report.json");

    res.json(files);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/stat-scrape/:filename", (req, res) => {
  const filePath = path.join(STAT_SCRAPE_DIR, req.params.filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File not found" });
  }

  try {
    const json = fs.readFileSync(filePath, "utf8");
    res.json(JSON.parse(json));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/stat-scraper", (req, res) => {
  console.log("⚡ Starting Stat Scraper...");

  const scriptPath = path.join(__dirname, "..", "statScraper.js");

  execFile("node", [scriptPath], (error, stdout, stderr) => {
    if (error) {
      console.error("❌ Stat Scraper error:", error);
      return res.status(500).json({ error: error.message });
    }

    console.log(stdout);
    res.json({ status: "Stat scraping complete" });
  });
});

//GEAR SCRAPPING
app.post("/api/gear-scraper", (req, res) => {
  console.log("⚡ Starting Gear Scraper...");

  const scriptPath = path.join(__dirname, "..", "getGearSetups.js");

  execFile("node", [scriptPath], (error, stdout, stderr) => {
    if (error) {
      console.error("❌ Gear Scraper error:", error);
      return res.status(500).json({ error: error.message });
    }

    console.log(stdout);
    res.json({ status: "Gear scraping complete" });
  });
});

app.get("/api/gear-scrape/list", (req, res) => {
  try {
    if (!fs.existsSync(GEAR_SCRAPE_DIR)) return res.json([]);

    const files = fs.readdirSync(GEAR_SCRAPE_DIR)
      .filter(f => f.endsWith(".json") && f !== "audit_gear_issues.json");

    res.json(files);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.get("/api/gear-scrape/:filename", (req, res) => {
  const filePath = path.join(GEAR_SCRAPE_DIR, req.params.filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Not found" });
  }

  try {
    const json = fs.readFileSync(filePath, "utf8");
    res.json(JSON.parse(json));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------
// GEAR TRANSFORMATION PIPELINES
// -----------------------------
function runScript(scriptName) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(ROOT_DIR, scriptName);

    execFile("node", [scriptPath], (error, stdout, stderr) => {
      if (error) {
        console.error(`❌ Script failure (${scriptName}):`, stderr || error);
        reject(stderr || error);
        return;
      }
      resolve(stdout);
    });
  });
}


// -----------------------------
// Pipeline A: Full audit run
// transform → applyFixes → transform
// -----------------------------
app.post("/api/gear/run-audit", async (req, res) => {
  try {
    console.log("⚡ Starting FULL audit transform pipeline...");

    const step1 = await runScript("transformGearData.js");
    const step2 = await runScript("applyManualFixes.js");
    const step3 = await runScript("transformGearData.js");

    res.json({
      success: true,
      steps: {
        initialTransform: step1,
        appliedFixes: step2,
        finalTransform: step3
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.toString() });
  }
});


// -----------------------------
// Pipeline B: After edits
// applyFixes → transform
// -----------------------------
app.post("/api/gear/reprocess-after-fixes", async (req, res) => {
  try {
    console.log("⚡ Reprocessing AFTER updating manual fixes...");

    const step1 = await runScript("applyManualFixes.js");
    const step2 = await runScript("transformGearData.js");

    res.json({
      success: true,
      steps: {
        appliedFixes: step1,
        finalTransform: step2
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.toString() });
  }
});


// -----------------------------
// MANUAL FIXES READ / WRITE
// -----------------------------

// Read fixes
app.get("/api/gear/manual-fixes", (req, res) => {
  try {
    if (!fs.existsSync(MANUAL_FIXES_PATH)) return res.json({});

    const json = JSON.parse(fs.readFileSync(MANUAL_FIXES_PATH, "utf8"));
    res.json(json);

  } catch (err) {
    res.status(500).json({ error: "Failed to read manual fixes", details: err });
  }
});

// Update fixes
app.post("/api/gear/manual-fixes", (req, res) => {
  try {
    fs.writeFileSync(MANUAL_FIXES_PATH, JSON.stringify(req.body, null, 2));
    res.json({ success: true });

  } catch (err) {
    res.status(500).json({ error: "Failed to write manual fixes", details: err });
  }
});


function diffPreview(newDir, oldDir) {
  const summary = {
    added: [],
    removed: [],
    changed: []
  };

  const newFiles = fs.existsSync(newDir)
    ? fs.readdirSync(newDir).filter(f => f.endsWith(".json"))
    : [];

  const oldFiles = fs.existsSync(oldDir)
    ? fs.readdirSync(oldDir).filter(f => f.endsWith(".json"))
    : [];

  const oldSet = new Set(oldFiles);

  // Added or changed
  for (const file of newFiles) {
    if (!oldSet.has(file)) {
      summary.added.push(file);
      continue;
    }

    const newData = fs.readFileSync(path.join(newDir, file), "utf8");
    const oldData = fs.readFileSync(path.join(oldDir, file), "utf8");

    if (newData !== oldData) {
      summary.changed.push(file);
    }
  }

  // Removed files
  for (const file of oldFiles) {
    if (!newFiles.includes(file)) {
      summary.removed.push(file);
    }
  }

  return summary;
}

// -----------------------------
// MERGE STEP - run mergeData.js
// -----------------------------
app.post("/api/pipeline/merge", async (req, res) => {
  try {
    console.log("⚡ Running mergeData.js...");

    const result = await runScript("mergeData.js");

    res.json({
      success: true,
      output: result
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.toString() });
  }
});


// -----------------------------
// DIFF SUMMARY (added/removed/changed)
// -----------------------------
app.get("/api/pipeline/diff", (req, res) => {
  try {
    const summary = diffPreview(MERGED_DIR, LIVE_MONSTER_DIR);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// -----------------------------
// INDIVIDUAL FILE DIFF CONTENT
// -----------------------------
app.get("/api/pipeline/diff/:file", (req, res) => {
  const file = req.params.file;

  const staged = path.join(MERGED_DIR, file);
  const live = path.join(LIVE_MONSTER_DIR, file);

  const result = { file };

  try {
    result.new = fs.existsSync(staged)
      ? JSON.parse(fs.readFileSync(staged, "utf8"))
      : null;

    result.old = fs.existsSync(live)
      ? JSON.parse(fs.readFileSync(live, "utf8"))
      : null;

    res.json(result);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// -----------------------------
// APPROVE SINGLE FILE
// Copies from staging → live assets
// -----------------------------
app.post("/api/pipeline/approve/:file", (req, res) => {
  const file = req.params.file;

  const stagedPath = path.join(MERGED_DIR, file);
  const livePath = path.join(LIVE_MONSTER_DIR, file);

  try {
    if (!fs.existsSync(stagedPath)) {
      return res.status(404).json({ error: "Not found in staging" });
    }
    console.log("Approving:", file);
    console.log("Copy:", stagedPath, "→", livePath);

    fs.copyFileSync(stagedPath, livePath);

    res.json({
      success: true,
      message: `Approved ${file}`
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
function cleanStaging() {
  const baseDir = path.join(__dirname, "..", "staging");

  const foldersToWipe = [
    "boss_html_dump",
    "boss_stat_scrape",
    "boss_gear_scrape",
    "boss_gear_final",
    "boss_gear_combined",
    "strategy_html_dump",
    "merged_boss_data"
  ];

  const results = [];

  foldersToWipe.forEach(folder => {
    const fullPath = path.join(baseDir, folder);

    if (fs.existsSync(fullPath)) {
      fs.rmSync(fullPath, { recursive: true, force: true });
      results.push({ folder, deleted: true });
    } else {
      results.push({ folder, deleted: false, message: "Not found" });
    }
  });

  return results;
}

app.post("/api/pipeline/cleanup", (req, res) => {
  try {
    console.log("⚙️ Running staging cleanup...");

    const result = cleanStaging();

    res.json({
      success: true,
      cleaned: result
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.toString()
    });
  }
});

// -----------------------------
// START SERVER
// -----------------------------
const PORT = 3001;
app.listen(PORT, () =>
  console.log(`Datascraping server running at http://localhost:${PORT}`)
);
