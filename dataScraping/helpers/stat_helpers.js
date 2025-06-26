const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const { downloadImage } = require('./download_images');
const validation = require('./stat_validation_schema.json');

const phasedHpLookup = {
  "kalphite queen crawling": 255,
  "kalphite queen airborne": 255,
  "wyrm (idle)": 425,
  "wyrm (attacking)": 425,
}

function normalize(str) {
  return str.trim().toLowerCase();
}

function sanitizeFilename(name, phase = '') {
  const parts = [name, phase].filter(Boolean).map(part =>
    part.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^\w]/g, '')
  );
  return parts.join('_');
}

function parseMaxHits(text, attackStyles) {
  const result = {};
  const pairs = text.match(/\d+\s*\([^\)]+\)/g);

  if (pairs) {
    for (const pair of pairs) {
      const [_, value, style] = pair.match(/(\d+)\s*\(([^\)]+)\)/) || [];
      if (value && style) {
        result[style.toLowerCase()] = parseInt(value, 10);
      }
    }
  } else {
    const soloMatch = text.match(/(\d+)/);
    if (soloMatch) {
      const value = parseInt(soloMatch[1], 10);
      if (attackStyles.length === 1) {
        result[attackStyles[0].toLowerCase()] = value;
      } else if (attackStyles.length > 1) {
        for (const style of attackStyles) {
          result[style.toLowerCase()] = value;
        }
      }
    }
  }

  console.log('🗡️ Parsed max hits:', result);
  return result;
}

function getImageSrcFromInfobox($) {
  let imgTag = $('.infobox-monster td[data-attr-param="image"] img').first();
  if (!imgTag || !imgTag.attr('src')) {
    imgTag = $('.infobox-monster td.infobox-image img').first();
  }

  if (!imgTag || !imgTag.attr('src')) {
    console.warn('⚠️ No image tag found inside monster infobox');
    return null;
  }

  let src = imgTag.attr('src');
  if (src.startsWith('//')) src = 'https:' + src;
  else if (src.startsWith('/')) src = 'https://oldschool.runescape.wiki' + src;

  console.log('📸 Pulled image src:', src);
  return src;
}

function extractHp($) {
  const combatHeader = $('th:contains("Combat stats")').closest('tr');
  const hpRow = combatHeader.nextAll('tr').filter((_, tr) => {
    return $(tr).find('td.infobox-nested').length >= 6;
  }).first();

  const hpCell = $(hpRow).find('td.infobox-nested').eq(0).text().replace('+', '').trim();
  const hp = parseInt(hpCell, 10);
  console.log('❤️ Extracted HP:', hp);
  return hp || 0;
}

function extractPhasedHp(bossName, phaseName) {
  totalName = bossName + " " + phaseName
  console.log(totalName)
  if (!totalName) {
    console.warn('❌ No phase name provided to extractPhasedHp');
    return 0;
  }

  const key = String(totalName).toLowerCase();
  const hp = phasedHpLookup[key];

  if (hp !== undefined) {
    console.log(`❤️ Retrieved phased HP for "${key}":`, hp);
    return hp;
  } else {
    console.warn(`⚠️ No HP override found for phased boss: "${key}"`);
    return 0;
  }
}



function extractMeleeDefense($) {
  const header = $('th:contains("Melee defence")').first();
  const values = header.closest('tr').nextAll('tr')
    .filter((_, tr) => $(tr).find('td.infobox-nested').length === 3)
    .first()
    .find('td.infobox-nested')
    .map((_, td) => parseInt($(td).text().replace('+', '').trim()) || 0)
    .get();

  const [stab, slash, crush] = values;
  console.log('🛡️ Melee defense values:', { stab, slash, crush });
  return {
    stab: stab || 0,
    slash: slash || 0,
    crush: crush || 0
  };
}

function extractFlatMagicDefense($) {
  const header = $('th:contains("Magic defence")').first();
  const row = header.closest('tr').nextAll('tr')
    .filter((_, tr) => $(tr).find('td.infobox-nested').length >= 1)
    .first();

  const text = row.find('td.infobox-nested').first().text().replace('+', '').trim();
  const val = parseInt(text, 10) || 0;
  console.log('🔮 Magic Defense:', val);
  return val;
}

function extractElementalWeakness($) {
  const htmlText = $.html().toLowerCase();
  const match = htmlText.match(/(\d+%)\s+weakness/);
  const percent = match ? match[1] : null;

  for (const element of validation.elemental_weaknesses) {
    if (htmlText.includes(`${element} elemental weakness`)) {
      const result = { [element]: percent || null };
      console.log('🧪 Elemental Weakness:', result);
      return result;
    }
  }

  if (htmlText.includes('no elemental weakness')) {
    console.log('🧪 No elemental weakness');
    return 'none';
  }

  console.warn('❓ No known elemental weakness found');
  return 'none';
}

function extractRangedDefense($) {
  const header = $('th:contains("Ranged defence")').first();
  const row = header.closest('tr').nextAll('tr')
    .filter((_, tr) => $(tr).find('td.infobox-nested').length === 3)
    .first();

  const values = row.find('td.infobox-nested')
    .map((_, td) => parseInt($(td).text().replace('+', '').trim()) || 0)
    .get();

  const [light, standard, heavy] = values;
  console.log('🏹 Ranged defense values:', { thrown: light, arrows: standard, bolts: heavy });
  return {
    arrows: standard || 0,
    bolts: heavy || 0,
    thrown: light || 0
  };
}

