import React, { useEffect } from 'react';
import SEO from '../components/SEO';
import { ChatWidgetProvider, useChatWidget } from '../components/chat/ChatWidgetContext';

// Internal-only page for testing the AI chatbot before it's wired up to the
// real "Talk to us" button sitewide (see FloatingCta in ResourceHero.jsx,
// deliberately left untouched pointing at /chat-about-funding until this is
// signed off). NOT in the sitemap, NOT linked from anywhere on the site,
// and noindex'd below as a second layer of "don't get found by accident" —
// reachable only if you know this exact URL.
//
// Once the chatbot is approved, the one line to flip is FloatingCta's
// onClick back to opening the widget instead of navigating to the form —
// this page and its route can stay or be removed at that point, your call.

const AutoOpen = () => {
    const { openChat } = useChatWidget();
    useEffect(() => {
        openChat();
    }, []);
    return null;
};

const ChatbotTest = () => {
    return (
        <ChatWidgetProvider>
            <SEO
                title="Chatbot Test"
                description="Internal chatbot testing page."
                noIndex={true}
            />
            <AutoOpen />
            <div style={{ minHeight: '100vh', background: '#0d1526', color: '#fff', padding: '3rem 1.5rem', fontFamily: 'monospace' }}>
                <div style={{ maxWidth: 640, margin: '0 auto' }}>
                    <h1 style={{ fontSize: '1.4rem', marginBottom: '0.5rem' }}>Chatbot test page — internal only</h1>
                    <p style={{ opacity: 0.7, fontSize: '0.9rem', lineHeight: 1.6 }}>
                        Not linked from anywhere on the site, not in the sitemap, marked
                        noindex. The chat panel should have opened automatically in the
                        bottom-right corner — if it didn't, or if it shows a "having
                        trouble connecting" message, check that <code>public/api/config.php</code> exists
                        on the server with a real Anthropic API key (see <code>docs/chatbot-brief.md</code>).
                    </p>
                    <p style={{ opacity: 0.7, fontSize: '0.9rem', lineHeight: 1.6, marginTop: '1rem' }}>
                        This page pretends to be a bridging loans service page for the
                        purposes of testing — page context sent to the model will say
                        "bridging finance service page" regardless of this page's actual
                        URL, since the category inference is based on path patterns this
                        internal route doesn't match. That's fine for testing the
                        conversation itself; page-context accuracy is already verified
                        separately on the real service/location pages.
                    </p>
                </div>
            </div>
        </ChatWidgetProvider>
    );
};

export default ChatbotTest;
