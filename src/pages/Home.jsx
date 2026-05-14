import React from 'react';
import Hero from '../components/Hero';
import Services from '../components/Services';
import About from '../components/About';
import CaseStudies from '../components/CaseStudies';
import Contact from '../components/Contact';
import SEO from '../components/SEO';

const Home = () => {
    return (
        <>
            <SEO
                title="UK Commercial Finance & Business Funding"
                description="Boxx Commercial Finance provides tailored funding solutions for UK businesses. From asset finance to commercial mortgages, we help you grow."
                keywords="commercial finance UK, business funding UK, commercial mortgages, bridging finance, asset finance, specialist finance broker"
                schema={[
                    {
                        "@context": "https://schema.org",
                        "@type": "Organization",
                        "name": "Boxx Commercial Finance",
                        "url": "https://boxxfinance.co.uk",
                        "logo": "https://boxxfinance.co.uk/logo.webp",
                        "contactPoint": {
                            "@type": "ContactPoint",
                            "telephone": "+44-0-000-0000",
                            "contactType": "customer service"
                        },
                        "sameAs": [
                            "https://www.linkedin.com/company/boxx-commercial-finance"
                        ]
                    },
                    {
                        "@context": "https://schema.org",
                        "@type": "WebSite",
                        "name": "Boxx Commercial Finance",
                        "url": "https://boxxfinance.co.uk"
                    }
                ]}
            />
            <Hero />
            <Services />
            <About />
            <CaseStudies />
            <Contact />
        </>
    );
};

export default Home;
