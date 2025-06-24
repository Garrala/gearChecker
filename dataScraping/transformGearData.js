const fs = require('fs');
const path = require('path');

const INPUT_DIR = path.join(__dirname, 'staging', 'boss_gear_scrape');
const OUTPUT_DIR = path.join(__dirname, 'staging', 'boss_gear_final');
const GEAR_DIR = path.join(__dirname, '..', 'src', 'assets', 'gear');

if (fs.existsSync(OUTPUT_DIR)) {
  fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
}
fs.mkdirSync(OUTPUT_DIR);

const auditRowsMaster = [];

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

function cleanItemName(name) {
  return name
    .replace(/\[[^\]]+\]/g, '')              
    .replace(/[^a-zA-Z0-9()/\s'-]/g, '')      
    .replace(/\s+/g, ' ')                     
    .trim();
}

function normalizeNA(entry) {
  const flat = Array.isArray(entry) ? entry.join('') : '';
  const cleaned = flat.toLowerCase().replace(/\W/g, '');
  return cleaned === 'na' || cleaned === 'n/a' ? ['N/A'] : entry;
}

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

const VALID_ITEMS_BY_SLOT = loadValidItemsBySlot();

function transformGearData(scraped, bossName) {
  const transformed = {
    gear_setups: {},
    unmatched_items: [],
  };

  const auditRows = [];
  if (!scraped || typeof scraped !== 'object' || !scraped.gear_setups) {
    console.warn(`⚠️ Skipping ${bossName} — gear_setups missing or malformed`);
    return {
      transformed: {
        gear_setups: {},
        unmatched_items: []
      },
      auditRows: []
    };
  }

  for (const [style, slots] of Object.entries(scraped.gear_setups)) {
    const normalizedStyle = style.trim();
    transformed.gear_setups[normalizedStyle] = {};

    for (const [slot, options] of Object.entries(slots)) {
      const validSet = VALID_ITEMS_BY_SLOT[slot];
      if (!validSet) continue;

      transformed.gear_setups[normalizedStyle][slot] = [];

      for (const row of options) {
        const cleanedRow = normalizeNA(row);
        const group = [];

        for (const item of cleanedRow) {
          const cleaned = cleanItemName(item);
          const isNA = cleaned.toLowerCase() === 'n/a';
          const isValid = validSet.has(cleaned);

          group.push(isNA ? 'N/A' : cleaned);

          if (!isValid && !isNA) {
            auditRows.push({
              boss: bossName,
              style: normalizedStyle,
              slot,
              raw: item,
              normalized: cleaned,
              reason: 'Not in slot list',
            });
          }
        }

        if (group.length > 0) {
          transformed.gear_setups[normalizedStyle][slot].push(group);
        }
      }
    }
  }

  transformed.unmatched_items = [...new Set(auditRows.map(row => row.normalized))].sort();

  return { transformed, auditRows };
}

// Process all scraped files
fs.readdirSync(INPUT_DIR)
  .filter(f => f.endsWith('.json'))
  .forEach(file => {
    const bossKey = file.replace(/\.json$/, '');
    const scrapedJson = JSON.parse(fs.readFileSync(path.join(INPUT_DIR, file), 'utf-8'));

    const { transformed, auditRows } = transformGearData(scrapedJson, bossKey);

    fs.writeFileSync(path.join(OUTPUT_DIR, bossKey + '.json'), JSON.stringify(transformed, null, 2));
    auditRowsMaster.push(...auditRows);

    console.log(`✅ Transformed ${bossKey}, unmatched: ${transformed.unmatched_items.length}`);
  });

// Write audit log
const auditPath = path.join(__dirname, 'staging', 'boss_gear_final', 'gear_audit_pass1.json');
fs.writeFileSync(auditPath, JSON.stringify(auditRowsMaster, null, 2));
console.log(`📝 Wrote full audit log to ${auditPath}`);
