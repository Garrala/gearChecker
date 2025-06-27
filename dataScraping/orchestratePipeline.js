const { execSync } = require('child_process');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

const steps = [
  { name: 'Fetching HTML dumps', script: 'fetchHtmlDumps.js' },
  { name: 'Scraping boss stats', script: 'statScraper.js' },
  { name: 'Scraping gear setups', script: 'getGearSetups.js' },
  { name: 'Apply manual fixes', script: 'applyManualFixes.js' },
  { name: 'Transforming data', script: 'transformGearData.js' },
  { name: 'Merging stats + gear', script: 'mergeData.js' },
  { name: 'Replacing final gear files', script: 'replaceWithFinalGear.js' },
  { name: 'Cleanup staging files', script: 'cleanupStaging.js' }
];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function pause(message) {
  return new Promise(resolve => {
    rl.question(`\n⏸️ ${message} Press [Enter] to continue...`, () => resolve());
  });
}

function runStep(name, script) {
  console.log(`\n🚀 ${name} [${script}]`);
  execSync(`node ${script}`, { stdio: 'inherit' });
}

function diffPreviewDir(newDir, oldDir) {
  console.log('\n🔍 Reviewing file differences (new vs current)...');

  const newFiles = fs.readdirSync(newDir).filter(f => f.endsWith('.json'));
  const oldFiles = fs.readdirSync(oldDir).filter(f => f.endsWith('.json'));

  for (const file of newFiles) {
    if (!oldFiles.includes(file)) {
      console.log(`🆕 New file: ${file}`);
      continue;
    }

    const newData = fs.readFileSync(path.join(newDir, file), 'utf-8');
    const oldData = fs.readFileSync(path.join(oldDir, file), 'utf-8');
    if (newData !== oldData) {
      console.log(`✏️ Changed: ${file}`);
    }
  }

  for (const file of oldFiles) {
    if (!newFiles.includes(file)) {
      console.log(`❌ Removed: ${file}`);
    }
  }
}

(async () => {
  runStep(steps[0].name, steps[0].script);
  runStep(steps[1].name, steps[1].script);
  runStep(steps[2].name, steps[2].script);

  await pause('Manual review time for gear_audit_pass1.json or fixing manual_gear_fixes.json');

  runStep(steps[3].name, steps[3].script);
  runStep(steps[4].name, steps[4].script);
  runStep(steps[5].name, steps[5].script);

  const newDir = path.join(__dirname, 'staging', 'merged_boss_data');
  const currentDir = path.join(__dirname, '..', 'src', 'assets', 'monsters');
  diffPreviewDir(newDir, currentDir);

  await pause('Final review before replacing live monster files');

  runStep(steps[6].name, steps[6].script);
  runStep(steps[7].name, steps[7].script);
  console.log('\n🎉 Pipeline complete.');
  rl.close();
})();
