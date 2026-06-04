/**
 * Boxx Finance — AI Visibility Checker
 * Tests 80 prompts across ChatGPT, Perplexity, and Claude
 * Tracks Boxx mentions and competitor mentions
 * Exports to CSV + Google Sheets
 */

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { google } from "googleapis";
import fetch from "node-fetch";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// ─── Config ──────────────────────────────────────────────────────────────────

const SPREADSHEET_ID = process.env.SPREADSHEET_ID || "1244VCHh0asyN9Uav9_7UHcoa8LyuLvHK0uprnHNAVrg";
const SHEET_TAB = "AI_Visibility";
const RESULTS_DIR = join(ROOT, "results");

const COMPETITORS = [
  "Together",
  "MT Finance",
  "West One",
  "Roma Finance",
  "Precise",
  "Octane Capital",
  "United Trust Bank",
  "LendInvest",
  "Masthaven",
  "TML",
  "Bridging Finance",
  "Funding 365",
  "InterBay",
  "Shawbrook",
  "Together Money",
  "Castle Trust",
  "Landbay",
  "Paragon",
];

// Rate limit: ms to wait between calls per service
const RATE_LIMITS = {
  chatgpt:   1200,
  claude:     800,
  perplexity: 1000,
  gemini:    1000,
};

// ─── Prompts ──────────────────────────────────────────────────────────────────

