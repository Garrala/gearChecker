const fs = require('fs');
const path = require('path');

const OVERRIDES_PATH = path.join(__dirname, 'helpers', 'final_gear_overrides.json');
const INPUT_DIR = path.join(__dirname, 'staging', 'boss_gear_final');

const overrides = JSON.parse(fs.readFileSync(OVERRIDES_PATH, 'utf-8'));
console.log('🔧 Applying final gear overrides...\n');

let patchCount = 0;
let replaceCount = 0;

const files = fs.readdirSync(INPUT_DIR).filter(f => f.endsWith('.json'));
console.log(`📂 Found ${files.length} boss files to check\n`);

files.forEach(file => {
  const fullPath = path.join(INPUT_DIR, file);
  const bossName = path.basename(file, '.json').toLowerCase();;
  console.log(`📄 Processing file: ${file} → Boss: "${bossName}"`);

  const json = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));

  if (!overrides[bossName]) {
    console.log(`⛔ No override found for boss "${bossName}"\n`);
    return;
  }

  const bossOverrides = overrides[bossName];
  console.log(`✅ Found override for "${bossName}"`);

  for (const [style, slots] of Object.entries(bossOverrides)) {
    console.log(`  🔍 Style: "${style}"`);

    if (!json.gear_setups?.[style]) {
      console.log(`  ⚠️ No gear setup found for style "${style}"\n`);
      continue;
    }

    for (const [slot, rawRules] of Object.entries(slots)) {
      const rules = Array.isArray(rawRules) ? rawRules : [rawRules];

      for (const rule of rules) {
        console.log(`    🎯 Slot: "${slot}" → Mode: ${rule.mode}`);

        if (!json.gear_setups[style][slot]) {
          console.log(`    ℹ️ Slot "${slot}" doesn't exist — initializing as empty`);
          json.gear_setups[style][slot] = [];
        }

        const slotGroups = json.gear_setups[style][slot];

        if (rule.mode === 'replace') {
          console.log(`    🔁 Replacing entire slot with: ${JSON.stringify(rule.items)}`);
          json.gear_setups[style][slot] = [rule.items];
          replaceCount++;
        }

        else if (rule.mode === 'patch') {
          const insertIdx = Math.max(0, Math.min(rule.insert_at, slotGroups.length));
          const alreadyExists = slotGroups.some(group => group.includes(rule.item));

          console.log(`    📌 Inserting "${rule.item}" at index ${insertIdx}`);
          console.log(`    🧪 Already exists in slot? ${alreadyExists}`);
          if (!alreadyExists) {
            slotGroups.splice(insertIdx, 0, [rule.item]);
            patchCount++;
            console.log(`    ✅ Patched in "${rule.item}"`);
          } else {
            console.log(`    🚫 Skipped — item already present`);
          }
        }

        else if (rule.mode === 'patch_join') {
          const insertIdx = Math.max(0, Math.min(rule.insert_at, slotGroups.length - 1));
          const groupAtIdx = slotGroups[insertIdx];

          console.log(`   🔀 [patch_join] Boss: ${bossName} | Style: ${style} | Slot: ${slot}`);
          console.log(`   ➕ Inserting "${rule.item}" into group at index ${insertIdx}`);

          if (!groupAtIdx) {
            slotGroups[insertIdx] = [rule.item];
            patchCount++;
            console.log(`   🆕 Created group with "${rule.item}" at index ${insertIdx}`);
          } else if (!groupAtIdx.includes(rule.item)) {
            groupAtIdx.push(rule.item);
            patchCount++;
            console.log(`   🔗 Appended "${rule.item}" to existing group at index ${insertIdx}`);
          } else {
            console.log(`   ⚠️ "${rule.item}" already exists in group, skipping.`);
          }
        }

        else {
          console.log(`    ⚠️ Unknown mode "${rule.mode}" for ${slot} — skipping.`);
        }
      }
    }
  }

  fs.writeFileSync(fullPath, JSON.stringify(json, null, 2));
  console.log(`💾 Wrote updated data for "${bossName}"\n`);
});

console.log(`\n✅ All done. ${patchCount} patch(es), ${replaceCount} replace(s) applied.`);
