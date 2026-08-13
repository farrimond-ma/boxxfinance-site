import React from 'react';
import Hero from '../components/Hero';
import Services from '../components/Services';
import About from '../components/About';
import CaseStudies from '../components/CaseStudies';
import Contact from '../components/Contact';
import HomeFaq from '../components/HomeFaq';
import SEO from '../components/SEO';
import { homeFaqSchema } from '../data/homeFaqs';

const Home = () => {
    return (
        <>
            <SEO
                title="Bridging Loans & Commercial Finance UK"
                description="Fast, whole-of-market bridging loans for UK property purchases, chain breaks and refurbishment — plus commercial mortgages, asset finance and the full range of business funding solutions."
                keywords="bridging loans UK, commercial finance UK, business funding UK, commercial mortgages, asset finance, specialist finance broker"
                schema={[
                    {
                        "@context": "https://schema.org",
                        "@type": "Organization",
                        "name": "Boxx Finance",
                        "url": "https://boxxfinance.co.uk",
                        "logo": "https://boxxfinance.co.uk/logo.png",
                        "contactPoint": {
                            "@type": "ContactPoint",
                            "telephone": "+44-1236-702070",
                            "contactType": "customer service",
                            "areaServed": "GB",
                            "availableLanguage": "English"
                        },
                        "sameAs": [
                            "https://www.linkedin.com/company/boxx-commercial-finance"
                        ]
                    },
                    {
                        "@context": "https://schema.org",
                        "@type": "WebSite",
                        "name": "Boxx Finance",
                        "url": "https://boxxfinance.co.uk"
                    },
                    // FAQPage built from the same source as the visible
                    // accordion below, so the two can never disagree.
                    homeFaqSchema
                ]}
            />
            <Hero />
            <Services />
            <About />
            <CaseStudies />
            <HomeFaq />
            <Contact />
        </>
    );
};

export default Home;
