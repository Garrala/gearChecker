const fs = require('fs');
const path = require('path');
const https = require('https');

const downloadImage = (url, outputPath) => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    const options = {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115 Safari/537.36',
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

const downloadImagesIfMissing = async (imageList, outputDir) => {
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  const seen = new Set();

  for (const image of imageList) {
    const urlPath = image.url.split('?')[0];
    const filename = image.filename || path.basename(urlPath);
    const outputPath = path.join(outputDir, filename);

    if (seen.has(filename) || fs.existsSync(outputPath)) {
      console.log(`⚠️ Skipping existing: ${filename}`);
      continue;
    }

    seen.add(filename);
    console.log(`⬇️ Downloading ${filename}...`);
    await downloadImage(image.url, outputPath);
  }
};

module.exports = {
  downloadImagesIfMissing,
  downloadImage
};
