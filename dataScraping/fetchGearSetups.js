const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const { extractGearFromSlice, ensureAllSlotsPresent, auditLog } = require('./helpers/gear_helpers');

const metadata = require('../boss_metadata.json');
const gearOutputPath = path.join(__dirname, 'staging', 'boss_gear_scrape');
if (fs.existsSync(gearOutputPath)) {
  fs.rmSync(gearOutputPath, { recursive: true, force: true });
}
fs.mkdirSync(gearOutputPath);

function normalizeLabel(label) {
  return label.trim().toLowerCase().replace(/\s+/g, ' ');
}

function fetchGearTabberHtml(bossName) {
  const safeFolderName = bossName.toLowerCase().replace(/\s+/g, '_');
  const filePath = path.join(__dirname, 'staging', 'boss_html_dumps', safeFolderName, 'strategy.html');

  if (!fs.existsSync(filePath)) {
    console.warn(`❌ Strategy file not found for ${bossName}: ${filePath}`);
    return [];
  }

  const rawHtml = fs.readFileSync(filePath, 'utf8');
  const $ = cheerio.load(rawHtml);
  const gearSlices = [];

  // Tabber (multi-style)
  $('.tabbertab').each((_, el) => gearSlices.push($(el)));

  // Captioned tables (single-style)
  $('table.wikitable').each((_, el) => {
    const caption = $(el).find('caption').text().toLowerCase();
    const isValid = caption.includes('recommended equipment') || caption.includes('recommended gear');
    const isInventory = $(el).hasClass('inventorytable');
    if (isValid && !isInventory) {
      const fakeTab = $('<div class="tabbertab"></div>')
        .attr('data-title', caption.replace(/recommended (equipment|gear) for/i, '').trim() || 'Default')
        .append($(el).clone());
      gearSlices.push(fakeTab);
    }
  });

  // Fallback: look for h2 Equipment section
  if (gearSlices.length === 0) {
    const equipmentHeader = $('h2 span.mw-headline#Equipment').parent();
    if (equipmentHeader.length) {
      const slice = $('<div class="tabbertab"></div>').attr('data-title', 'Default');
      slice.append(equipmentHeader.clone());

      let current = equipmentHeader.next();
      while (current.length && !current.is('h2')) {
        slice.append(current.clone());
        current = current.next();
      }

      gearSlices.push(slice);
    }
  }

  return gearSlices;
}

async function fetchGearSetupsForBoss(bossName, meta) {
  const expectedSetups = meta.setups || [];
  const normalizedExpected = expectedSetups.map(s => normalizeLabel(s));
  console.log(`\n📋 Processing ${bossName}`);
  console.log(`Expected setups:`, expectedSetups);

  const gearSlices = fetchGearTabberHtml(bossName);
  if (!gearSlices || gearSlices.length === 0) {
    console.warn(`⚠️ No tabber sections found for ${bossName}`);
    return;
  }

  const gear_setups = {};
  const expectedUsed = new Array(expectedSetups.length).fill(false);
  const matchCounts = {}; // how many tabs we’ve seen with a normalized label

  for (let i = 0; i < gearSlices.length; i++) {
    const tab = gearSlices[i];
    const $tab = cheerio.load(tab.html());
    const rawLabel = tab.attr('data-title')?.trim() || `Unknown ${i + 1}`;
    const normalized = normalizeLabel(rawLabel);

    console.log(`🔍 Found tab: "${rawLabel}" (normalized: "${normalized}")`);

    matchCounts[normalized] = (matchCounts[normalized] || 0) + 1;
    const occurrence = matchCounts[normalized];
    console.log(`— Seen "${normalized}" ${occurrence} time(s)`);

    // Try to find the N-th matching normalized expected label
    let matchIndex = -1;
    let seen = 0;

    for (let j = 0; j < normalizedExpected.length; j++) {
      if (normalizedExpected[j] === normalized && !expectedUsed[j]) {
        seen++;
        if (seen === occurrence) {
          matchIndex = j;
          break;
        }
      }
    }

    if (matchIndex === -1) {
      console.warn(`⚠️ ${bossName} has unexpected or duplicate tab: "${rawLabel}"`);
      continue;
    }

    const styleName = expectedSetups[matchIndex];
    expectedUsed[matchIndex] = true;
    console.log(`✅ Matched to setup: "${styleName}"`);

    const gear = extractGearFromSlice($tab, rawLabel, bossName);
    ensureAllSlotsPresent(gear, styleName, bossName, metadata);
    gear_setups[styleName] = gear;
  }

  // Report missing setups
  const missing = expectedSetups.filter((_, idx) => !expectedUsed[idx]);
  if (missing.length > 0) {
    console.warn(`⚠️ ${bossName} is missing expected setups:`, missing);
  }

  const missingStyles = expectedSetups.filter((_, idx) => !expectedUsed[idx]);

  const output = {
    name: bossName,
    category: meta.category || '',
    wiki_link: meta.wiki_link,
    gear_setups,
    missing_styles: missingStyles
  };

  const auditPath = path.join(__dirname, 'staging', 'boss_gear_scrape', 'audit_gear_issues.json');
  if (fs.existsSync(auditPath)) fs.unlinkSync(auditPath);
  fs.writeFileSync(auditPath, JSON.stringify(auditLog, null, 2));
  console.log(`📝 Audit log written to ${auditPath}`);

  const fileName = bossName.replace(/\s+/g, '-').toLowerCase() + '.json';
  fs.writeFileSync(path.join(gearOutputPath, fileName), JSON.stringify(output, null, 2));
  console.log(`💾 Gear saved for ${bossName}: ${fileName}`);
}

(async () => {
  for (const [bossName, meta] of Object.entries(metadata)) {
    if (!meta.strategy_link || !meta.setups) continue;
    await fetchGearSetupsForBoss(bossName, meta);
  }
})();
