const fs = require('fs');
const path = require('path');

const INPUT_DIR = path.join(__dirname, 'boss_gear_scrape');
const OUTPUT_DIR = path.join(__dirname, 'boss_gear_final');
const GEAR_DIR = path.join(__dirname, 'src', 'assets', 'gear');

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

// Normalize JSON filenames to slot keys
const SLOT_FILENAME_MAP = {
  ammo: 'Ammo',
  amulets: 'Amulet',
  body: 'Body',
  boots: 'Boots',
  capes: 'Cape',
  gloves: 'Gloves',
  helmets: 'Helmet',
  legs: 'Legs',
  rings: 'Ring',
  shields: 'Shield',
  special_attack: 'Special Attack',
  weapons: 'Weapon',
};

// Manual fixes for odd scraped formats
function manualInterventionSubstitutions() {
  return {
    "Blessed boots": "Any Blessed boots",
    "Blessed body": "Any Blessed body",
    "Blessed chaps": "Any Blessed chaps",
    "Blessed vambraces": "Any Blessed vambraces",
    "Salve amulet(ei)": "Salve amulet (ei)",
    "Cape of Accomplishment (t)": "Any Skillcape (t)",
    "Blessed d'hide body": "Any Blessed body",
    "Blessed d'hide chaps": "Any Blessed chaps",
    "Barrows platebody": "Any Barrows tank body",
    "Barrows platelegs": "Any Barrows tank legs",
    "God blessing": "Any God blessing",
    "Barrowss": "Barrows",
    "Ring of suffering (ri)": "Ring of suffering (i)",
  };
}

const MANUAL_SUBS = manualInterventionSubstitutions();

// Direct replacements for known weird combined cases
const CUSTOM_UNMATCHED_FIXES = {
  "N A": ["N/A"],
  '["N", "A"]': ["N/A"],
  "Ava's accumulator Mixed hide cape": ["Ava's accumulator", "Mixed hide cape"],
  "Webweaver bow Craw's bow": ["Webweaver bow", "Craw's bow"],
  "Toxic blowpipe Hunters' sunlight crossbow": ["Toxic blowpipe", "Hunters' sunlight crossbow"],
  "Dragon crossbow Rune crossbow": ["Dragon crossbow", "Rune crossbow"],
  "Dragon arrow Amethyst arrow Rune arrow": ["Dragon arrows", "Amethyst arrows", "Rune arrows"],
  "Rada's Blessing Webweaver Craw's bow Toxic blowpipe Crystal bow": [[
    "Rada's blessing 4"
  ],
  [
    "Any God blessing",
    "Rada's blessing 3",
    "Rada's blessing 2"
    ]],

  "Barrows platebody Fighter torso": ["Any Barrows tank body", "Fighter torso"],
  "Blessed body": ["Any Blessed body"],
  "Blessed chaps Black d'hide chaps": ["Any Blessed chaps", "Black d'hide chaps"],
  "Blessed vambraces Black d'hide vambraces": ["Any Blessed vambraces", "Black d'hide vambraces"],
  "God blessing Rada's blessing 3 Rada's blessing 2": ["Any God blessing", "Rada's blessing 3", "Rada's blessing 2"],
  "Salve amulet(ei) Salve amulet (e)": ["Salve amulet (ei)", "Salve amulet (e)"]
};

// Cleans up spacing, bracket artifacts, and common typos
function cleanItemName(name) {
  if (typeof name !== 'string') return '';
  return name
    .replace(/\[[^\]]+\]/g, '') // remove [1], [note] etc
    .replace(/\s+/g, ' ')
    .replace(/Barrowss/g, 'Barrows')
    .trim();
}

// Load all gear slot files into slot-indexed map
function loadValidItemsBySlot() {
  const slotMap = {};
  const files = fs.readdirSync(GEAR_DIR).filter(f => f.endsWith('.json'));

  for (const file of files) {
    const slotKey = SLOT_FILENAME_MAP[file.replace('.json', '')];
    if (!slotKey) continue;

    const full = JSON.parse(fs.readFileSync(path.join(GEAR_DIR, file), 'utf-8'));
    slotMap[slotKey] = new Set(Object.keys(full).map(cleanItemName));
  }

  return slotMap;
}

// Flatten all valid gear names globally (for fallback)
function flattenGlobalValidItems(validMap) {
  const globalSet = new Set();
  for (const set of Object.values(validMap)) {
    for (const item of set) globalSet.add(item);
  }
  return globalSet;
}

const VALID_ITEMS_BY_SLOT = loadValidItemsBySlot();
const VALID_ITEMS_GLOBAL = flattenGlobalValidItems(VALID_ITEMS_BY_SLOT);

