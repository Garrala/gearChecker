const fs = require('fs');
const path = require('path');
const https = require('https');

// ✅ ABSOLUTE monster-icons path
const MONSTER_ICON_DIR = path.join(__dirname, '..', '..', '..', 'src', 'assets', 'monster-icons');

const downloadImage = (url, outputPath) => {
  return new Promise((resolve) => {
    const file = fs.createWriteStream(outputPath);
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
    };

    https.get(url, options, (res) => {
      if (res.statusCode === 200) {
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve(true)));
      } else {
        fs.unlink(outputPath, () => { });
        console.warn(`⚠️ Failed to download image: ${url} (${res.statusCode})`);
        resolve(false);
      }
    }).on('error', (err) => {
      fs.unlink(outputPath, () => { });
      console.error(`❌ Error fetching image: ${url} – ${err.message}`);
      resolve(false);
    });
  });
};

const normalizeImageFilename = (urlOrName) => {
  return urlOrName
    .toLowerCase()
    .replace(/.*\//, '')                   // basename only
    .replace(/\.(jpg|jpeg|gif)$/, '.png')  // force png extension
    .replace(/\?.*$/, '')                  // remove query strings
    .replace(/[^\w.]/g, '_');              // safe characters only
};

// ✅ Updated to always target monster-icons directory
const downloadImagesIfMissing = async (imageList) => {
  if (!fs.existsSync(MONSTER_ICON_DIR)) fs.mkdirSync(MONSTER_ICON_DIR, { recursive: true });
  const seen = new Set();
  const urlToPathMap = {};

  for (const image of imageList) {
    const urlPath = image.url.split('?')[0];
    const filename = normalizeImageFilename(urlPath);
    const outputPath = path.join(MONSTER_ICON_DIR, filename);
    const jsonPath = `assets/monster-icons/${filename}`;

    urlToPathMap[image.url] = jsonPath;

    if (seen.has(filename) || fs.existsSync(outputPath)) {
      console.log(`⚠️ Skipping existing: ${filename}`);
      continue;
    }

    seen.add(filename);
    console.log(`⬇️ Downloading ${filename}...`);
    await downloadImage(image.url, outputPath);
  }

  return urlToPathMap;
};


module.exports = {
  downloadImagesIfMissing,
  downloadImage,
  normalizeImageFilename,
  MONSTER_ICON_DIR
};
