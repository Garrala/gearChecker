const ALL_SLOTS = [
  'Helmet', 'Amulet', 'Cape', 'Body', 'Legs', 'Gloves',
  'Boots', 'Ring', 'Ammo', 'Shield', 'Weapon', 'Special Attack'
];

const auditLog = [];

// Optional: Add any slot-specific post-processors here
const slotProcessors = {
  Helmet: entries => entries,
  Amulet: entries => entries,
  Cape: entries => entries,
  Body: entries => entries,
  Legs: entries => entries,
  Gloves: entries => entries,
  Boots: entries => entries,
  Ring: entries => entries,
  Ammo: entries => entries,
  Shield: entries => entries,
  Weapon: entries => entries,
  'Special Attack': entries => entries,
};

function tightenParentheses(text) {
  return text.replace(/\s+\(([^)]+)\)/g, '($1)');
}

function normalizeNA(entry) {
  const joined = Array.isArray(entry) ? entry.join('').toLowerCase().replace(/\W/g, '') : '';
  return joined === 'na' || joined === 'n/a' ? ['N/A'] : entry;
}

function extractSlotName($, cellOrImg) {
  let alt = '', title = '';
  if (typeof cellOrImg === 'string') {
    alt = title = cellOrImg.toLowerCase();
  } else {
    alt = $(cellOrImg).attr('alt')?.toLowerCase() || '';
    title = $(cellOrImg).closest('a').attr('title')?.toLowerCase() || '';
  }

  const slotMap = {
    'head': 'Helmet', 'helm': 'Helmet', 'helmet': 'Helmet', 'head slot': 'Helmet',
    'neck': 'Amulet', 'amulet': 'Amulet',
    'cape': 'Cape', 'back': 'Cape',
    'body': 'Body',
    'legs': 'Legs',
    'hands': 'Gloves', 'gloves': 'Gloves',
    'feet': 'Boots', 'boots': 'Boots',
    'ring': 'Ring',
    'ammo': 'Ammo', 'ammunition': 'Ammo', 'ammo/spell': 'Ammo',
    'weapon': 'Weapon',
    'shield': 'Shield',
    'special attack': 'Special Attack', 'spec': 'Special Attack'
  };

  if (slotMap[alt]) return slotMap[alt];
  if (slotMap[title]) return slotMap[title];

  for (const key of Object.keys(slotMap)) {
    if (alt.includes(key) || title.includes(key)) {
      return slotMap[key];
    }
  }

  return null;
}

function extractGearFromSlice($, label = 'Unnamed') {
  const result = {};
  const foundSlots = new Set();

  $('table').each((_, table) => {
    $(table).find('tr').each((_, tr) => {
      const cells = $(tr).find('td');
      if (cells.length === 0) return;

      const slotImg = $(cells[0]).find('img').first();
      const slotName = extractSlotName($, slotImg);
      if (!slotName || !ALL_SLOTS.includes(slotName)) return;

      foundSlots.add(slotName);
      if (!result[slotName]) result[slotName] = [];

      const itemCells = cells.length > 1
        ? Array.from(cells).slice(1)
        : [$(cells[0]).clone().find('img').remove().end()];

      itemCells.forEach(cell => {
        const names = new Set();
        $(cell).find('a[href]').each((_, a) => {
          const text = $(a).text().replace(/\[[a-z]\]/gi, '').trim();
          if (text) names.add(tightenParentheses(text));
        });

        if (names.size === 0) {
          $(cell).text().split(/(?:>|,|\/|\n)/).forEach(t => {
            const cleaned = tightenParentheses(t.replace(/\[[a-z]\]/gi, '').trim());
            if (cleaned) names.add(cleaned);
          });
        }

        const normalized = Array.from(names)
          .filter(name => name && name !== '')
          .flatMap(name =>
            name.toLowerCase() === "rada's blessing 3/2"
              ? ["Rada's blessing 3", "Rada's blessing 2"]
              : [name]
          );

        if (normalized.length) {
          result[slotName].push(normalizeNA(normalized));
        }
      });
    });
  });

  // Detect unrecognized or missing slots
  const missing = ALL_SLOTS.filter(slot => !foundSlots.has(slot));
  if (missing.length > 0) {
    console.warn(`⚠️  [${label}] Missing slots:`, missing);
  }

  const extra = Array.from(foundSlots).filter(slot => !ALL_SLOTS.includes(slot));
  if (extra.length > 0) {
    console.warn(`⚠️  [${label}] Unexpected slots found:`, extra);
  }

  return result;
}

function ensureAllSlotsPresent(setup, style, bossName, fullMetadata = {}) {
  const ALL_SLOTS = [
    'Helmet', 'Amulet', 'Cape', 'Body', 'Legs', 'Gloves',
    'Boots', 'Ring', 'Ammo', 'Shield', 'Weapon', 'Special Attack'
  ];

  const normalize = s => s.trim().toLowerCase().replace(/\s+/g, ' ');
  const normalizedStyle = normalize(style);

  const bossMeta = fullMetadata[bossName] || {};
  const missingMap = bossMeta.missing_slots || {};

  const normalizedMissing = Object.fromEntries(
    Object.entries(missingMap).map(([key, slots]) => [
      normalize(key),
      slots.map(normalize)
    ])
  );

  const whitelist = normalizedMissing[normalizedStyle] || [];

  //console.log(`\n🔍 Boss: ${bossName}`);
  //console.log(`🧪 Style: "${style}" → "${normalizedStyle}"`);
  //console.log(`📜 Whitelist:`, whitelist);

  const missingUnwhitelisted = [];
  const foundButWhitelisted = [];

  for (const slot of ALL_SLOTS) {
    const slotNorm = normalize(slot);
    const isPresent = !!setup[slot];

    if (!isPresent) {
      if (whitelist.includes(slotNorm)) {
        console.log(`✔️ Slot "${slot}" normalized to "${slotNorm}" is whitelisted`);
        setup[slot] = [["N/A"]];
      } else {
        console.warn(`❗ Slot "${slot}" normalized to "${slotNorm}" is NOT whitelisted`);
        setup[slot] = [["N/A"]];
        missingUnwhitelisted.push(slot);
      }
    } else {
      if (whitelist.includes(slotNorm)) {
        console.warn(`⚠️ Slot "${slot}" was whitelisted as missing but is actually present`);
        foundButWhitelisted.push(slot);
      }
    }
  }

  if (missingUnwhitelisted.length > 0) {
    auditLog.push({
      boss: bossName,
      style,
      type: 'missing',
      slots: missingUnwhitelisted
    });
  }

  if (foundButWhitelisted.length > 0) {
    auditLog.push({
      boss: bossName,
      style,
      type: 'unexpectedWhitelist',
      slots: foundButWhitelisted
    });
  }
}

function runSlotProcessors(gearSet) {
  for (const slot of ALL_SLOTS) {
    if (!gearSet[slot]) continue;
    const handler = slotProcessors[slot];
    gearSet[slot] = handler ? handler(gearSet[slot]) : gearSet[slot];
  }
}

module.exports = {
  ALL_SLOTS,
  extractGearFromSlice,
  ensureAllSlotsPresent,
  runSlotProcessors,
  extractSlotName,
  tightenParentheses,
  auditLog
};
