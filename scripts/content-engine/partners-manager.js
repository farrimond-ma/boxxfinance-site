// Partner / introducer registry — CLI to add, list, activate and deactivate
// referral codes for the /partners program. Source of truth is
// src/data/partners.json (git-committed), which the internal /dashboard page
// reads directly to show the partner list.
//
// Codes are issued manually, on purpose: the /partners page tells applicants
// "we'll send an introducer agreement and your referral code" — a code should
// only exist once that agreement is actually sent, not the moment someone
// submits the sign-up form. Sign-up submissions still land in the regular
// leads Google Sheet (tagged "Partner sign-up (introducer)") for review; once
// approved, run `add` here to issue the code.
//
// Usage:
//   node partners-manager.js add --firm "Example Brokers Ltd" --contact "Jane Doe" --email jane@example.com [--phone "..."] [--fca "123456"] [--notes "..."]
//   node partners-manager.js list
//   node partners-manager.js activate <code>
//   node partners-manager.js deactivate <code>

const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '../../src/data/partners.json');

function readPartners() {
  if (!fs.existsSync(DATA_PATH)) return [];
  return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
}

function writePartners(list) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(list, null, 2) + '\n');
}

function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      opts[key] = val;
    }
  }
  return opts;
}

function slugPrefix(firm) {
  const letters = firm.toUpperCase().replace(/[^A-Z]/g, '');
  return (letters.slice(0, 4) || 'PTNR');
}

function generateCode(firm, existingCodes) {
  const prefix = slugPrefix(firm);
  let code;
  do {
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    code = `${prefix}-${suffix}`;
  } while (existingCodes.has(code));
  return code;
}

function addPartner(opts) {
  if (!opts.firm || !opts.contact || !opts.email) {
    console.error('Usage: node partners-manager.js add --firm "..." --contact "..." --email "..." [--phone "..."] [--fca "..."] [--notes "..."]');
    process.exit(1);
  }
  const partners = readPartners();
  const existingCodes = new Set(partners.map(p => p.code));
  const code = generateCode(opts.firm, existingCodes);

  const entry = {
    code,
    firm: opts.firm,
    contact: opts.contact,
    email: opts.email,
    phone: opts.phone || '',
    fca: opts.fca || '',
    notes: opts.notes || '',
    status: 'active',
    dateJoined: new Date().toISOString().slice(0, 10),
  };
  partners.push(entry);
  writePartners(partners);

  const link = `https://boxxfinance.co.uk/?ref=${code}`;
  const snippet = `<p>Need a bridging loan? Our specialist partner\n  <a href="${link}" rel="sponsored" target="_blank">Boxx Commercial Finance</a>\n  arranges short-term property finance across the UK.</p>`;

  console.log('\n✅ Partner added\n');
  console.log(`  Firm:    ${entry.firm}`);
  console.log(`  Contact: ${entry.contact} <${entry.email}>`);
  console.log(`  Code:    ${entry.code}`);
  console.log(`  Link:    ${link}`);
  console.log('\n  Snippet to send them:\n');
  console.log(snippet);
  console.log('\n  Remember: send the introducer agreement alongside this — the code');
  console.log('  is only meant to go out once that\'s been issued.\n');
  console.log('  Run `node partners-manager.js` after committing src/data/partners.json');
  console.log('  and pushing, so the code shows on /dashboard and starts attributing leads.\n');
}

function listPartners() {
  const partners = readPartners();
  if (partners.length === 0) {
    console.log('No partners yet. Add one with: node partners-manager.js add --firm "..." --contact "..." --email "..."');
    return;
  }
  console.table(partners.map(p => ({
    Code: p.code, Firm: p.firm, Contact: p.contact, Status: p.status, Joined: p.dateJoined,
  })));
}

function setStatus(code, status) {
  const partners = readPartners();
  const entry = partners.find(p => p.code === code);
  if (!entry) {
    console.error(`No partner found with code ${code}`);
    process.exit(1);
  }
  entry.status = status;
  writePartners(partners);
  console.log(`✅ ${entry.firm} (${code}) set to ${status}`);
}

function main() {
  const [, , command, ...rest] = process.argv;
  const opts = parseArgs(rest);

  switch (command) {
    case 'add':
      addPartner(opts);
      break;
    case 'list':
      listPartners();
      break;
    case 'activate':
      setStatus(rest[0], 'active');
      break;
    case 'deactivate':
      setStatus(rest[0], 'inactive');
      break;
    default:
      console.log('Usage:');
      console.log('  node partners-manager.js add --firm "..." --contact "..." --email "..." [--phone "..."] [--fca "..."] [--notes "..."]');
      console.log('  node partners-manager.js list');
      console.log('  node partners-manager.js activate <code>');
      console.log('  node partners-manager.js deactivate <code>');
  }
}

main();
