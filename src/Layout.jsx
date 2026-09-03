import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import { ChatWidgetProvider } from './components/chat/ChatWidgetContext';
import ContactMenu from './components/ContactMenu';
import { useEffect } from 'react';

// Pages where the floating "Talk to us" chat pill would compete with an
// already-open conversion funnel, so it's suppressed there.
const HIDE_FLOATING_CTA = ['/progress-your-application'];
const hideFloatingCta = (pathname) =>
    HIDE_FLOATING_CTA.includes(pathname) || pathname.startsWith('/chat-about-funding');

// The 60s auto-open now lives in ContactMenu — it opens the "Get in Touch"
// panel rather than the chat, so an unprompted interruption offers every
// route to a human instead of committing the visitor to typing.

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
                {/* Global "Get in Touch" launcher — WhatsApp, phone, live chat
                    and enquiry form. Appears site-wide except where suppressed
                    above. Was a chat-only button; people arriving on a funding
                    page want different routes to a human. */}
                {!hideFloatingCta(pathname) && <ContactMenu />}
            </ChatWidgetProvider>
        </div>
    );
};

export default Layout;