// Try to match multiple valid items from a string
function matchOrSplitItems(text, slotKey) {
  const words = text.split(' ');
  const found = [];
  let current = [];

  for (const word of words) {
    current.push(word);
    const candidate = cleanItemName(current.join(' '));

    const replaced = MANUAL_SUBS[candidate] || candidate;

    if (
      VALID_ITEMS_BY_SLOT[slotKey]?.has(replaced) ||
      VALID_ITEMS_GLOBAL.has(replaced)
    ) {
      found.push(replaced);
      current = [];
    }
  }

  if (current.length > 0) {
    const fallback = cleanItemName(current.join(' '));
    found.push(fallback);
  }

  return found;
}


// Core row normalization logic
function normalizeRow(row, slotKey) {
  let current = row.join(' ').trim();
  let last = null;

  // Keep applying normalization until it stops changing
  while (current !== last) {
    last = current;

    // Apply manual substitutions
    if (MANUAL_SUBS[current]) {
      current = MANUAL_SUBS[current];
      continue;
    }

    // Apply custom group fixes
    if (CUSTOM_UNMATCHED_FIXES[current]) {
      return CUSTOM_UNMATCHED_FIXES[current];
    }

    // Apply N/A catch
    if (/^(n\/?a|n a)$/i.test(current)) {
      return ['N/A'];
    }

    current = cleanItemName(current);
  }

  // At this point, try matching the cleaned result
  if (VALID_ITEMS_BY_SLOT[slotKey]?.has(current)) return [current];
  if (VALID_ITEMS_GLOBAL.has(current)) return [current];

  // Try splitting into components
  const split = matchOrSplitItems(current, slotKey);
  return split;
}


// Convert "ranged", "melee (stab)" into title case keys
function titleCaseGearStyle(style) {
  return style
    .split(' ')
    .map(w => w[0]?.toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
    .replace(/\(([^)]+)\)/g, (_, inner) => `(${inner[0]?.toUpperCase()}${inner.slice(1).toLowerCase()})`);
}

// Normalize entire style block
function transformGearStyleBlock(styleBlock, unmatchedItems) {
  const normalized = {};

  for (const [rawSlot, rows] of Object.entries(styleBlock)) {
    const slotKey = rawSlot;

    if (!VALID_ITEMS_BY_SLOT[slotKey]) continue;

    normalized[slotKey] = [];

    for (const row of rows) {
      const combined = row.join(' ').trim();
      const replacement = CUSTOM_UNMATCHED_FIXES[combined];

      // Handle manual multi-group fix: insert directly into appropriate slot
      if (Array.isArray(replacement) && Array.isArray(replacement[0])) {
        for (const group of replacement) {
          const inferredSlot = inferSlotFromItemGroup(group) || slotKey;
          if (!normalized[inferredSlot]) normalized[inferredSlot] = [];
          normalized[inferredSlot].push(group);
        }
        continue;
      }

      const normalizedRow = normalizeRow(row, slotKey);
      const validGroup = [];

      for (const item of normalizedRow) {
        const clean = cleanItemName(item);
        if (VALID_ITEMS_BY_SLOT[slotKey].has(clean) || clean === "N/A") {
          validGroup.push(clean);
        } else {
          unmatchedItems.add(clean);
        }
      }

      if (validGroup.length > 0) {
        normalized[slotKey].push(validGroup);
      }
    }
  }

  return normalized;
}

function inferSlotFromItemGroup(group) {
  for (const [slot, itemSet] of Object.entries(VALID_ITEMS_BY_SLOT)) {
    if (group.every(name => itemSet.has(name))) {
      return slot;
    }
  }
  return null;
}


function transformFile(filename) {
  const filePath = path.join(INPUT_DIR, filename);
  const scrapedGear = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  const transformed = {
    gear_setups: {},
    unmatched_items: []
  };

  const unmatched = new Set();

  for (const [style, block] of Object.entries(scrapedGear)) {
    const formattedStyle = titleCaseGearStyle(style);
    transformed.gear_setups[formattedStyle] = transformGearStyleBlock(block, unmatched);
  }

  transformed.unmatched_items = [...unmatched].filter(i => i.length > 1).sort();
  return transformed;
}

// Entry point
fs.readdirSync(INPUT_DIR)
  .filter(file => file.endsWith('.json'))
  .forEach(file => {
    const bossName = path.basename(file, '.json').replace(/_/g, '-');
    const result = transformFile(file);
    const outputPath = path.join(OUTPUT_DIR, `${bossName}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log(`✅ Transformed ${bossName} with ${result.unmatched_items.length} unmatched item(s)`);
  });
