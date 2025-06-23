const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const { fetchMonsterStats, downloadMonsterIcons } = require('./helpers/stat_helpers');

const outputFolder = path.join(__dirname, 'boss_gear_scrape');
if (!fs.existsSync(outputFolder)) fs.mkdirSync(outputFolder);

const monsterList = [
  {
    name: 'Wyrm',
    strategyUrl: 'https://oldschool.runescape.wiki/w/Slayer_task/Wyrms',
    monsterUrl: 'https://oldschool.runescape.wiki/w/Wyrm'
  }
];

function tightenParentheses(text) {
  return text.replace(/\s+\(([^)]+)\)/g, '($1)');
}

function cleanItemName(text) {
  return tightenParentheses(text.replace(/\[[a-zA-Z]\]/g, '').trim());
}

function extractSlotName($, cell) {
  const alt = $(cell).find('img').attr('alt')?.toLowerCase() || '';
  const slotMap = {
    'head': 'Helmet', 'helm': 'Helmet', 'helmet': 'Helmet', 'head slot': 'Helmet',
    'neck': 'Amulet', 'amulet': 'Amulet',
    'cape': 'Cape', 'back': 'Cape',
    'body': 'Body',
    'legs': 'Legs',
    'hands': 'Gloves', 'gloves': 'Gloves',
    'feet': 'Boots', 'boots': 'Boots',
    'ring': 'Ring',
    'ammo': 'Ammo', 'ammunition': 'Ammo',
    'weapon': 'Weapon',
    'shield': 'Shield',
    'special': 'Special Attack', 'spec': 'Special Attack'
  };
  for (const [key, value] of Object.entries(slotMap)) {
    if (alt.includes(key)) return value;
  }
  const fallbackText = $(cell).text().toLowerCase();
  for (const [key, value] of Object.entries(slotMap)) {
    if (fallbackText.includes(key)) return value;
  }
  return null;
}

async function fetchGearSetups(strategyUrl) {
  const res = await axios.get(strategyUrl);
  const $ = cheerio.load(res.data);

  const tables = $('caption:contains("Recommended equipment for")').closest('table');
  const gearData = {};

  tables.each((_, table) => {
    let style = $(table).find('caption').text().replace('Recommended equipment for', '').trim();
    if (!style) style = 'Default';

    if (!gearData[style]) gearData[style] = {};

    $(table).find('tr').slice(1).each((_, row) => {
      const cells = $(row).find('td');
      if (cells.length < 2) return;

      const slot = extractSlotName($, cells[0]) || $(cells[0]).text().trim();
      if (!slot || slot === '-' || slot === '–') return;

      const items = [];
      const seen = new Set();

      $(cells).slice(1).each((_, cell) => {
        const group = [];
        $(cell).find('a[href]').each((_, a) => {
          const name = cleanItemName($(a).text());
          if (name && !seen.has(name)) {
            seen.add(name);
            group.push(name);
          }
        });

        if (group.length === 0) {
          $(cell).text().split(/,|\/|\n/).forEach(t => {
            const cleaned = cleanItemName(t);
            if (cleaned && !seen.has(cleaned)) {
              seen.add(cleaned);
              group.push(cleaned);
            }
          });
        }

        if (group.length > 0) items.push(group);
      });

      gearData[style][slot] = items.length ? items : [['N/A']];
    });
  });

  return gearData;
}

async function scrapeMonster(monster) {
  console.log(`🔍 Scraping: ${monster.name}`);
  const bosses = await fetchMonsterStats(monster.monsterUrl, monster.name);
  const gear_setups = await fetchGearSetups(monster.strategyUrl);
  await downloadMonsterIcons(monster.name); // download if not already present

  const filenameSlug = monster.name.toLowerCase().replace(/\s+/g, '-');

  const result = {
    name: monster.name,
    category: 'Slayer',
    image: bosses[0]?.image || '',
    wiki_link: monster.monsterUrl,
    bosses,
    gear_setups
  };

  const filePath = path.join(outputFolder, `${filenameSlug}.json`);
  fs.writeFileSync(filePath, JSON.stringify(result, null, 2));
  console.log(`✅ Saved: ${filePath}`);
}

(async () => {
  for (const monster of monsterList) {
    await scrapeMonster(monster);
  }
})();