const PROMPTS = [
  // Bridging Finance (priority: high)
  { id: 1,  pillar: "Bridging Finance",     priority: "high",   text: "What are the best bridging loan lenders in the UK?" },
  { id: 2,  pillar: "Bridging Finance",     priority: "high",   text: "How do I get a bridging loan for a property purchase?" },
  { id: 3,  pillar: "Bridging Finance",     priority: "high",   text: "What is a bridging loan and how does it work?" },
  { id: 4,  pillar: "Bridging Finance",     priority: "high",   text: "Best short-term property finance options UK 2025" },
  { id: 5,  pillar: "Bridging Finance",     priority: "high",   text: "Bridging loan rates comparison UK" },
  { id: 6,  pillar: "Bridging Finance",     priority: "high",   text: "Who offers fast bridging finance for property developers?" },
  { id: 7,  pillar: "Bridging Finance",     priority: "medium", text: "How quickly can I get a bridging loan?" },
  { id: 8,  pillar: "Bridging Finance",     priority: "medium", text: "Bridging finance for auction property purchase" },
  { id: 9,  pillar: "Bridging Finance",     priority: "medium", text: "What's the difference between open and closed bridging loans?" },
  { id: 10, pillar: "Bridging Finance",     priority: "medium", text: "Best bridging loan brokers UK" },

  // Development Finance (priority: high)
  { id: 11, pillar: "Development Finance",  priority: "high",   text: "Best property development finance lenders UK" },
  { id: 12, pillar: "Development Finance",  priority: "high",   text: "How to finance a property development project" },
  { id: 13, pillar: "Development Finance",  priority: "high",   text: "Development finance for ground-up builds UK" },
  { id: 14, pillar: "Development Finance",  priority: "high",   text: "Short-term development loans for property developers" },
  { id: 15, pillar: "Development Finance",  priority: "high",   text: "Who lends for property development in the UK?" },
  { id: 16, pillar: "Development Finance",  priority: "medium", text: "Development finance rates and terms 2025" },
  { id: 17, pillar: "Development Finance",  priority: "medium", text: "How to get funding for a property conversion" },
  { id: 18, pillar: "Development Finance",  priority: "medium", text: "Property development finance options for small developers" },
  { id: 19, pillar: "Development Finance",  priority: "medium", text: "Mezzanine finance for property development" },
  { id: 20, pillar: "Development Finance",  priority: "medium", text: "How does development finance drawdown work?" },

  // Refurbishment Loans
  { id: 21, pillar: "Refurbishment Loans",  priority: "medium", text: "Best lenders for property refurbishment loans UK" },
  { id: 22, pillar: "Refurbishment Loans",  priority: "medium", text: "How to finance a property renovation project" },
  { id: 23, pillar: "Refurbishment Loans",  priority: "medium", text: "Light vs heavy refurbishment bridging loans" },
  { id: 24, pillar: "Refurbishment Loans",  priority: "medium", text: "Loans for buy-renovate-sell strategy UK" },
  { id: 25, pillar: "Refurbishment Loans",  priority: "medium", text: "Refurbishment finance for landlords UK" },
  { id: 26, pillar: "Refurbishment Loans",  priority: "low",    text: "Short-term loans for property improvement UK" },
  { id: 27, pillar: "Refurbishment Loans",  priority: "low",    text: "How to fund a HMO conversion UK" },
  { id: 28, pillar: "Refurbishment Loans",  priority: "low",    text: "Finance for flipping properties UK" },
  { id: 29, pillar: "Refurbishment Loans",  priority: "low",    text: "Refurbishment bridging loan rates UK" },
  { id: 30, pillar: "Refurbishment Loans",  priority: "low",    text: "Best lenders for property flip finance" },

  // Commercial Finance
  { id: 31, pillar: "Commercial Finance",   priority: "medium", text: "Commercial mortgage lenders UK" },
  { id: 32, pillar: "Commercial Finance",   priority: "medium", text: "Finance options for commercial property purchase" },
  { id: 33, pillar: "Commercial Finance",   priority: "medium", text: "Semi-commercial property finance UK" },
  { id: 34, pillar: "Commercial Finance",   priority: "medium", text: "Mixed-use property mortgage options UK" },
  { id: 35, pillar: "Commercial Finance",   priority: "medium", text: "Short-term commercial property loans" },
  { id: 36, pillar: "Commercial Finance",   priority: "low",    text: "Bridging loans for commercial property UK" },
  { id: 37, pillar: "Commercial Finance",   priority: "low",    text: "Commercial property investment finance UK" },
  { id: 38, pillar: "Commercial Finance",   priority: "low",    text: "How to finance a commercial property conversion" },
  { id: 39, pillar: "Commercial Finance",   priority: "low",    text: "Office to residential conversion finance" },
  { id: 40, pillar: "Commercial Finance",   priority: "low",    text: "Commercial bridging loan rates UK" },

  // Buy-to-Let
  { id: 41, pillar: "Buy-to-Let",           priority: "medium", text: "Best buy-to-let mortgage lenders UK 2025" },
  { id: 42, pillar: "Buy-to-Let",           priority: "medium", text: "HMO finance options for landlords" },
  { id: 43, pillar: "Buy-to-Let",           priority: "medium", text: "Multi-unit buy-to-let finance UK" },
  { id: 44, pillar: "Buy-to-Let",           priority: "medium", text: "Portfolio landlord mortgage options UK" },
  { id: 45, pillar: "Buy-to-Let",           priority: "medium", text: "Limited company buy-to-let mortgages UK" },
  { id: 46, pillar: "Buy-to-Let",           priority: "low",    text: "Buy-to-let remortgage options UK" },
  { id: 47, pillar: "Buy-to-Let",           priority: "low",    text: "Finance for student HMO properties" },
  { id: 48, pillar: "Buy-to-Let",           priority: "low",    text: "Best lenders for first-time landlords UK" },
  { id: 49, pillar: "Buy-to-Let",           priority: "low",    text: "Buy-to-let mortgage rates comparison" },
  { id: 50, pillar: "Buy-to-Let",           priority: "low",    text: "Holiday let finance options UK" },

  // Auction Finance
  { id: 51, pillar: "Auction Finance",      priority: "high",   text: "Finance for buying property at auction UK" },
  { id: 52, pillar: "Auction Finance",      priority: "high",   text: "How to get a loan for an auction property" },
  { id: 53, pillar: "Auction Finance",      priority: "high",   text: "Fast bridging loans for auction purchases" },
  { id: 54, pillar: "Auction Finance",      priority: "medium", text: "Auction finance lenders UK" },
  { id: 55, pillar: "Auction Finance",      priority: "medium", text: "28-day completion finance for auction property" },
  { id: 56, pillar: "Auction Finance",      priority: "medium", text: "Best lenders for property auction finance" },
  { id: 57, pillar: "Auction Finance",      priority: "low",    text: "Can I get a mortgage for an auction property?" },
  { id: 58, pillar: "Auction Finance",      priority: "low",    text: "Pre-approved auction finance UK" },
  { id: 59, pillar: "Auction Finance",      priority: "low",    text: "Unconditional auction property loans" },
  { id: 60, pillar: "Auction Finance",      priority: "low",    text: "How to prepare finance for a property auction" },

  // Second Charge
  { id: 61, pillar: "Second Charge",        priority: "medium", text: "Second charge mortgage lenders UK" },
  { id: 62, pillar: "Second Charge",        priority: "medium", text: "How does a second charge mortgage work?" },
  { id: 63, pillar: "Second Charge",        priority: "medium", text: "Second charge loans for home improvements" },
  { id: 64, pillar: "Second Charge",        priority: "medium", text: "Best rates for second charge mortgages UK" },
  { id: 65, pillar: "Second Charge",        priority: "medium", text: "Alternatives to remortgaging for raising capital" },
  { id: 66, pillar: "Second Charge",        priority: "low",    text: "Second charge bridging loans UK" },
  { id: 67, pillar: "Second Charge",        priority: "low",    text: "How to release equity without remortgaging" },
  { id: 68, pillar: "Second Charge",        priority: "low",    text: "Secured loans against property UK" },
  { id: 69, pillar: "Second Charge",        priority: "low",    text: "Second charge vs remortgage comparison" },
  { id: 70, pillar: "Second Charge",        priority: "low",    text: "Who offers second charge mortgages UK?" },

  // General Brand (priority: high)
  { id: 71, pillar: "General Brand",        priority: "high",   text: "Best specialist property finance companies UK" },
  { id: 72, pillar: "General Brand",        priority: "high",   text: "Alternative lenders for property investment UK" },
  { id: 73, pillar: "General Brand",        priority: "high",   text: "Short-term property loans UK" },
  { id: 74, pillar: "General Brand",        priority: "high",   text: "Fast property finance solutions UK" },
  { id: 75, pillar: "General Brand",        priority: "high",   text: "Property investment finance brokers UK" },
  { id: 76, pillar: "General Brand",        priority: "high",   text: "Specialist finance for property investors" },
  { id: 77, pillar: "General Brand",        priority: "medium", text: "Who are the leading alternative property lenders?" },
  { id: 78, pillar: "General Brand",        priority: "medium", text: "Best fintech lenders for property UK" },
  { id: 79, pillar: "General Brand",        priority: "medium", text: "Property finance comparison UK" },
  { id: 80, pillar: "General Brand",        priority: "medium", text: "Top rated property finance companies UK" },
];

