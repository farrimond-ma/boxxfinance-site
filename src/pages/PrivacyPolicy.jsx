import React from 'react';
import Sidebar from '../components/Sidebar';
import SEO from '../components/SEO';
import RelatedArticles from '../components/RelatedArticles';
import './Blog.css';

const PrivacyPolicy = () => {
    return (
        <div className="blog-post-page">
            <SEO
                title="Privacy Policy"
                description="Read the Boxx Commercial Finance Privacy Policy. We are committed to protecting your personal data and handling it transparently in line with UK data protection law."
            />
            <div className="legal-hero" style={{ padding: '10rem 0 6rem' }}>
                <div className="container">
                    <h1>Privacy <span className="text-highlight">Policy</span></h1>
                </div>
            </div>

            <div className="container blog-layout">
                {/* Main Content */}
                <div className="blog-main">
                    <div className="blog-main-card">
                        <div className="blog-post-content" style={{ padding: '3rem' }}>
                            <h2>1. Introduction</h2>
                            <p>Boxx Commercial Finance ("we", "us", "our") is committed to protecting and respecting your privacy. This policy sets out the basis on which any personal data we collect from you, or that you provide to us, will be processed by us.</p>

                            <h2>2. Information We Collect</h2>
                            <p>We may collect and process the following data about you:</p>
                            <ul>
                                <li>Information that you provide by filling in forms on our site boxxfinance.co.uk. This includes information provided at the time of registering to use our site, subscribing to our service, posting material or requesting further services.</li>
                                <li>If you contact us, we may keep a record of that correspondence.</li>
                                <li>Details of your visits to our site including, but not limited to, traffic data, location data, weblogs and other communication data.</li>
                            </ul>

                            <h2>3. How We Use Your Information</h2>
                            <p>We use information held about you in the following ways:</p>
                            <ul>
                                <li>To ensure that content from our site is presented in the most effective manner for you and for your computer.</li>
                                <li>To provide you with information, products or services that you request from us or which we feel may interest you, where you have consented to be contacted for such purposes.</li>
                                <li>To carry out our obligations arising from any contracts entered into between you and us.</li>
                            </ul>

                            <h2>4. Disclosure of Your Information</h2>
                            <p>We may disclose your personal information to third parties:</p>
                            <ul>
                                <li>In the event that we sell or buy any business or assets, in which case we may disclose your personal data to the prospective seller or buyer of such business or assets.</li>
                                <li>If Boxx Commercial Finance or substantially all of its assets are acquired by a third party, in which case personal data held by it about its customers will be one of the transferred assets.</li>
                            </ul>

                            <h2>5. Your Rights</h2>
                            <p>You have the right to ask us not to process your personal data for marketing purposes. We will usually inform you (before collecting your data) if we intend to use your data for such purposes or if we intend to disclose your information to any third party for such purposes.</p>

                            <h2>6. Changes to Our Privacy Policy</h2>
                            <p>Any changes we may make to our privacy policy in the future will be posted on this page and, where appropriate, notified to you by e-mail.</p>

                            <h2>7. Contact</h2>
                            <p>Questions, comments and requests regarding this privacy policy are welcomed and should be addressed to <a href="mailto:hello@boxxfinance.co.uk" className="gold-link">hello@boxxfinance.co.uk</a>.</p>
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

export default PrivacyPolicy;
