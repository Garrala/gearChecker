const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { fetchMonsterStats } = require('./helpers/stat_helpers');
const metadata = require('./boss_metadata.json');

const htmlDumpPath = path.join(__dirname, 'boss_html_dumps');
const statOutputPath = path.join(__dirname, 'boss_stat_scrape');

if (fs.existsSync(statOutputPath)) {
  fs.rmSync(statOutputPath, { recursive: true, force: true });
}
fs.mkdirSync(statOutputPath);

function collectMonsterHtmlFiles(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      results.push(...collectMonsterHtmlFiles(fullPath));
    } else if (entry.isFile() && entry.name.startsWith('monster') && entry.name.endsWith('.html')) {
      results.push(fullPath);
    }
  }

  return results;
}

function inferSlugFromPath(filePath) {
  const filename = path.basename(filePath, '.html');
  const raw = filename.replace(/^monster_?/, '').trim();
  const displayName = raw.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  const slug = displayName.replace(/\s/g, '_');
  return `https://oldschool.runescape.wiki/w/${slug}`;
}

(async () => {
  const allHtmlFiles = collectMonsterHtmlFiles(htmlDumpPath);
  const bossToEntries = {};

  for (const filePath of allHtmlFiles) {
    const relPath = path.relative(htmlDumpPath, filePath);
    const bossFolder = relPath.split(path.sep)[0];

    const phaseMatch = filePath.match(/monster(?:_([a-z0-9_]+))?\.html$/i);
    const phase = phaseMatch ? phaseMatch[1]?.replace(/_/g, ' ') : null;

    const metaEntry = Object.entries(metadata).find(([key]) =>
      key.toLowerCase().replace(/\s+/g, '_') === bossFolder.toLowerCase()
    );
    let bossName = bossFolder.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const meta = metaEntry ? metaEntry[1] : {};

    if (meta.monster_links && meta.monster_links.length > 1) {
      const subDir = relPath.split(path.sep)[1];
      if (subDir) {
        bossName = subDir.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      }
    }

    try {
      const rawHtml = fs.readFileSync(filePath, 'utf8');
      const $ = cheerio.load(rawHtml);
      const monsterInfos = await fetchMonsterStats($, bossName, phase);

      if (!bossToEntries[bossFolder]) {
        bossToEntries[bossFolder] = {
          name: bossName,
          category: meta.category || '',
          image: null,
          wiki_link: meta.wiki_link || '',
          bosses: [],
          seen: new Set()
        };
      }

      const group = bossToEntries[bossFolder];

      for (const info of monsterInfos || []) {
        if (group.seen.has(info.name)) {
          console.log(`⚠️ Skipping duplicate entry for ${info.name}`);
          continue;
        }

        // ✅ Set wiki_link for each boss entry
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
          const link = meta.monster_links.find(link => {
            return link.toLowerCase().includes(bossName.toLowerCase().replace(/\s+/g, '_'));
          });
          if (link) info.wiki_link = link;
        }


        group.seen.add(info.name);
        group.bosses.push(info);
        if (!group.image) group.image = info.image;

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
      image: data.image,
      wiki_link: data.wiki_link,
      bosses: data.bosses
    };
    fs.writeFileSync(outFilePath, JSON.stringify(clean, null, 2));
  }
})();
