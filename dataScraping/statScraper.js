const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { fetchMonsterStats } = require('./helpers/stat_helpers');
const metadata = require('../boss_metadata.json');

const htmlDumpPath = path.join(__dirname, 'staging', 'boss_html_dumps');
const statOutputPath = path.join(__dirname, 'staging', 'boss_stat_scrape');

// Reset output directory
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

    const filename = path.basename(filePath, '.html');
    const parts = filename.replace(/^monster_/, '').split('_');

    let bossName = parts[0];
    let phase = null;

    if (parts.length > 1) {
      bossName = parts.slice(0, -1).join(' ');
      phase = parts[parts.length - 1];
      console.log(`🔀 Parsed boss name: "${bossName}" with phase: "${phase}"`);
    } else {
      console.log(`🔍 Parsed single-phase boss: "${bossName}"`);
    }

    bossName = bossName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    const metaEntry = Object.entries(metadata).find(([key]) =>
      key.toLowerCase().replace(/\s+/g, '_') === bossFolder.toLowerCase()
    );
    const meta = metaEntry ? metaEntry[1] : {};
    if (!metaEntry) {
      console.warn(`⚠️ No metadata found for boss folder: ${bossFolder}`);
    }

    if (meta.monster_links && meta.monster_links.length > 1) {
      const subDir = relPath.split(path.sep)[1];
      if (subDir) {
        bossName = subDir.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        console.log(`📛 Using subdir override for boss name: "${bossName}"`);
      }
    }

    try {
      const rawHtml = fs.readFileSync(filePath, 'utf8');
      const $ = cheerio.load(rawHtml);
      console.log('📥 HTML file loaded into Cheerio.');

      const monsterInfos = await fetchMonsterStats($, bossName, phase);
      if (!monsterInfos) {
        console.warn(`⚠️ No monster data returned for ${bossName}`);
        continue;
      }

      if (!bossToEntries[bossFolder]) {
        bossToEntries[bossFolder] = {
          name: bossName,
          category: meta.category || '',
          image: null,
          wiki_link: meta.wiki_link || '',
          bosses: [],
          seen: new Set()
        };
        console.log(`📘 Initialized boss entry group for: ${bossFolder}`);
      }

      const group = bossToEntries[bossFolder];

      for (const info of monsterInfos) {
        if (group.seen.has(info.name)) {
          console.log(`⚠️ Skipping duplicate entry for ${info.name}`);
          continue;
        }

        // Determine wiki link
        if (monsterInfos.length === 1) {
          info.wiki_link = group.wiki_link;
        } else if (meta.wiki_link) {
          const labelMatch = info.name.match(/\((.+)\)/);
          if (labelMatch) {
            const anchor = labelMatch[1].replace(/\s/g, '_').replace(/[^\w_()]/g, '');
            info.wiki_link = `${meta.wiki_link}#${anchor}`;
          } else {
            info.wiki_link = meta.wiki_link;
          }
        }

        if (meta.monster_links && meta.monster_links.length > 1) {
          const link = meta.monster_links.find(link =>
            link.toLowerCase().includes(bossName.toLowerCase().replace(/\s+/g, '_'))
          );
          if (link) {
            info.wiki_link = link;
            console.log(`🔗 Overriding wiki link using monster_links: ${link}`);
          }
        }

        group.seen.add(info.name);
        group.bosses.push(info);
        if (!group.image) {
          group.image = info.image;
        }

        console.log(`✅ Wrote stats for ${info.name}`);
      }
    } catch (err) {
      console.error(`❌ Error parsing stats for ${filePath}:`, err.message);
    }
  }

  for (const [folder, data] of Object.entries(bossToEntries)) {
    const outFileName = folder.toLowerCase().replace(/\s+/g, '-') + '.json';
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
