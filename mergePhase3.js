const fs = require('fs');
const path = require('path');

const phase2Folder = path.join(__dirname, 'boss_gear_final');
const originalFolder = path.join(__dirname, 'src/assets/monsters');
const outputFolder = path.join(__dirname, 'boss_gear_combined');

if (!fs.existsSync(outputFolder)) {
  fs.mkdirSync(outputFolder);
}

const ALL_SLOTS = [
  'Weapon', 'Special Attack', 'Shield', 'Helmet', 'Amulet',
  'Cape', 'Body', 'Legs', 'Gloves', 'Boots', 'Ring', 'Ammo'
];

function toKebabCase(str) {
  return str.replace(/_/g, '-').replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

function mergeGearData(originalData, transformedRaw) {
  const transformedData = transformedRaw.gear_setups || transformedRaw;

  const merged = {
    ...originalData,
    gear_setups: originalData.gear_setups ? JSON.parse(JSON.stringify(originalData.gear_setups)) : {}
  };

  for (const style of Object.keys(transformedData)) {
    if (!merged.gear_setups[style]) {
      merged.gear_setups[style] = {};
    }

    for (const slot of Object.keys(transformedData[style])) {
      if (slot === 'Helmet') {
        merged.gear_setups[style]['Helmet'] = originalData.gear_setups?.[style]?.['Helmet'] || [["N/A"]];
        continue;
      }

      const newSlot = transformedData[style][slot];
      const oldSlot = merged.gear_setups[style][slot] || [["N/A"]];

      const oldFlat = Array.isArray(oldSlot?.[0])
        ? oldSlot.flat().map(s => String(s).trim())
        : Array.isArray(oldSlot)
          ? oldSlot.map(s => String(s).trim())
          : [String(oldSlot).trim()];

      const newFlat = Array.isArray(newSlot?.[0])
        ? newSlot.flat().map(s => String(s).trim())
        : Array.isArray(newSlot)
          ? newSlot.map(s => String(s).trim())
          : [String(newSlot).trim()];

      const added = newFlat.filter(x => !oldFlat.includes(x));
      const removed = oldFlat.filter(x => !newFlat.includes(x));

      if (added.length || removed.length) {
        console.log(`🔄 ${style} → ${slot}`);
        if (added.length) console.log(`   ➕ Added: ${added.join(', ')}`);
        if (removed.length) console.log(`   ➖ Removed: ${removed.join(', ')}`);
      }

      merged.gear_setups[style][slot] = newSlot;
      moveAnyGodBlessingToEnd(merged.gear_setups[style]);
    }

    for (const slot of ALL_SLOTS) {
      if (!merged.gear_setups[style][slot]) {
        merged.gear_setups[style][slot] = [["N/A"]];
      }
    }
  }

  return merged;
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

  // Compact small arrays (gear arrays) into one-liners
  return json.replace(/\[\s+((?:\s*"[^"]+",?\s*){1,6})\s+\]/g, (match, inner) => {
    return `[ ${inner.trim().replace(/\s+/g, ' ')} ]`;
  });
}

function moveAnyGodBlessingToEnd(setup) {
  for (const slot of Object.keys(setup)) {
    setup[slot] = setup[slot].map(group => {
      if (!Array.isArray(group)) return group;

      const blessings = group.filter(item => item === "Any God blessing");
      const others = group.filter(item => item !== "Any God blessing");

      // Only reorder if it's a known mixed blessing group
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




fs.readdirSync(phase2Folder).forEach(file => {
  const baseName = path.basename(file, '.json');
  const kebabFileName = toKebabCase(baseName) + '.json';

  const transformedPath = path.join(phase2Folder, file);
  const originalPath = path.join(originalFolder, kebabFileName);
  const outputPath = path.join(outputFolder, kebabFileName);

  if (!fs.existsSync(originalPath)) {
    console.warn(`❌ No original file found for ${kebabFileName}, skipping`);
    return;
  }

  const transformedRaw = JSON.parse(fs.readFileSync(transformedPath, 'utf8'));
  const originalData = JSON.parse(fs.readFileSync(originalPath, 'utf8'));

  const merged = mergeGearData(originalData, transformedRaw);
  padSlotArraysToUniformLength(merged.gear_setups);
  fs.writeFileSync(outputPath, compactStringify(merged));
  console.log(`✅ Merged gear for ${baseName} → ${outputPath}`);
});
