import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import { ChatWidgetProvider } from './components/chat/ChatWidgetContext';
import { useEffect } from 'react';

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
            </ChatWidgetProvider>
        </div>
    );
};

export default Layout;
