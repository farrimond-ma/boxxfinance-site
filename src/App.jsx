import React, { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './Layout';
import Home from './pages/Home';
import ServicePage from './pages/ServicePage';
import Blog from './pages/Blog';
import BlogPost from './pages/BlogPost';
import MultiStepForm from './pages/MultiStepForm';
import PrivacyPolicy from './pages/PrivacyPolicy';
import LegalDisclaimer from './pages/LegalDisclaimer';
import TermsConditions from './pages/TermsConditions';
import SmeFundingIndex from './pages/SmeFundingIndex';
import BridgingCalculatorPage from './pages/BridgingCalculatorPage';
import NotFound from './pages/NotFound';
import ContentDashboard from './pages/ContentDashboard';
import './App.css';
import ScrollToTop from './components/ScrollToTop';
import LocationPage from './pages/LocationPage';
import CountyPage from './pages/CountyPage';
import Locations from './pages/Locations';
import FundingSolutions from './pages/FundingSolutions';
import Partners from './pages/Partners';
import AdLandingBridgingLoans from './pages/AdLandingBridgingLoans';
import ProgressApplication from './pages/ProgressApplication';
import ChatbotTest from './pages/ChatbotTest';

function App() {
  // Capture a partner's ?ref=CODE on first load and keep it for the session, so
  // an enquiry that starts on any page still attributes to the introducer.
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref) sessionStorage.setItem('boxx_ref', ref.slice(0, 40));
  }, []);

  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="funding-solutions" element={<FundingSolutions />} />
          <Route path="funding-solutions/:slug" element={<ServicePage />} />
          <Route path="insights" element={<Blog />} />
          <Route path="insights/:slug" element={<BlogPost />} />
          <Route path="chat-about-funding" element={<MultiStepForm />} />
          <Route path="chat-about-funding/:slug" element={<MultiStepForm />} />
          <Route path="progress-your-application" element={<ProgressApplication />} />
          <Route path="privacy-policy" element={<PrivacyPolicy />} />
          <Route path="legal-disclaimer" element={<LegalDisclaimer />} />
          <Route path="terms-and-conditions" element={<TermsConditions />} />
          {/* Single page only. The old /uk-sme-funding-index/:archiveSlug routes
              served 61 months of fabricated "archives" and now return 410 Gone. */}
          <Route path="bridging-loan-calculator" element={<BridgingCalculatorPage />} />
          <Route path="uk-sme-funding-index" element={<SmeFundingIndex />} />
          <Route path="partners" element={<Partners />} />
          <Route path="locations" element={<Locations />} />
          <Route path="locations/county/:countySlug" element={<CountyPage />} />
          <Route path="locations/:slug" element={<LocationPage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
        {/* Dashboard sits outside Layout — no navbar, no footer */}
        <Route path="/dashboard" element={<ContentDashboard />} />
        {/* Ad landing page — outside Layout deliberately: paid traffic should
            see a single-purpose page with a form in the hero, not the full
            site nav pulling attention away from conversion. */}
        <Route path="/ads/bridging-loans" element={<AdLandingBridgingLoans />} />
        {/* Internal chatbot test page — outside Layout, noindex'd, not in the
            sitemap, not linked from anywhere. See src/pages/ChatbotTest.jsx. */}
        <Route path="/internal/chatbot-preview" element={<ChatbotTest />} />
      </Routes>
    </>
  );
}

export default App;
