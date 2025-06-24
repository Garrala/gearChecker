const axios = require('axios');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const beautify = require('js-beautify').html;

const metadata = JSON.parse(fs.readFileSync('../boss_metadata.json', 'utf8'));
const baseFolder = path.join(__dirname, 'staging', 'boss_html_dumps');

if (fs.existsSync(baseFolder)) {
  fs.rmSync(baseFolder, { recursive: true, force: true });
}
fs.mkdirSync(baseFolder);

function normalizeName(name) {
  return name.replace(/\s+/g, '_').toLowerCase();
}

function createFolderStructure(base, name, subfolder = null) {
  const mainFolder = path.join(base, normalizeName(name));
  if (!fs.existsSync(mainFolder)) fs.mkdirSync(mainFolder);
  const folderPath = subfolder
    ? path.join(mainFolder, normalizeName(subfolder))
    : mainFolder;
  if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath);
  return folderPath;
}

function extractStrategySlice($, name) {
  const equipmentHeader = $('h2, h3').filter((_, el) =>
    $(el).find('.mw-headline').text().toLowerCase().includes('equipment')
  ).first();

  if (!equipmentHeader.length) {
    console.warn(`⚠️ No Equipment section found for ${name}`);
    return null;
  }

  const slice = $('<div></div>').append(equipmentHeader.clone());
  let current = equipmentHeader.next();

  while (current.length) {
    const tag = current.get(0).tagName;

    // Stop at next h2 to isolate the section
    if (tag === 'h2') break;

    slice.append(current.clone());
    current = current.next();
  }

  const containsTabberOrTable = slice.find('.tabber, .wikitable').length > 0;
  if (!containsTabberOrTable) {
    console.warn(`⚠️ Strategy section found for ${name}, but no obvious gear elements were matched. Consider manual inspection.`);
  }

  return slice;
}



async function downloadMonsterHtml(name, url, folderPath) {
  const response = await axios.get(url);
  const $ = cheerio.load(response.data);
  const tabButtons = $('.infobox-buttons .button');

  if (tabButtons.length === 0) {
    const infobox = $('table.infobox-monster').first();
    if (!infobox.length) {
      console.warn(`⚠️ No infobox found for ${name}`);
      return;
    }
    const filePath = path.join(folderPath, `monster.html`);
    fs.writeFileSync(filePath, beautify($.html(infobox), { indent_size: 2 }));
    console.log(`✅ Saved default monster for ${name} → ${filePath}`);
    return;
  }

  for (const button of tabButtons.toArray()) {
    const anchor = $(button).attr('data-switch-anchor');
    const label = $(button).text().trim().replace(/[^\w\s]/g, '').replace(/\s+/g, '_').toLowerCase();
    const phaseUrl = url + anchor;
    const phaseRes = await axios.get(phaseUrl);
    const $phase = cheerio.load(phaseRes.data);
    const infobox = $phase('table.infobox-monster').first();
    if (!infobox.length) {
      console.warn(`⚠️ No infobox for ${name} [${label}]`);
      continue;
    }

    const filePath = path.join(folderPath, `monster_${label}.html`);
    fs.writeFileSync(filePath, beautify($phase.html(infobox), { indent_size: 2 }));
    console.log(`✅ Saved [${label}] version of ${name} → ${filePath}`);
  }
}

async function downloadStrategyHtml(name, url, folderPath) {
  const response = await axios.get(url);
  const $ = cheerio.load(response.data);

  const slice = extractStrategySlice($, name);
  if (!slice) return;

  const filePath = path.join(folderPath, `strategy.html`);
  fs.writeFileSync(filePath, beautify(slice.html(), { indent_size: 2 }));
  console.log(`✅ Trimmed and saved strategy page for ${name} → ${filePath}`);
}

async function downloadAndSaveHtml(name, url, type, subfolder = null) {
  try {
    const folderPath = createFolderStructure(baseFolder, name, subfolder);
    if (type === 'monster') {
      await downloadMonsterHtml(name, url, folderPath);
    } else if (type === 'strategy') {
      await downloadStrategyHtml(name, url, folderPath);
    }
  } catch (err) {
    console.error(`❌ Failed [${type}] for ${name}:`, err.message);
  }
}

(async () => {
  for (const [name, meta] of Object.entries(metadata)) {
    const monsterUrls = Array.isArray(meta.monster_links)
      ? meta.monster_links
      : [meta.wiki_link];
    const strategyUrl = meta.strategy_link;

    for (const url of monsterUrls) {
      const subName = monsterUrls.length > 1
        ? url.split('/').pop().replace(/_/g, ' ')
        : null;

      await downloadAndSaveHtml(name, url, 'monster', subName);
    }

    if (strategyUrl) {
      await downloadAndSaveHtml(name, strategyUrl, 'strategy');
    }
  }
})();
