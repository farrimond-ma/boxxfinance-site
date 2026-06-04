require('dotenv').config();
const { execSync } = require('child_process');
const fs   = require('fs');
const path = require('path');
const { Octokit } = require('@octokit/rest');
const Anthropic = require('@anthropic-ai/sdk');

// ─── Config ───────────────────────────────────────────────────────────────────
const GITHUB_OWNER       = process.env.GITHUB_OWNER || 'farrimond-ma';
const GITHUB_REPO        = process.env.GITHUB_REPO  || 'boxxfinance-site';
const BLOG_FILE          = 'src/data/blogPosts.json';
const FB_PAGE_ID         = process.env.FACEBOOK_PAGE_ID;
const FB_TOKEN           = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const FB_API_VER         = 'v21.0';
const SITE_URL           = 'https://boxxfinance.co.uk';
const TMP_DIR            = '/tmp/boxx-reels';
const LOOKBACK_DAYS      = 3;

const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'XB0fDUnXU5powFXDhCwa';
const TIKTOK_ACCESS_TOKEN = process.env.TIKTOK_ACCESS_TOKEN;

// ─── Clients ──────────────────────────────────────────────────────────────────
const octokit   = new Octokit({ auth: process.env.GH_TOKEN || process.env.GITHUB_TOKEN });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── GitHub helpers ───────────────────────────────────────────────────────────
async function getBlogPostsFile() {
  const { data } = await octokit.repos.getContent({ owner: GITHUB_OWNER, repo: GITHUB_REPO, path: BLOG_FILE });
  return { sha: data.sha, posts: JSON.parse(Buffer.from(data.content, 'base64').toString('utf8')) };
}

async function pushBlogPostsFile(posts, message) {
  const { data: latest } = await octokit.repos.getContent({ owner: GITHUB_OWNER, repo: GITHUB_REPO, path: BLOG_FILE });
  await octokit.repos.createOrUpdateFileContents({
    owner: GITHUB_OWNER, repo: GITHUB_REPO, path: BLOG_FILE,
    message, sha: latest.sha, branch: 'main',
    content: Buffer.from(JSON.stringify(posts, null, 2)).toString('base64'),
  });
}

function getUnpostedBlog(posts) {
  const today = new Date().toISOString().split('T')[0];
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - LOOKBACK_DAYS);
  const cutoffDate = cutoff.toISOString().split('T')[0];
  return posts
    .filter(p => p.status === 'published' && !p.reelPosted && p.date >= cutoffDate && p.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date))[0] || null;
}

// ─── Image URL helper ─────────────────────────────────────────────────────────
const PILLAR_IMAGES = {
  'bridging-finance':'/images/blog/bridging-finance-1.webp','development-finance':'/images/blog/development-finance-1.webp',
  'commercial-mortgages':'/images/blog/commercial-mortgage-1.webp','invoice-finance':'/images/blog/invoice-finance-1.webp',
  'asset-finance':'/images/blog/asset-finance-1.webp','working-capital':'/images/blog/working-capital-1.webp',
  'trade-finance':'/images/blog/trade-finance-1.webp','cashflow-finance':'/images/blog/cashflow-finance-1.webp',
  'business-loans':'/images/blog/business-loans-1.webp','mezzanine-finance':'/images/blog/mezzanine-finance-1.webp',
  'structured-finance':'/images/blog/structured-finance-1.webp',
};

function getImageUrl(post) {
  if (post?.heroImage) return post.heroImage.startsWith('http') ? post.heroImage : `${SITE_URL}${post.heroImage}`;
  if (post?.slug) return `${SITE_URL}/images/blog/${post.slug}.jpg`;
  const key = (post?.service || '').toLowerCase().replace(/\s+/g, '-').replace(/&/g, 'and');
  return `${SITE_URL}${PILLAR_IMAGES[key] || '/header_bg.png'}`;
}

// ─── Article content helper ───────────────────────────────────────────────────
function getArticleContent(post) {
  if (!post?.content) return null;
  return post.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 2000);
}

