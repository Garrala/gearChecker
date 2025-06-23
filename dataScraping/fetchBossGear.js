const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const { fetchMonsterStats } = require('./helpers/stat_helpers');

const simpleUrls = {
  "Abyssal Sire": {
    strategy: "https://oldschool.runescape.wiki/w/Abyssal_Sire/Strategies",
    monster: "https://oldschool.runescape.wiki/w/Abyssal_Sire"
  },
  "Chaos Fanatic": {
    strategy: "https://oldschool.runescape.wiki/w/Chaos_Fanatic/Strategies",
    monster: "https://oldschool.runescape.wiki/w/Chaos_Fanatic"
  },
  "Commander Zilyana": {
    strategy: "https://oldschool.runescape.wiki/w/Commander_Zilyana/Strategies",
    monster: "https://oldschool.runescape.wiki/w/Commander_Zilyana"
  },
  "Crazy Archaeologist": {
    strategy: "https://oldschool.runescape.wiki/w/Crazy_archaeologist/Strategies",
    monster: "https://oldschool.runescape.wiki/w/Crazy_archaeologist"
  },
  "Deranged Archaeologist": {
    strategy: "https://oldschool.runescape.wiki/w/Deranged_archaeologist/Strategies",
    monster: "https://oldschool.runescape.wiki/w/Deranged_archaeologist"
  },
  "Duke Sucellus": {
    strategy: "https://oldschool.runescape.wiki/w/Duke_Sucellus/Strategies",
    monster: "https://oldschool.runescape.wiki/w/Duke_Sucellus"
  },
  "General Graardor": {
    strategy: "https://oldschool.runescape.wiki/w/General_Graardor/Strategies",
    monster: "https://oldschool.runescape.wiki/w/General_Graardor"
  },
  "Giant Mole": {
    strategy: "https://oldschool.runescape.wiki/w/Giant_Mole/Strategies",
    monster: "https://oldschool.runescape.wiki/w/Giant_Mole"
  },
  "Hespori": {
    strategy: "https://oldschool.runescape.wiki/w/Hespori/Strategies",
    monster: "https://oldschool.runescape.wiki/w/Hespori"
  },
  "King Black Dragon": {
    strategy: "https://oldschool.runescape.wiki/w/King_Black_Dragon/Strategies",
    monster: "https://oldschool.runescape.wiki/w/King_Black_Dragon"
  }
};

const outputFolder = path.join(__dirname, 'boss_gear_scrape');
const expectedStylesPath = path.join(__dirname, 'expectedGearStyles.json');
const categoryPath = path.join(__dirname, 'expectedMonsterCategories.json');
const expectedGearStyles = JSON.parse(fs.readFileSync(expectedStylesPath, 'utf8'));
const expectedCategories = JSON.parse(fs.readFileSync(categoryPath, 'utf8'));

if (!fs.existsSync(outputFolder)) {
  fs.mkdirSync(outputFolder);
}

function tightenParentheses(text) {
  return text.replace(/\s+\(([^)]+)\)/g, '($1)');
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

async function fetchGearAndStats(bossName, { strategy, monster }) {
  try {
    const response = await axios.get(strategy);
    const html = response.data;
    const $ = cheerio.load(html);

    const tabNames = $('div.tabber a[role="tab"], .tabber a.tabbertab')
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(name => name.length > 0);

    const tables = $('caption:contains("Recommended equipment for")').closest('table');
    const gearData = {};

    tables.each((i, table) => {
      let style = 'Unknown';
      const tabber = $(table).closest('.tabbertab');
      if (tabber.length > 0 && tabber.attr('data-title')) {
        style = tabber.attr('data-title').trim();
      } else {
        const captionText = $(table).find('caption').text().trim();
        const match = captionText.match(/for (.+)$/i);
        style = match ? match[1].trim() : 'Unknown';
      }

      if (tabNames[i]) {
        style = tabNames[i];
      }

      if (!gearData[style]) gearData[style] = {};

      $(table).find('tr').slice(1).each((_, row) => {
        const cells = $(row).find('td');
        if (cells.length === 0) return;

        const slotImg = $(cells[0]).find('img').first();
        const slotName = extractSlotName($, slotImg);
        if (!slotName) return;

        if (!gearData[style][slotName]) gearData[style][slotName] = [];

        let itemCells = cells.length > 1 ? Array.from(cells).slice(1) : [$(cells[0]).clone().find('img').remove().end()];

        itemCells.forEach(cell => {
          const names = new Set();
          $(cell).find('a[href]').each((_, a) => {
            const text = $(a).text().replace(/\[[a-z]\]/gi, '').trim();
            if (text) names.add(tightenParentheses(text));
          });

          if (names.size === 0) {
            $(cell).text().split(/(?:>|,|\/|\n)/).forEach(t => {
              const cleaned = tightenParentheses(t.replace(/\[[a-z]\]/gi, '').trim());
              if (cleaned && cleaned !== '') names.add(cleaned);
            });
          }

          const list = Array.from(names)
            .filter(name => name && name !== '')
            .flatMap(name =>
              name.toLowerCase() === "rada's blessing 3/2"
                ? ["Rada's blessing 3", "Rada's blessing 2"]
                : [name]
            );

          if (list.length) gearData[style][slotName].push(list);
        });
      });
    });

    const ALL_SLOTS = [
      'Helmet', 'Amulet', 'Cape', 'Body', 'Legs', 'Gloves',
      'Boots', 'Ring', 'Ammo', 'Shield', 'Weapon', 'Special Attack'
    ];

    for (const style of Object.keys(gearData)) {
      for (const slot of ALL_SLOTS) {
        if (!gearData[style][slot]) {
          gearData[style][slot] = [["N/A"]];
        }
      }
    }

    const expected = expectedGearStyles[bossName] || [];
    const actual = Object.keys(gearData);
    const extraStyles = actual.filter(style => !expected.includes(style));
    const knownStyles = expected.filter(style => actual.includes(style));

    const trimmedGearData = Object.fromEntries(knownStyles.map(style => [style, gearData[style]]));
    const bosses = await fetchMonsterStats(monster, bossName);

    const result = {
      name: bossName,
      category: expectedCategories[bossName]?.[0] || 'Unknown',
      image: bosses[0]?.image || '',
      wiki_link: monster,
      bosses,
      gear_setups: trimmedGearData,
      extra_styles: extraStyles
    };

    const fileName = `${bossName.replace(/\s+/g, '-').toLowerCase()}.json`;
    const filePath = path.join(outputFolder, fileName);
    fs.writeFileSync(filePath, JSON.stringify(result, null, 2));
    console.log(`✅ Wrote ${filePath}`);
  } catch (err) {
    console.error(`❌ Failed ${bossName}:`, err.message);
  }
}

(async () => {
  for (const [bossName, urls] of Object.entries(simpleUrls)) {
    await fetchGearAndStats(bossName, urls);
  }
})();
