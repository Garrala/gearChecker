const axios = require('axios');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const beautify = require('js-beautify').html;

// Load metadata
const metadata = JSON.parse(fs.readFileSync('../boss_metadata.json', 'utf8'));

const baseFolder = path.join(__dirname, 'staging', 'boss_html_dumps');
if (fs.existsSync(baseFolder)) {
  fs.rmSync(baseFolder, { recursive: true, force: true });
}
fs.mkdirSync(baseFolder);

async function downloadAndSaveHtml(name, url, type, subfolder = null) {
  try {
    const response = await axios.get(url);
    const cleanName = name.replace(/\s+/g, '_').toLowerCase();
    const mainFolder = path.join(baseFolder, cleanName);
    if (!fs.existsSync(mainFolder)) fs.mkdirSync(mainFolder);

    const folderPath = subfolder
      ? path.join(mainFolder, subfolder.toLowerCase().replace(/\s+/g, '_'))
      : mainFolder;

    if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath);

    if (type === 'monster') {
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
    } else {
      const filePath = path.join(folderPath, `${type}.html`);
      fs.writeFileSync(filePath, response.data, 'utf8');
      console.log(`✅ Saved [${type}] HTML for ${name} → ${filePath}`);
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