async function generateReelScript(post) {
  const content = getArticleContent(post);
  const prompt = `You are writing text for a 20-second Facebook Reel for Boxx Commercial Finance.

${content ? `ARTICLE: "${post.title}"\n\nCONTENT:\n${content}` : `TOPIC: "${post.title}" — service: ${post.service}`}

Write exactly 4 lines of text to display on screen:
- LINE 1 (HOOK): Bold statement or question. Max 8 words. All caps.
- LINE 2 (INSIGHT 1): One practical fact from the article. Max 10 words.
- LINE 3 (INSIGHT 2): One more insight or benefit. Max 10 words.
- LINE 4 (CTA): Exactly: "Read more at boxxfinance.co.uk"

Return ONLY the 4 lines, one per line, nothing else.`;

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001', max_tokens: 150,
    messages: [{ role: 'user', content: prompt }],
  });

  const text  = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  return {
    hook:     lines[0] || post.title.toUpperCase().substring(0, 40),
    insight1: lines[1] || `Expert ${post.service || ''} advice for UK businesses`,
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

  const boldFont    = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
  const regularFont = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';

  // Logo — use logo_solid.png from the checked-out repo
  const logoPath = path.resolve(__dirname, '../../public/logo_solid.png');
  const hasLogo  = fs.existsSync(logoPath);
  if (hasLogo) console.log('  Logo overlay: enabled');

  // Video filter chain applied to [0:v] (background image)
  const videoChain = [
    `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920`,
    `zoompan=z='if(lte(zoom,1.0),1.0,zoom+0.0008)':d=${duration * 30}:s=1080x1920:fps=30`,
    `drawbox=x=0:y=0:w=iw:h=ih:color=black@0.55:t=fill`,
    `drawbox=x=0:y=0:w=iw:h=90:color=0x031b49@0.95:t=fill`,
    `drawtext=fontfile=${boldFont}:text='${hook}':fontcolor=white:fontsize=62:x=(w-text_w)/2:y=350:borderw=3:bordercolor=black@0.8`,
    `drawbox=x=120:y=570:w=840:h=3:color=0xb8922a@0.9:t=fill`,
    `drawtext=fontfile=${boldFont}:text='${insight1}':fontcolor=white:fontsize=42:x=(w-text_w)/2:y=610:borderw=2:bordercolor=black@0.7`,
    `drawtext=fontfile=${boldFont}:text='${insight2}':fontcolor=white:fontsize=42:x=(w-text_w)/2:y=690:borderw=2:bordercolor=black@0.7`,
    `drawbox=x=0:y=1780:w=iw:h=140:color=0x031b49@0.95:t=fill`,
    `drawtext=fontfile=${regularFont}:text='${cta}':fontcolor=0xb8922a:fontsize=36:x=(w-text_w)/2:y=1830`,
  ].join(',');

  // Audio input index depends on whether logo is present
  // inputs: 0=image, 1=logo (if any), then audio
  const logoInputIdx  = 1;
  const audioInputIdx = hasLogo ? 2 : 1;

  let filterComplex;
  if (hasLogo) {
    // Scale logo to 65px height, overlay centred in the 90px navy bar
    filterComplex = `${videoChain}[bg];[${logoInputIdx}:v]scale=-1:65[logo];[bg][logo]overlay=x=(W-w)/2:y=12[out]`;
  } else {
    filterComplex = `${videoChain}[out]`;
  }

  const logoInput  = hasLogo  ? `-loop 1 -i "${logoPath}"` : '';
  const audioInput = audioPath ? `-i "${audioPath}"` : '';
  const audioMap   = audioPath ? `-map ${audioInputIdx}:a` : '';
  const audioCodec = audioPath ? `-c:a aac -shortest` : '-an';

  const cmd = [
    'ffmpeg -y',
    `-loop 1 -t ${duration} -i "${imagePath}"`,
    logoInput,
    audioInput,
    `-filter_complex "${filterComplex}"`,
    `-map "[out]"`,
    audioMap,
    `-c:v libx264 -preset fast -pix_fmt yuv420p -r 30`,
    audioCodec,
    `-movflags +faststart`,
    `"${outputPath}"`,
  ].filter(Boolean).join(' ');

  console.log('  Running ffmpeg...');
  execSync(cmd, { stdio: 'pipe' });
  const size = Math.round(fs.statSync(outputPath).size / (1024 * 1024) * 10) / 10;
  console.log(`  Video created: ${size} MB`);
}

