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
  const filePath = path.join(__dirname, 'staging', 'strategy_html_dump', safeFolderName, 'strategy.html');

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

  const expectedMappings = [
    { from: 'solo melee', to: 'Stat Draining' },
    { from: 'solo melee', to: 'Quick-Pool' },
    { from: 'dolo', to: 'Dolo' },
    { from: 'fewer stat drains', to: 'Fewer stat drains' },
    { from: 'team melee', to: '3–7 players strategy' },
    { from: 'melee masses', to: 'Mass strategy' },
    { from: 'ranged masses', to: 'Ranged' }
  ];

  const normalize = s => s.toLowerCase().replace(/\s+/g, ' ').trim();

  const gear_setups = {};
  const auditIssues = [];
  const used = new Array(expectedMappings.length).fill(false);
  const matchCounts = {}; // Tracks how many of each label we've seen

  for (let i = 0; i < gearSlices.length; i++) {
    const tab = gearSlices[i];
    const rawLabel = tab.attr('data-title')?.trim() || `Unknown ${i + 1}`;
    const normalized = normalize(rawLabel);

    matchCounts[normalized] = (matchCounts[normalized] || 0) + 1;
    const seenCount = matchCounts[normalized];

    // Match based on order of appearance
    let matchIndex = -1;
    let seenSoFar = 0;
    for (let j = 0; j < expectedMappings.length; j++) {
      if (normalize(expectedMappings[j].from) === normalized) {
        seenSoFar++;
        if (seenSoFar === seenCount && !used[j]) {
          matchIndex = j;
          break;
        }
      }
    }


    if (matchIndex === -1) {
      auditIssues.push({ boss: bossName, issue: `Unexpected or duplicate tab "${rawLabel}"` });
      continue;
    }

    const styleName = expectedMappings[matchIndex].to;
    used[matchIndex] = true;

    const $tab = cheerio.load(tab.html());
    const gear = extractGearFromSlice($tab, styleName, bossName);
    ensureAllSlotsPresent(gear, styleName, bossName, metadata);
    gear_setups[styleName] = gear;
  }

  const missingStyles = expectedMappings
    .map((map, idx) => (!used[idx] ? map.to : null))
    .filter(Boolean);

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
  console.log(`💾 Custom gear saved for ${bossName}: ${fileName}`);

  return auditIssues;
}





async function fetchKalphiteQueenGearSetups(bossName, meta) {
  console.log(`\n🔧 Using custom handler for ${bossName}`);
  const rawHtml = fs.readFileSync(
    path.join(__dirname, 'staging', 'strategy_html_dump', 'kalphite_queen', 'strategy.html'),
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
      subPhases.each((_, subTab) => {
        const subLabel = $(subTab).attr('data-title')?.trim();
        if (!subLabel) return;
        const fullLabel = `${label.trim()} ${subLabel}`.replace(/\s+/g, ' ');
        const subTab$ = cheerio.load($(subTab).html());

        const gear = extractGearFromSlice(subTab$, fullLabel, bossName);
        ensureAllSlotsPresent(gear, fullLabel, bossName, metadata);
        gear_setups[fullLabel] = gear;
      });
    } else if (!label.match(/^Phase \d/)) {
      // Only extract if it's not a generic phase tab on its own
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

async function fetchPerilousMoonsGearSetups(bossName, meta) {
  console.log(`\n🔧 Using custom handler for ${bossName}`);
  const rawHtml = fs.readFileSync(
    path.join(__dirname, 'staging', 'strategy_html_dump', 'perilous_moons', 'strategy.html'),
    'utf8'
  );
  const $ = cheerio.load(rawHtml);
  const gear_setups = {};
  const auditIssues = [];

  // 🔹 Step 1: Extract shared armor
  let sharedArmor = {};
  $('table.wikitable').each((_, el) => {
    const caption = $(el).find('caption').text().toLowerCase();
    if (caption.includes('moons of peril armour')) {
      const armor$ = cheerio.load($(el).html());
      sharedArmor = extractSharedArmor($, bossName);
    }
  });

  if (Object.keys(sharedArmor).length === 0) {
    console.warn(`⚠️ Could not find shared armor table for ${bossName}`);
    auditIssues.push({ boss: bossName, issue: 'Missing shared armor table' });
  }

  // 🔹 Step 2: Handle each moon tab
  $('.tabbertab').each((_, tab) => {
    const label = $(tab).attr('data-title')?.trim() || 'Unknown';
    const tab$ = cheerio.load($(tab).html());
    const gear = extractGearFromSlice(tab$, label, bossName);

    // Add shared armor into every tab
    for (const [slot, items] of Object.entries(sharedArmor)) {
      if (!gear[slot]) {
        gear[slot] = items;
      }
    }

    ensureAllSlotsPresent(gear, label, bossName, metadata);
    gear_setups[label] = gear;
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

function extractSharedArmor($, bossName) {
  const armorTable = $('caption')
    .filter((_, el) =>
      $(el).text().toLowerCase().includes('moons of peril armour')
    )
    .closest('table.wikitable');

  if (!armorTable.length) {
    console.warn(`⚠️ Could not find shared armor table for ${bossName}`);
    return {};
  }

  // Rebuild a fake page with only the armor table so extractGearFromSlice works properly
  const armor$ = cheerio.load('<table>' + armorTable.html() + '</table>');

  const gear = extractGearFromSlice(armor$, 'Shared Armour', bossName);
  return gear;
}




const customScraperOverrides = {
  'Corporeal Beast': fetchCorporealGearSetups,
  'Kalphite Queen': fetchKalphiteQueenGearSetups,
  'Perilous Moons': fetchPerilousMoonsGearSetups
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
