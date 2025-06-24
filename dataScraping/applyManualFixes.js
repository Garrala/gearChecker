const fs = require('fs');
const path = require('path');

const FIXES_PATH = path.join(__dirname, 'helpers', 'manual_gear_fixes.json');
const INPUT_DIR = path.join(__dirname, 'staging', 'boss_gear_scrape');

const FIXES_MAP = JSON.parse(fs.readFileSync(FIXES_PATH, 'utf-8'));
function cleanItemName(name) {
  if (typeof name !== 'string') name = String(name || '');
  return name
    .replace(/\[[^\]]+\]/g, '')                    // remove [a], [b], etc.
    .replace(/\((?:uncharged|broken|placeholder)\)/gi, '') // remove common junk suffixes
    .replace(/[^a-zA-Z0-9()/\s'-]/g, '')           // remove special chars
    .replace(/\s+/g, ' ')
    .trim();
}

function splitMultiItems(name) {
  // Handle slash-separated tiers
  const tierMatch = name.match(/(.+?)\s+(\d(?:\/\d+)+)$/); // e.g. "Ring 3/2/1"
  if (tierMatch) {
    const base = tierMatch[1].trim();
    const tiers = tierMatch[2].split('/');
    return tiers.map(t => `${base} ${t}`);
  }

  // If not slash-style, return as single-item array
  return [name];
}
function applyFixesToFile(filePath) {
  const filename = path.basename(filePath, '.json');
  const json = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  let fixCount = 0;
  let moveCount = 0;
  const fixedItems = new Set();

  // Normalize fix map once per file
  const normalizedFixes = {};
  for (const [key, val] of Object.entries(FIXES_MAP)) {
    const normalizedKey = cleanItemName(key);
    normalizedFixes[normalizedKey] = val;
  }

  for (const [style, slots] of Object.entries(json.gear_setups || {})) {
    for (const [slot, rows] of Object.entries(slots)) {
      const toRemove = new Set();

      for (let r = 0; r < rows.length; r++) {
        const group = rows[r];

        for (let i = 0; i < group.length; i++) {
          const original = group[i];
          let splitItems = [original];

          // If there's no direct fix, try tier-splitting fallback
          if (!normalizedFixes[cleanItemName(original)]) {
            splitItems = splitMultiItems(original);
          }

          let matched = false;

          for (const splitItem of splitItems) {
            const cleaned = cleanItemName(splitItem);
            const fix = normalizedFixes[cleaned];
            if (!fix) continue;

            const { alias, correct_slot } = fix;

            if (correct_slot === slot) {
              if (Array.isArray(alias)) {
                // Replace entire group
                rows[r] = alias;
              } else {
                group[i] = alias;
              }
              fixedItems.add(cleaned);
              fixCount++;
              console.log(`🔁 [${filename}] ${style} | ${slot}: "${splitItem}" → ${JSON.stringify(alias)}`);
            } else {
              // Move to correct slot
              if (!json.gear_setups[style][correct_slot]) {
                json.gear_setups[style][correct_slot] = [];
              }

              const newGroup = Array.isArray(alias) ? alias : [alias];
              json.gear_setups[style][correct_slot].push(newGroup);
              toRemove.add(r);
              fixedItems.add(cleaned);
              moveCount++;
              console.log(`📦 [${filename}] ${style} | ${slot} → ${correct_slot}: "${splitItem}" → ${JSON.stringify(newGroup)}`);
            }

            matched = true;
            break; // Stop after first valid match
          }

          if (matched) break; // Don't double-apply within a group
        }
      }

      // Remove rows that were moved to a different slot
      if (toRemove.size > 0) {
        json.gear_setups[style][slot] = rows.filter((_, idx) => !toRemove.has(idx));
      }
    }
  }

  // Remove fixed items from unmatched_items
  if (Array.isArray(json.unmatched_items)) {
    json.unmatched_items = json.unmatched_items.filter(item => {
      return !fixedItems.has(cleanItemName(item));
    });
  }

  fs.writeFileSync(filePath, JSON.stringify(json, null, 2));
  return { boss: filename, fixCount, moveCount };
}


console.log('🔧 Applying manual fixes from normalized map...\n');

let totalFixes = 0;
let totalMoves = 0;

fs.readdirSync(INPUT_DIR)
  .filter(f => f.endsWith('.json'))
  .forEach(file => {
    const fullPath = path.join(INPUT_DIR, file);
    const { boss, fixCount, moveCount } = applyFixesToFile(fullPath);
    totalFixes += fixCount;
    totalMoves += moveCount;

    if (fixCount || moveCount) {
      console.log(`✅ ${boss}: ${fixCount} fixed, ${moveCount} moved\n`);
    }
  });

console.log(`🧮 All done. Total aliases fixed: ${totalFixes}, total slot moves: ${totalMoves}`);
