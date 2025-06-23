const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const { downloadImage } = require('./download_images');
const validation = require('./stat_validation_schema.json');

function normalize(str) {
  return str.trim().toLowerCase();
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

  return result;
}

function getImageSrcFromInfobox($) {
  // Try structured attribute first
  let imgTag = $('table.infobox-monster td[data-attr-param="image"] img').first();

  // Fallback if not found
  if (!imgTag || !imgTag.attr('src')) {
    imgTag = $('table.infobox-monster .infobox-image img').first();
  }

  if (!imgTag || !imgTag.attr('src')) {
    console.warn('⚠️ No image tag found inside monster infobox');
    return null;
  }

  let src = imgTag.attr('src');
  if (src.startsWith('//')) {
    src = 'https:' + src;
  } else if (src.startsWith('/')) {
    src = 'https://oldschool.runescape.wiki' + src;
  }

  return src;
}

function extractHp($) {
  const rows = $('th:contains("Combat stats")')
    .closest('tr')
    .nextAll('tr');

  for (let i = 0; i < rows.length; i++) {
    const tds = $(rows[i]).find('td.infobox-nested');
    if (tds.length >= 6) {
      const raw = $(tds[0]).text().replace('+', '').trim();
      const parsed = parseInt(raw);
      //console.log('❤️ Extracted HP value:', parsed);
      return parsed || 0;
    }
  }

  console.log('❌ HP not found in expected Combat stats block.');
  return 0;
}

function extractMeleeDefense($) {
  const headerRow = $('table.infobox-monster th:contains("Melee defence")').closest('tr');
  const defenseRow = headerRow.nextAll('tr').filter((_, tr) =>
    $(tr).find('td.infobox-nested').length >= 3
  ).first();

  const values = defenseRow.find('td')
    .map((_, td) => parseInt($(td).text().replace('+', '').trim()) || 0)
    .get();

  const [stab, slash, crush] = values;

  //console.log(`🛡️ Extracted Melee Defense - stab: ${stab}, slash: ${slash}, crush: ${crush}`);
  return {
    stab: stab || 0,
    slash: slash || 0,
    crush: crush || 0
  };
}

function extractFlatMagicDefense($) {
  const magicDefenseRow = $('th:contains("Magic defence")').closest('tr').nextAll('tr')
    .filter((_, tr) => $(tr).find('td.infobox-nested').length >= 2)
    .first();

  const columns = magicDefenseRow.find('td.infobox-nested');
  const defenseText = $(columns[0]).text().replace('+', '').trim();
  const defense = parseInt(defenseText, 10) || 0;

  //console.log('🧙 Flat Magic Defense Extracted:', defense);
  return defense;
}

function extractElementalWeakness($) {
  const htmlText = $.html().toLowerCase();
  const allowed = new Set(validation.elemental_weaknesses);
  const match = htmlText.match(/(\d+%)\s+weakness/);
  const percent = match ? match[1] : null;

  for (const element of validation.elemental_weaknesses) {
    if (htmlText.includes(`${element} elemental weakness`)) {
      const result = { [element]: percent || null };
      //console.log('🧪 Brute-forced Weakness:', result);
      return result;
    }
  }

  if (htmlText.includes('no elemental weakness')) {
    return 'none';
  }

  console.warn('❓ No known elemental weakness found');
  return 'none';
}


function extractRangedDefense($) {
  const headerRow = $('table.infobox-monster th:contains("Ranged defence")').closest('tr');
  const defenseRow = headerRow.nextAll('tr').filter((_, tr) =>
    $(tr).find('td.infobox-nested').length >= 3
  ).first();

  const values = defenseRow.find('td')
    .map((_, td) => parseInt($(td).text().replace('+', '').trim()) || 0)
    .get();

  const [light, standard, heavy] = values;

  return {
    arrows: standard || 0,
    bolts: heavy || 0,
    thrown: light || 0
  };
}

