import React from 'react';
import Hero from '../components/Hero';
import HeroStats from '../components/HeroStats';
import Services from '../components/Services';
import BridgingCalculator from '../components/BridgingCalculator';
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
                title="Bridging Loans & Development Finance UK"
                description="Fast bridging loans and development finance from a panel of lenders, for UK property purchases, auctions, chain breaks, refurbishment, ground-up schemes and stopping repossessions."
                keywords="bridging loans UK, development finance UK, auction finance, refurbishment finance, stop repossession bridging loan, specialist finance broker"
                schema={[
                    {
                        "@context": "https://schema.org",
                        "@type": "Organization",
                        "name": "Boxx Finance",
                        "legalName": "Boxx Finance Ltd",
                        "identifier": {
                            "@type": "PropertyValue",
                            "propertyID": "GB:CRN",
                            "value": "SC905235"
                        },
                        "url": "https://boxxfinance.co.uk",
                        "logo": "https://boxxfinance.co.uk/logo.png",
                        "contactPoint": {
                            "@type": "ContactPoint",
                            "telephone": "+44-1236-702070",
                            "contactType": "customer service",
                            "areaServed": "GB",
                            "availableLanguage": "English"
                        },
                        // sameAs tells Google "this organisation IS that profile",
                        // so it reconciles the entity against LinkedIn and can take
                        // the name from there. In Aug 2026 an AI Overview cited the
                        // business as "Boxx Commercial Finance" — the LinkedIn page
                        // name, not the name used anywhere on this site.
                        //
                        // Fixing that means renaming the LinkedIn page; no schema
                        // change here can override the profile it points at. Do not
                        // add "Boxx Commercial Finance" as an alternateName to paper
                        // over it — that tells Google the wrong name is legitimate.
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
            <HeroStats />
            <Services />
            {/* Directly after Services: the hero states what Boxx does, Services
                shows the range, and the calculator is the first thing that lets a
                visitor do something with their own numbers — before the softer
                About/case-study content. */}
            <BridgingCalculator />
            <About />
            <CaseStudies />
            <HomeFaq />
            <Contact />
        </>
    );
};

export default Home;
