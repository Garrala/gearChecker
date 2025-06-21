const fs = require('fs');
const path = require('path');
const https = require('https');

// List your rogue URLs here
const imageUrls = [
  'https://oldschool.runescape.wiki/images/Mysterious_Old_Man_chathead.png?a0eb8',
  'https://oldschool.runescape.wiki/images/Mystery_box_detail.png?0e275',
  'https://oldschool.runescape.wiki/images/Bank_filler.png?f928c',
  'https://oldschool.runescape.wiki/images/Dragon_med_helm.png?8fa13',
  'https://oldschool.runescape.wiki/images/Worn_Equipment.png?124cf',
  'https://oldschool.runescape.wiki/images/Mr._Mordaut_chathead.png?26eca',
  'https://oldschool.runescape.wiki/images/Resurrect_Greater_Ghost.png?687f2',
  'https://oldschool.runescape.wiki/images/Cannon_barrels.png?3c432',
  'https://oldschool.runescape.wiki/images/Venom_hitsplat.png?1977a',
  'https://oldschool.runescape.wiki/images/Poison_hitsplat.png?16146',
  'https://oldschool.runescape.wiki/images/Steel_bolts_5.png?f1c11',
  'https://oldschool.runescape.wiki/images/Steel_arrow_5.png?2c4a2',
  'https://oldschool.runescape.wiki/images/Steel_dart.png?3203e',
  'https://oldschool.runescape.wiki/images/Air_rune.png?248b4',
  'https://oldschool.runescape.wiki/images/Earth_rune.png?0b998',
  'https://oldschool.runescape.wiki/images/Water_rune.png?75a26',
  'https://oldschool.runescape.wiki/images/Fire_rune.png?3859a',
  'https://oldschool.runescape.wiki/images/Pure_essence.png?ed4b0',
  'https://oldschool.runescape.wiki/images/Magic_defence_icon.png?65b01',
  'https://oldschool.runescape.wiki/images/Steel_warhammer.png?1a4de',
  'https://oldschool.runescape.wiki/images/Steel_scimitar.png?0395b',
  'https://oldschool.runescape.wiki/images/Steel_dagger.png?f410d',
  'https://oldschool.runescape.wiki/images/Attack_Speed_icon.png?c8037',
  'https://oldschool.runescape.wiki/images/Protect_from_all.png?944a7',
  'https://oldschool.runescape.wiki/images/Fire_Surge.png?76ce4',
  'https://oldschool.runescape.wiki/images/Special_attack_orb.png?27d06',
  'https://oldschool.runescape.wiki/images/Ranged_icon.png',
  'https://oldschool.runescape.wiki/images/Magic_icon.png',
  'https://oldschool.runescape.wiki/images/Strength_icon.png?e6e0c',
  'https://oldschool.runescape.wiki/images/Combat_icon.png?93d63',
  'https://oldschool.runescape.wiki/images/Protect_from_Melee_overhead.png?e8059',
  'https://oldschool.runescape.wiki/images/Ice_Barrage.png?3f12e',
  'https://oldschool.runescape.wiki/images/Smite.png?d9143',
  'https://oldschool.runescape.wiki/images/Retribution.png?724d1',
  'https://oldschool.runescape.wiki/images/Special_attack_orb.png?27d06',
  'https://oldschool.runescape.wiki/images/Abyssal_tentacle.png?c04be',
  'https://oldschool.runescape.wiki/images/Protect_from_all.png?944a7',
  'https://oldschool.runescape.wiki/images/Pet_rock.png?97482',
  'https://oldschool.runescape.wiki/images/Damage_hitsplat_%28max_hit%29.png?a8d79',
  'https://oldschool.runescape.wiki/images/Hitpoints_icon.png?a4819'
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
