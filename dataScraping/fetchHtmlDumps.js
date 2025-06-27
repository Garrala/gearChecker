const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const beautify = require('js-beautify').html;
const cheerio = require('cheerio');

const metadata = require('../boss_metadata.json');

const OUTPUT_DIR = path.join(__dirname, 'staging', 'boss_html_dumps');
const STRATEGY_DIR = path.join(__dirname, 'staging', 'strategy_html_dumps');

for (const dir of [OUTPUT_DIR, STRATEGY_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function breakTagsToNewLines(html) {
  return html
    .replace(/</g, '\n<')
    .replace(/>/g, '>\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function sanitizeTab(tab) {
  return tab.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

async function scrapeSimple(page, monsterName, bossDir, bossFolder, customFilename = null) {
  const infoboxHandle = await page.$('.infobox-monster');
  if (!infoboxHandle) {
    console.warn(`✗ No infobox found for ${monsterName}`);
    return;
  }

  const rawHtml = await infoboxHandle.evaluate(el => el.outerHTML);

  const fullHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="UTF-8"><title>${monsterName}</title></head>
    <body>${rawHtml}</body>
    </html>
  `;

  const prettyHtml = breakTagsToNewLines(beautify(fullHtml, {
    indent_size: 2,
    wrap_line_length: 120,
    preserve_newlines: true,
    max_preserve_newlines: 2
  }));

  const filename = customFilename || `${bossFolder}.html`;
  fs.writeFileSync(path.join(bossDir, filename), prettyHtml);
  console.log(`✓ Saved default infobox for ${monsterName} → ${filename}`);
}


async function scrapeTabs(page, monsterName, bossDir, bossFolder, buttonSelector) {
  const seenTabs = new Set();
  const buttons = await page.$$(buttonSelector);

  for (const button of buttons) {
    const tabName = await button.innerText() || await button.getAttribute('data-hash') || 'unknown';
    const sanitized = sanitizeTab(tabName);
    if (seenTabs.has(sanitized)) continue;
    seenTabs.add(sanitized);

    console.log(`Clicking tab: ${tabName}`);
    await button.click();
    await page.waitForTimeout(1000);

    const infobox = await page.$('.infobox-monster');
    if (infobox) {
      const rawHtml = await infobox.innerHTML();
      const $ = cheerio.load(rawHtml);
      const prettyHtml = breakTagsToNewLines($.html());
      fs.writeFileSync(path.join(bossDir, `${bossFolder}_${sanitized}.html`), prettyHtml);
      console.log(`✓ Saved tab [${tabName}]`);
    } else {
      console.warn(`✗ No infobox for tab ${tabName}`);
    }
  }
}

async function scrapeTopTabsOnly(page, monsterName, bossDir, bossFolder) {
  await scrapeTabs(page, monsterName, bossDir, bossFolder, '.infobox-buttons .button');
}

async function scrapeNestedTabs(page, monsterName, bossDir, bossFolder) {
  console.log(`🧭 Starting nested tab scrape for ${monsterName}`);
  const outerTabs = await page.$$('.infobox-buttons .button');

  if (outerTabs.length === 0) {
    console.warn(`⚠️ No outer tabs found for ${monsterName}`);
    return;
  }

  const outer = outerTabs[0];
  const outerName = await outer.innerText();
  const outerSanitized = sanitizeTab(outerName);
  console.log(`🔸 Using first outer tab: ${outerName}`);

  try {
    await outer.click();
    console.log(`✅ Clicked outer tab: ${outerName}`);
    await page.waitForTimeout(800);
  } catch (err) {
    console.warn(`⚠️ Could not click first outer tab "${outerName}": ${err.message}`);
    return;
  }

  const innerTabs = await page.$$('.tabbernav > li > a');
  console.log(`  └ Found ${innerTabs.length} inner tab(s) under outer tab "${outerName}"`);

  const seenCombos = new Set();

  for (let j = 0; j < innerTabs.length; j++) {
    const innerTabsFresh = await page.$$('.tabbernav > li > a');
    const inner = innerTabsFresh[j];

    const innerName = await inner.innerText();
    if (!innerName || innerName.toLowerCase().includes('asleep')) {
      console.log(`    ⏭️ Skipping invalid inner tab: "${innerName}"`);
      continue;
    }

    const innerSanitized = sanitizeTab(innerName);
    const filename = `${bossFolder}_${outerSanitized}_${innerSanitized}.html`;

    if (seenCombos.has(filename)) {
      console.log(`    🔁 Already scraped: ${filename}`);
      continue;
    }
    seenCombos.add(filename);

    try {
      console.log(`    🔹 Clicking inner tab: ${innerName}`);
      await inner.click({ timeout: 3000 });
      console.log(`    ✅ Clicked inner tab: ${innerName}`);
      await page.waitForTimeout(800);

      const infobox = await page.$('.infobox-monster');
      if (infobox) {
        const rawHtml = await infobox.innerHTML();
        const $ = cheerio.load(rawHtml);
        const prettyHtml = breakTagsToNewLines($.html());
        fs.writeFileSync(path.join(bossDir, filename), prettyHtml);
        console.log(`    💾 Saved: ${filename}`);
      } else {
        console.warn(`    ⚠️ No infobox found for ${outerName} > ${innerName}`);
      }
    } catch (err) {
      console.warn(`    ⚠️ Failed to click/save [${outerName} > ${innerName}]: ${err.message}`);
    }
  }

  console.log(`✅ Finished nested scrape for ${monsterName} (first outer tab only)`);
}



async function scrapeStrategyPage(page, monsterName, strategyUrl, strategyBossDir) {
  try {
    console.log(`📘 Downloading strategy for ${monsterName}`);
    await page.goto(strategyUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    const fullHtml = await page.content();
    const prettyHtml = beautify(fullHtml, {
      indent_size: 2,
      wrap_line_length: 120,
      preserve_newlines: true,
      max_preserve_newlines: 2
    });

    fs.writeFileSync(path.join(strategyBossDir, 'strategy.html'), prettyHtml);
    console.log(`✅ Strategy saved`);
  } catch (err) {
    console.warn(`⚠️ Strategy failed for ${monsterName}: ${err.message}`);
  }
}

async function downloadWithPlaywright(monsterName, url, scrapeMode, monsterLinks, parentFolderOverride = null) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const bossFolder = parentFolderOverride || monsterName.replace(/\s+/g, '_').toLowerCase();
  const bossDir = path.join(OUTPUT_DIR, bossFolder);
  const strategyBossDir = path.join(STRATEGY_DIR, bossFolder);
  for (const dir of [bossDir, strategyBossDir]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  try {
    console.log(`🌐 Visiting: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    switch (scrapeMode) {
      case 'phased':
        await scrapeTabs(page, monsterName, bossDir, bossFolder, '.infobox-buttons .button');
        break;
      case 'top_tabs':
        await scrapeTopTabsOnly(page, monsterName, bossDir, bossFolder);
        break;
      case 'nested_tabs':
        await scrapeNestedTabs(page, monsterName, bossDir, bossFolder);
        break;
      case 'multi_monster':
        for (const link of monsterLinks || []) {
          const subSlug = link.split('/').pop().toLowerCase(); // e.g., dagannoth_rex
          const subName = subSlug.replace(/_/g, ' ');
          const subFolder = monsterName.replace(/\s+/g, '_').toLowerCase(); // stay in the parent dir

          console.log(`↳ Scraping sub-monster: ${subName} from ${link}`);
          await page.goto(link, { waitUntil: 'domcontentloaded', timeout: 30000 });

          await scrapeSimple(page, subName, path.join(OUTPUT_DIR, subFolder), subFolder, `${subSlug}.html`);
        }
        break;
      case 'simple':
      default:
        await scrapeSimple(page, monsterName, bossDir, bossFolder);
        break;
    }

    const strategyUrl = metadata[monsterName]?.strategy_link;
    if (strategyUrl) {
      await scrapeStrategyPage(page, monsterName, strategyUrl, strategyBossDir);
    }

  } catch (err) {
    console.error(`❌ Error on ${monsterName}:`, err.message);
  } finally {
    await browser.close();
  }
}

(async () => {
  for (const [monsterName, data] of Object.entries(metadata)) {
    if (!data.wiki_link) {
      console.warn(`⚠️ Skipping ${monsterName} — no wiki_link`);
      continue;
    }

    const scrapeMode = data.scrape_mode || 'simple';
    const monsterLinks = data.monster_links || [];
    await downloadWithPlaywright(monsterName, data.wiki_link, scrapeMode, monsterLinks);
  }
})();
