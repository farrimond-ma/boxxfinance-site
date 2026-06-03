require('dotenv').config();
const { execSync } = require('child_process');
const fs   = require('fs');
const path = require('path');
const { google } = require('googleapis');
const Anthropic = require('@anthropic-ai/sdk');

// ─── Config ───────────────────────────────────────────────────────────────────
const SPREADSHEET_ID     = process.env.SPREADSHEET_ID;
const FB_PAGE_ID         = process.env.FACEBOOK_PAGE_ID;
const FB_TOKEN           = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const FB_API_VER         = 'v21.0';
const SITE_URL           = 'https://boxxfinance.co.uk';
const TMP_DIR            = '/tmp/boxx-reels';

// ElevenLabs voice — "Charlotte" (British female, professional)
// See https://api.elevenlabs.io/v1/voices for full list
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'XB0fDUnXU5powFXDhCwa';

// TikTok
const TIKTOK_ACCESS_TOKEN = process.env.TIKTOK_ACCESS_TOKEN;

// ─── Column mapping for LinkedIn_Queue (0-indexed) ────────────────────────────
// A=0 id, B=1 publishDate, C=2 service, D=3 keyword, E=4 title
// F=5 slug, G=6 url, H=7 author
// I=8 liStatus ... P=15 igStatus ... S=18 pinterestStatus
// V=21 reelStatus, W=22 reelId, X=23 tiktokStatus, Y=24 tiktokVideoId

// ─── Pillar image fallbacks ───────────────────────────────────────────────────
const PILLAR_IMAGES = {
  'bridging-finance':    '/images/blog/bridging-finance-1.webp',
  'development-finance': '/images/blog/development-finance-1.webp',
  'commercial-mortgages':'/images/blog/commercial-mortgage-1.webp',
  'invoice-finance':     '/images/blog/invoice-finance-1.webp',
  'asset-finance':       '/images/blog/asset-finance-1.webp',
  'working-capital':     '/images/blog/working-capital-1.webp',
  'trade-finance':       '/images/blog/trade-finance-1.webp',
  'cashflow-finance':    '/images/blog/cashflow-finance-1.webp',
  'business-loans':      '/images/blog/business-loans-1.webp',
  'mezzanine-finance':   '/images/blog/mezzanine-finance-1.webp',
  'structured-finance':  '/images/blog/structured-finance-1.webp',
};

// ─── Clients ──────────────────────────────────────────────────────────────────
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

let blogPosts = [];
try { blogPosts = require('../../src/data/blogPosts.json'); } catch {}

// ─── Google Sheets ────────────────────────────────────────────────────────────
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

async function getPendingRow(sheets) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'LinkedIn_Queue!A2:Y',
  });
  const rows  = res.data.values || [];
  const today = new Date().toISOString().split('T')[0];

  for (let i = 0; i < rows.length; i++) {
    const row        = rows[i];
    const pubDate    = (row[1] || '').trim();
    const reelStatus = (row[21] || '').toLowerCase().trim();

    if (pubDate <= today && reelStatus === 'pending') {
      return {
        rowIndex: i + 2,
        publishDate: pubDate,
        service: row[2] || '',
        keyword: row[3] || '',
        title:   row[4] || '',
        slug:    row[5] || '',
        url:     row[6] || '',
        author:  row[7] || '',
      };
    }
  }
  return null;
}

