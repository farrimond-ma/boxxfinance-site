import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import './ChatWidget.css';

const PHONE_DISPLAY = '01236 702070';
const PHONE_TEL = 'tel:01236702070';

// Infers a rough page category from the URL path, sent to the backend so
// the model's system prompt gets useful page context (item 13/14 of the
// brief) without needing every page to explicitly wire it up.
function inferPageCategory(pathname) {
    if (/^\/funding-solutions\/bridging-loans/.test(pathname)) return 'bridging finance service page';
    if (/^\/funding-solutions\//.test(pathname)) return 'commercial finance service page (non-bridging)';
    if (/^\/ads\/bridging-loans/.test(pathname)) return 'bridging loans ad landing page';
    if (/auction/.test(pathname)) return 'auction finance content';
    if (/^\/locations\/county\//.test(pathname)) return 'county location hub page';
    if (/^\/locations\//.test(pathname)) return 'town/city bridging finance location page';
    if (/^\/insights\//.test(pathname)) return 'blog article';
    if (pathname === '/') return 'homepage';
    return 'general site page';
}

function TypingIndicator() {
    return (
        <div className="chat-bubble chat-bubble-assistant chat-typing" aria-label="Typing">
            <span></span><span></span><span></span>
        </div>
    );
}

const ChatWidget = ({ isOpen, onClose }) => {
    const location = useLocation();
    const [messages, setMessages] = useState([]); // {role: 'user'|'assistant', content}
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [leadCaptured, setLeadCaptured] = useState(false);
    const [error, setError] = useState('');
    const listRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 300);
        }
    }, [isOpen]);

    useEffect(() => {
        if (listRef.current) {
            listRef.current.scrollTop = listRef.current.scrollHeight;
        }
    }, [messages, isTyping]);

    const pageContext = {
        url: typeof window !== 'undefined' ? window.location.href : '',
        title: typeof document !== 'undefined' ? document.title : '',
        category: inferPageCategory(location.pathname),
    };

    const sendMessage = async (text) => {
        const trimmed = text.trim();
        if (!trimmed || isTyping) return;

        const nextMessages = [...messages, { role: 'user', content: trimmed }];
        setMessages(nextMessages);
        setInput('');
        setIsTyping(true);
        setError('');

        try {
            const res = await fetch('/api/chat.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: nextMessages, pageContext }),
            });
            const data = await res.json();

            if (!res.ok) {
                setError(data.error || `Something went wrong — you can also call us on ${PHONE_DISPLAY}.`);
                setIsTyping(false);
                return;
            }

            setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
            if (data.leadCaptured) setLeadCaptured(true);
        } catch {
            setError(`Chat is having trouble connecting — you can call us directly on ${PHONE_DISPLAY}.`);
        } finally {
            setIsTyping(false);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        sendMessage(input);
    };

    if (!isOpen) return null;

    return (
        <div className="chat-panel" role="dialog" aria-label="Chat with Boxx Finance">
            <div className="chat-header">
                <div className="chat-header-info">
                    <span className="chat-header-dot" aria-hidden="true"></span>
                    <div>
                        <h3>Boxx Finance</h3>
                        <p>Usually replies in a minute</p>
                    </div>
                </div>
                <div className="chat-header-actions">
                    <a href={PHONE_TEL} className="chat-header-call" aria-label={`Call ${PHONE_DISPLAY}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                        </svg>
                    </a>
                    <button type="button" className="chat-header-close" onClick={onClose} aria-label="Close chat">
                        &times;
                    </button>
                </div>
            </div>

            <div className="chat-messages" ref={listRef}>
                {messages.length === 0 && (
                    <div className="chat-greeting">
                        <div className="chat-bubble chat-bubble-assistant">
                            Hi, welcome to Boxx Finance.
                        </div>
                        <div className="chat-bubble chat-bubble-assistant">
                            How can we help?
                        </div>
                    </div>
                )}

                {messages.map((m, i) => (
                    <div key={i} className={`chat-bubble chat-bubble-${m.role}`}>
                        {m.content}
                    </div>
                ))}

                {isTyping && <TypingIndicator />}

                {leadCaptured && (
                    <div className="chat-lead-confirmation">
                        Thanks — a member of the team will be in touch shortly. You can keep chatting or call {PHONE_DISPLAY} any time.
                    </div>
                )}

                {error && <div className="chat-error">{error}</div>}
            </div>

            <form className="chat-input-row" onSubmit={handleSubmit}>
                <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type your message..."
                    aria-label="Type your message"
                    disabled={isTyping}
                />
                <button type="submit" className="chat-send" disabled={isTyping || !input.trim()} aria-label="Send">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <line x1="22" y1="2" x2="11" y2="13"></line>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                </button>
            </form>
        </div>
    );
};

export default ChatWidget;
