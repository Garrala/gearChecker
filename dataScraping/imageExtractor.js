const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { downloadImage, normalizeImageFilename } = require('./helpers/download_images');

const INPUT_DIR = path.join(__dirname, 'staging', 'boss_html_dumps');
const IMAGE_DIR = path.join(__dirname, '..', 'src', 'assets', 'monster-icons');

if (!fs.existsSync(IMAGE_DIR)) fs.mkdirSync(IMAGE_DIR, { recursive: true });

function extractImageUrl(html) {
  const $ = cheerio.load(html);

  let img = $('td.infobox-image img').first();
  if (!img.length) img = $('img[src*="/images/"]').first();

  if (!img.length) return null;

  let src = img.attr('src');
  if (src.startsWith('/')) {
    src = 'https://oldschool.runescape.wiki' + src;
  }

  return src;
}

async function processFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const imageUrl = extractImageUrl(raw);
  const filenameBase = path.basename(filePath, '.html');
  const targetFilename = `${filenameBase}.png`;
  const outputPath = path.join(IMAGE_DIR, targetFilename);

  if (!imageUrl) {
    console.warn(`⚠️ No image found in ${filenameBase}`);
    return;
  }

  // Always write it for each HTML file even if the content is the same
  if (!fs.existsSync(outputPath)) {
    console.log(`⬇️ Downloading image for ${filenameBase} -> ${targetFilename}`);
    await downloadImage(imageUrl, outputPath);
  } else {
    console.log(`✔️ Already exists: ${targetFilename}`);
  }
}

async function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath);
    } else if (entry.name.endsWith('.html')) {
      await processFile(fullPath);
    }
  }
}

walk(INPUT_DIR);
