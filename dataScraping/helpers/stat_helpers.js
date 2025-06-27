const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const { downloadImage } = require('./download_images');
const validation = require('./stat_validation_schema.json');

const phasedHpLookup = {
  "abyssal sire phase 1": 425,
  "abyssal sire phase 2": 425,
  "abyssal sire phase 3  stage 1 ": 425,
  "abyssal sire phase 3  stage 2 ": 425,
  "duke sucellus awakened": 1540,
  "duke sucellus post quest": 485,
  "duke sucellus quest": 330,
  "kalphite queen crawling": 255,
  "kalphite queen airborne": 255,
  "vorkath post quest": 750,
  "vorkath dragon slayer ii": 450,
  "wyrm idle": 425,
  "wyrm attacking": 425,
}

const forceTabbedParsing = new Set([
  'abyssal sire phase 3  stage 1',
  'abyssal sire phase 3  stage 2',
]);

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

  const clean = (str) => str.replace(/\s+/g, ' ').replace(/\n/g, '').trim().toLowerCase();

  if (pairs) {
    for (const pair of pairs) {
      const [_, value, style] = pair.match(/(\d+)\s*\(([^\)]+)\)/) || [];
      if (value && style) {
        result[clean(style)] = parseInt(value, 10);
      }
    }
  } else {
    const soloMatch = text.match(/(\d+)/);
    if (soloMatch) {
      const value = parseInt(soloMatch[1], 10);
      if (attackStyles.length === 1) {
        result[clean(attackStyles[0])] = value;
      } else if (attackStyles.length > 1) {
        for (const style of attackStyles) {
          result[clean(style)] = value;
        }
      }
    }
  }

  console.log('🗡️ Parsed max hits:', result);
  return result;
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

function extractMultiMaxHitsVerbose($, info) {
  //console.log('🔍 Attempting to parse multi-style max hits...');

  const maxHitAnchor = $('a')
    .filter((_, el) => ($(el).attr('title') || '').trim().toLowerCase() === 'monster maximum hit')
    .first();

  if (!maxHitAnchor.length) {
    console.warn('⚠️ Could not find "Max hit" anchor');
    return;
  }

  //console.log('✅ Found "Max hit" anchor. Beginning traversal...');
  let node = maxHitAnchor[0].next;
  const result = {};
  let pendingDamage = null;
  let matchedCount = 0;
  let step = 0;

  const knownStyles = ['magic', 'melee', 'ranged', 'dragonfire'];
  const schemaStyles = new Set(validation.max_hit_types.map(s => s.toLowerCase()));

  while (node) {
    step++;
    const type = node.type;
    const name = node.name || '';
    const content = type === 'text' ? node.data.trim() : $(node).text().trim();

    //console.log(`🔍 Step ${step}: tag/type=${name || type}, content="${content}"`);

    // Stop if we hit Aggressiveness section
    if (
      name === 'a' &&
      ($(node).attr('title') || '').toLowerCase().includes('aggressiveness')
    ) {
      //console.log('⛔ Stopping traversal at Aggressiveness anchor.');
      break;
    }

    // Case 1: Combined match like "121 (Dragonfire Bomb/Special)"
    const comboMatch = content.match(/(\d+)\s*\(([^\)]+)\)/);
    if (comboMatch) {
      const [, damageStr, rawStyle] = comboMatch;
      const style = rawStyle.toLowerCase().replace(/[^a-z]/g, '');
      const damage = parseInt(damageStr, 10);

      result[style] = damage;
      matchedCount++;
      //console.log(`🎯 Directly assigned ${damage} to style "${style}" from combined content`);

      if (schemaStyles.has(style)) {
        //console.log(`✅ Style "${style}" validated against max_hit_types`);
      } else {
        console.warn(`⚠️ Style "${style}" is NOT listed in max_hit_types`);
      }

      node = node.next;
      continue;
    }

    // Case 2: Numeric damage waiting for style
    const stripped = content.replace(/[^\d]/g, '');
    if (pendingDamage === null && /^\d+$/.test(stripped)) {
      pendingDamage = parseInt(stripped, 10);
      //console.log(`🔢 Found pending damage: ${pendingDamage}`);
    }

    // Case 3: Match next style after damage
    if (pendingDamage !== null && name === 'a') {
      const title = ($(node).attr('title') || '').toLowerCase();
      const text = content.toLowerCase();

      for (const style of knownStyles) {
        if (title.includes(style) || text.includes(style)) {
          result[style] = pendingDamage;
          matchedCount++;
          //console.log(`🎯 Assigned ${pendingDamage} to style "${style}"`);

          if (schemaStyles.has(style)) {
            //console.log(`✅ Style "${style}" validated against max_hit_types`);
          } else {
            console.warn(`⚠️ Style "${style}" is NOT listed in max_hit_types`);
          }

          pendingDamage = null;
          break;
        }
      }

      // Handle unrecognized style text
      if (pendingDamage !== null && text) {
        const cleaned = text.toLowerCase().replace(/[^a-z]/g, '');
        result[cleaned] = pendingDamage;
        matchedCount++;
        //console.log(`⚠️ Assigned ${pendingDamage} to unrecognized style "${cleaned}"`);

        if (schemaStyles.has(cleaned)) {
          //console.log(`✅ Style "${cleaned}" validated against max_hit_types`);
        } else {
          console.warn(`⚠️ Style "${cleaned}" is NOT listed in max_hit_types`);
        }

        pendingDamage = null;
      }
    }

    node = node.next;
  }

  // Fallback: if we saw a number but couldn't match any style
  if (pendingDamage !== null && matchedCount === 0 && info.attack_styles.length) {
    for (const style of info.attack_styles) {
      const norm = style.toLowerCase();
      result[norm] = pendingDamage;
    }
    //console.warn(`🧩 Orphaned damage assigned to all attack styles: ${pendingDamage}`);
  }

  if (Object.keys(result).length > 0) {
    info.max_hit = result;
    console.log('✅ Final parsed max hits:', result);
  } else {
    console.warn('❌ No max hit values found in multi-style block');
  }
}