function createMonsterTemplate(phase, bossName) {
  const name = phase ? `${bossName} (${phase})` : bossName;
  console.log(`📝 Creating template for: ${name}`);
  return {
    name,
    wiki_link: '',
    image: '',
    combat_level: 0,
    hp: 0,
    max_hit: {},
    defense: {
      melee: { stab: 0, slash: 0, crush: 0 },
      magic: 0,
      ranged: { arrows: 0, bolts: 0, thrown: 0 }
    },
    attack_styles: [],
    attack_speed: null,
    aggressive: false,
    immunities: {}
  };
}

function parseCombatLevel($, info) {
  $('tr').each((_, tr) => {
    const th = $(tr).find('th').text().trim().toLowerCase();
    const td = $(tr).find('td').text().trim();
    if (th.includes('combat level')) {
      info.combat_level = parseInt(td);
      console.log('⚔️ Combat Level:', info.combat_level);
    }
  });
}

function parseAttackStyles($, info) {
  $('tr').each((_, tr) => {
    const th = $(tr).find('th').text().trim().toLowerCase();
    const td = $(tr).find('td').text().trim();

    if (th.includes('attack style')) {
      const rawStyles = td.split(/,|\//).map(s => s.trim().toLowerCase());
      const allowed = new Set(validation.attack_styles.map(normalize));
      const ignored = new Set(validation.ignore_case.map(normalize));

      const valid = rawStyles.filter(s => allowed.has(normalize(s)));
      const invalid = rawStyles.filter(s => {
        const norm = normalize(s);
        return !allowed.has(norm) && !ignored.has(norm);
      });

      info.attack_styles = valid.map(s => s[0].toUpperCase() + s.slice(1));
      console.log('🧨 Attack Styles:', info.attack_styles);

      if (invalid.length > 0) {
        console.warn(`⚠️ [${info.name}] Unrecognized attack style(s):`, invalid);
      }
    }
  });
}

function parseMaxHit($, info) {
  $('tr').each((_, tr) => {
    const th = $(tr).find('th').text().trim().toLowerCase();
    const td = $(tr).find('td').text().trim();

    if (th.includes('max hit')) {
      const parsed = parseMaxHits(td, info.attack_styles);
      info.max_hit = parsed;
    }
  });
}

function parseAttackSpeed($, info) {
  $('tr').each((_, tr) => {
    const th = $(tr).find('th').text().trim().toLowerCase();
    const td = $(tr).find('td').text().trim();
    if (th.includes('attack speed')) {
      info.attack_speed = parseInt(td.match(/\d+/)?.[0] || '0');
      console.log('⏱️ Attack Speed:', info.attack_speed);
    }
  });
}

function parseAggressive($, info) {
  let found = false;
  $('tr').each((_, tr) => {
    const th = $(tr).find('th').text().trim().toLowerCase();
    const td = $(tr).find('td').text().trim();

    if (th.includes('aggressive')) {
      found = true;
      info.aggressive = td.toLowerCase().includes('yes');
      console.log('😡 Aggressive:', info.aggressive);
    }
  });

  if (!found) {
    console.warn(`⚠️ [${info.name}] Aggressiveness info not found.`);
  }
}

function parseImmunities($, info) {
  const found = new Set();
  $('tr').each((_, tr) => {
    const th = $(tr).find('th').text().trim().toLowerCase();
    const td = $(tr).find('td').text().trim().toLowerCase();

    for (const key of validation.immunities) {
      if (th.includes(key)) {
        info.immunities[key] = td.includes('immune');
        found.add(key);
      }
    }

    if (th.includes('immune')) {
      const known = validation.immunities.map(s => s.toLowerCase());
      const match = known.find(k => th.includes(k));
      if (!match) {
        console.warn(`❓ [${info.name}] Unknown immunity row: "${th}" = "${td}"`);
      }
    }
  });

  const missing = validation.immunities.filter(k => !found.has(k));
  if (missing.length > 0) {
    console.warn(`⚠️ [${info.name}] Missing known immunities:`, missing);
  } else {
    console.log('🛡️ Immunities:', info.immunities);
  }
}

async function parseInfoboxData($, phase, bossName) {
  const info = createMonsterTemplate(phase, bossName);
  const sanitizedImagePath = `assets/monster-icons/${sanitizeFilename(bossName, phase)}.png`;
  const localImgPath = path.join(__dirname, '..', '..', 'src', sanitizedImagePath);
  const wikiImgSrc = getImageSrcFromInfobox($);

  if (wikiImgSrc && !fs.existsSync(localImgPath)) {
    await downloadImage(wikiImgSrc, localImgPath);
    console.log('💾 Downloaded image for', info.name);
  }

  info.image = sanitizedImagePath;
  info.defense.melee = extractMeleeDefense($);
  info.defense.magic = extractFlatMagicDefense($);
  info.weaknesses = extractElementalWeakness($);
  info.defense.ranged = extractRangedDefense($);
  parseCombatLevel($, info);
  parseAttackStyles($, info);
  parseMaxHit($, info);
  parseAttackSpeed($, info);
  parseAggressive($, info);
  parseImmunities($, info);
  info.hp = extractHp($);

  return info;
}

async function parseTabbedInfoboxData($, phase, bossName) {
  console.log("In the tabbed method")
  const info = createMonsterTemplate(phase, bossName); 
  info.hp = extractPhasedHp(bossName, phase);

  return info;
}



async function fetchMonsterStats($, bossName, phase = null) {
  try {
    const hasTabs = $('.infobox-buttons .button').length > 0;

    const bossData = hasTabs && phase
      ? await parseTabbedInfoboxData($, phase, bossName)
      : await parseInfoboxData($, phase, bossName);

    return [bossData];
  } catch (err) {
    console.error(`❌ Failed to parse monster stats for ${bossName}${phase ? ` (${phase})` : ''}:`, err.message);
    return null;
  }
}


module.exports = { fetchMonsterStats, sanitizeFilename };
