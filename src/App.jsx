import React from 'react';
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
import NotFound from './pages/NotFound';
import ContentDashboard from './pages/ContentDashboard';
import './App.css';
import ScrollToTop from './components/ScrollToTop';
import LocationPage from './pages/LocationPage';
import Locations from './pages/Locations';
import FundingSolutions from './pages/FundingSolutions';

function App() {
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
          <Route path="privacy-policy" element={<PrivacyPolicy />} />
          <Route path="legal-disclaimer" element={<LegalDisclaimer />} />
          <Route path="terms-and-conditions" element={<TermsConditions />} />
          {/* Single page only. The old /uk-sme-funding-index/:archiveSlug routes
              served 61 months of fabricated "archives" and now return 410 Gone. */}
          <Route path="uk-sme-funding-index" element={<SmeFundingIndex />} />
          <Route path="locations" element={<Locations />} />
          <Route path="locations/:slug" element={<LocationPage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
        {/* Dashboard sits outside Layout — no navbar, no footer */}
        <Route path="/dashboard" element={<ContentDashboard />} />
      </Routes>
    </>
  );
}

export default App;
