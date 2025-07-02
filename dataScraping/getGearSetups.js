const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const { extractGearFromSlice, ensureAllSlotsPresent } = require('./helpers/gear_helpers');

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

  $('.tabbertab').each((_, el) => gearSlices.push($(el)));

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

async function fetchCorporealGearSetups(bossName, meta) {
  console.log(`\n🔧 Using custom handler for ${bossName}`);
  const gearSlices = fetchGearTabberHtml(bossName);

  const styles = {
    'Stat Draining': 'Stat Draining',
    'Quick-Pool': 'Quick-Pool',
    'Dolo': 'Dolo',
    'Fewer stat drains': 'Fewer stat drains',
    '3–7 players strategy': '3–7 Players',
    'Mass strategy': 'Mass',
    'Ranged': 'Ranged'
  };

  const gear_setups = {};
  const auditIssues = [];

  for (const [labelMatch, styleName] of Object.entries(styles)) {
    const slice = gearSlices.find(slice => slice.attr('data-title')?.includes(labelMatch));
    if (!slice) {
      auditIssues.push({ boss: bossName, issue: `Missing gear tab "${labelMatch}"` });
      continue;
    }

    const $tab = cheerio.load(slice.html());
    const gear = extractGearFromSlice($tab, styleName, bossName);
    ensureAllSlotsPresent(gear, styleName, bossName, metadata);
    gear_setups[styleName] = gear;
  }

  const output = {
    name: bossName,
    category: meta.category || '',
    wiki_link: meta.wiki_link,
    gear_setups,
    missing_styles: []
  };

  const fileName = bossName.replace(/\s+/g, '-').toLowerCase() + '.json';
  fs.writeFileSync(path.join(gearOutputPath, fileName), JSON.stringify(output, null, 2));
  console.log(`💾 Custom gear saved for ${bossName}: ${fileName}`);

  return auditIssues;
}

async function fetchKalphiteQueenGearSetups(bossName, meta) {
  console.log(`\n🔧 Using custom handler for ${bossName}`);
  const rawHtml = fs.readFileSync(
    path.join(__dirname, 'staging', 'strategy_html_dumps', 'kalphite_queen', 'strategy.html'),
    'utf8'
  );
  const $ = cheerio.load(rawHtml);
  const gear_setups = {};
  const auditIssues = [];

  $('.tabbertab').each((_, tab) => {
    const $tab = cheerio.load($(tab).html());
    const label = $(tab).attr('data-title')?.trim() || 'Unknown';
    const subPhases = $tab('.tabbertab');

    if (subPhases.length) {
      subPhases.each((__, subTab) => {
        const subLabel = $(subTab).attr('data-title')?.trim() || 'Unknown';
        const combinedLabel = `${label} (${subLabel})`;
        const $innerTab = cheerio.load($(subTab).html());
        const gear = extractGearFromSlice($innerTab, combinedLabel, bossName);
        ensureAllSlotsPresent(gear, combinedLabel, bossName, metadata);
        gear_setups[combinedLabel] = gear;
      });
    } else {
      const gear = extractGearFromSlice($tab, label, bossName);
      ensureAllSlotsPresent(gear, label, bossName, metadata);
      gear_setups[label] = gear;
    }
  });

  const output = {
    name: bossName,
    category: meta.category || '',
    wiki_link: meta.wiki_link,
    gear_setups,
    missing_styles: []
  };

  const fileName = bossName.replace(/\s+/g, '-').toLowerCase() + '.json';
  fs.writeFileSync(path.join(gearOutputPath, fileName), JSON.stringify(output, null, 2));
  console.log(`💾 Custom gear saved for ${bossName}: ${fileName}`);

  return auditIssues;
}

const customScraperOverrides = {
  'Corporeal Beast': fetchCorporealGearSetups,
  'Kalphite Queen': fetchKalphiteQueenGearSetups
};

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

  // Support CLI arg for a specific boss
  const arg = process.argv[2];
  const target = arg ? arg.toLowerCase().replace(/[_-]/g, ' ') : null;

  for (const [bossName, meta] of Object.entries(metadata)) {
    const normalized = bossName.toLowerCase().replace(/\s+/g, ' ');
    if (target && normalized !== target) continue;

    if (!meta.strategy_link || !meta.setups) continue;
    const fetchFn = customScraperOverrides[bossName] || fetchGearSetupsForBoss;
    const issues = await fetchFn(bossName, meta);
    if (issues && issues.length) allAuditIssues.push(...issues);
  }

  const auditPath = path.join(__dirname, 'staging', 'boss_gear_scrape', 'audit_gear_issues.json');
  fs.writeFileSync(auditPath, JSON.stringify(allAuditIssues, null, 2));
  console.log(`📝 Audit log written to ${auditPath}`);
})();