// ─── API Clients ──────────────────────────────────────────────────────────────

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not set");
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function getAnthropicClient() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set");
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// ─── Query Functions ──────────────────────────────────────────────────────────

async function queryChatGPT(openai, prompt) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "You are a helpful assistant. Answer questions about UK property finance clearly and concisely. Name specific lenders and companies where relevant.",
      },
      { role: "user", content: prompt },
    ],
    max_tokens: 600,
    temperature: 0.3,
  });
  return response.choices[0].message.content || "";
}

async function queryPerplexity(prompt) {
  if (!process.env.PERPLEXITY_API_KEY) throw new Error("PERPLEXITY_API_KEY not set");
  const response = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
    },
    body: JSON.stringify({
      model: "sonar",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant. Answer questions about UK property finance. Name specific lenders and companies where relevant.",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 600,
      temperature: 0.3,
    }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Perplexity API error ${response.status}: ${err}`);
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

async function queryClaude(anthropic, prompt) {
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 600,
    system: "You are a helpful assistant. Answer questions about UK property finance clearly and concisely. Name specific lenders and companies where relevant.",
    messages: [{ role: "user", content: prompt }],
  });
  return response.content[0].type === "text" ? response.content[0].text : "";
}

async function queryGemini(prompt) {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not set");
  const systemPrompt = "You are a helpful assistant. Answer questions about UK property finance clearly and concisely. Name specific lenders and companies where relevant.";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 600, temperature: 0.3 },
      }),
    }
  );
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${err}`);
  }
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

// ─── Analysis ─────────────────────────────────────────────────────────────────

function analyseResponse(responseText) {
  const text = responseText.toLowerCase();

  // Check for Boxx mention (case-insensitive, whole-word variants)
  const boxxPatterns = [/\bboxx\b/i, /\bboxx finance\b/i, /\bboxxfinance\b/i];
  const boxxMentioned = boxxPatterns.some((p) => p.test(responseText));

  // Check competitor mentions
  const competitorMentions = COMPETITORS.filter((c) =>
    responseText.toLowerCase().includes(c.toLowerCase())
  );

  // Extract snippet around Boxx mention if found
  let boxxSnippet = "";
  if (boxxMentioned) {
    const match = responseText.match(/.{0,60}boxx.{0,60}/i);
    if (match) boxxSnippet = match[0].trim().replace(/\n/g, " ");
  }

  return {
    boxxMentioned,
    boxxSnippet,
    competitorMentions,
    competitorCount: competitorMentions.length,
    responseLength: responseText.length,
  };
}

// ─── Sleep ────────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── Main Run ─────────────────────────────────────────────────────────────────

