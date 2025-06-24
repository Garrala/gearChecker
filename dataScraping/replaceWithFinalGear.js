const fs = require('fs');
const path = require('path');

const FINAL_DIR = path.join(__dirname, 'staging', 'merged_boss_data');
const MONSTERS_DIR = path.join(__dirname, '..', 'src', 'assets', 'monsters');
const SLAYER_DIR = path.join(__dirname, '..', 'src', 'assets', 'slayer');
const METADATA_PATH = path.join(__dirname, '..', 'boss_metadata.json');

if (!fs.existsSync(FINAL_DIR)) {
  console.error('❌ Final gear directory does not exist:', FINAL_DIR);
  process.exit(1);
}
if (!fs.existsSync(MONSTERS_DIR) || !fs.existsSync(SLAYER_DIR)) {
  console.error('❌ Output directories missing.');
  process.exit(1);
}

const metadata = JSON.parse(fs.readFileSync(METADATA_PATH, 'utf-8'));

// Normalize to match file system format (e.g. King Black Dragon → king-black-dragon)
function toDashName(str) {
  return str.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-');
}

const categoryMap = {};
for (const [bossName, meta] of Object.entries(metadata)) {
  const dashName = toDashName(bossName);
  categoryMap[dashName] = {
    category: meta.category || '',
    originalName: bossName
  };
}

fs.readdirSync(FINAL_DIR)
  .filter(f => f.endsWith('.json'))
  .forEach(file => {
    const rawName = file.replace(/\.json$/, '').replace(/_/g, ' ');
    const dashName = toDashName(rawName);
    const categoryEntry = categoryMap[dashName];

    if (!categoryEntry) {
      console.warn(`⚠️ No category mapping found for ${file}, skipping`);
      return;
    }

    const targetDir = categoryEntry.category === 'Slayer Monster' ? SLAYER_DIR : MONSTERS_DIR;
    const from = path.join(FINAL_DIR, file);
    const to = path.join(targetDir, dashName + '.json');

    fs.copyFileSync(from, to);
    console.log(`🔁 Replaced ${dashName}.json in ${targetDir.includes('slayer') ? 'slayer/' : 'monsters/'}`);
  });

console.log('\n✅ All categorized replacements complete.');
