const fs = require('fs');
const path = require('path');
const https = require('https');

// List your rogue URLs here
const imageUrls = [
  'https://oldschool.runescape.wiki/images/Red_spiky_vambraces.png?db71c',
  
  // Add more rogue links here
];

const outputDir = path.join(__dirname, 'src', 'assets', 'misc-icons');
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

const downloadImage = (url, filename) => {
  return new Promise((resolve, reject) => {
    const filePath = path.join(outputDir, filename);
    const file = fs.createWriteStream(filePath);
    const options = {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115 Safari/537.36',
      },
    };

    https.get(url, options, (res) => {
      if (res.statusCode === 200) {
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve()));
      } else {
        fs.unlink(filePath, () => { });
        reject(`❌ ${res.statusCode} - ${url}`);
      }
    }).on('error', (err) => {
      fs.unlink(filePath, () => { });
      reject(`❌ Error: ${url} – ${err.message}`);
    });
  });
};

(async () => {
  const seen = new Set();

  for (const url of imageUrls) {
    const urlPath = url.split('?')[0];
    const filename = path.basename(urlPath);

    if (seen.has(url) || fs.existsSync(path.join(outputDir, filename))) {
      console.log(`⚠️ Skipping duplicate or existing: ${filename}`);
      continue;
    }

    seen.add(url);
    console.log(`⬇️ Downloading ${filename}...`);

    try {
      await downloadImage(url, filename);
    } catch (err) {
      console.error(err);
    }
  }

  console.log('✅ Rogue image download complete!');
})();
