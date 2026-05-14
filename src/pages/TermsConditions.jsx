import React from 'react';
import Sidebar from '../components/Sidebar';
import SEO from '../components/SEO';
import RelatedArticles from '../components/RelatedArticles';
import './Blog.css';

const TermsConditions = () => {
    return (
        <div className="blog-post-page">
            <SEO
                title="Terms & Conditions"
                description="Read the Terms & Conditions for use of the Boxx Commercial Finance website. These terms govern your access to our site and the services we provide."
            />
            <div className="legal-hero" style={{ padding: '10rem 0 6rem' }}>
                <div className="container">
                    <h1>Terms & <span className="text-highlight">Conditions</span></h1>
                </div>
            </div>

            <div className="container blog-layout">
                {/* Main Content */}
                <div className="blog-main">
                    <div className="blog-main-card">
                        <div className="blog-post-content" style={{ padding: '3rem' }}>
                            <h2>1. Introduction</h2>
                            <p>These terms and conditions govern your use of this website; by using this website, you accept these terms and conditions in full. If you disagree with these terms and conditions or any part of these terms and conditions, you must not use this website.</p>

                            <h2>2. License to Use Website</h2>
                            <p>Unless otherwise stated, Boxx Commercial Finance and/or its licensors own the intellectual property rights in the website and material on the website. Subject to the license below, all these intellectual property rights are reserved.</p>
                            <p>You may view, download for caching purposes only, and print pages from the website for your own personal use, subject to the restrictions set out below and elsewhere in these terms and conditions.</p>

                            <h2>3. Acceptable Use</h2>
                            <p>You must not use this website in any way that causes, or may cause, damage to the website or impairment of the availability or accessibility of the website; or in any way which is unlawful, illegal, fraudulent or harmful, or in connection with any unlawful, illegal, fraudulent or harmful purpose or activity.</p>

                            <h2>4. Restricted Access</h2>
                            <p>Access to certain areas of this website is restricted. Boxx Commercial Finance reserves the right to restrict access to areas of this website, or indeed this entire website, at our discretion.</p>

                            <h2>5. No Warranties</h2>
                            <p>This website is provided "is" without any representations or warranties, express or implied. Boxx Commercial Finance makes no representations or warranties in relation to this website or the information and materials provided on this website.</p>

                            <h2>6. Limitations of Liability</h2>
                            <p>Boxx Commercial Finance will not be liable to you (whether under the law of contact, the law of torts or otherwise) in relation to the contents of, or use of, or otherwise in connection with, this website.</p>

                            <h2>7. Variation</h2>
                            <p>We may revise these terms and conditions from time to time. Revised terms and conditions will apply to the use of this website from the date of the publication of the revised terms and conditions on this website.</p>

                            <h2>8. Law and Jurisdiction</h2>
                            <p>These terms and conditions will be governed by and construed in accordance with English law, and any disputes relating to these terms and conditions will be subject to the exclusive jurisdiction of the courts of England and Wales.</p>
                        </div>
                    </div>

                    <RelatedArticles type="legal" />
                </div>

                {/* Sidebar */}
                <div className="blog-sidebar">
                    <Sidebar />
                </div>
            </div>
        </div>
    );
};

export default TermsConditions;
