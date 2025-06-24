const fs = require('fs');
const path = require('path');

const FINAL_DIR = path.join(__dirname, 'staging', 'merged_boss_data');
const MONSTERS_DIR = path.join(__dirname, '..', 'src', 'assets', 'monsters');
const SLAYER_DIR = path.join(__dirname, '..', 'src', 'assets', 'slayer');
const METADATA_PATH = path.join(__dirname, '..', 'boss_metadata.json');

const metadata = JSON.parse(fs.readFileSync(METADATA_PATH, 'utf-8'));

// Convert to kebab-case for filename comparison
function toKebabCase(str) {
  return str.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, '-');
}

// Map: kebab-case → { category, originalName }
const categoryMap = {};
for (const [bossName, meta] of Object.entries(metadata)) {
  const kebab = toKebabCase(bossName);
  categoryMap[kebab] = {
    category: meta.category?.toLowerCase() || '',
    originalName: bossName
  };
}

if (!fs.existsSync(FINAL_DIR)) {
  console.error('❌ Final gear directory does not exist:', FINAL_DIR);
  process.exit(1);
}
if (!fs.existsSync(MONSTERS_DIR) || !fs.existsSync(SLAYER_DIR)) {
  console.error('❌ Output directories missing.');
  process.exit(1);
}

fs.readdirSync(FINAL_DIR)
  .filter(f => f.endsWith('.json'))
  .forEach(file => {
    const baseName = file.replace(/\.json$/, '');
    const categoryEntry = categoryMap[baseName];

    if (!categoryEntry) {
      console.warn(`⚠️ No category mapping found for ${file}, skipping`);
      return;
    }

    const destination = categoryEntry.category.includes('slayer') ? SLAYER_DIR : MONSTERS_DIR;
    const from = path.join(FINAL_DIR, file);
    const to = path.join(destination, file);

    fs.copyFileSync(from, to);
    console.log(`🔁 Replaced ${file} in ${destination.includes('slayer') ? 'slayer/' : 'monsters/'}`);
  });

console.log('\n✅ All categorized replacements complete.');
