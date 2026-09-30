<?php
// Server-to-server endpoint, called only by the CRM (sms_webhook.php), never by the browser.
// Drafts an automatic text reply when a "dead" lead (a closed case, on the nurture sequence —
// see 52_sequences.sql in the CRM) replies to a check-in text. Same reason chat.php proxies the
// Anthropic API rather than the frontend calling it directly: the key must never leave the server.
// See prompt.php's buildSmsReplyPrompt() for why this is deliberately much more cautious than the
// main website chat — this reply goes out with no human reading it first.

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$configPath = __DIR__ . '/config.php';
if (!file_exists($configPath)) {
    http_response_code(500);
    echo json_encode(['error' => 'Not configured']);
    exit;
}
$config = require $configPath;
require_once __DIR__ . '/prompt.php';

// Shared-secret auth, same idea as the CRM's own intake_key — this endpoint costs real API money
// per call, so it must only ever be reachable by the CRM, never scraped or hit directly.
$providedKey = $_SERVER['HTTP_X_SMS_REPLY_KEY'] ?? '';
$expectedKey = $config['SMS_REPLY_KEY'] ?? '';
if ($expectedKey === '' || $expectedKey === 'CHANGE_ME' || !hash_equals($expectedKey, (string)$providedKey)) {
    http_response_code(403);
    echo json_encode(['error' => 'Forbidden']);
    exit;
}

$raw = file_get_contents('php://input');
$body = json_decode($raw, true);
if (!$body || !isset($body['messages']) || !is_array($body['messages'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid request']);
    exit;
}

$firstName = isset($body['first_name']) ? mb_substr((string)$body['first_name'], 0, 60) : '';

$anthropicMessages = [];
foreach ($body['messages'] as $m) {
    if (!isset($m['role'], $m['content']) || !in_array($m['role'], ['user', 'assistant'], true)) continue;
    $anthropicMessages[] = ['role' => $m['role'], 'content' => mb_substr((string)$m['content'], 0, 1000)];
}
// The conversation must actually end with the client's own message — otherwise there's nothing
// for this reply to be answering.
if (count($anthropicMessages) === 0 || end($anthropicMessages)['role'] !== 'user') {
    http_response_code(400);
    echo json_encode(['error' => 'No client message to reply to']);
    exit;
}
// Bounded to the last ~10 messages by the caller already; this is a defensive second cap.
if (count($anthropicMessages) > 20) {
    $anthropicMessages = array_slice($anthropicMessages, -20);
}

$systemPrompt = buildSmsReplyPrompt($config['PHONE_NUMBER'], $firstName);

$payload = json_encode([
    'model' => $config['MODEL'],
    'max_tokens' => 250,
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
    CURLOPT_TIMEOUT => 25,
]);
$responseRaw = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($curlError || $httpCode !== 200) {
    // Fails to "needs a human" — an API problem must never look like a safe auto-reply.
    echo json_encode(['reply' => '', 'needs_human' => true, 'error' => 'Anthropic call failed']);
    exit;
}

$response = json_decode($responseRaw, true);
$modelText = '';
if (isset($response['content']) && is_array($response['content'])) {
    foreach ($response['content'] as $block) {
        if (isset($block['type']) && $block['type'] === 'text') $modelText .= $block['text'];
    }
}

$needsHuman = true; // default to the safe outcome if parsing fails for any reason
if (preg_match('/<needs_human>\s*(true|false)\s*<\/needs_human>/i', $modelText, $m)) {
    $needsHuman = strtolower($m[1]) === 'true';
}

$reply = '';
if (!$needsHuman && preg_match('/<reply>(.*?)<\/reply>/s', $modelText, $m)) {
    $reply = trim($m[1]);
}
// House style: no em/en dashes (matches chat.php's own cleanup).
$reply = preg_replace('/[ \t]*[\x{2013}\x{2014}][ \t]*/u', ', ', $reply);
$reply = preg_replace('/(?<=\S)[ \t]+-[ \t]+(?=\S)/u', ', ', $reply);

if (!$needsHuman && $reply === '') $needsHuman = true; // model said safe but gave nothing usable

$callbackTime = '';
if (!$needsHuman && preg_match('/<callback_time>(.*?)<\/callback_time>/s', $modelText, $m)) {
    $callbackTime = mb_substr(trim($m[1]), 0, 120);
}

echo json_encode(['reply' => $reply, 'needs_human' => $needsHuman, 'callback_time' => $callbackTime]);
