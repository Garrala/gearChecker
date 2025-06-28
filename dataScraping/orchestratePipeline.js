const { execSync } = require('child_process');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

const steps = [
  { name: 'Fetching HTML dumps', script: 'fetchHtmlDumps.js' },
  { name: 'Scraping boss stats', script: 'statScraper.js' },
  { name: 'Scraping gear setups', script: 'getGearSetups.js' },
  { name: 'Initial gear transform (for audit)', script: 'transformGearData.js' },
  { name: 'Apply manual fixes', script: 'applyManualFixes.js' },
  { name: 'Final gear transform (after fixes)', script: 'transformGearData.js' },
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
  // Fetch and parse data
  runStep(steps[0].name, steps[0].script); // HTML dumps
  runStep(steps[1].name, steps[1].script); // Boss stats
  runStep(steps[2].name, steps[2].script); // Gear setups

  // First transform to audit scraped gear issues
  runStep(steps[3].name, steps[3].script); // Initial transform

  await pause('Manual review time for gear_audit_pass1.json or fixing manual_gear_fixes.json');

  // Apply fixes and finalize transforms
  runStep(steps[4].name, steps[4].script); // Apply manual fixes
  runStep(steps[5].name, steps[5].script); // Final transform

  // Merge and preview
  runStep(steps[6].name, steps[6].script); // Merge stats + gear

  const newDir = path.join(__dirname, 'staging', 'merged_boss_data');
  const currentDir = path.join(__dirname, '..', 'src', 'assets', 'monsters');
  diffPreviewDir(newDir, currentDir);

  await pause('Final review before replacing live monster files');

  // Replace and cleanup
  runStep(steps[7].name, steps[7].script); // Replace live files
  runStep(steps[8].name, steps[8].script); // Cleanup

  console.log('\n🎉 Pipeline complete.');
  rl.close();
})();
