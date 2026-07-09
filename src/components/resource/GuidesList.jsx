import React from 'react';
import { Link } from 'react-router-dom';
import blogIndex from '../../data/blogIndex.json';

// Comprehensive "More guides" listing (the ABC Finance pattern) — links every
// other published guide in the same service, newest first. This is the main
// blog-to-blog internal-linking surface on the page.
const GuidesList = ({ service, currentSlug, max = 10 }) => {
    const norm = (s) => (s || '').toLowerCase().replace(/[^a-z]+/g, '').replace(/s$/, '');
    const key = norm(service);

    let guides = blogIndex
        .filter((p) => p && p.status === 'published' && p.slug !== currentSlug && norm(p.service) === key)
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    // Thin services fall back to the latest guides overall so the section
    // never renders half-empty.
    if (guides.length < 4) {
        guides = blogIndex
            .filter((p) => p && p.status === 'published' && p.slug !== currentSlug)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    guides = guides.slice(0, max);
    if (guides.length === 0) return null;

    const label = service ? `More ${service.toLowerCase()} guides` : 'More guides';

    return (
        <section className="resource-guides" aria-label={label}>
            <h2>{label}</h2>
            <ul className="resource-guides-grid">
                {guides.map((g) => (
                    <li key={g.slug}>
                        <Link to={`/insights/${g.slug}`}>{g.title}</Link>
                    </li>
                ))}
            </ul>
        </section>
    );
};

export default GuidesList;
