import React, { useState } from 'react';

// Renders the FAQ *visibly* from the same faqSchema.mainEntity that feeds the
// JSON-LD, so on-page content matches the structured data (Google requires
// this for FAQ rich results). Until now the FAQ existed only in schema.
const FaqAccordion = ({ faqSchema }) => {
    const entities = faqSchema && Array.isArray(faqSchema.mainEntity) ? faqSchema.mainEntity : [];
    const [open, setOpen] = useState(0);

    if (entities.length === 0) return null;

    return (
        <section className="resource-faqs" aria-label="Frequently asked questions">
            <h2 id="section-faqs">Frequently asked questions</h2>
            <div className="faq-list">
                {entities.map((q, i) => {
                    const answer = q.acceptedAnswer?.text || '';
                    const isOpen = open === i;
                    return (
                        <div key={i} className={`faq-item${isOpen ? ' is-open' : ''}`}>
                            <button
                                type="button"
                                className="faq-question"
                                aria-expanded={isOpen}
                                onClick={() => setOpen(isOpen ? -1 : i)}
                            >
                                <span>{q.name}</span>
                                <span className="faq-icon" aria-hidden="true">{isOpen ? '−' : '+'}</span>
                            </button>
                            {isOpen && (
                                <div className="faq-answer">
                                    <p>{answer}</p>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </section>
    );
};

export default FaqAccordion;
