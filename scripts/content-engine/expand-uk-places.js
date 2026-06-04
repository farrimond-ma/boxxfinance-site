/**
 * Expand UK_Places tab with UK towns 10,000+ population.
 * Script reads existing entries and only adds towns not already present.
 * Run: node expand-uk-places.js [--dry-run]
 */
require('dotenv').config();
const { google } = require('googleapis');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

// ─── Towns to add ─────────────────────────────────────────────────────────────
// Curated list of UK towns with 10,000+ population.
// Script deduplicates automatically so no harm if some are already in the sheet.

const TOWNS = [
  // England — East Midlands
  { place: 'Ilkeston',        country: 'England' },
  { place: 'Long Eaton',      country: 'England' },
  { place: 'Hucknall',        country: 'England' },
  { place: 'Kirkby in Ashfield', country: 'England' },
  { place: 'Sutton in Ashfield', country: 'England' },
  { place: 'Swadlincote',     country: 'England' },
  { place: 'Loughborough',    country: 'England' },
  { place: 'Hinckley',        country: 'England' },
  { place: 'Melton Mowbray',  country: 'England' },
  { place: 'Oadby',           country: 'England' },
  { place: 'Wigston',         country: 'England' },
  { place: 'Market Harborough', country: 'England' },
  { place: 'Coalville',       country: 'England' },
  { place: 'Grantham',        country: 'England' },
  { place: 'Gainsborough',    country: 'England' },
  { place: 'Retford',         country: 'England' },
  { place: 'Worksop',         country: 'England' },
  { place: 'Spalding',        country: 'England' },
  { place: 'Stamford',        country: 'England' },
  { place: 'Boston',          country: 'England' },

  // England — West Midlands
  { place: 'Cannock',         country: 'England' },
  { place: 'Rugeley',         country: 'England' },
  { place: 'Burntwood',       country: 'England' },
  { place: 'Brownhills',      country: 'England' },
  { place: 'Kingswinford',    country: 'England' },
  { place: 'Brierley Hill',   country: 'England' },
  { place: 'Halesowen',       country: 'England' },
  { place: 'Rowley Regis',    country: 'England' },
  { place: 'Wednesbury',      country: 'England' },
  { place: 'Willenhall',      country: 'England' },
  { place: 'Bromsgrove',      country: 'England' },
  { place: 'Evesham',         country: 'England' },
  { place: 'Droitwich Spa',   country: 'England' },
  { place: 'Royal Leamington Spa', country: 'England' },
  { place: 'Warwick',         country: 'England' },
  { place: 'Kenilworth',      country: 'England' },
  { place: 'Bedworth',        country: 'England' },

  // England — East of England
  { place: 'Huntingdon',      country: 'England' },
  { place: 'St Neots',        country: 'England' },
  { place: 'Wisbech',         country: 'England' },
  { place: 'Haverhill',       country: 'England' },
  { place: 'Thetford',        country: 'England' },
  { place: 'Leighton Buzzard', country: 'England' },
  { place: 'Dunstable',       country: 'England' },
  { place: 'Biggleswade',     country: 'England' },
  { place: 'Clacton-on-Sea',  country: 'England' },
  { place: 'Braintree',       country: 'England' },
  { place: 'Witham',          country: 'England' },
  { place: 'Rayleigh',        country: 'England' },
  { place: 'Billericay',      country: 'England' },
  { place: 'Canvey Island',   country: 'England' },
  { place: 'Grays',           country: 'England' },
  { place: 'Sittingbourne',   country: 'England' },

  // England — South East
  { place: 'Margate',         country: 'England' },
  { place: 'Ramsgate',        country: 'England' },
  { place: 'Deal',            country: 'England' },
  { place: 'Tonbridge',       country: 'England' },
  { place: 'Sevenoaks',       country: 'England' },
  { place: 'Dartford',        country: 'England' },
  { place: 'Gravesend',       country: 'England' },
  { place: 'Rochester',       country: 'England' },
  { place: 'Sittingbourne',   country: 'England' },
  { place: 'Newbury',         country: 'England' },
  { place: 'Maidenhead',      country: 'England' },
  { place: 'Staines-upon-Thames', country: 'England' },
  { place: 'Camberley',       country: 'England' },
  { place: 'Weybridge',       country: 'England' },
  { place: 'Epsom',           country: 'England' },
  { place: 'Reigate',         country: 'England' },
  { place: 'Burgess Hill',    country: 'England' },
  { place: 'Haywards Heath',  country: 'England' },
  { place: 'East Grinstead',  country: 'England' },
  { place: 'Horley',          country: 'England' },
  { place: 'Farnham',         country: 'England' },
  { place: 'Fleet',           country: 'England' },
  { place: 'Lancing',         country: 'England' },

  // England — South West
  { place: 'Chippenham',      country: 'England' },
  { place: 'Trowbridge',      country: 'England' },
  { place: 'Frome',           country: 'England' },
  { place: 'Bridgwater',      country: 'England' },
  { place: 'Barnstaple',      country: 'England' },
  { place: 'Exmouth',         country: 'England' },
  { place: 'Newton Abbot',    country: 'England' },
  { place: 'Paignton',        country: 'England' },
  { place: 'Newquay',         country: 'England' },
  { place: 'Camborne',        country: 'England' },
  { place: 'Falmouth',        country: 'England' },
  { place: 'Dorchester',      country: 'England' },
  { place: 'Christchurch',    country: 'England' },
  { place: 'Andover',         country: 'England' },
  { place: 'Eastleigh',       country: 'England' },
  { place: 'Fareham',         country: 'England' },
  { place: 'Gosport',         country: 'England' },
  { place: 'Waterlooville',   country: 'England' },
  { place: 'Newport Isle of Wight', country: 'England' },

  // England — North West
  { place: 'Accrington',      country: 'England' },
  { place: 'Nelson',          country: 'England' },
  { place: 'Rawtenstall',     country: 'England' },
  { place: 'Darwen',          country: 'England' },
  { place: 'Chorley',         country: 'England' },
  { place: 'Leyland',         country: 'England' },
  { place: 'Lytham St Annes', country: 'England' },
  { place: 'Ormskirk',        country: 'England' },
  { place: 'Skelmersdale',    country: 'England' },
  { place: 'Crosby',          country: 'England' },
  { place: 'Bootle',          country: 'England' },
  { place: 'Newton-le-Willows', country: 'England' },
  { place: 'Golborne',        country: 'England' },
  { place: 'Atherton',        country: 'England' },
  { place: 'Horwich',         country: 'England' },
  { place: 'Farnworth',       country: 'England' },
  { place: 'Radcliffe',       country: 'England' },
  { place: 'Middleton',       country: 'England' },
  { place: 'Heywood',         country: 'England' },
  { place: 'Royton',          country: 'England' },
  { place: 'Chadderton',      country: 'England' },
  { place: 'Droylsden',       country: 'England' },
  { place: 'Dukinfield',      country: 'England' },
  { place: 'Stalybridge',     country: 'England' },
  { place: 'Hyde',            country: 'England' },
  { place: 'Denton',          country: 'England' },
  { place: 'Altrincham',      country: 'England' },
  { place: 'Cheadle',         country: 'England' },
  { place: 'Sale',            country: 'England' },
  { place: 'Stretford',       country: 'England' },
  { place: 'Eccles',          country: 'England' },
  { place: 'Swinton',         country: 'England' },
  { place: 'Winsford',        country: 'England' },
  { place: 'Northwich',       country: 'England' },
  { place: 'Congleton',       country: 'England' },
  { place: 'Wilmslow',        country: 'England' },
  { place: 'Neston',          country: 'England' },
  { place: 'Fleetwood',       country: 'England' },
  { place: 'Clitheroe',       country: 'England' },

  // England — Yorkshire
  { place: 'Bingley',         country: 'England' },
  { place: 'Shipley',         country: 'England' },
  { place: 'Morley',          country: 'England' },
  { place: 'Pudsey',          country: 'England' },
  { place: 'Ossett',          country: 'England' },
  { place: 'Pontefract',      country: 'England' },
  { place: 'Castleford',      country: 'England' },
  { place: 'Batley',          country: 'England' },
  { place: 'Brighouse',       country: 'England' },
  { place: 'Normanton',       country: 'England' },
  { place: 'Rothwell',        country: 'England' },
  { place: 'Cleckheaton',     country: 'England' },
  { place: 'Goole',           country: 'England' },
  { place: 'Selby',           country: 'England' },
  { place: 'Dronfield',       country: 'England' },

  // England — North East
  { place: 'Newton Aycliffe', country: 'England' },
  { place: 'Chester-le-Street', country: 'England' },
  { place: 'Consett',         country: 'England' },
  { place: 'Spennymoor',      country: 'England' },
  { place: 'Bishop Auckland', country: 'England' },
  { place: 'Seaham',          country: 'England' },
  { place: 'Peterlee',        country: 'England' },
  { place: 'South Shields',   country: 'England' },
  { place: 'Jarrow',          country: 'England' },
  { place: 'Hebburn',         country: 'England' },
  { place: 'Wallsend',        country: 'England' },
  { place: 'Whitley Bay',     country: 'England' },
  { place: 'Ashington',       country: 'England' },
  { place: 'Blyth',           country: 'England' },
  { place: 'Morpeth',         country: 'England' },
  { place: 'Hexham',          country: 'England' },
  { place: 'Billingham',      country: 'England' },
  { place: 'Thornaby-on-Tees', country: 'England' },

  // England — East / Herts
  { place: 'Welwyn Garden City', country: 'England' },
  { place: 'Hatfield',        country: 'England' },
  { place: 'Hoddesdon',       country: 'England' },
  { place: 'Cheshunt',        country: 'England' },
  { place: 'Hertford',        country: 'England' },
  { place: 'Letchworth Garden City', country: 'England' },
  { place: 'Baldock',         country: 'England' },
  { place: 'Hitchin',         country: 'England' },
  { place: 'Royston',         country: 'England' },
  { place: 'Thetford',        country: 'England' },
  { place: 'Ely',             country: 'England' },
  { place: 'March',           country: 'England' },

  // Scotland
  { place: 'Hamilton',        country: 'Scotland' },
  { place: 'Cumbernauld',     country: 'Scotland' },
  { place: 'East Kilbride',   country: 'Scotland' },
  { place: 'Glenrothes',      country: 'Scotland' },
  { place: 'Kirkcaldy',       country: 'Scotland' },
  { place: 'Dunfermline',     country: 'Scotland' },
  { place: 'Bathgate',        country: 'Scotland' },
  { place: 'Coatbridge',      country: 'Scotland' },
  { place: 'Airdrie',         country: 'Scotland' },
  { place: 'Greenock',        country: 'Scotland' },
  { place: 'Clydebank',       country: 'Scotland' },
  { place: 'Bearsden',        country: 'Scotland' },
  { place: 'Bishopbriggs',    country: 'Scotland' },
  { place: 'Newton Mearns',   country: 'Scotland' },
  { place: 'Rutherglen',      country: 'Scotland' },
  { place: 'Musselburgh',     country: 'Scotland' },
  { place: 'Dalkeith',        country: 'Scotland' },
  { place: 'Penicuik',        country: 'Scotland' },
  { place: 'Arbroath',        country: 'Scotland' },
  { place: 'Elgin',           country: 'Scotland' },
  { place: 'Inverurie',       country: 'Scotland' },
  { place: 'Peterhead',       country: 'Scotland' },
  { place: 'Fraserburgh',     country: 'Scotland' },
  { place: 'Irvine',          country: 'Scotland' },
  { place: 'Galashiels',      country: 'Scotland' },
  { place: 'Hawick',          country: 'Scotland' },

  // Wales
  { place: 'Cwmbran',         country: 'Wales' },
  { place: 'Caerphilly',      country: 'Wales' },
  { place: 'Pontypool',       country: 'Wales' },
  { place: 'Aberdare',        country: 'Wales' },
  { place: 'Pontypridd',      country: 'Wales' },
  { place: 'Ebbw Vale',       country: 'Wales' },
  { place: 'Bargoed',         country: 'Wales' },
  { place: 'Blackwood',       country: 'Wales' },
  { place: 'Port Talbot',     country: 'Wales' },
  { place: 'Barry',           country: 'Wales' },
  { place: 'Penarth',         country: 'Wales' },
  { place: 'Abergavenny',     country: 'Wales' },
  { place: 'Welshpool',       country: 'Wales' },
  { place: 'Newtown Powys',   country: 'Wales' },

  // Northern Ireland
  { place: 'Newtownabbey',    country: 'Northern Ireland' },
  { place: 'Bangor',          country: 'Northern Ireland' },
  { place: 'Antrim',          country: 'Northern Ireland' },
  { place: 'Ballymena',       country: 'Northern Ireland' },
  { place: 'Coleraine',       country: 'Northern Ireland' },
  { place: 'Omagh',           country: 'Northern Ireland' },
  { place: 'Enniskillen',     country: 'Northern Ireland' },
  { place: 'Armagh',          country: 'Northern Ireland' },
  { place: 'Dungannon',       country: 'Northern Ireland' },
  { place: 'Strabane',        country: 'Northern Ireland' },
  { place: 'Carrickfergus',   country: 'Northern Ireland' },
  { place: 'Larne',           country: 'Northern Ireland' },
  { place: 'Cookstown',       country: 'Northern Ireland' },
];

