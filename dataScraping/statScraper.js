const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { fetchMonsterStats } = require('./helpers/stat_helpers');
const metadata = require('../boss_metadata.json');

const htmlDumpPath = path.join(__dirname, 'staging', 'boss_html_dumps');
const statOutputPath = path.join(__dirname, 'staging', 'boss_stat_scrape');

if (fs.existsSync(statOutputPath)) {
  console.log('🧹 Clearing previous stat output directory...');
  fs.rmSync(statOutputPath, { recursive: true, force: true });
}
fs.mkdirSync(statOutputPath);
console.log('📂 Created new stat output directory.');

function collectMonsterHtmlFiles(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectMonsterHtmlFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      results.push(fullPath);
    }
  }
  return results;
}

(async () => {
  console.log('🔍 Collecting HTML files...');
  const allHtmlFiles = collectMonsterHtmlFiles(htmlDumpPath);
  console.log(`📦 Found ${allHtmlFiles.length} monster HTML files.`);

  const bossToEntries = {};

  for (const filePath of allHtmlFiles) {
    console.log(`\n📄 Processing file: ${filePath}`);
    const relPath = path.relative(htmlDumpPath, filePath);
    const bossFolder = relPath.split(path.sep)[0];
    const filename = path.basename(filePath, '.html').replace(/__+/g, '_');
    const parts = filename.split('_');

    //console.log(`relPath: ${relPath}`);
    //console.log(`bossFolder: ${bossFolder}`);
    //console.log(`filename: ${filename}`);
    //console.log(`filename parts:`, parts);

    let displayPhase = null;
    let bossName = bossFolder.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    //console.log(`Initial bossName from folder: "${bossName}"`);

    const meta = metadata[bossName] || {};
    const hasMonsterLinks = meta.monster_links && meta.monster_links.length > 1;
    //console.log(`hasMonsterLinks: ${hasMonsterLinks}`);

    if (hasMonsterLinks && relPath.includes(path.sep)) {
      bossName = relPath.split(path.sep)[1].replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      //console.log(`Overwritten bossName (monster_links): "${bossName}"`);
    } else if (parts.length > 1) {
      const basePart = parts[0]; // first word = boss name
      const labelPart = parts.slice(1).join(' '); // everything else = phase

      bossName = basePart.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      displayPhase = labelPart.trim();
      if (!displayPhase || displayPhase.toLowerCase() === 'null') {
        console.warn(`⚠️ Invalid displayPhase ("${displayPhase}"), resetting to null`);
        displayPhase = null;
      }

      //console.log(`Parsed basePart: "${basePart}", labelPart: "${labelPart}"`);
      //console.log(`Final bossName: "${bossName}"`);
      //console.log(`Final displayPhase: "${displayPhase}"`);
    }


    try {
      const rawHtml = fs.readFileSync(filePath, 'utf8');
      const $ = cheerio.load(rawHtml);
      const monsterInfos = await fetchMonsterStats($, bossName, displayPhase);
      if (!monsterInfos) {
        console.warn(`⚠️ No monster data returned for ${bossName}`);
        continue;
      }

      if (!bossToEntries[bossFolder]) {
        bossToEntries[bossFolder] = {
          name: meta.name || bossFolder.replace(/_/g, ' '),
          category: meta.category || '',
          image: null,
          wiki_link: meta.wiki_link || '',
          bosses: [],
          seen: new Set()
        };
        console.log(`📘 Initialized boss entry group for: ${bossToEntries[bossFolder].name}`);
      }

      const group = bossToEntries[bossFolder];
      const baseName = meta.name || bossFolder.replace(/_/g, ' ');

      for (const info of monsterInfos) {
        let label = displayPhase;
        const CYAN = '\x1b[36m';
        const RESET = '\x1b[0m';

        console.log(`🔎 Parsed boss variant name: ${CYAN}${info.name}${RESET}`);

        if (hasMonsterLinks) {
          const subName = path.basename(filePath, '.html').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          info.name = subName;
        } else if (label) {
          info.name = `${baseName} (${label})`;
        } else {
          info.name = baseName;
        }

        if (group.seen.has(info.name)) continue;

        if (monsterInfos.length === 1) {
          info.wiki_link = group.wiki_link;
        } else if (meta.wiki_link) {
          const anchor = label ? label.replace(/\s/g, '_').replace(/[^\w_]/g, '') : '';
          info.wiki_link = anchor ? `${meta.wiki_link}#${anchor}` : meta.wiki_link;
        }

        if (hasMonsterLinks) {
          const override = meta.monster_links.find(link =>
            link.toLowerCase().includes(info.name.toLowerCase().replace(/\s+/g, '_'))
          );
          if (override) info.wiki_link = override;
        }

        group.seen.add(info.name);
        group.bosses.push(info);
        if (!group.image) group.image = info.image;

        console.log(`✅ Wrote stats for ${info.name}`);
        console.log('==================================================================================================')
      }
    } catch (err) {
      console.error(`❌ Error parsing stats for ${filePath}:`, err.message);
    } 
  }

  for (const [folder, data] of Object.entries(bossToEntries)) {
    const outFileName = folder.toLowerCase().replace(/\s+/g, '_') + '.json';
    const outFilePath = path.join(statOutputPath, outFileName);
    const clean = {
      name: data.name,
      category: data.category,
      wiki_link: data.wiki_link,
      bosses: data.bosses
    };
    fs.writeFileSync(outFilePath, JSON.stringify(clean, null, 2));
    console.log(`💾 Wrote final output for ${folder} → ${outFileName}`);
  }

  console.log('\n✅ Stat scraping complete.');
})();
