const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const beautify = require('js-beautify').html;
const cheerio = require('cheerio');

const metadata = require('../boss_metadata.json');

// Output directories
const OUTPUT_DIR = path.join(__dirname, 'staging', 'boss_html_dumps');
const STRATEGY_DIR = path.join(__dirname, 'staging', 'strategy_html_dumps');

for (const dir of [OUTPUT_DIR, STRATEGY_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Monsters that use high-level primary tab groups (e.g., Duke Sucellus)
const PRIMARY_TAB_OVERRIDE = new Set([
  'duke sucellus',
  // add more here if needed
]);

// Simple formatter to break tags onto their own lines
function breakTagsToNewLines(html) {
  return html
    .replace(/</g, '\n<')
    .replace(/>/g, '>\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

async function downloadWithPlaywright(monsterName, url) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const bossFolder = monsterName.replace(/\s+/g, '_').toLowerCase();
  const bossDir = path.join(OUTPUT_DIR, bossFolder);
  const strategyBossDir = path.join(STRATEGY_DIR, bossFolder);

  for (const dir of [bossDir, strategyBossDir]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  try {
    console.log(`Visiting: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    const useTabbernav = PRIMARY_TAB_OVERRIDE.has(monsterName.toLowerCase());
    const buttonSelector = useTabbernav
      ? '.tabbernav > li > a'
      : '.infobox-buttons .button';
    const hasTabs = await page.$(buttonSelector);
    const seenTabs = new Set();

    if (hasTabs) {
      const buttons = await page.$$(buttonSelector);

      for (const button of buttons) {
        const tabName = await button.innerText() || await button.getAttribute('data-hash') || 'unknown';
        const sanitizedTab = tabName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        if (seenTabs.has(sanitizedTab)) continue;
        seenTabs.add(sanitizedTab);

        console.log(`Clicking tab: ${tabName}`);
        await button.click();
        await page.waitForTimeout(1000); // Let DOM settle
        const infobox = await page.$('.infobox-monster');

        if (infobox) {
          const rawHtml = await infobox.innerHTML();
          const $ = cheerio.load(rawHtml);
          const prettyHtml = breakTagsToNewLines($.html());

          const filename = `${bossFolder}_${sanitizedTab}.html`;
          fs.writeFileSync(path.join(bossDir, filename), prettyHtml);

          console.log(`✓ Saved phase [${tabName}] for ${monsterName} -> ${filename}`);
        } else {
          console.warn(`✗ Could not find infobox for tab ${tabName} on ${monsterName}`);
        }
      }
    } else {
      const infoboxHandle = await page.$('.infobox-monster');
      if (infoboxHandle) {
        const rawHtml = await infoboxHandle.evaluate(el => el.outerHTML);

        const fullHtml = `
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <title>${monsterName}</title>
          </head>
          <body>
            ${rawHtml}
          </body>
          </html>
        `;

        const prettyHtml = breakTagsToNewLines(beautify(fullHtml, {
          indent_size: 2,
          wrap_line_length: 120,
          preserve_newlines: true,
          max_preserve_newlines: 2
        }));

        const filename = `${bossFolder}.html`;
        fs.writeFileSync(path.join(bossDir, filename), prettyHtml);

        console.log(`✓ Saved default infobox for ${monsterName} -> ${filename}`);
      } else {
        console.warn(`✗ No infobox found for ${monsterName}`);
      }
    }

    // 🌐 Strategy page dump (new addition)
    if (metadata[monsterName] && metadata[monsterName].strategy_link) {
      const strategyUrl = metadata[monsterName].strategy_link;
      try {
        console.log(`📘 Downloading strategy page for ${monsterName}: ${strategyUrl}`);
        await page.goto(strategyUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

        const fullHtml = await page.content();
        const prettyHtml = beautify(fullHtml, {
          indent_size: 2,
          wrap_line_length: 120,
          preserve_newlines: true,
          max_preserve_newlines: 2
        });

        const strategyFile = path.join(strategyBossDir, 'strategy.html');
        fs.writeFileSync(strategyFile, prettyHtml);
        console.log(`✅ Strategy page saved for ${monsterName} -> strategy.html`);
      } catch (err) {
        console.warn(`⚠️ Failed to fetch strategy page for ${monsterName}: ${err.message}`);
      }
    }

  } catch (err) {
    console.error(`❌ Error scraping ${monsterName}:`, err.message);
  } finally {
    await browser.close();
  }
}


(async () => {
  for (const [monsterName, data] of Object.entries(metadata)) {
    if (!data.wiki_link) {
      console.warn(`⚠️ No wiki_link for ${monsterName}, skipping`);
      continue;
    }
    await downloadWithPlaywright(monsterName, data.wiki_link);
  }
})();
