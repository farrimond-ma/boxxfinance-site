require('dotenv').config();
const { google } = require('googleapis');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

// ─── Auth ─────────────────────────────────────────────────────────────────────
async function getSheetsClient() {
  let credentials;
  if (process.env.GOOGLE_CREDENTIALS) {
    try {
      credentials = JSON.parse(Buffer.from(process.env.GOOGLE_CREDENTIALS, 'base64').toString('utf8'));
    } catch {
      credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    }
  }
  const auth = credentials
    ? new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] })
    : new google.auth.GoogleAuth({ keyFile: 'google-credentials.json', scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  return google.sheets({ version: 'v4', auth });
}

// ─── Get sheet metadata ───────────────────────────────────────────────────────
async function getSheetIds(sheets) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const map = {};
  for (const s of meta.data.sheets) {
    map[s.properties.title] = s.properties.sheetId;
  }
  return map;
}

// ─── LinkedIn_Queue: ensure header row is complete ────────────────────────────
async function updateLinkedInQueueHeaders(sheets) {
  console.log('\n── LinkedIn_Queue ──────────────────────────────────────────');

  // Full intended header row A–R
  const FULL_HEADERS = [
    'id',             // A
    'publishDate',    // B
    'service',        // C
    'keyword',        // D
    'title',          // E
    'slug',           // F
    'url',            // G
    'author',         // H
    'liStatus',       // I
    'liPostText',     // J
    'liFirstComment', // K
    'notes',          // L
    'fbStatus',       // M
    'fbPostText',     // N
    'fbPostId',       // O
    'igStatus',       // P
    'igPostText',     // Q
    'igPostId',       // R
  ];

  // Read existing header row
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'LinkedIn_Queue!A1:R1',
  });
  const existing = (res.data.values || [[]])[0] || [];
  console.log(`  Existing headers (${existing.length}): ${existing.join(', ') || '(none)'}`);

  // Build updated row: keep existing values, fill in blanks / add new ones
  const updated = FULL_HEADERS.map((h, i) => existing[i] || h);

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: 'LinkedIn_Queue!A1:R1',
    valueInputOption: 'RAW',
    requestBody: { values: [updated] },
  });

  console.log(`  ✅ Header row updated to ${updated.length} columns (A–R)`);
  console.log(`  New columns added:`);
  if (!existing[12]) console.log(`    M  = fbStatus`);
  if (!existing[13]) console.log(`    N  = fbPostText`);
  if (!existing[14]) console.log(`    O  = fbPostId`);
  if (!existing[15]) console.log(`    P  = igStatus`);
  if (!existing[16]) console.log(`    Q  = igPostText`);
  if (!existing[17]) console.log(`    R  = igPostId`);
  if (existing[15]) console.log(`    (Instagram columns P–R already present)`);
}

// ─── Create Reddit_Drafts tab if missing ─────────────────────────────────────
async function ensureRedditDraftsTab(sheets, sheetIds) {
  console.log('\n── Reddit_Drafts ───────────────────────────────────────────');

  if (sheetIds['Reddit_Drafts'] !== undefined) {
    console.log('  Tab already exists — checking headers...');
  } else {
    console.log('  Tab not found — creating...');
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{
          addSheet: {
            properties: { title: 'Reddit_Drafts' },
          },
        }],
      },
    });
    console.log('  ✅ Tab created');
  }

  // Write / overwrite header row
  const HEADERS = [
    'Date Found',    // A
    'Subreddit',     // B
    'Post Title',    // C
    'Post URL',      // D
    'Keyword',       // E
    'Draft Response', // F
    'Status',        // G
  ];

  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Reddit_Drafts!A1:G1',
  });
  const existingHeaders = (existing.data.values || [[]])[0] || [];

  if (existingHeaders.length === HEADERS.length) {
    console.log('  Headers already set — skipping');
    return;
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Reddit_Drafts!A1:G1',
    valueInputOption: 'RAW',
    requestBody: { values: [HEADERS] },
  });
  console.log(`  ✅ Headers written: ${HEADERS.join(', ')}`);
}

