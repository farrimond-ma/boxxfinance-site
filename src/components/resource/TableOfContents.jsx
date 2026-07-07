import React, { useEffect, useMemo, useState } from 'react';

// Sticky "On this page" jump-links, auto-built from the article's <h2>s.
// Reads the rendered content container by id after it mounts so it works
// with the async-fetched article/location body. IDs are slugged onto each
// heading so the anchors resolve.
const slugId = (text) =>
    'section-' + text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const TableOfContents = ({ containerId, ready }) => {
    const [items, setItems] = useState([]);
    const [activeId, setActiveId] = useState('');

    useEffect(() => {
        if (!ready) return;
        const container = document.getElementById(containerId);
        if (!container) return;
        const headings = [...container.querySelectorAll('h2')];
        const next = headings.map((h) => {
            const id = h.id || slugId(h.textContent || '');
            h.id = id;
            return { id, text: h.textContent || '' };
        });
        setItems(next);
    }, [containerId, ready]);

    useEffect(() => {
        if (items.length === 0) return undefined;
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((e) => {
                    if (e.isIntersecting) setActiveId(e.target.id);
                });
            },
            { rootMargin: '-20% 0px -70% 0px' }
        );
        items.forEach((i) => {
            const el = document.getElementById(i.id);
            if (el) observer.observe(el);
        });
        return () => observer.disconnect();
    }, [items]);

    const handleClick = (e, id) => {
        e.preventDefault();
        const el = document.getElementById(id);
        if (el) {
            window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 90, behavior: 'smooth' });
            history.replaceState(null, '', `#${id}`);
        }
    };

    if (items.length < 3) return null; // not worth a ToC on short pages

    return (
        <nav className="resource-toc" aria-label="On this page">
            <p className="resource-toc-title">On this page</p>
            <ul>
                {items.map((i) => (
                    <li key={i.id} className={activeId === i.id ? 'is-active' : ''}>
                        <a href={`#${i.id}`} onClick={(e) => handleClick(e, i.id)}>{i.text}</a>
                    </li>
                ))}
            </ul>
        </nav>
    );
};

export default TableOfContents;
