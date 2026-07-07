import React, { useEffect, useState } from 'react';

// Compact "On this page" jump-box rendered at the top of the article
// (ABC Finance / NerdWallet pattern) — not a sticky rail. Links are
// auto-built from the article's <h2>s after the async body mounts.
const slugId = (text) =>
    'section-' + text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const TableOfContents = ({ containerId, ready }) => {
    const [items, setItems] = useState([]);

    useEffect(() => {
        if (!ready) return;
        const container = document.getElementById(containerId);
        if (!container) return;
        const headings = [...container.querySelectorAll('h2')];
        setItems(headings.map((h) => {
            const id = h.id || slugId(h.textContent || '');
            h.id = id;
            return { id, text: h.textContent || '' };
        }));
    }, [containerId, ready]);

    const handleClick = (e, id) => {
        e.preventDefault();
        const el = document.getElementById(id);
        if (el) {
            window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 90, behavior: 'smooth' });
            history.replaceState(null, '', `#${id}`);
        }
    };

    if (items.length < 3) return null;

    return (
        <nav className="resource-toc" aria-label="On this page">
            <p className="resource-toc-title">On this page</p>
            <ul>
                {items.map((i) => (
                    <li key={i.id}>
                        <a href={`#${i.id}`} onClick={(e) => handleClick(e, i.id)}>{i.text}</a>
                    </li>
                ))}
            </ul>
        </nav>
    );
};

export default TableOfContents;
