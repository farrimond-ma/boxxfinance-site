import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import { ChatWidgetProvider } from './components/chat/ChatWidgetContext';
import { FloatingCta } from './components/resource/ResourceHero';
import { useEffect } from 'react';

// Pages where the floating "Talk to us" chat pill would compete with an
// already-open conversion funnel, so it's suppressed there.
const HIDE_FLOATING_CTA = ['/progress-your-application'];
const hideFloatingCta = (pathname) =>
    HIDE_FLOATING_CTA.includes(pathname) || pathname.startsWith('/chat-about-funding');

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
            </ChatWidgetProvider>
        </div>
    );
};

export default Layout;