// ─── Style the header rows ────────────────────────────────────────────────────
async function styleHeaders(sheets, sheetIds) {
  console.log('\n── Styling header rows ─────────────────────────────────────');

  const requests = [];

  // LinkedIn_Queue header: bold + navy background + white text (columns A–R = 18 cols)
  if (sheetIds['LinkedIn_Queue'] !== undefined) {
    requests.push({
      repeatCell: {
        range: {
          sheetId:          sheetIds['LinkedIn_Queue'],
          startRowIndex:    0,
          endRowIndex:      1,
          startColumnIndex: 0,
          endColumnIndex:   18,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor:  { red: 0.012, green: 0.106, blue: 0.286 }, // #031b49 navy
            textFormat:       { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)',
      },
    });
  }

  // Reddit_Drafts header: bold + dark green background + white text
  if (sheetIds['Reddit_Drafts'] !== undefined) {
    requests.push({
      repeatCell: {
        range: {
          sheetId:          sheetIds['Reddit_Drafts'],
          startRowIndex:    0,
          endRowIndex:      1,
          startColumnIndex: 0,
          endColumnIndex:   7,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor:  { red: 0.067, green: 0.28, blue: 0.067 }, // dark green
            textFormat:       { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)',
      },
    });

    // Freeze header row + auto-resize columns in Reddit_Drafts
    requests.push({
      updateSheetProperties: {
        properties: {
          sheetId: sheetIds['Reddit_Drafts'],
          gridProperties: { frozenRowCount: 1 },
        },
        fields: 'gridProperties.frozenRowCount',
      },
    });
  }

  if (requests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests },
    });
    console.log('  ✅ Header styles applied');
  }
}

// ─── Add data validation for status columns ───────────────────────────────────
async function addStatusValidation(sheets, sheetIds) {
  console.log('\n── Status column validation ────────────────────────────────');

  const socialStatuses = ['pending', 'posted', 'skipped', 'failed'];
  const redditStatuses = ['pending', 'posted', 'skipped'];

  const requests = [];

  // LinkedIn_Queue: validate igStatus (col P = index 15)
  if (sheetIds['LinkedIn_Queue'] !== undefined) {
    for (const colIndex of [12, 15]) { // M=fbStatus, P=igStatus
      requests.push({
        setDataValidation: {
          range: {
            sheetId:          sheetIds['LinkedIn_Queue'],
            startRowIndex:    1,
            endRowIndex:      1000,
            startColumnIndex: colIndex,
            endColumnIndex:   colIndex + 1,
          },
          rule: {
            condition: {
              type:   'ONE_OF_LIST',
              values: socialStatuses.map((v) => ({ userEnteredValue: v })),
            },
            showCustomUi: true,
            strict:       false,
          },
        },
      });
    }
  }

  // Reddit_Drafts: validate Status (col G = index 6)
  if (sheetIds['Reddit_Drafts'] !== undefined) {
    requests.push({
      setDataValidation: {
        range: {
          sheetId:          sheetIds['Reddit_Drafts'],
          startRowIndex:    1,
          endRowIndex:      1000,
          startColumnIndex: 6,
          endColumnIndex:   7,
        },
        rule: {
          condition: {
            type:   'ONE_OF_LIST',
            values: redditStatuses.map((v) => ({ userEnteredValue: v })),
          },
          showCustomUi: true,
          strict:       false,
        },
      },
    });
  }

  if (requests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests },
    });
    console.log('  ✅ Dropdown validation added to status columns');
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║   Boxx Finance — Sheet Setup             ║');
  console.log('╚══════════════════════════════════════════╝');

  const sheets  = await getSheetsClient();
  const sheetIds = await getSheetIds(sheets);
  console.log(`\nFound tabs: ${Object.keys(sheetIds).join(', ')}`);

  await updateLinkedInQueueHeaders(sheets);
  await ensureRedditDraftsTab(sheets, sheetIds);

  // Re-fetch sheet IDs after potentially creating Reddit_Drafts
  const updatedIds = await getSheetIds(sheets);
  await styleHeaders(sheets, updatedIds);
  await addStatusValidation(sheets, updatedIds);

  console.log('\n✅ Sheet setup complete.\n');
  console.log('Summary of changes:');
  console.log('  LinkedIn_Queue  — headers extended to column R (igStatus, igPostText, igPostId)');
  console.log('  Reddit_Drafts   — tab created/confirmed with 7-column header row');
  console.log('  Styling         — navy header row on LinkedIn_Queue, green on Reddit_Drafts');
  console.log('  Validation      — status dropdowns on fbStatus, igStatus, Reddit Status\n');
}

main().catch((err) => {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
});