// ─── Auth ─────────────────────────────────────────────────────────────────────
async function getSheetsClient() {
  let credentials;
  if (process.env.GOOGLE_CREDENTIALS) {
    try { credentials = JSON.parse(Buffer.from(process.env.GOOGLE_CREDENTIALS, 'base64').toString('utf8')); }
    catch { credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS); }
  }
  const auth = credentials
    ? new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] })
    : new google.auth.GoogleAuth({ keyFile: 'google-credentials.json', scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  return google.sheets({ version: 'v4', auth });
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  console.log('\n[Expand UK_Places — adding 10,000+ population towns]\n');
  if (isDryRun) console.log('DRY RUN\n');

  const sheets = await getSheetsClient();

  // Read existing places
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'UK_Places!A2:E',
  });
  const existing = res.data.values || [];
  const existingNames = new Set(existing.map(r => (r[1] || '').toLowerCase().trim().replace(/\s+/g,' ')));
  const maxRank = Math.max(...existing.map(r => parseInt(r[0]) || 0));

  console.log(`Existing places: ${existing.length} (max rank: ${maxRank})`);

  // Filter to only new towns not already present
  const toAdd = TOWNS.filter(t => {
    const key = t.place.toLowerCase().trim().replace(/\s+/g,' ');
    return !existingNames.has(key);
  }).filter((t, i, arr) => {
    // Remove duplicates within the new list
    return arr.findIndex(x => x.place.toLowerCase().trim() === t.place.toLowerCase().trim()) === i;
  });

  console.log(`Towns to add: ${toAdd.length} (${TOWNS.length - toAdd.length} already present)`);

  if (isDryRun) {
    const byCountry = {};
    toAdd.forEach(t => { byCountry[t.country] = (byCountry[t.country] || 0) + 1; });
    Object.entries(byCountry).sort((a,b) => b[1]-a[1]).forEach(([c,n]) => console.log(`  ${c}: ${n}`));
    console.log('\nFirst 20:');
    toAdd.slice(0,20).forEach((t,i) => console.log(`  ${maxRank+i+1}. ${t.place} (${t.country})`));
    console.log(`\nTotal UK_Places after: ${existing.length + toAdd.length}`);
    const daysLoc = (existing.length + toAdd.length) / 5;
    console.log(`At 5 locations/day: ${Math.round(daysLoc)} days = ${Math.round(daysLoc/7)} weeks of location pages`);
    return;
  }

  if (toAdd.length === 0) {
    console.log('Nothing to add — all towns already in UK_Places');
    return;
  }

  // Build rows with slug hints
  const slugify = (s) => s.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'').replace(/-+/g,'-');
  const rows = toAdd.map((t, i) => [
    String(maxRank + i + 1),
    t.place,
    t.country,
    'Tier 4',
    slugify(t.place),
  ]);

  // Append in batches of 200
  for (let start = 0; start < rows.length; start += 200) {
    const chunk = rows.slice(start, start + 200);
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'UK_Places!A:E',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: chunk },
    });
    console.log(`  Appended ${start + 1}–${Math.min(start + 200, rows.length)}`);
  }

  const total = existing.length + rows.length;
  const days  = Math.round(total / 5);
  console.log(`\n✅ Done!`);
  console.log(`   Added: ${rows.length} towns`);
  console.log(`   UK_Places total: ${total} locations`);
  console.log(`   At 5 locations/day: ${days} days = ${Math.round(days/7)} weeks of location pages`);
  console.log(`   At 1 bridging finance service: ${total} location pages total\n`);
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