function getImageSrcFromInfobox($) {
  let imgTag = $('.infobox-monster td[data-attr-param="image"] img').first();
  if (!imgTag || !imgTag.attr('src')) {
    imgTag = $('.infobox-monster td.infobox-image img').first();
  }

  if (!imgTag || !imgTag.attr('src')) {
    //console.warn('⚠️ No image tag found inside monster infobox');
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
  totalName = bossName + " " + phaseName.toLowerCase();
  console.log("My full name is ", totalName)
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

function extractFlexibleMeleeDefense($, bossName = '', phaseName = '') {
  let stab = 0, slash = 0, crush = 0;

  // Manual override block
  const fullKey = `${bossName.toLowerCase()} ${phaseName.toLowerCase()}`.trim();
  //console.log("My full name is ", fullKey)
  const override = {
    'abyssal sire phase 3 stage 1': { stab: 40, slash: 60, crush: 50 },
    'abyssal sire phase 3 stage 2': { stab: 40, slash: 60, crush: 50 }
  };

  if (override[fullKey]) {
    console.warn(`⚠️ Using manual melee defense override for: ${fullKey}`);
    return override[fullKey];
  }

  const meleeAnchor = $('a')
    .filter((_, el) => $(el).text().trim().toLowerCase() === 'melee defence')
    .first();

  if (!meleeAnchor.length) {
    console.warn('⚠️ Could not find "melee defence" anchor');
    return { stab, slash, crush };
  }

  //console.log('✅ Found "melee defence" anchor. Starting DOM traversal...');

  let node = meleeAnchor[0].next;
  let steps = 0;

  // First pass: try traversing text nodes
  while (node) {
    steps++;
    const raw = node.type === 'text' ? node.data.trim() : $(node).text().trim();
    //console.log(`🔍 Step ${steps}: type=${node.type}, name=${node.name || 'n/a'}, text="${raw}"`);

    // Stop if we hit Magic Defence or next known section
    if (node.type === 'tag' && node.name === 'a') {
      const title = ($(node).attr('title') || '').trim().toLowerCase();
      if (title === 'magic' || title === 'magic defence') {
        //console.log(`⛔ Hit stop boundary at <a title="${title}">`);
        break;
      }
    }

    // Try matching +X+Y+Z
    if (node.type === 'text') {
      const text = node.data.trim();
      const match = text.match(/\+(\d+)\+(\d+)\+(\d+)/);
      if (match) {
        [, stab, slash, crush] = match.map(Number);
        console.log('🛡️ Found melee defense values in DOM traversal:', { stab, slash, crush });
        return { stab, slash, crush };
      }
    }

    node = node.next;
  }

  // Second pass: fallback raw HTML search around the "melee defence" section
  console.warn('❌ DOM traversal failed. Trying smarter fallback near melee section...');
  const html = $.html().replace(/\s+/g, ' ');
  const meleeIndex = html.toLowerCase().indexOf('melee defence');

  if (meleeIndex !== -1) {
    const snippet = html.slice(meleeIndex, meleeIndex + 500);
    const match = snippet.match(/\+(\d+)\+(\d+)\+(\d+)/);
    if (match) {
      [, stab, slash, crush] = match.map(Number);
      console.log('🛡️ (Fallback) Found melee defense near "melee defence" section:', { stab, slash, crush });
      return { stab, slash, crush };
    }
  }

  console.warn('❌ Could not extract melee defense from any pattern.');
  return { stab, slash, crush };
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

function extractFlexibleMagicDefenseAndWeakness($, bossName = '', phaseName = '') {
  const html = $.html().replace(/\s+/g, ' ');
  const fullKey = `${bossName.toLowerCase()} ${phaseName.toLowerCase()}`.trim();

  //console.log(`\n🔍 Extracting magic def + weakness for "${fullKey}"`);

  const magicIndex = html.toLowerCase().indexOf('magic defence');
  const rangedIndex = html.toLowerCase().indexOf('ranged defence');

  if (magicIndex === -1 || rangedIndex === -1 || magicIndex > rangedIndex) {
    console.warn(`❌ Could not find magic/ranged section for ${fullKey}`);
    return { magicDef: 0, elementalWeakness: 'none' };
  }

  const snippet = html.slice(magicIndex, rangedIndex);
  //console.log('🔬 Raw snippet between magic and ranged:\n', snippet);

  let magicDef = 0;
  let elementalWeakness = 'none';

  // Strip all HTML tags
  const cleanedText = snippet.replace(/<[^>]*>/g, '');
  //console.log('🧼 Cleaned snippet:', cleanedText);

  // Match "+<number><number>% weakness"
  const comboMatch = cleanedText.match(/([+-]?\d{2,3})(\d{2,3})%\s+weakness/i);
  const weaknessTitleMatch = snippet.match(/title="([^"]+ elemental weakness)"/i);

  if (comboMatch && weaknessTitleMatch) {
    magicDef = parseInt(comboMatch[1], 10);
    const weaknessPercent = `${parseInt(comboMatch[2], 10)}%`;
    const title = weaknessTitleMatch[1].toLowerCase();

    for (const element of validation.elemental_weaknesses) {
      if (title.includes(element)) {
        elementalWeakness = { [element]: weaknessPercent };
        break;
      }
    }

    //console.log(`✅ Combined match found:`);
    console.log(`🧙 Magic Defense: ${magicDef}`);
    console.log(`🧪 Weakness %: ${weaknessPercent}`);
    console.log(`🌐 Weakness Element from Title:`, elementalWeakness);
  } else {
    // Normalize for "no elemental weakness"
    const flattened = cleanedText.toLowerCase().replace(/[^a-z]/g, '');
    if (flattened.includes('noelementalweakness')) {
      elementalWeakness = 'none';
      const noWeaknessMatch = cleanedText.match(/([+-]?\d{1,3})/);
      if (noWeaknessMatch) {
        magicDef = parseInt(noWeaknessMatch[1], 10);
        console.log(`🧙 Magic Defense: ${magicDef}`);
      } else {
        console.warn('⚠️ Found no weakness string, but could not extract defense value.');
      }
      console.log('🧪 No elemental weakness found.');
    } else {
      console.warn('⚠️ Could not extract combined magic def and weakness pattern.');
    }
  }

  return { magicDef, elementalWeakness };
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

function extractFlexibleRangedDefense($) {
  let arrows = 0, bolts = 0, thrown = 0;

  const rangedAnchor = $('a')
    .filter((_, el) => $(el).text().trim().toLowerCase() === 'ranged defence')
    .first();

  if (!rangedAnchor.length) {
    console.warn('⚠️ Could not find "ranged defence" anchor');
    return { arrows, bolts, thrown };
  }

  let node = rangedAnchor[0].next;
  let steps = 0;

  // Traverse text nodes after the ranged defence label
  while (node) {
    steps++;
    const raw = node.type === 'text' ? node.data.trim() : $(node).text().trim();

    // Stop if we hit a known section like Immunities or Magic
    if (node.type === 'tag' && node.name === 'a') {
      const title = ($(node).attr('title') || '').trim().toLowerCase();
      if (title.includes('magic') || title.includes('immunities')) {
        break;
      }
    }

    // Look for "+X+Y+Z" or "-X-Y-Z"
    if (node.type === 'text') {
      const text = node.data.trim();
      const match = text.match(/([+-]?\d+)([+-]\d+)([+-]\d+)/);
      if (match) {
        thrown = parseInt(match[1], 10);  // light
        arrows = parseInt(match[2], 10);  // standard
        bolts = parseInt(match[3], 10);   // heavy
        console.log('🏹 Ranged defense values found in DOM traversal:', { arrows, bolts, thrown });
        return { arrows, bolts, thrown };
      }
    }

    node = node.next;
  }

  // Fallback HTML search
  console.warn('❌ DOM traversal failed. Trying fallback near "ranged defence"...');
  const html = $.html().replace(/\s+/g, ' ');
  const rangedIndex = html.toLowerCase().indexOf('ranged defence');

  if (rangedIndex !== -1) {
    const snippet = html.slice(rangedIndex, rangedIndex + 500);
    const match = snippet.match(/([+-]?\d+)([+-]\d+)([+-]\d+)/);
    if (match) {
      thrown = parseInt(match[1], 10);
      arrows = parseInt(match[2], 10);
      bolts = parseInt(match[3], 10);
      console.log('🏹 (Fallback) Found ranged defense near "ranged defence" section:', { arrows, bolts, thrown });
      return { arrows, bolts, thrown };
    }
  }

  console.warn('❌ Could not extract ranged defense from any pattern.');
  return { arrows, bolts, thrown };
}


function createMonsterTemplate(phase, bossName) {
  const name = phase ? `${bossName} (${phase})` : bossName;
  const baseUrl = `https://oldschool.runescape.wiki/w/${bossName.trim().replace(/\s+/g, '_')}`;
  const anchor = phase ? `#${slugWikiAnchor(phase)}` : '';
  const wiki_link = `${baseUrl}${anchor}`;

  console.log(`📝 Creating template for: ${name}`);
  return {
    name,
    wiki_link,
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
    immunities: {},
    weaknesses: 'none'
  };
}

function slugWikiAnchor(phase) {
  return phase
    .trim()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('_'); // e.g., "phase 3 stage 1" => "Phase_3_Stage_1"
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

function extractCombatLevel($) {
  const anchor = $('a[title="Combat level"]').first();

  if (!anchor.length) {
    console.warn('⚠️ Could not find "Combat level" anchor.');
    return 0;
  }

  // First, check for text node right after the anchor
  let node = anchor[0].next;
  let steps = 0;

  while (node && steps < 5) {
    let text = '';

    if (node.type === 'text') {
      text = node.data.trim();
    } else {
      text = $(node).text().trim();
    }

    // 🧠 Try to find just a number
    const match = text.match(/^(\d{1,4})$/);
    if (match) {
      const level = parseInt(match[1], 10);
      console.log('⚔️ Found Combat Level:', level);
      return level;
    }

    node = node.next;
    steps++;
  }

  console.warn('⚠️ Failed to extract Combat Level after anchor.');
  return 0;
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

function extractAttackStyles($, info) {
  const styles = [];
  const allowed = new Set(validation.attack_styles.map(normalize));
  const ignored = new Set(validation.ignore_case.map(normalize));

  const attackAnchor = $('a[title="Combat Options"]').filter((_, el) => $(el).text().trim().toLowerCase() === 'attack style').first();
  const endAnchor = $('a[title="Monster attack speed"]').first();

  if (!attackAnchor.length || !endAnchor.length) {
    console.warn(`⚠️ [${info.name}] Could not find attack style or end anchor`);
    return;
  }

  let node = attackAnchor[0].next;
  while (node && node !== endAnchor[0]) {
    if (node.type === 'tag' && node.name === 'a') {
      const styleText = $(node).text().trim().toLowerCase();
      if (styleText && !ignored.has(styleText)) {
        styles.push(styleText);
      }
    }
    node = node.next;
  }

  const valid = styles.filter(s => allowed.has(normalize(s)));
  const invalid = styles.filter(s => !allowed.has(normalize(s)));

  info.attack_styles = valid.map(s => s[0].toUpperCase() + s.slice(1));
  console.log('🧨 Attack Styles:', info.attack_styles);

  if (invalid.length > 0) {
    console.warn(`⚠️ [${info.name}] Unrecognized attack style(s):`, invalid);
  }
}

function parseAttackSpeed($, info) {
  let found = false;

  $('tr').each((i, tr) => {
    let thRaw = $(tr).find('th').text().trim();
    let tdRaw = $(tr).find('td').text().trim();
    const th = thRaw.replace(/\s+/g, ' ').toLowerCase(); // normalize for matching

    //console.log(`🧪 Row ${i}: th="${th}", td="${tdRaw}"`);

    if (th.includes('attack speed')) {
      const fullMatch = tdRaw.match(/(\d+)\s*ticks\s*\(([\d.]+)\s*seconds\)/i);
      if (fullMatch) {
        const ticks = parseInt(fullMatch[1], 10);
        const seconds = parseFloat(fullMatch[2]);
        info.attack_speed = { ticks, seconds };
        console.log(`✅ Parsed attack speed: ${ticks} ticks (${seconds} seconds)`);
        found = true;
        return false; // break loop
      }

      const fallbackMatch = tdRaw.match(/(\d+)\s*ticks/i);
      if (fallbackMatch) {
        const ticks = parseInt(fallbackMatch[1], 10);
        info.attack_speed = { ticks };
        console.log(`✅ Parsed attack speed: ${ticks} ticks (no seconds found)`);
        found = true;
        return false; // break loop
      }
    }
  });

  if (!found) {
    console.warn('⚠️ No attack speed found after parsing all rows.');
  }
}

function extractAttackSpeed($, info) {
  const anchor = $('a')
    .filter((_, el) => ($(el).attr('title') || '').trim().toLowerCase() === 'monster attack speed')
    .first();

  if (!anchor.length) {
    console.warn('⚠️ Attack speed anchor not found.');
    return;
  }

  let node = anchor[0].next;
  let step = 0;

  while (node) {
    step++;
    const content = node.type === 'text' ? node.data.trim() : $(node).text().trim();
    console.log(`🔍 Step ${step}: type=${node.type}, content="${content}"`);

    const fullMatch = content.match(/(\d+)\s*ticks\s*\(([\d.]+)\s*seconds\)/i);
    if (fullMatch) {
      const ticks = parseInt(fullMatch[1], 10);
      const seconds = parseFloat(fullMatch[2]);
      info.attack_speed = { ticks, seconds };
      console.log(`✅ Parsed attack speed: ${ticks} ticks (${seconds} seconds)`);
      return;
    }

    const fallbackMatch = content.match(/(\d+)\s*ticks/i);
    if (fallbackMatch) {
      const ticks = parseInt(fallbackMatch[1], 10);
      info.attack_speed = { ticks };
      console.log(`✅ Parsed attack speed: ${ticks} ticks (no seconds found)`);
      return;
    }

    node = node.next;
  }

  console.warn('❌ Failed to parse attack speed from nearby content.');
}

function parseAggressive($, info) {
  let found = false;

  $('tr').each((index, tr) => {
    const thRaw = $(tr).find('th').text();
    const tdRaw = $(tr).find('td').text();
    const th = thRaw.trim().toLowerCase();
    const td = tdRaw.trim();

    //console.log(`🔎 Row ${index}: th="${th}", td="${td}"`);

    if (th.includes('aggressive')) {
      found = true;
      const value = td.toLowerCase();
      if (['yes', 'no'].includes(value)) {
        info.aggressive = value === 'yes';
        console.log('😡 Aggressive:', info.aggressive);
      } else {
        console.warn(`⚠️ Unexpected aggressiveness value: "${value}"`);
      }

      return false; // ❗ Break out of .each after match
    }
  });

  if (!found) {
    console.warn(`⚠️ [${info.name}] Aggressiveness info not found.`);
  }
}

function extractMultiPhaseAggressiveness($, info) {
 

  console.log('🔍 Attempting to parse aggressiveness...');

  // Log all rows for visibility
  $('tr').each((i, tr) => {
    const th = $(tr).find('th').text().trim();
    const td = $(tr).find('td').text().trim();
    //console.log(`🔎 Row ${i}: th="${th}", td="${td}"`);
  });

  const anchor = $('a')
    .filter((_, el) => ($(el).attr('title') || '').trim().toLowerCase() === 'aggressiveness')
    .first();

  if (!anchor.length) {
    console.warn(`⚠️ [${info.name}] Aggressiveness anchor not found.`);
    return;
  }

  let node = anchor[0].next;
  let step = 0;

  while (node) {
    step++;
    let content = '';
    if (node.type === 'text') {
      content = node.data.trim();
    } else {
      content = $(node).text().trim();
    }

    console.log(`🔍 Step ${step}:`);
    console.log(`   ↪ node type: ${node.type}`);
    console.log(`   ↪ raw content: "${content}"`);
    console.log(`   ↪ tag name: ${node.name || 'N/A'}`);

    if (content) {
      const normalized = content.toLowerCase().replace(/\(.*?\)/g, '').trim();
      console.log(`   ↪ normalized: "${normalized}"`);
      if (validation.aggression_values.includes(normalized)) {
        info.aggressive = normalized === 'yes';
        console.log(`😡 Aggressive: ${info.aggressive}`);
        return;
      } else {
        console.warn(`⚠️ Unexpected aggressiveness value: "${normalized}"`);
        return;
      }
    }

    node = node.next;
  }

  console.warn(`⚠️ [${info.name}] Aggressiveness info not found after traversal.`);
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

function extractMultiPhaseImmunities($, info) {
  console.log('🧬 Attempting to parse immunities from multiphase page...');

  const knownImmunities = validation.immunities;
  const found = {};

  const anchors = $('a').toArray();
  for (let i = 0; i < anchors.length; i++) {
    const el = anchors[i];
    const label = ($(el).text() || '').trim().toLowerCase();

    if (knownImmunities.includes(label)) {
      // Look for the next sibling text node
      let node = el.next;
      while (node && node.type === 'text' && !node.data.trim()) {
        node = node.next;
      }

      if (node && node.type === 'text') {
        const value = node.data.trim().toLowerCase();
        if (value.includes('immune')) {
          found[label] = value.includes('not') ? false : true;
          console.log(`🧪 ${label}: ${found[label] ? 'Immune' : 'Not immune'}`);
        }
      }
    }
  }

  // Validate against schema
  const extra = Object.keys(found).filter(k => !knownImmunities.includes(k));
  if (extra.length > 0) {
    console.warn('⚠️ Unknown immunities found:', extra);
  }

  const missing = knownImmunities.filter(k => !(k in found));
  if (missing.length > 0) {
    console.warn('⚠️ Missing expected immunities:', missing);
  }

  if (Object.keys(found).length > 0) {
    info.immunities = found;
    console.log('✅ Immunities parsed:', found);
  } else {
    console.warn('❌ No valid immunities parsed');
  }
}

async function parseInfoboxData($, phase, bossName) {
  console.log('🧩 Using single-phase parser');
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
  console.log('🧩 Using tabbed multi-phase parser');
  const info = createMonsterTemplate(phase, bossName);
  const sanitizedImagePath = `assets/monster-icons/${sanitizeFilename(bossName, phase)}.png`;
  const localImgPath = path.join(__dirname, '..', '..', 'src', sanitizedImagePath);
  const wikiImgSrc = getImageSrcFromInfobox($);
  const { magicDef, elementalWeakness } = extractFlexibleMagicDefenseAndWeakness($, bossName, phase);

  if (wikiImgSrc && !fs.existsSync(localImgPath)) {
    await downloadImage(wikiImgSrc, localImgPath);
    console.log('💾 Downloaded image for', info.name);
  }

  info.image = sanitizedImagePath;
  // Use override if available; otherwise fallback to raw HP scraping
  info.hp = extractPhasedHp(bossName, phase) || extractHp($);

  info.defense.melee = extractFlexibleMeleeDefense($, bossName, phase);
  info.defense.magic = magicDef;
  info.defense.ranged = extractFlexibleRangedDefense($);
  info.weaknesses = elementalWeakness;

  info.combat_level = extractCombatLevel($);
  extractAttackStyles($, info);
  extractMultiMaxHitsVerbose($, info);
  extractAttackSpeed($, info);
  extractMultiPhaseAggressiveness($, info);
  extractMultiPhaseImmunities($, info);

  return info;
}



async function fetchMonsterStats($, bossName, phase = null) {
  try {
    const hasTabs = $('.infobox-buttons .button').length > 0;
    const fullName = [bossName, phase].filter(Boolean).join(' ').toLowerCase();

    const forceTabbed = forceTabbedParsing.has(fullName);

    console.log(`➡️ hasTabs: ${hasTabs}, phase: "${phase}", forceTabbed: ${forceTabbed}`);

    const bossData = (hasTabs && phase) || forceTabbed
      ? await parseTabbedInfoboxData($, phase, bossName)
      : await parseInfoboxData($, phase, bossName);

    return [bossData];
  } catch (err) {
    console.error(`❌ Failed to parse monster stats for ${bossName}${phase ? ` (${phase})` : ''}:`, err.message);
    return null;
  }
}


module.exports = { fetchMonsterStats, sanitizeFilename };
