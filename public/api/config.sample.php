<?php
// Copy this file to config.php ON THE SERVER ONLY — never commit config.php,
// it holds the real API key. config.php is gitignored and excluded from the
// FTP deploy sync (see docs/chatbot-brief.md) specifically so a real deploy
// never overwrites or deletes it once it's placed.
//
// Setup (one-off, manual):
//   1. Upload this file to public_html/api/config.php via the SiteGround
//      file manager or FTP client (NOT via the GitHub Actions deploy).
//   2. Fill in ANTHROPIC_API_KEY below with a real key.
//   3. That's it — chat.php will pick it up on every request.

return [
    // https://console.anthropic.com/settings/keys
    'ANTHROPIC_API_KEY' => 'CHANGE_ME',

    // Same Apps Script endpoint every other form on the site posts leads to.
    'GOOGLE_SCRIPT_URL' => 'https://script.google.com/macros/s/AKfycbwF7_EU1ekXaviBoRU_Xay1P4uzAhIm7t_Ded9j73jh9B_fpObwNdspWtSji8YLrpHFag/exec',

    'PHONE_NUMBER' => '01236 702070',

    // Model used for the chat — Haiku is what the rest of the content
    // engine already uses for conversational (non-long-form) calls.
    'MODEL' => 'claude-haiku-4-5-20251001',

    // Optional: pushes captured leads + full chat transcript directly to the
    // CRM, in addition to the Google Sheet write above (see
    // docs/chatbot-crm-sync.md for the endpoint spec this expects). Leave
    // both blank/unset to skip the CRM push entirely — nothing breaks, it's
    // just a no-op until the CRM side exists.
    'CRM_CHATBOT_URL' => '',
    'CRM_CHATBOT_KEY' => '',
];