async function runChecker(options = {}) {
  const {
    priorityFilter = null, // "high" | "medium" | "low" | null (all)
    services = ["chatgpt", "perplexity", "claude", "gemini"],
    dryRun = false,
  } = options;

  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║   Boxx Finance — AI Visibility Checker   ║");
  console.log("╚══════════════════════════════════════════╝\n");

  const promptsToRun = priorityFilter
    ? PROMPTS.filter((p) => p.priority === priorityFilter)
    : PROMPTS;

  console.log(`📋 Prompts: ${promptsToRun.length}`);
  console.log(`🤖 Services: ${services.join(", ")}`);
  console.log(`📊 Total queries: ${promptsToRun.length * services.length}`);
  if (dryRun) console.log("🔍 DRY RUN — no API calls will be made\n");
  console.log("");

  // Init API clients
  let openai, anthropic;
  if (!dryRun) {
    if (services.includes("chatgpt")) openai = getOpenAIClient();
    if (services.includes("claude")) anthropic = getAnthropicClient();
  }

  const results = [];
  let totalBoxx = 0;
  let totalQueries = 0;

  for (const prompt of promptsToRun) {
    for (const service of services) {
      process.stdout.write(
        `  [${String(totalQueries + 1).padStart(3)}] ${service.padEnd(11)} | ${prompt.pillar.padEnd(22)} | ${prompt.text.slice(0, 50).padEnd(52)} `
      );

      let responseText = "";
      let error = null;
      const startMs = Date.now();

      if (dryRun) {
        responseText = `This is a dry run response. Boxx Finance and ${COMPETITORS[0]} are example lenders.`;
        await sleep(50);
      } else {
        try {
          switch (service) {
            case "chatgpt":
              responseText = await queryChatGPT(openai, prompt.text);
              await sleep(RATE_LIMITS.chatgpt);
              break;
            case "perplexity":
              responseText = await queryPerplexity(prompt.text);
              await sleep(RATE_LIMITS.perplexity);
              break;
            case "claude":
              responseText = await queryClaude(anthropic, prompt.text);
              await sleep(RATE_LIMITS.claude);
              break;
            case "gemini":
              responseText = await queryGemini(prompt.text);
              await sleep(RATE_LIMITS.gemini);
              break;
          }
        } catch (e) {
          error = e.message;
          responseText = "";
        }
      }

      const elapsedMs = Date.now() - startMs;
      const analysis = error ? { boxxMentioned: false, boxxSnippet: "", competitorMentions: [], competitorCount: 0, responseLength: 0 } : analyseResponse(responseText);

      const result = {
        promptId: prompt.id,
        prompt: prompt.text,
        pillar: prompt.pillar,
        priority: prompt.priority,
        service,
        boxxMentioned: analysis.boxxMentioned,
        boxxSnippet: analysis.boxxSnippet,
        competitorMentions: analysis.competitorMentions.join("; "),
        competitorCount: analysis.competitorCount,
        responseLength: analysis.responseLength,
        responsePreview: responseText.slice(0, 200).replace(/\n/g, " "),
        error: error || "",
        elapsedMs,
        runDate: new Date().toISOString(),
      };

      results.push(result);
      totalQueries++;
      if (analysis.boxxMentioned) totalBoxx++;

      const statusIcon = error ? "❌" : analysis.boxxMentioned ? "✅" : "·";
      const compStr = analysis.competitorCount > 0 ? ` (${analysis.competitorCount} comp)` : "";
      console.log(`${statusIcon}${compStr} ${elapsedMs}ms`);
    }
  }

  // ── Summary ──
  const visibilityPct = totalQueries > 0 ? ((totalBoxx / totalQueries) * 100).toFixed(1) : 0;
  console.log("\n──────────────────────────────────────────");
  console.log(`✅ Boxx mentioned: ${totalBoxx}/${totalQueries} (${visibilityPct}%)`);

  // Per-pillar breakdown
  const pillars = [...new Set(results.map((r) => r.pillar))];
  console.log("\n📊 Visibility by pillar:");
  for (const pillar of pillars) {
    const rows = results.filter((r) => r.pillar === pillar);
    const hits = rows.filter((r) => r.boxxMentioned).length;
    const pct = ((hits / rows.length) * 100).toFixed(0);
    const bar = "█".repeat(Math.round(pct / 10)) + "░".repeat(10 - Math.round(pct / 10));
    console.log(`  ${pillar.padEnd(24)} ${bar} ${pct}% (${hits}/${rows.length})`);
  }

  // Top competitors
  const compCounts = {};
  results.forEach((r) => {
    if (r.competitorMentions) {
      r.competitorMentions.split("; ").forEach((c) => {
        if (c) compCounts[c] = (compCounts[c] || 0) + 1;
      });
    }
  });
  const topComps = Object.entries(compCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  if (topComps.length) {
    console.log("\n🏆 Most mentioned competitors:");
    topComps.forEach(([c, n]) => console.log(`  ${c.padEnd(25)} ${n}x`));
  }

  return results;
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

function exportCSV(results) {
  mkdirSync(RESULTS_DIR, { recursive: true });

  const date = new Date().toISOString().slice(0, 10);
  const filename = join(RESULTS_DIR, `boxx_visibility_${date}.csv`);

  const headers = [
    "Prompt ID", "Prompt", "Pillar", "Priority", "Service",
    "Boxx Mentioned", "Boxx Snippet", "Competitor Mentions",
    "Competitor Count", "Response Length", "Response Preview",
    "Error", "Elapsed MS", "Run Date",
  ];

  const escape = (v) => `"${String(v).replace(/"/g, '""')}"`;

  const rows = [
    headers.map(escape).join(","),
    ...results.map((r) =>
      [
        r.promptId, r.prompt, r.pillar, r.priority, r.service,
        r.boxxMentioned ? "YES" : "NO",
        r.boxxSnippet, r.competitorMentions, r.competitorCount,
        r.responseLength, r.responsePreview, r.error, r.elapsedMs, r.runDate,
      ]
        .map(escape)
        .join(",")
    ),
  ];

  writeFileSync(filename, rows.join("\n"), "utf8");
  console.log(`\n📄 CSV saved: ${filename}`);
  return filename;
}

// ─── Google Sheets Export ─────────────────────────────────────────────────────

async function exportToSheets(results) {
  if (!process.env.GOOGLE_CREDENTIALS) {
    console.warn("⚠️  GOOGLE_CREDENTIALS not set — skipping Sheets export");
    return;
  }

  let credentials;
  try {
    const raw = Buffer.from(process.env.GOOGLE_CREDENTIALS, "base64").toString("utf8");
    credentials = JSON.parse(raw);
  } catch {
    throw new Error("Failed to parse GOOGLE_CREDENTIALS — ensure it is base64-encoded JSON");
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  // Ensure the tab exists
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const tabExists = meta.data.sheets?.some(
    (s) => s.properties?.title === SHEET_TAB
  );

  if (!tabExists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: SHEET_TAB } } }],
      },
    });
    console.log(`📋 Created sheet tab: ${SHEET_TAB}`);
  }

  // Clear existing content
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_TAB}!A:Z`,
  });

  // Write header + data
  const header = [
    "Run Date", "Prompt ID", "Prompt", "Pillar", "Priority", "Service",
    "Boxx Mentioned", "Boxx Snippet", "Competitor Mentions",
    "Competitor Count", "Response Length", "Elapsed MS", "Error",
  ];

  const rows = results.map((r) => [
    r.runDate, r.promptId, r.prompt, r.pillar, r.priority, r.service,
    r.boxxMentioned ? "YES" : "NO",
    r.boxxSnippet, r.competitorMentions, r.competitorCount,
    r.responseLength, r.elapsedMs, r.error,
  ]);

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_TAB}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: [header, ...rows] },
  });

  // Bold the header row
  const sheetId = meta.data.sheets?.find(
    (s) => s.properties?.title === SHEET_TAB
  )?.properties?.sheetId;

  if (sheetId !== undefined) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
              cell: { userEnteredFormat: { textFormat: { bold: true } } },
              fields: "userEnteredFormat.textFormat.bold",
            },
          },
          {
            autoResizeDimensions: {
              dimensions: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: 13 },
            },
          },
        ],
      },
    });
  }

  console.log(
    `📊 Google Sheet updated: https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}`
  );
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const highOnly = args.includes("--high-only");
  const skipSheets = args.includes("--skip-sheets");

  const servicesArg = args.find((a) => a.startsWith("--services="));
  const services = servicesArg
    ? servicesArg.replace("--services=", "").split(",")
    : ["chatgpt", "perplexity", "claude"];

  try {
    const results = await runChecker({
      priorityFilter: highOnly ? "high" : null,
      services,
      dryRun,
    });

    exportCSV(results);

    if (!skipSheets) {
      await exportToSheets(results);
    }

    console.log("\n✅ Done.\n");
  } catch (err) {
    console.error("\n❌ Fatal error:", err.message);
    process.exit(1);
  }
}

main();