async function updateRow(sheets, rowIndex, reelId, reelStatus, tiktokId, tiktokStatus) {
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range:         `LinkedIn_Queue!V${rowIndex}:Y${rowIndex}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[reelStatus, reelId || '', tiktokStatus, tiktokId || '']] },
  });
}

// ─── Get image URL for the blog post ─────────────────────────────────────────
function getImageUrl(slug, service) {
  const post = blogPosts.find(p => p.slug === slug);
  if (post?.heroImage) return `${SITE_URL}${post.heroImage}`;
  if (post) return `${SITE_URL}/images/blog/${slug}.jpg`;
  const key = (service || '').toLowerCase().replace(/\s+/g, '-').replace(/&/g, 'and');
  return `${SITE_URL}${PILLAR_IMAGES[key] || '/header_bg.png'}`;
}

// ─── Generate reel script via Claude ─────────────────────────────────────────
function getArticleContent(slug) {
  const post = blogPosts.find(p => p.slug === slug);
  if (!post) return null;
  const text = (post.content || '')
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.substring(0, 2000);
}

async function generateReelScript(row) {
  const content = getArticleContent(row.slug);

  const prompt = `You are writing text for a 20-second Facebook Reel for Boxx Commercial Finance.

${content
  ? `ARTICLE: "${row.title}"\n\nCONTENT:\n${content}`
  : `TOPIC: "${row.title}" — service: ${row.service}`}

Write exactly 4 lines of text to display on screen. Requirements:
- LINE 1 (HOOK): A bold statement or question. Max 8 words. All caps.
- LINE 2 (INSIGHT 1): One practical fact from the article. Max 10 words.
- LINE 3 (INSIGHT 2): One more insight or benefit. Max 10 words.
- LINE 4 (CTA): Exactly: "Read more at boxxfinance.co.uk"

Return ONLY the 4 lines, one per line, nothing else. No labels, no numbering.`;

  const response = await anthropic.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 150,
    messages:   [{ role: 'user', content: prompt }],
  });

  const text  = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  return {
    hook:     lines[0] || row.title.toUpperCase().substring(0, 40),
    insight1: lines[1] || `Expert ${row.service} advice for UK businesses`,
    insight2: lines[2] || 'Fast, flexible funding solutions',
    cta:      lines[3] || 'Read more at boxxfinance.co.uk',
  };
}

// ─── Download image ───────────────────────────────────────────────────────────
async function downloadImage(imageUrl, destPath) {
  const res = await fetch(imageUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`Image download failed: ${res.status} ${imageUrl}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buffer);
  console.log(`  Image downloaded: ${Math.round(buffer.length / 1024)} KB`);
}

