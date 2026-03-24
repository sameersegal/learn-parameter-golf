#!/usr/bin/env node
/**
 * Reads data/parsed/*.json and produces:
 *   web/src/data/submissions.json
 *   web/src/data/technique-index.json
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PARSED_DIR = path.join(ROOT, "data", "parsed");
const OUT_DIR = path.join(ROOT, "web", "src", "data");
const NORMALIZE_PATH = path.join(__dirname, "normalize-methods.json");
const DEEPDIVE_MAP_PATH = path.join(OUT_DIR, "technique-to-deepdive.json");

// Load normalization map (lowercase keys)
const rawNorm = JSON.parse(fs.readFileSync(NORMALIZE_PATH, "utf-8"));
const normalizeMap = {};
for (const [k, v] of Object.entries(rawNorm)) {
  normalizeMap[k.toLowerCase()] = v;
}

// Load deep-dive mapping
let deepDiveMap = {};
if (fs.existsSync(DEEPDIVE_MAP_PATH)) {
  deepDiveMap = JSON.parse(fs.readFileSync(DEEPDIVE_MAP_PATH, "utf-8"));
}

function normalize(name) {
  if (!name) return "unknown";
  const lower = name.toLowerCase().trim();
  return normalizeMap[lower] || name.trim();
}

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Read all parsed submissions
if (!fs.existsSync(PARSED_DIR)) {
  console.log("No data/parsed directory found, keeping existing data files");
  process.exit(0);
}
const files = fs.readdirSync(PARSED_DIR).filter((f) => f.endsWith(".json"));
if (files.length === 0) {
  console.log("No parsed files found, keeping existing data files");
  process.exit(0);
}
const submissions = files
  .map((f) => {
    try {
      return JSON.parse(fs.readFileSync(path.join(PARSED_DIR, f), "utf-8"));
    } catch {
      console.warn(`Skipping invalid JSON: ${f}`);
      return null;
    }
  })
  .filter(Boolean)
  .sort((a, b) => a.pr_number - b.pr_number);

console.log(`Loaded ${submissions.length} submissions`);

// Build technique index
// Map: "category:normalizedMethod" -> TechniqueCard data
const cardMap = new Map();

for (const sub of submissions) {
  if (!sub.training_techniques) continue;
  for (const tech of sub.training_techniques) {
    const category = tech.category || "other";
    const data = tech.data || {};

    // Extract method name based on category
    let method;
    if (category === "architecture_modification") {
      method = data.component;
    } else if (category === "sequence_length") {
      method = data.train_length ? `${data.train_length}` : "unknown";
    } else {
      method = data.method;
    }
    method = normalize(method || "unknown");

    const key = `${category}:${method}`;
    if (!cardMap.has(key)) {
      cardMap.set(key, {
        category,
        method,
        slug: slugify(method),
        count: 0,
        bpbValues: [],
        prNumbers: [],
        deepDiveSlug: deepDiveMap[key] || null,
        hyperparameters: [],
      });
    }

    const card = cardMap.get(key);
    card.count++;
    card.prNumbers.push(sub.pr_number);
    if (sub.val_bpb != null) {
      card.bpbValues.push(sub.val_bpb);
    }
    // Store hyperparameters (filter out descriptive fields)
    const params = { ...data };
    delete params.description;
    delete params.component;
    delete params.method;
    if (Object.keys(params).length > 0) {
      card.hyperparameters.push({ pr_number: sub.pr_number, ...params });
    }
  }
}

// Build categories object and emerging array
const categories = {};
const emerging = [];
const mappedKeys = new Set(Object.keys(deepDiveMap));

for (const card of cardMap.values()) {
  const key = `${card.category}:${card.method}`;
  const finalCard = {
    category: card.category,
    method: card.method,
    slug: card.slug,
    count: card.count,
    avgBpb:
      card.bpbValues.length > 0
        ? +(card.bpbValues.reduce((a, b) => a + b, 0) / card.bpbValues.length).toFixed(4)
        : null,
    bestBpb:
      card.bpbValues.length > 0 ? +Math.min(...card.bpbValues).toFixed(4) : null,
    prNumbers: card.prNumbers,
    deepDiveSlug: card.deepDiveSlug,
    hyperparameters: card.hyperparameters,
  };

  // Add to category bucket
  if (!categories[card.category]) {
    categories[card.category] = [];
  }
  categories[card.category].push(finalCard);

  // Check if unmapped
  if (!mappedKeys.has(key)) {
    emerging.push(finalCard);
  }
}

// Sort within each category by count desc
for (const cat of Object.keys(categories)) {
  categories[cat].sort((a, b) => b.count - a.count);
}
emerging.sort((a, b) => b.count - a.count);

const techniqueIndex = { categories, emerging };

// Write outputs
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(
  path.join(OUT_DIR, "submissions.json"),
  JSON.stringify(submissions, null, 2)
);
fs.writeFileSync(
  path.join(OUT_DIR, "technique-index.json"),
  JSON.stringify(techniqueIndex, null, 2)
);

console.log(`Written submissions.json (${submissions.length} entries)`);
console.log(
  `Written technique-index.json (${cardMap.size} methods, ${emerging.length} emerging)`
);
