const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const expectedGearStyles = require('./expectedGearStyles.json');

const outputFolder = path.join(__dirname, 'boss_gear_scrape');

const complexUrls = {
  "Corporeal Beast": "https://oldschool.runescape.wiki/w/Corporeal_Beast/Strategies",
  "Dagannoth Kings": "https://oldschool.runescape.wiki/w/Dagannoth_Kings/Strategies",
  "Grotesque Guardians": "https://oldschool.runescape.wiki/w/Grotesque_Guardians/Strategies",
  "Kalphite Queen": "https://oldschool.runescape.wiki/w/Kalphite_Queen/Strategies",
  "Vorkath": "https://oldschool.runescape.wiki/w/Vorkath/Strategies"
};

// ========== Slot Mapping + Helpers ==========

function tightenParentheses(text) {
  return text.replace(/\s+\(([^)]+)\)/g, '($1)');
}

function extractSlotName($, img) {
  const alt = $(img).attr('alt')?.toLowerCase() || '';
  const title = $(img).closest('a').attr('title')?.toLowerCase() || '';
  const slotMap = {
    'head': 'Helmet', 'helm': 'Helmet', 'helmet': 'Helmet',
    'neck': 'Amulet', 'amulet': 'Amulet',
    'cape': 'Cape', 'back': 'Cape',
    'body': 'Body', 'legs': 'Legs',
    'hands': 'Gloves', 'gloves': 'Gloves',
    'feet': 'Boots', 'boots': 'Boots',
    'ring': 'Ring', 'ammo': 'Ammo',
    'weapon': 'Weapon', 'shield': 'Shield',
    'special attack': 'Special Attack', 'spec': 'Special Attack'
  };
  for (const key in slotMap) {
    if (alt.includes(key) || title.includes(key)) return slotMap[key];
  }
  return null;
}

// ========== Individual Boss Scrapers ==========

async function scrapeKalphiteQueen(bossName, url) {
  const response = await axios.get(url);
  const $ = cheerio.load(response.data);

  const tables = $('caption:contains("Recommended equipment")').closest('table');
  const overrideStyles = expectedGearStyles[bossName];
  const gearData = {};

  tables.each((i, table) => {
    const style = overrideStyles[i];
    if (!style) return;

    gearData[style] = {};

    $(table).find('tr').slice(1).each((_, row) => {
      const cells = $(row).find('td');
      if (cells.length < 2) return;

      const slotImg = $(cells[0]).find('img').first();
      const slotName = extractSlotName($, slotImg);
      if (!slotName) return;

      if (!gearData[style][slotName]) gearData[style][slotName] = [];

      $(cells).slice(1).each((_, cell) => {
        const links = $(cell).find('a[href]');
        const items = [];

        links.each((_, a) => {
          const name = tightenParentheses($(a).text().trim());
          if (name.toLowerCase() === "rada's blessing 3/2") {
            items.push("Rada's blessing 3", "Rada's blessing 2");
          } else if (name) {
            items.push(name);
          }
        });

        if (items.length === 0) {
          const raw = $(cell).text().trim();
          items.push(...raw.split(/\/|,/).map(s => s.trim()).filter(Boolean));
        }

        if (items.length > 0) {
          gearData[style][slotName].push(items);
        }
      });
    });

    // Fill all empty slots
    const ALL_SLOTS = [
      'Helmet', 'Amulet', 'Cape', 'Body', 'Legs', 'Gloves',
      'Boots', 'Ring', 'Ammo', 'Shield', 'Weapon', 'Special Attack'
    ];
    for (const slot of ALL_SLOTS) {
      if (!gearData[style][slot]) {
        gearData[style][slot] = [["N/A"]];
      }
    }
  });

  const scrapedStyles = Object.keys(gearData);
  const expected = overrideStyles || [];
  const extraStyles = scrapedStyles.filter(s => !expected.includes(s));

  const known = [];
  const unexpected = [];

  for (const style of scrapedStyles) {
    if (expected.includes(style)) {
      known.push([style, gearData[style]]);
    } else {
      unexpected.push(style);
    }
  }

  if (unexpected.length > 0) {
    console.warn(`⚠️ Unexpected styles for ${bossName}:`, unexpected);
  }

  const trimmedGearData = Object.fromEntries(known);
  const output = {
    gear_setups: trimmedGearData,
    extra_styles: extraStyles
  };

  const fileName = `${bossName.replace(/\s+/g, '-').toLowerCase()}.json`;
  const outputPath = path.join(outputFolder, fileName);

  if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`✅ Wrote gear for ${bossName} to ${outputPath}`);
}

// ========== Complex Scraper Runner ==========

const complexScrapers = {
  "Kalphite Queen": scrapeKalphiteQueen,
  // "Vorkath": scrapeVorkath,
  // "Corporeal Beast": scrapeCorpBeast,
  // "Dagannoth Kings": scrapeDagKings,
  // "Grotesque Guardians": scrapeGrotesques
};

async function runComplexScrapers() {
  for (const [bossName, url] of Object.entries(complexUrls)) {
    const scraper = complexScrapers[bossName];
    if (typeof scraper === 'function') {
      await scraper(bossName, url);
    } else {
      console.warn(`⚠️ No scraper defined for ${bossName}, skipping.`);
    }
  }
}

// ========== Entry Point ==========

(async () => {
  if (!fs.existsSync(outputFolder)) {
    fs.mkdirSync(outputFolder);
  }
  await runComplexScrapers();
})();