// ─── Generate voiceover via ElevenLabs ───────────────────────────────────────
async function generateVoiceover(script, outputPath) {
  if (!ELEVENLABS_API_KEY) {
    console.log('  No ELEVENLABS_API_KEY — skipping voiceover');
    return null;
  }

  // Convert to natural speech (no ALL CAPS, add pauses with punctuation)
  const spokenText = [
    script.hook.charAt(0) + script.hook.slice(1).toLowerCase() + '.',
    script.insight1 + '.',
    script.insight2 + '.',
    'Read more at Boxx Finance dot co dot uk.',
  ].join('  ');

  console.log(`  Voiceover text: ${spokenText.slice(0, 80)}...`);

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
    {
      method:  'POST',
      headers: {
        'xi-api-key':   ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: spokenText,
        model_id: 'eleven_turbo_v2',
        voice_settings: {
          stability:        0.5,
          similarity_boost: 0.75,
          style:            0.0,
          use_speaker_boost: true,
        },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.warn(`  ElevenLabs error (non-fatal): ${res.status} ${err}`);
    return null;
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(outputPath, buffer);
  console.log(`  Voiceover generated: ${Math.round(buffer.length / 1024)} KB`);
  return outputPath;
}

// ─── Get audio duration in seconds ───────────────────────────────────────────
function getAudioDuration(audioPath) {
  try {
    const out = execSync(
      `ffprobe -v error -show_entries format=duration -of csv=p=0 "${audioPath}"`,
      { encoding: 'utf8' }
    ).trim();
    return Math.ceil(parseFloat(out)) + 1; // round up + 1s buffer
  } catch {
    return 20; // fallback
  }
}

// ─── Build video with ffmpeg ──────────────────────────────────────────────────
function buildVideo(imagePath, script, outputPath, audioPath = null) {
  const duration = audioPath ? getAudioDuration(audioPath) : 20;
  // Escape text for ffmpeg drawtext (escape : \ ' special chars)
  const esc = (t) => t
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/:/g, '\\:')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]');

  const hook     = esc(script.hook);
  const insight1 = esc(script.insight1);
  const insight2 = esc(script.insight2);
  const cta      = esc(script.cta);

  // Font — DejaVu is reliably available on Ubuntu runners
  const boldFont    = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
  const regularFont = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';

  // Filter chain:
  // 1. Scale + crop to 1080x1920 portrait
  // 2. Slow Ken Burns zoom (loops over 20s duration)
  // 3. Dark overlay for text readability
  // 4. Branding top
  // 5. Hook text centre-upper
  // 6. Two insight lines centre
  // 7. CTA bottom
  const filters = [
    `scale=1080:1920:force_original_aspect_ratio=increase`,
    `crop=1080:1920`,
    `zoompan=z='if(lte(zoom,1.0),1.0,zoom+0.0008)':d=${duration * 30}:s=1080x1920:fps=30`,
    // Dark gradient overlay
    `drawbox=x=0:y=0:w=iw:h=ih:color=black@0.55:t=fill`,
    // Branding bar top
    `drawbox=x=0:y=0:w=iw:h=90:color=0x031b49@0.95:t=fill`,
    `drawtext=fontfile=${boldFont}:text='BOXX COMMERCIAL FINANCE':fontcolor=0xb8922a:fontsize=32:x=(w-text_w)/2:y=28`,
    // Hook — large, white, all caps
    `drawtext=fontfile=${boldFont}:text='${hook}':fontcolor=white:fontsize=62:x=(w-text_w)/2:y=350:line_spacing=10:borderw=3:bordercolor=black@0.8`,
    // Divider line
    `drawbox=x=120:y=570:w=840:h=3:color=0xb8922a@0.9:t=fill`,
    // Insight 1
    `drawtext=fontfile=${boldFont}:text='${insight1}':fontcolor=white:fontsize=42:x=(w-text_w)/2:y=610:borderw=2:bordercolor=black@0.7`,
    // Insight 2
    `drawtext=fontfile=${boldFont}:text='${insight2}':fontcolor=white:fontsize=42:x=(w-text_w)/2:y=690:borderw=2:bordercolor=black@0.7`,
    // CTA bar bottom
    `drawbox=x=0:y=1780:w=iw:h=140:color=0x031b49@0.95:t=fill`,
    `drawtext=fontfile=${regularFont}:text='${cta}':fontcolor=0xb8922a:fontsize=36:x=(w-text_w)/2:y=1830`,
  ].join(',');

  const audioInput = audioPath ? `-i "${audioPath}"` : '';
  const audioCodec = audioPath ? `-c:a aac -shortest` : '-an';

  const cmd = [
    'ffmpeg -y',
    `-loop 1 -t ${duration} -i "${imagePath}"`,
    audioInput,
    `-vf "${filters}"`,
    `-c:v libx264 -preset fast -pix_fmt yuv420p -r 30 -t ${duration}`,
    audioCodec,
    `-movflags +faststart`,
    `"${outputPath}"`,
  ].filter(Boolean).join(' ');

  console.log('  Running ffmpeg...');
  execSync(cmd, { stdio: 'pipe' });
  const size = Math.round(fs.statSync(outputPath).size / (1024 * 1024) * 10) / 10;
  console.log(`  Video created: ${size} MB`);
}

