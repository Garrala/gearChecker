const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, 'staging');
const foldersToWipe = [
  'boss_html_dumps',
  'boss_stat_scrape',
  'boss_gear_scrape',
  'boss_gear_final',
  'boss_gear_combined',
  'merged_boss_data'
];

console.log('⚙️ Cleaning staging folders...\n');

foldersToWipe.forEach(folder => {
  const fullPath = path.join(baseDir, folder);
  if (fs.existsSync(fullPath)) {
    fs.rmSync(fullPath, { recursive: true, force: true });
    console.log(`🗑️ Deleted ${folder}`);
  } else {
    console.log(`⚠️ Not found: ${folder}`);
  }
});

console.log('\n✅ Cleanup complete.\n');
