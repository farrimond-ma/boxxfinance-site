import React from 'react';
import { Link } from 'react-router-dom';
import FaqAccordion from './resource/FaqAccordion';
import { homeFaqSchema } from '../data/homeFaqs';
import './HomeFaq.css';

/**
 * Home page FAQ section.
 *
 * Reuses the resource FaqAccordion, which renders the visible list from the
 * same object that feeds the JSON-LD — Google requires on-page content to
 * match FAQPage structured data, and keeping one source removes the chance of
 * them drifting.
 *
 * The home page previously had no FAQ schema at all, despite the whole content
 * strategy being built around being quotable by AI answer engines. FAQPage
 * markup on the highest-authority page on the domain is the most direct
 * version of that.
 */
const HomeFaq = () => (
    <section className="home-faq" id="faq" aria-labelledby="home-faq-heading">
        <div className="container">
            <div className="home-faq-intro">
                <p className="home-faq-eyebrow">Common Questions</p>
                <h2 id="home-faq-heading">Bridging loans, answered</h2>
                <p>
                    The questions we are asked most often. For detail on a specific situation,{' '}
                    <Link to="/insights">browse our guides</Link> or{' '}
                    <Link to="/chat-about-funding/bridging-loans">talk to us about your case</Link>.
                </p>
            </div>
            <FaqAccordion faqSchema={homeFaqSchema} />
        </div>
    </section>
);

export default HomeFaq;
