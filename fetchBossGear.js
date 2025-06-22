const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const simpleUrls = {
  "Chaos Fanatic": "https://oldschool.runescape.wiki/w/Chaos_Fanatic/Strategies",
  "Commander Zilyana": "https://oldschool.runescape.wiki/w/Commander_Zilyana/Strategies",
  "Crazy Archaeologist": "https://oldschool.runescape.wiki/w/Crazy_archaeologist/Strategies",
  "Deranged Archaeologist": "https://oldschool.runescape.wiki/w/Deranged_archaeologist/Strategies",
  "Duke Sucellus": "https://oldschool.runescape.wiki/w/Duke_Sucellus/Strategies",
  "General Graardor": "https://oldschool.runescape.wiki/w/General_Graardor/Strategies",
  "Giant Mole": "https://oldschool.runescape.wiki/w/Giant_Mole/Strategies",
  "Hespori": "https://oldschool.runescape.wiki/w/Hespori/Strategies",
  "Kalphite Queen": "https://oldschool.runescape.wiki/w/Kalphite_Queen/Strategies",
  "King Black Dragon": "https://oldschool.runescape.wiki/w/King_Black_Dragon/Strategies",
  "Vorkath": "https://oldschool.runescape.wiki/w/Vorkath/Strategies",
};

const complexUrls = {
  "Corporeal Beast": "https://oldschool.runescape.wiki/w/Corporeal_Beast/Strategies",
  "Dagannoth Kings": "https://oldschool.runescape.wiki/w/Dagannoth_Kings/Strategies",
  "Grotesque Guardians": "https://oldschool.runescape.wiki/w/Grotesque_Guardians/Strategies"
};

const outputFolder = path.join(__dirname, 'boss_gear_scrape');
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
    'head': 'Helmet',
    'helm': 'Helmet',
    'helmet': 'Helmet',
    'head slot': 'Helmet',
    'helm slot': 'Helmet',
    'neck': 'Amulet',
    'amulet': 'Amulet',
    'cape': 'Cape',
    'back': 'Cape',
    'body': 'Body',
    'legs': 'Legs',
    'hands': 'Gloves',
    'gloves': 'Gloves',
    'feet': 'Boots',
    'boots': 'Boots',
    'ring': 'Ring',
    'ammo': 'Ammo',
    'ammunition': 'Ammo',
    'ammo/spell': 'Ammo',
    'weapon': 'Weapon',
    'shield': 'Shield',
    'special attack': 'Special Attack',
    'spec': 'Special Attack'
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

    const tables = $('caption:contains("Recommended equipment for")').closest('table');

    if (tables.length === 0) {
      console.warn(`⚠️ No Recommended section found for ${bossName}.`);
      return;
    }

    const gearData = {};
    tables.each((_, table) => {
      const caption = $(table).find('caption').text();
      const styleMatch = caption.match(/for (.+)$/i);
      const style = styleMatch ? styleMatch[1] : 'Unknown';
      if (!gearData[style]) gearData[style] = {};

      $(table)
        .find('tr')
        .slice(1)
        .each((_, row) => {
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

            // Normalize known funky blessings
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

    const fileName = `${bossName.replace(/\s+/g, '-').toLowerCase()}.json`;
    const filePath = path.join(outputFolder, fileName);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    fs.writeFileSync(filePath, JSON.stringify(gearData, null, 2));
    console.log(`✅ Wrote gear for ${bossName} to ${filePath}`);
  } catch (err) {
    console.error(`❌ Failed to fetch gear for ${bossName}:`, err.message);
  }
}

(async () => {
  for (const [bossName, url] of Object.entries(simpleUrls)) {
    await fetchGearFromWiki(bossName, url);
  }

  for (const [bossName, url] of Object.entries(complexUrls)) {
    console.log(`⚠️ Skipping complex boss for now: ${bossName}`);
    // Optionally write an empty stub so your final merge doesn’t break
    const stubPath = path.join(outputFolder, `${bossName.replace(/\s+/g, '-').toLowerCase()}.json`);
    fs.writeFileSync(stubPath, JSON.stringify({ gear_setups: {}, unmatched_items: [] }, null, 2));
  }
})();