// ─── Get Page Access Token (same fix as publish-facebook.js) ─────────────────
async function getPageToken() {
  const res = await fetch(
    `https://graph.facebook.com/${FB_API_VER}/${FB_PAGE_ID}?fields=access_token&access_token=${FB_TOKEN}`
  );
  const data = await res.json();
  if (data.access_token) { console.log('  Page token obtained'); return data.access_token; }
  const acctRes = await fetch(`https://graph.facebook.com/${FB_API_VER}/me/accounts?access_token=${FB_TOKEN}`);
  const acctData = await acctRes.json();
  const page = (acctData.data || []).find(p => p.id === FB_PAGE_ID);
  if (page?.access_token) return page.access_token;
  return FB_TOKEN;
}

// ─── Upload reel to Facebook ──────────────────────────────────────────────────
async function uploadReel(videoPath, title, description) {
  if (!FB_PAGE_ID || !FB_TOKEN) {
    throw new Error('FACEBOOK_PAGE_ID and FACEBOOK_PAGE_ACCESS_TOKEN must be set');
  }

  const pageToken = await getPageToken();
  const base = `https://graph.facebook.com/${FB_API_VER}/${FB_PAGE_ID}/video_reels`;

  // Step 1: Initialise upload
  const startRes = await fetch(`${base}?upload_phase=start&access_token=${pageToken}`, {
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
      Authorization:    `OAuth ${pageToken}`,
      'Content-Type':   'application/octet-stream',
      'Content-Length': String(videoBuffer.length),
      'offset':         '0',
      'file_size':      String(videoBuffer.length),
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
    `&access_token=${pageToken}`,
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

  const { posts } = await getBlogPostsFile();
  const post = getUnpostedBlog(posts);
  if (!post) { console.log('  No unposted blogs in the last 3 days. Done.\n'); return; }

  console.log(`  Found: "${post.title}" (${post.date})`);

  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
  const imagePath = path.join(TMP_DIR, `${post.slug}.jpg`);
  const videoPath = path.join(TMP_DIR, `${post.slug}.mp4`);

  const imageUrl = getImageUrl(post);
  console.log(`\nDownloading image: ${imageUrl}`);
  await downloadImage(imageUrl, imagePath);

  console.log('\nGenerating reel script via Claude...');
  const script = await generateReelScript(post);
  console.log(`  Hook: ${script.hook}`);

  const audioPath = path.join(TMP_DIR, `${post.slug}.mp3`);
  console.log('\nGenerating voiceover via ElevenLabs...');
  const voiceoverPath = await generateVoiceover(script, audioPath);

  console.log('\nBuilding video with ffmpeg...');
  buildVideo(imagePath, script, videoPath, voiceoverPath);
  if (voiceoverPath) { try { fs.unlinkSync(voiceoverPath); } catch {} }

  const postUrl = post.url.startsWith('http') ? post.url : `${SITE_URL}${post.url}`;

  console.log('\nUploading reel to Facebook...');
  try {
    const description = `${script.insight1} ${script.insight2} ${postUrl}`;
    const reelId = await uploadReel(videoPath, post.title, description);
    post.reelPosted = true;
    console.log(`  ✅ Reel published — ID: ${reelId}`);
  } catch (err) {
    console.error(`  ❌ Reel failed: ${err.message}`);
  }

  console.log('\nPosting to TikTok...');
  if (TIKTOK_ACCESS_TOKEN) {
    try {
      await publishToTikTok(videoPath, post.title);
      console.log('  ✅ TikTok posted');
    } catch (err) { console.error(`  ❌ TikTok failed: ${err.message}`); }
  } else {
    console.log('  TIKTOK_ACCESS_TOKEN not set — skipping');
  }

  try { fs.unlinkSync(imagePath); fs.unlinkSync(videoPath); } catch {}

  await pushBlogPostsFile(posts, `social: reel posted for ${post.slug}`);

  console.log('\n✅ Done.\n');
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
});