// ─── Upload reel to Facebook ──────────────────────────────────────────────────
async function uploadReel(videoPath, title, description) {
  if (!FB_PAGE_ID || !FB_TOKEN) {
    throw new Error('FACEBOOK_PAGE_ID and FACEBOOK_PAGE_ACCESS_TOKEN must be set');
  }

  const base = `https://graph.facebook.com/${FB_API_VER}/${FB_PAGE_ID}/video_reels`;

  // Step 1: Initialise upload
  const startRes = await fetch(`${base}?upload_phase=start&access_token=${FB_TOKEN}`, {
    method: 'POST',
  });
  if (!startRes.ok) throw new Error(`Reel start failed: ${await startRes.text()}`);
  const { video_id, upload_url } = await startRes.json();
  console.log(`  Upload initialised — video_id: ${video_id}`);

  // Step 2: Upload binary
  const videoBuffer = fs.readFileSync(videoPath);
  const uploadRes = await fetch(upload_url, {
    method:  'POST',
    headers: {
      Authorization:            `OAuth ${FB_TOKEN}`,
      'Content-Type':           'application/octet-stream',
      'Content-Length':         String(videoBuffer.length),
      'offset':                 '0',
      'file_size':              String(videoBuffer.length),
    },
    body: videoBuffer,
  });
  if (!uploadRes.ok) throw new Error(`Reel upload failed: ${await uploadRes.text()}`);
  console.log('  Video uploaded');

  // Step 3: Finish + publish
  const publishRes = await fetch(
    `${base}?upload_phase=finish&video_state=PUBLISHED` +
    `&video_id=${video_id}` +
    `&title=${encodeURIComponent(title.slice(0, 100))}` +
    `&description=${encodeURIComponent(description.slice(0, 200))}` +
    `&access_token=${FB_TOKEN}`,
    { method: 'POST' }
  );
  if (!publishRes.ok) throw new Error(`Reel publish failed: ${await publishRes.text()}`);
  const result = await publishRes.json();
  console.log(`  Reel published — ID: ${result.id || video_id}`);
  return result.id || video_id;
}