function createMonsterTemplate(phase, bossName) {
  return {
    name: phase ? `${bossName} (${phase})` : bossName,
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
  $('table.infobox-monster tr').each((_, tr) => {
    const th = $(tr).find('th').text().trim().toLowerCase();
    const td = $(tr).find('td').text().trim();
    if (th.includes('combat level')) info.combat_level = parseInt(td);
  });
}

function parseAttackStyles($, info) {
  $('table.infobox-monster tr').each((_, tr) => {
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

      if (invalid.length > 0) {
        console.warn(`⚠️ [${info.name}] Unrecognized attack style(s):`, invalid);
      }
    }
  });
}


function parseMaxHit($, info) {
  $('table.infobox-monster tr').each((_, tr) => {
    const th = $(tr).find('th').text().trim().toLowerCase();
    const td = $(tr).find('td').text().trim();

    if (th.includes('max hit')) {
      const parsed = parseMaxHits(td, info.attack_styles);
      info.max_hit = parsed;

      const allowed = new Set(validation.max_hit_types.map(normalize));
      const ignored = new Set(validation.ignore_case.map(normalize));
      const keys = Object.keys(parsed);

      const unknowns = keys.filter(k => {
        const norm = normalize(k);
        return !allowed.has(norm) && !ignored.has(norm);
      });
    }
  });
}


function parseAttackSpeed($, info) {
  $('table.infobox-monster tr').each((_, tr) => {
    const th = $(tr).find('th').text().trim().toLowerCase();
    const td = $(tr).find('td').text().trim();
    if (th.includes('attack speed')) info.attack_speed = parseInt(td.match(/\d+/)?.[0] || '0');
  });
}

function parseAggressive($, info) {
  let found = false;

  $('table.infobox-monster tr').each((_, tr) => {
    const th = $(tr).find('th').text().trim().toLowerCase();
    const td = $(tr).find('td').text().trim();

    if (th.includes('aggressive')) {
      found = true;
      info.aggressive = td.toLowerCase().includes('yes');
    }
  });

  if (!found) {
    console.warn(`⚠️ [${info.name}] Aggressiveness info not found.`);
  }
}


function parseImmunities($, info) {
  const found = new Set();

  $('table.infobox-monster tr').each((_, tr) => {
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
  }
}


async function parseInfoboxData($, phase, bossName) {
  const info = createMonsterTemplate(phase, bossName);
  const imageSlug = bossName.toLowerCase().replace(/\s+/g, '_') + (phase ? `__${phase.toLowerCase().replace(/\s+/g, '_')}__` : '');
  const localImgPath = path.join(__dirname, '..', '..', 'src', 'assets', 'monster-icons', `${imageSlug}.png`);
  const localImgRelPath = `assets/monster-icons/${imageSlug}.png`;
  const wikiImgSrc = getImageSrcFromInfobox($);

  if (wikiImgSrc && !fs.existsSync(localImgPath)) {
    await downloadImage(wikiImgSrc, localImgPath);
  }

  info.image = localImgRelPath;
  info.defense.melee = extractMeleeDefense($)
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

async function fetchMonsterStats($, bossName, phase = null) {
  try {
    const tabs = $('.infobox-buttons .button');
    const bosses = [];

    if (tabs.length > 0) {
      // Handle multi-phase bosses like Abyssal Sire
      for (const el of tabs) {
        const phase = $(el).text().trim();
        const phaseData = await parseInfoboxData($, phase, bossName);
        if (phaseData) bosses.push(phaseData);
      }
    } else {
      // Single-phase boss (or already filtered)
      const singleBossData = await parseInfoboxData($, phase, bossName);
      if (singleBossData) bosses.push(singleBossData);
    }

    return bosses;
  } catch (err) {
    console.error(`❌ Failed to parse monster stats for ${bossName}:`, err.message);
    return null;
  }
}


module.exports = { fetchMonsterStats };
