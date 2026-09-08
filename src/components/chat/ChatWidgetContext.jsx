import React, { createContext, useContext, useState } from 'react';
import ChatWidget from './ChatWidget';

// Global chat-open state, so any button anywhere on the site (right now
// just the floating launcher) — now the ContactMenu "Live Chat" option can open the
// same chat panel without prop-drilling. The panel itself lives here too,
// rendered once at the top of the tree (see Layout.jsx) rather than once
// per page.
const ChatWidgetContext = createContext(null);

export const useChatWidget = () => {
    const ctx = useContext(ChatWidgetContext);
    if (!ctx) throw new Error('useChatWidget must be used within ChatWidgetProvider');
    return ctx;
};

export const ChatWidgetProvider = ({ children }) => {
    const [isOpen, setIsOpen] = useState(false);
    // Set once by a re-engagement link (?t=&a=yes/no — see ReengageOpener) to seed the
    // conversation with who the visitor is and what they just tapped, so the widget can open
    // straight into a personalised reply instead of the generic greeting.
    const [seed, setSeed] = useState(null);

    const openChat = () => setIsOpen(true);
    const closeChat = () => setIsOpen(false);
    const toggleChat = () => setIsOpen((v) => !v);
    const openChatWithSeed = (s) => { setSeed(s); setIsOpen(true); };

    return (
        <ChatWidgetContext.Provider value={{ isOpen, openChat, closeChat, toggleChat, openChatWithSeed }}>
            {children}
            <ChatWidget isOpen={isOpen} onClose={closeChat} seed={seed} onSeedConsumed={() => setSeed(null)} />
        </ChatWidgetContext.Provider>
    );
};
