import React from 'react';
import Sidebar from '../components/Sidebar';
import SEO from '../components/SEO';
import RelatedArticles from '../components/RelatedArticles';
import './Blog.css';

const LegalDisclaimer = () => {
    return (
        <div className="blog-post-page">
            <SEO
                title="Legal Disclaimer"
                description="Legal information for Boxx Commercial Finance. We act as a commercial finance broker, not a lender. Read our regulatory status, commission disclosure and liability terms."
            />
            <div className="legal-hero" style={{ padding: '10rem 0 6rem' }}>
                <div className="container">
                    <h1>Legal <span className="text-highlight">Disclaimer</span></h1>
                </div>
            </div>

            <div className="container blog-layout">
                {/* Main Content */}
                <div className="blog-main">
                    <div className="blog-main-card">
                        <div className="blog-post-content" style={{ padding: '3rem' }}>
                            <h2>1. Broker Status</h2>
                            <p>Boxx Commercial Finance is a commercial finance broker and not a lender. We work with a panel of lenders to find funding solutions for business purposes.</p>

                            <h2>2. No Advice</h2>
                            <p>The content on this website is for information purposes only and does not constitute financial or professional advice. We recommend that you seek independent professional advice before entering into any financial agreement.</p>

                            <h2>3. Regulatory Status</h2>
                            <p>Commercial finance is not regulated by the Financial Conduct Authority (FCA). As such, Boxx Commercial Finance is not authorised or regulated by the FCA for commercial finance activities.</p>

                            <h2>4. Commission Disclosure</h2>
                            <p>We may receive a commission or finder's fee from lenders for arranging finance. The amount of commission may vary depending on the lender, the product, and the complexity of the deal. You have the right to request information about any commissions we may receive.</p>

                            <h2>5. Liability</h2>
                            <p>While we make every effort to ensure the accuracy of the information on our website, we accept no liability for any errors or omissions. We shall not be liable for any direct, indirect, incidental, or consequential damages arising out of the use of, or inability to use, our website or services.</p>

                            <h2>6. Funding Availability</h2>
                            <p>All funding is subject to lender criteria, status, and terms. Past performance is not indicative of future results. Rates and terms are subject to change without notice.</p>
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

export default LegalDisclaimer;
