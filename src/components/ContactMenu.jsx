import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useChatWidget } from './chat/ChatWidgetContext';
import './ContactMenu.css';

/**
 * Floating "Get in Touch" menu.
 *
 * Replaces the single floating button that opened the chat widget directly.
 * People arriving on a funding page want different things — some will type,
 * some want WhatsApp, some just want to ring — and a single icon only offered
 * one of those.
 *
 * Live Chat still opens the existing widget; it is one option now rather than
 * the only one.
 */

const PHONE_TEL = 'tel:01236702070';

// The panel opens itself once per browser session after a minute on site.
// This used to be the chat widget opening unprompted, which committed the
// visitor to one channel; the menu offers the same routes without doing that.
// sessionStorage (not React state) so it survives a reload but not a new tab.
const AUTO_OPEN_DELAY_MS = 60000;
const AUTO_OPEN_KEY = 'boxx_contact_menu_auto_opened';

// wa.me needs the full international number, no spaces, no leading zero.
// 07915 377969 → 44 7915 377969
const WHATSAPP_URL = 'https://wa.me/447915377969';

// No booking tool is set up yet, so this entry does not render. Set it to the
// scheduling URL (Calendly, Cal.com, HubSpot meetings, whatever gets used) and
// "Book a Meeting" appears. Deliberately not pointed at the enquiry form —
// that is a form, not a booking, and labelling it as one would mislead.
const BOOKING_URL = null;

const Icon = ({ d, children }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
        strokeLinejoin="round" aria-hidden="true">
        {children || <path d={d} />}
    </svg>
);

const ContactMenu = () => {
    const { isOpen: chatIsOpen, openChat } = useChatWidget();
    const [open, setOpen] = useState(false);
    const panelRef = useRef(null);
    const buttonRef = useRef(null);

    // Read at fire time rather than at mount, so a visitor who has since
    // opened the chat (or the menu) themselves isn't interrupted by it.
    const chatIsOpenRef = useRef(chatIsOpen);
    const openRef = useRef(open);
    chatIsOpenRef.current = chatIsOpen;
    openRef.current = open;

    useEffect(() => {
        if (sessionStorage.getItem(AUTO_OPEN_KEY)) return undefined;
        const timer = setTimeout(() => {
            sessionStorage.setItem(AUTO_OPEN_KEY, '1');
            if (!chatIsOpenRef.current && !openRef.current) setOpen(true);
        }, AUTO_OPEN_DELAY_MS);
        return () => clearTimeout(timer);
    }, []);

    // Close on Escape and on a click outside — expected of anything that opens
    // over the page.
    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        const onClick = (e) => {
            if (panelRef.current?.contains(e.target) || buttonRef.current?.contains(e.target)) return;
            setOpen(false);
        };
        document.addEventListener('keydown', onKey);
        document.addEventListener('mousedown', onClick);
        return () => {
            document.removeEventListener('keydown', onKey);
            document.removeEventListener('mousedown', onClick);
        };
    }, [open]);

    const startChat = () => {
        setOpen(false);
        openChat();
    };

    return (
        <>
            {open && (
                <div className="contact-menu-panel" ref={panelRef} role="dialog" aria-label="Get in touch">
                    <h3>Get in Touch</h3>
                    <p>Speak to our team about your funding requirements.</p>

                    <ul>
                        <li>
                            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>
                                <Icon d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                                WhatsApp
                            </a>
                        </li>
                        <li>
                            <a href={PHONE_TEL} onClick={() => setOpen(false)}>
                                <Icon d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                                Call us now
                            </a>
                        </li>
                        <li>
                            <button type="button" onClick={startChat}>
                                <Icon>
                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                </Icon>
                                Live Chat
                            </button>
                        </li>
                        {BOOKING_URL && (
                            <li>
                                <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>
                                    <Icon>
                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                        <line x1="16" y1="2" x2="16" y2="6" />
                                        <line x1="8" y1="2" x2="8" y2="6" />
                                        <line x1="3" y1="10" x2="21" y2="10" />
                                    </Icon>
                                    Book a Meeting
                                </a>
                            </li>
                        )}
                        <li>
                            <Link to="/chat-about-funding" onClick={() => setOpen(false)}>
                                <Icon>
                                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                    <polyline points="22,6 12,13 2,6" />
                                </Icon>
                                Send Enquiry
                            </Link>
                        </li>
                    </ul>
                </div>
            )}

            <button
                type="button"
                ref={buttonRef}
                className={`contact-menu-fab${open ? ' is-open' : ''}`}
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-label={open ? 'Close contact options' : 'Get in touch'}
            >
                {open ? (
                    <Icon>
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </Icon>
                ) : (
                    <Icon d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                )}
            </button>
        </>
    );
};

export default ContactMenu;
