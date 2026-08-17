import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import { ChatWidgetProvider, useChatWidget } from './components/chat/ChatWidgetContext';
import { FloatingCta } from './components/resource/ResourceHero';
import { useEffect, useRef } from 'react';

// Pages where the floating "Talk to us" chat pill would compete with an
// already-open conversion funnel, so it's suppressed there.
const HIDE_FLOATING_CTA = ['/progress-your-application'];
const hideFloatingCta = (pathname) =>
    HIDE_FLOATING_CTA.includes(pathname) || pathname.startsWith('/chat-about-funding');

// Opens the chat automatically after 60s on site, once per browser session
// (sessionStorage, not React state, so it survives a page reload but not a
// closed tab). Starts once, at the top of the tree — Layout doesn't remount
// on client-side navigation, so this isn't reset by browsing between pages.
// Reads pathname/isOpen from refs at fire time (not at mount) so it still
// correctly skips auto-opening if the visitor has since navigated to a page
// where the CTA is suppressed, or has already opened the chat themselves.
const AUTO_OPEN_DELAY_MS = 60000;
const AUTO_OPEN_KEY = 'boxx_chat_auto_opened';

const AutoOpenChat = () => {
    const { pathname } = useLocation();
    const { isOpen, openChat } = useChatWidget();
    const pathnameRef = useRef(pathname);
    const isOpenRef = useRef(isOpen);
    pathnameRef.current = pathname;
    isOpenRef.current = isOpen;

    useEffect(() => {
        if (sessionStorage.getItem(AUTO_OPEN_KEY)) return;
        const timer = setTimeout(() => {
            sessionStorage.setItem(AUTO_OPEN_KEY, '1');
            if (!isOpenRef.current && !hideFloatingCta(pathnameRef.current)) {
                openChat();
            }
        }, AUTO_OPEN_DELAY_MS);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return null;
};

const Layout = () => {
    const { pathname } = useLocation();

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [pathname]);

    return (
        <div className="App">
            <ChatWidgetProvider>
                <Navbar minimal={pathname === '/progress-your-application'} />
                <main>
                    <Outlet />
                </main>
                <Footer />
                {/* Global chat launcher — appears site-wide (home, listings,
                    articles, locations, services) except where suppressed above. */}
                {!hideFloatingCta(pathname) && <FloatingCta />}
                <AutoOpenChat />
            </ChatWidgetProvider>
        </div>
    );
};

export default Layout;
