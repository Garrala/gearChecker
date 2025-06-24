const fs = require('fs');
const path = require('path');

const STAT_DIR = path.join(__dirname, 'staging', 'boss_stat_scrape');
const GEAR_DIR = path.join(__dirname, 'staging', 'boss_gear_final');
const OUTPUT_DIR = path.join(__dirname, 'staging', 'merged_boss_data');

const ALL_SLOTS = [
  'Weapon', 'Special Attack', 'Shield', 'Helmet', 'Amulet',
  'Cape', 'Body', 'Legs', 'Gloves', 'Boots', 'Ring', 'Ammo'
];

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

function loadJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (err) {
    console.warn(`⚠️ Could not read or parse ${filePath}`);
    return null;
  }
}

function moveAnyGodBlessingToEnd(setup) {
  for (const slot of Object.keys(setup)) {
    setup[slot] = setup[slot].map(group => {
      if (!Array.isArray(group)) return group;

      const blessings = group.filter(item => item === "Any God blessing");
      const others = group.filter(item => item !== "Any God blessing");

      if (
        blessings.length &&
        others.some(i =>
          i.startsWith("Rada's blessing") || i.endsWith("blessing")
        )
      ) {
        return [...others, ...blessings];
      }

      return group;
    });
  }
}

function padSlotArraysToUniformLength(gearSetups) {
  for (const style of Object.keys(gearSetups)) {
    const slotRows = gearSetups[style];
    let maxLength = 0;

    for (const slot of ALL_SLOTS) {
      const rows = slotRows[slot] || [];
      if (rows.length > maxLength) maxLength = rows.length;
    }

    for (const slot of ALL_SLOTS) {
      const rows = slotRows[slot] || [];
      while (rows.length < maxLength) {
        rows.push(["N/A"]);
      }
      gearSetups[style][slot] = rows;
    }
  }
}

function compactStringify(obj, indent = 2) {
  const json = JSON.stringify(obj, null, indent);
  return json.replace(/\[\s+((?:\s*"[^"]+",?\s*){1,6})\s+\]/g, (match, inner) => {
    return `[ ${inner.trim().replace(/\s+/g, ' ')} ]`;
  });
}

function toKebabCase(str) {
  return str.replace(/_/g, '-').replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

function mergeGearData(originalData, gearData) {
  const transformedData = gearData.gear_setups || gearData;
  const merged = {
    ...originalData,
    gear_setups: {}
  };

  for (const style of Object.keys(transformedData)) {
    merged.gear_setups[style] = {};

    for (const slot of Object.keys(transformedData[style])) {
      merged.gear_setups[style][slot] = transformedData[style][slot];
    }

    for (const slot of ALL_SLOTS) {
      if (!merged.gear_setups[style][slot]) {
        merged.gear_setups[style][slot] = [["N/A"]];
      }
    }

    moveAnyGodBlessingToEnd(merged.gear_setups[style]);
  }

  padSlotArraysToUniformLength(merged.gear_setups);
  return merged;
}

// Merge logic
fs.readdirSync(STAT_DIR).forEach(file => {
  if (!file.endsWith('.json')) return;

  const baseName = path.basename(file, '.json');
  const kebabName = toKebabCase(baseName);
  const statPath = path.join(STAT_DIR, file);
  const gearPath = path.join(GEAR_DIR, kebabName + '.json');
  const outputPath = path.join(OUTPUT_DIR, baseName + '.json');

  const statData = loadJsonSafe(statPath);
  const gearData = loadJsonSafe(gearPath);

  if (!statData) return;

  let merged = statData;

  if (gearData && gearData.gear_setups) {
    merged = mergeGearData(statData, gearData);
  } else {
    console.log(`ℹ️ No gear data found for ${baseName}, merging stats only.`);
  }

  delete merged.unmatched_items;

  fs.writeFileSync(outputPath, compactStringify(merged, 2));
  console.log(`✅ Merged ${baseName}`);
});

console.log('\n📦 All boss data merged with formatting.');
