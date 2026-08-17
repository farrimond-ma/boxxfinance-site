import React, { createContext, useContext, useState } from 'react';
import ChatWidget from './ChatWidget';

// Global chat-open state, so any button anywhere on the site (right now
// just the FloatingCta "Talk to us" pill in ResourceHero.jsx) can open the
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

    const openChat = () => setIsOpen(true);
    const closeChat = () => setIsOpen(false);
    const toggleChat = () => setIsOpen((v) => !v);

    return (
        <ChatWidgetContext.Provider value={{ isOpen, openChat, closeChat, toggleChat }}>
            {children}
            <ChatWidget isOpen={isOpen} onClose={closeChat} />
        </ChatWidgetContext.Provider>
    );
};