// ─── Upload video to TikTok ───────────────────────────────────────────────────
async function publishToTikTok(videoPath, title) {
  if (!TIKTOK_ACCESS_TOKEN) {
    console.log('  No TIKTOK_ACCESS_TOKEN — skipping TikTok');
    return null;
  }

  const videoBuffer = fs.readFileSync(videoPath);
  const videoSize   = videoBuffer.length;

  // Step 1: Initialise upload
  const initRes = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${TIKTOK_ACCESS_TOKEN}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify({
      post_info: {
        title:           title.slice(0, 150),
        privacy_level:   'PUBLIC_TO_EVERYONE',
        disable_duet:    false,
        disable_comment: false,
        disable_stitch:  false,
      },
      source_info: {
        source:            'FILE_UPLOAD',
        video_size:        videoSize,
        chunk_size:        videoSize,
        total_chunk_count: 1,
      },
    }),
  });

  if (!initRes.ok) throw new Error(`TikTok init failed: ${await initRes.text()}`);
  const initData  = await initRes.json();
  const publishId = initData.data?.publish_id;
  const uploadUrl = initData.data?.upload_url;
  if (!publishId || !uploadUrl) throw new Error(`TikTok init missing data: ${JSON.stringify(initData)}`);
  console.log(`  TikTok upload initialised — publish_id: ${publishId}`);

  // Step 2: Upload video (single chunk)
  const uploadRes = await fetch(uploadUrl, {
    method:  'PUT',
    headers: {
      'Content-Type':  'video/mp4',
      'Content-Range': `bytes 0-${videoSize - 1}/${videoSize}`,
      'Content-Length': String(videoSize),
    },
    body: videoBuffer,
  });
  if (!uploadRes.ok) throw new Error(`TikTok upload failed: ${await uploadRes.text()}`);
  console.log('  TikTok video uploaded');

  // Step 3: Poll for publish completion (up to 60 seconds)
  for (let attempt = 0; attempt < 12; attempt++) {
    await new Promise(r => setTimeout(r, 5000));
    const statusRes = await fetch('https://open.tiktokapis.com/v2/post/publish/status/fetch/', {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${TIKTOK_ACCESS_TOKEN}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({ publish_id: publishId }),
    });

    if (!statusRes.ok) continue;
    const statusData = await statusRes.json();
    const status     = statusData.data?.status;
    console.log(`  TikTok status: ${status}`);

    if (status === 'PUBLISH_COMPLETE') {
      const videoId = statusData.data?.publicaly_available_post_id?.[0] || publishId;
      console.log(`  ✅ TikTok published — video ID: ${videoId}`);
      return videoId;
    }
    if (status === 'FAILED') throw new Error(`TikTok publish failed: ${JSON.stringify(statusData)}`);
  }

  // Timed out — treat as posted since video was uploaded
  console.log('  TikTok polling timed out — video likely published (check TikTok app)');
  return publishId;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║   Boxx Finance — Facebook Reels          ║');
  console.log('╚══════════════════════════════════════════╝\n');

  // Weekdays only
  const dow = new Date().getUTCDay();
  if ((dow === 0 || dow === 6) && process.env.FORCE_RUN !== 'true') {
    console.log('  Weekend — skipping. Done.\n');
    return;
  }

  const sheets = await getSheetsClient();

  console.log('Finding pending reel row...');
  const row = await getPendingRow(sheets);
  if (!row) {
    console.log('  No pending reels today. Done.\n');
    return;
  }

  console.log(`  Found: "${row.title}" (${row.publishDate})`);

  // Prepare temp dir
  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
  const imagePath = path.join(TMP_DIR, `${row.slug}.jpg`);
  const videoPath = path.join(TMP_DIR, `${row.slug}.mp4`);

  // Download image
  const imageUrl = getImageUrl(row.slug, row.service);
  console.log(`\nDownloading image: ${imageUrl}`);
  await downloadImage(imageUrl, imagePath);

  // Generate reel script
  console.log('\nGenerating reel script via Claude...');
  const script = await generateReelScript(row);
  console.log(`  Hook     : ${script.hook}`);
  console.log(`  Insight 1: ${script.insight1}`);
  console.log(`  Insight 2: ${script.insight2}`);
  console.log(`  CTA      : ${script.cta}`);

  // Generate voiceover
  const audioPath = path.join(TMP_DIR, `${row.slug}.mp3`);
  console.log('\nGenerating voiceover via ElevenLabs...');
  const voiceoverPath = await generateVoiceover(script, audioPath);

  // Build video (duration matches speech if voiceover available)
  console.log('\nBuilding video with ffmpeg...');
  buildVideo(imagePath, script, videoPath, voiceoverPath);

  // Clean up audio temp file
  if (voiceoverPath) { try { fs.unlinkSync(voiceoverPath); } catch {} }

  // Upload and publish
  console.log('\nUploading reel to Facebook...');
  let reelId = '';
  let status = 'posted';

  try {
    const description = `${script.insight1} ${script.insight2} ${row.url}`;
    reelId = await uploadReel(videoPath, row.title, description);
    console.log(`  ✅ Reel published — ID: ${reelId}`);
  } catch (err) {
    console.error(`  ❌ Failed: ${err.message}`);
    status = 'failed';
  }

  // Post to TikTok (same video — no re-generation needed)
  console.log('\nPosting to TikTok...');
  let tiktokId     = '';
  let tiktokStatus = 'skipped';

  if (TIKTOK_ACCESS_TOKEN) {
    try {
      tiktokId     = await publishToTikTok(videoPath, row.title) || '';
      tiktokStatus = 'posted';
    } catch (err) {
      console.error(`  ❌ TikTok failed: ${err.message}`);
      tiktokStatus = 'failed';
    }
  } else {
    console.log('  TIKTOK_ACCESS_TOKEN not set — skipping');
  }

  // Clean up temp files
  try { fs.unlinkSync(imagePath); fs.unlinkSync(videoPath); } catch {}

  console.log('\nUpdating LinkedIn_Queue sheet...');
  await updateRow(sheets, row.rowIndex, reelId, status, tiktokId, tiktokStatus);
  console.log(`  Row ${row.rowIndex} updated — reel: ${status}, tiktok: ${tiktokStatus}`);

  console.log('\n✅ Done.\n');
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
});
