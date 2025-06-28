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
  return label.toLowerCase().replace(/\s+/g, ' ').replace(/[^a-z0-9 ()]/gi, '').trim();
}

function fetchGearTabberHtml(bossName) {
  const safeFolderName = bossName.toLowerCase().replace(/\s+/g, '_');
  const filePath = path.join(__dirname, 'staging', 'strategy_html_dumps', safeFolderName, 'strategy.html');

  if (!fs.existsSync(filePath)) {
    console.warn(`❌ Strategy file not found for ${bossName}: ${filePath}`);
    return [];
  }

  const rawHtml = fs.readFileSync(filePath, 'utf8');
  const $ = cheerio.load(rawHtml);
  const gearSlices = [];

  // Tabber tabs
  $('.tabbertab').each((_, el) => gearSlices.push($(el)));

  // Captioned tables fallback
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

  // Final fallback: H2 Equipment header
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
  if (!gearSlices.length) {
    console.warn(`⚠️ No gear slices found for ${bossName}`);
    return;
  }

  const gear_setups = {};
  const expectedUsed = new Array(expectedSetups.length).fill(false);
  const matchCounts = {};
  const auditIssues = [];

  for (let i = 0; i < gearSlices.length; i++) {
    const tab = gearSlices[i];
    const $tab = cheerio.load(tab.html());
    const rawLabel = tab.attr('data-title')?.trim() || `Unknown ${i + 1}`;
    const normalized = normalizeLabel(rawLabel);

    matchCounts[normalized] = (matchCounts[normalized] || 0) + 1;
    const seenCount = matchCounts[normalized];
    console.log(`🔍 Found tab: "${rawLabel}" → normalized: "${normalized}" (seen ${seenCount}x)`);

    let matchIndex = -1;
    let seenOfThatType = 0;

    for (let j = 0; j < normalizedExpected.length; j++) {
      if (normalizedExpected[j] === normalized && !expectedUsed[j]) {
        seenOfThatType++;
        if (seenOfThatType === seenCount) {
          matchIndex = j;
          break;
        }
      }
    }

    if (matchIndex === -1) {
      auditIssues.push({ boss: bossName, issue: `Unexpected or duplicate tab "${rawLabel}"` });
      continue;
    }

    const styleName = expectedSetups[matchIndex];
    expectedUsed[matchIndex] = true;
    console.log(`✅ Matched tab "${rawLabel}" to setup "${styleName}"`);

    const gear = extractGearFromSlice($tab, rawLabel, bossName);
    ensureAllSlotsPresent(gear, styleName, bossName, metadata);
    gear_setups[styleName] = gear;
  }

  const missingStyles = expectedSetups.filter((_, idx) => !expectedUsed[idx]);
  if (missingStyles.length > 0) {
    auditIssues.push({ boss: bossName, missing_tabs: missingStyles });
    console.warn(`⚠️ Missing tabs for ${bossName}:`, missingStyles);
  }

  const output = {
    name: bossName,
    category: meta.category || '',
    wiki_link: meta.wiki_link,
    gear_setups,
    missing_styles: missingStyles
  };

  const fileName = bossName.replace(/\s+/g, '-').toLowerCase() + '.json';
  fs.writeFileSync(path.join(gearOutputPath, fileName), JSON.stringify(output, null, 2));
  console.log(`💾 Gear saved for ${bossName}: ${fileName}`);

  return auditIssues;
}

(async () => {
  const allAuditIssues = [];

  for (const [bossName, meta] of Object.entries(metadata)) {
    if (!meta.strategy_link || !meta.setups) continue;
    const issues = await fetchGearSetupsForBoss(bossName, meta);
    if (issues && issues.length) allAuditIssues.push(...issues);
  }

  const auditPath = path.join(__dirname, 'staging', 'boss_gear_scrape', 'audit_gear_issues.json');
  fs.writeFileSync(auditPath, JSON.stringify(allAuditIssues, null, 2));
  console.log(`📝 Audit log written to ${auditPath}`);
})();
