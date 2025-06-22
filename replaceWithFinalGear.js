const fs = require('fs');
const path = require('path');

// Adjust these to match your setup
const FINAL_DIR = path.join(__dirname, 'boss_gear_combined');
const MONSTERS_DIR = path.join(__dirname, 'src', 'assets', 'monsters');

if (!fs.existsSync(FINAL_DIR)) {
  console.error('❌ Final gear directory does not exist:', FINAL_DIR);
  process.exit(1);
}

if (!fs.existsSync(MONSTERS_DIR)) {
  console.error('❌ Monsters directory does not exist:', MONSTERS_DIR);
  process.exit(1);
}

const files = fs.readdirSync(FINAL_DIR).filter(f => f.endsWith('.json'));

files.forEach(file => {
  const finalPath = path.join(FINAL_DIR, file);
  const monsterPath = path.join(MONSTERS_DIR, file);

  if (!fs.existsSync(monsterPath)) {
    console.warn(`⚠️ Skipping missing monster file: ${file}`);
    return;
  }

  fs.copyFileSync(finalPath, monsterPath);
  console.log(`🔁 Replaced: ${file}`);
});
