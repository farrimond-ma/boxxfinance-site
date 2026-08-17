<?php
// Boxx Finance bridging chatbot — backend proxy.
//
// Exists for one reason: the frontend must never hold the Anthropic API key
// (see docs/chatbot-brief.md item 26). This endpoint receives the visitor's
// message history + current page context, calls Anthropic server-side using
// a key that only ever lives in config.php on the server, and returns just
// the reply text plus a couple of lead-status flags — never the raw model
// output, never the key.
//
// Also does the actual lead delivery: when the model's own structured
// lead_data says the visitor has given enough to be a real lead, this file
// posts it straight to the same Google Sheet every other form on the site
// uses — server-side, so it happens even if the visitor closes the tab a
// second after typing their number.

header('Content-Type: application/json; charset=utf-8');

// Same-origin only. This is a soft check (Origin isn't sent on every
// same-origin request by every browser), not a security boundary on its
// own — paired with the rate limit below, not a replacement for it.
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
if ($origin !== '' && strpos($origin, 'boxxfinance.co.uk') === false && strpos($origin, 'localhost') === false) {
    http_response_code(403);
    echo json_encode(['error' => 'Forbidden']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$configPath = __DIR__ . '/config.php';
if (!file_exists($configPath)) {
    http_response_code(500);
    echo json_encode(['error' => 'Chat is not configured yet.']);
    exit;
}
$config = require $configPath;

require_once __DIR__ . '/prompt.php';

// ─── Rate limiting ────────────────────────────────────────────────────────
// File-based, per-IP, no database needed. Generous enough for genuine
// conversations (this is a sales chat, not a high-volume API), tight enough
// to bound cost if someone scripts requests at it. 40 requests/hour/IP.
function rateLimitOk($ip) {
    $dir = sys_get_temp_dir() . '/boxx_chat_ratelimit';
    if (!is_dir($dir)) { @mkdir($dir, 0700, true); }
    $file = $dir . '/' . md5($ip) . '.json';
    $now = time();
    $window = 3600;
    $limit = 40;

    $data = ['count' => 0, 'windowStart' => $now];
    $fp = @fopen($file, 'c+');
    if (!$fp) return true; // fail open — don't break chat if temp dir is unwritable
    flock($fp, LOCK_EX);
    $contents = stream_get_contents($fp);
    if ($contents) {
        $decoded = json_decode($contents, true);
        if ($decoded && $now - $decoded['windowStart'] < $window) {
            $data = $decoded;
        }
    }
    $data['count']++;
    $ok = $data['count'] <= $limit;
    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode($data));
    flock($fp, LOCK_UN);
    fclose($fp);
    return $ok;
}

$clientIp = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : 'unknown';
if (!rateLimitOk($clientIp)) {
    http_response_code(429);
    echo json_encode(['error' => 'Too many messages — please try again shortly, or call ' . $config['PHONE_NUMBER'] . '.']);
    exit;
}

// ─── Parse and validate the request ──────────────────────────────────────
$raw = file_get_contents('php://input');
$body = json_decode($raw, true);
if (!$body || !isset($body['messages']) || !is_array($body['messages'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid request']);
    exit;
}

$messages = $body['messages'];
$pageContext = isset($body['pageContext']) ? $body['pageContext'] : null;

// Bound conversation size — both a cost guard and a sanity check. 40 turns
// (80 messages) is far beyond what this chat is designed for; if a real
// conversation runs that long it should already have converted or moved to
// a phone call.
if (count($messages) > 80) {
    http_response_code(400);
    echo json_encode(['error' => 'Conversation too long']);
    exit;
}

$anthropicMessages = [];
foreach ($messages as $m) {
    if (!isset($m['role'], $m['content']) || !in_array($m['role'], ['user', 'assistant'], true)) continue;
    // Cap individual message length defensively.
    $content = mb_substr((string) $m['content'], 0, 4000);
    $anthropicMessages[] = ['role' => $m['role'], 'content' => $content];
}
if (count($anthropicMessages) === 0) {
    http_response_code(400);
    echo json_encode(['error' => 'No valid messages']);
    exit;
}

$systemPrompt = buildSystemPrompt($config['PHONE_NUMBER'], $pageContext);

// ─── Call Anthropic ───────────────────────────────────────────────────────
$payload = json_encode([
    'model' => $config['MODEL'],
    'max_tokens' => 700, // headroom for reply + the lead_data JSON block
    'system' => $systemPrompt,
    'messages' => $anthropicMessages,
]);

$ch = curl_init('https://api.anthropic.com/v1/messages');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $payload,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'x-api-key: ' . $config['ANTHROPIC_API_KEY'],
        'anthropic-version: 2023-06-01',
    ],
    CURLOPT_TIMEOUT => 30,
]);
$responseRaw = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($curlError || $httpCode !== 200) {
    http_response_code(502);
    echo json_encode(['error' => 'Chat is temporarily unavailable — please call ' . $config['PHONE_NUMBER'] . ' instead.']);
    exit;
}

