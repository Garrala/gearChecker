const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const simpleUrls = {
  "Abyssal Sire":"https://oldschool.runescape.wiki/w/Abyssal_Sire/Strategies",
  "Chaos Fanatic": "https://oldschool.runescape.wiki/w/Chaos_Fanatic/Strategies",
  "Commander Zilyana": "https://oldschool.runescape.wiki/w/Commander_Zilyana/Strategies",
  "Crazy Archaeologist": "https://oldschool.runescape.wiki/w/Crazy_archaeologist/Strategies",
  "Deranged Archaeologist": "https://oldschool.runescape.wiki/w/Deranged_archaeologist/Strategies",
  "Duke Sucellus": "https://oldschool.runescape.wiki/w/Duke_Sucellus/Strategies",
  "General Graardor": "https://oldschool.runescape.wiki/w/General_Graardor/Strategies",
  "Giant Mole": "https://oldschool.runescape.wiki/w/Giant_Mole/Strategies",
  "Hespori": "https://oldschool.runescape.wiki/w/Hespori/Strategies",
  "King Black Dragon": "https://oldschool.runescape.wiki/w/King_Black_Dragon/Strategies",
};




const outputFolder = path.join(__dirname, 'boss_gear_scrape');
const expectedStylesPath = path.join(__dirname, 'expectedGearStyles.json');
const expectedGearStyles = JSON.parse(fs.readFileSync(expectedStylesPath, 'utf8'));

if (!fs.existsSync(outputFolder)) {
  fs.mkdirSync(outputFolder);
}

function extractSlotName(cellOrImg) {
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

function tightenParentheses(text) {
  return text.replace(/\s+\(([^)]+)\)/g, '($1)');
}

async function fetchGearFromWiki(bossName, url) {
  try {
    const response = await axios.get(url);
    const html = response.data;
    $ = cheerio.load(html);

    // Capture gear tab names
    const tabNames = $('div.tabber a[role="tab"], .tabber a.tabbertab')
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(name => name.length > 0);

    const tables = $('caption:contains("Recommended equipment for")').closest('table');
    if (tables.length === 0) {
      console.warn(`⚠️ No Recommended section found for ${bossName}.`);
      return;
    }

    const gearData = {};
    const usedTabNames = [];

    tables.each((i, table) => {
      let style = 'Unknown';

      const tabber = $(table).closest('.tabbertab');
      if (tabber.length > 0 && tabber.attr('data-title')) {
        style = tabber.attr('data-title').trim();
      } else {
        // Fall back to caption text if no tab exists (for single-style bosses)
        const captionText = $(table).find('caption').text().trim();
        const match = captionText.match(/for (.+)$/i);
        style = match ? match[1].trim() : 'Unknown';
      }

      // Override with matching tab if available
      if (tabNames[i]) {
        style = tabNames[i];
        usedTabNames.push(style);
      }

      if (!gearData[style]) gearData[style] = {};

      $(table).find('tr').slice(1).each((_, row) => {
        const cells = $(row).find('td');
        if (cells.length === 0) return;

        const slotImg = $(cells[0]).find('img').first();
        const slotName = extractSlotName(slotImg);
        if (!slotName) {
          console.warn(`⚠️ Could not determine slot in row:`, $(cells[0]).text().trim());
          return;
        }

        if (!gearData[style][slotName]) gearData[style][slotName] = [];

        let itemCells = [];
        if (cells.length > 1) {
          itemCells = Array.from(cells).slice(1).map(cell => $(cell));
        } else {
          const clone = $(cells[0]).clone();
          clone.find('img').remove();
          if (clone.text().trim()) {
            itemCells = [clone];
          }
        }

        itemCells.forEach(cell => {
          const names = [];
          const seen = new Set();

          const links = $(cell).find('a[href]');
          if (links.length > 0) {
            links.each((_, a) => {
              const text = $(a).text().replace(/\[[a-z]\]/gi, '').trim();
              const tightened = tightenParentheses(text);
              if (tightened && !seen.has(tightened)) {
                seen.add(tightened);
                names.push(tightened);
              }
            });
          }

          if (names.length === 0) {
            $(cell).text().split(/(?:>|,|\/|\n)/).forEach(t => {
              const cleaned = t.replace(/\[[a-z]\]/gi, '').trim();
              const tightened = tightenParentheses(cleaned);
              if (tightened && !seen.has(tightened)) {
                seen.add(tightened);
                names.push(tightened);
              }
            });
          }

          const replacedNames = names.flatMap(name => {
            if (name.toLowerCase() === "rada's blessing 3/2") {
              return ["Rada's blessing 3", "Rada's blessing 2"];
            }
            return [name];
          });

          if (replacedNames.length > 0) {
            gearData[style][slotName].push(replacedNames);
          }
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

    const scrapedStyles = Object.keys(gearData);
    const expectedStyles = expectedGearStyles[bossName] || [];
    const extraStyles = scrapedStyles.filter(style => !expectedStyles.includes(style));
    const known = [];
    const unexpected = [];

    for (const style of scrapedStyles) {
      if (expectedStyles.includes(style)) {
        known.push([style, gearData[style]]);
      } else {
        unexpected.push(style);
      }
    }

    if (unexpected.length) {
      console.warn(`⚠️ Unexpected styles for ${bossName}:`, unexpected);
    }

    const trimmedGearData = Object.fromEntries(known);
    const output = {
      gear_setups: trimmedGearData,
      extra_styles: extraStyles
    };

    const fileName = `${bossName.replace(/\s+/g, '-').toLowerCase()}.json`;
    const filePath = path.join(outputFolder, fileName);

    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    fs.writeFileSync(filePath, JSON.stringify(output, null, 2));
    console.log(`✅ Wrote gear for ${bossName} to ${filePath}`);
  } catch (err) {
    console.error(`❌ Failed to fetch gear for ${bossName}:`, err.message);
  }
}


(async () => {
  for (const [bossName, url] of Object.entries(simpleUrls)) {
    await fetchGearFromWiki(bossName, url);
  }
})();
