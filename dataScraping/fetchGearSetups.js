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

  // Collect all tabber tabs (multi-style)
  $('.tabbertab').each((_, el) => {
    gearSlices.push($(el));
  });

  // Also collect lone wikitables with gear captions (single-style)
  $('table.wikitable').each((_, el) => {
    const caption = $(el).find('caption').text().toLowerCase();
    const isValid = caption.includes('recommended equipment') || caption.includes('recommended gear');
    const isInventory = $(el).hasClass('inventorytable');

    if (isValid && !isInventory) {
      // Wrap in a fake tabbertab container for uniform parsing
      const fakeTab = $('<div class="tabbertab"></div>')
        .attr('data-title', caption.replace(/recommended (equipment|gear) for/i, '').trim() || 'Default')
        .append($(el).clone());

      gearSlices.push(fakeTab);
    }
  });

  return gearSlices;
}

async function fetchGearSetupsForBoss(bossName, meta) {
  const expectedSetups = meta.setups || [];
  const normalizedExpected = expectedSetups.map(normalizeLabel);
  const gearSlices = fetchGearTabberHtml(bossName);

  if (!gearSlices || gearSlices.length === 0) {
    console.warn(`⚠️ No tabber sections found for ${bossName}`);
    return;
  }

  const gear_setups = {};
  const foundLabels = [];

  for (let i = 0; i < gearSlices.length; i++) {
    const tab = gearSlices[i];
    const $tab = cheerio.load(tab.html());
    const label = tab.attr('data-title')?.trim() || `Unknown ${i + 1}`;
    const normalized = normalizeLabel(label);

    if (normalizedExpected.includes(normalized)) {
      const gear = extractGearFromSlice($tab, label, bossName);
      const originalStyle = expectedSetups[normalizedExpected.indexOf(normalized)];
      ensureAllSlotsPresent(gear, originalStyle, bossName, metadata);
      gear_setups[expectedSetups[normalizedExpected.indexOf(normalized)]] = gear; // preserve original label casing
      foundLabels.push(normalized);
    } else {
      console.warn(`⚠️ ${bossName} has unexpected tab label: "${label}"`);
    }
  }


  const missing = normalizedExpected.filter(expected => !foundLabels.includes(expected));
  if (missing.length > 0) {
    const missingLabels = expectedSetups.filter(s => missing.includes(normalizeLabel(s)));
    console.warn(`⚠️ ${bossName} is missing expected setups:`, missingLabels);
  }

  const output = {
    name: bossName,
    category: meta.category || '',
    wiki_link: meta.wiki_link,
    gear_setups,
    extra_styles: gearSlices.length - Object.keys(gear_setups).length
  };

  const auditPath = path.join(__dirname, 'staging', 'boss_gear_scrape', 'audit_gear_issues.json');
  if (fs.existsSync(auditPath)) fs.unlinkSync(auditPath);
  fs.writeFileSync(auditPath, JSON.stringify(auditLog, null, 2));
  console.log(`📝 Audit log written to ${auditPath}`);

  const fileName = bossName.replace(/\s+/g, '-').toLowerCase() + '.json';
  fs.writeFileSync(path.join(gearOutputPath, fileName), JSON.stringify(output, null, 2));
  console.log(`✅ Gear saved for ${bossName}`);
}

(async () => {
  for (const [bossName, meta] of Object.entries(metadata)) {
    if (!meta.strategy_link || !meta.setups) continue;
    await fetchGearSetupsForBoss(bossName, meta);
  }
})();