$response = json_decode($responseRaw, true);
$modelText = '';
if (isset($response['content']) && is_array($response['content'])) {
    foreach ($response['content'] as $block) {
        if (isset($block['type']) && $block['type'] === 'text') {
            $modelText .= $block['text'];
        }
    }
}

// ─── Parse the <reply>/<lead_data> envelope ──────────────────────────────
$reply = '';
if (preg_match('/<reply>(.*?)<\/reply>/s', $modelText, $m)) {
    $reply = trim($m[1]);
} else {
    // Model didn't follow the format — fall back to showing the raw text
    // rather than a blank message, but this shouldn't happen in practice.
    $reply = trim($modelText) !== '' ? trim($modelText) : "Sorry, could you rephrase that?";
}

$leadData = null;
if (preg_match('/<lead_data>(.*?)<\/lead_data>/s', $modelText, $m)) {
    $leadData = json_decode(trim($m[1]), true);
}

$leadCaptured = false;
$leadQuality = $leadData['lead_quality'] ?? 'COLD';

if (is_array($leadData) && !empty($leadData['ready_to_submit'])) {
    $hasName = !empty($leadData['name']);
    $hasContact = !empty($leadData['telephone']) || !empty($leadData['email']);
    if ($hasName && $hasContact) {
        $leadCaptured = submitLead($leadData, $pageContext, $config['GOOGLE_SCRIPT_URL']);
    }
}

echo json_encode([
    'reply' => $reply,
    'leadCaptured' => $leadCaptured,
    'leadQuality' => $leadQuality,
]);
exit;

// ─── Deliver the lead to the same Sheet every other form uses ────────────
function submitLead($lead, $pageContext, $googleScriptUrl) {
    $summaryParts = [];
    foreach ([
        'purpose', 'property_type', 'property_location', 'property_value',
        'purchase_price', 'loan_required', 'existing_mortgage', 'ltv_estimate',
        'exit_strategy', 'required_completion_date', 'term_required', 'borrower_type',
    ] as $field) {
        if (!empty($lead[$field])) {
            $label = ucwords(str_replace('_', ' ', $field));
            $summaryParts[] = "{$label}: {$lead[$field]}";
        }
    }
    if (!empty($lead['additional_information'])) {
        $summaryParts[] = 'Notes: ' . $lead['additional_information'];
    }
    if (!empty($lead['conversation_summary'])) {
        $summaryParts[] = 'Summary: ' . $lead['conversation_summary'];
    }
    $summaryParts[] = 'Lead quality: ' . ($lead['lead_quality'] ?? 'COLD');
    if ($pageContext && !empty($pageContext['url'])) {
        $summaryParts[] = 'Started chat on: ' . $pageContext['url'];
    }

    $params = [
        'name' => $lead['name'] ?? '',
        'email' => $lead['email'] ?? '',
        'phone' => $lead['telephone'] ?? '',
        'company' => $lead['company'] ?? '',
        'funding_type' => 'AI Chatbot (' . ($lead['finance_type'] ?? 'bridging') . ')',
        'funding_purpose' => implode(' | ', $summaryParts),
        'funding_amount' => $lead['loan_required'] ?? '',
        'property_value' => $lead['property_value'] ?? '',
        'source' => 'AI Chatbot',
    ];

    $ch = curl_init($googleScriptUrl);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => http_build_query($params),
        CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
        CURLOPT_TIMEOUT => 15,
    ]);
    curl_exec($ch);
    $ok = curl_errno($ch) === 0;
    curl_close($ch);
    return $ok;
}
