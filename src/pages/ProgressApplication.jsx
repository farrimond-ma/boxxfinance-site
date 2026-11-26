import React from 'react';
import ApplicationForm from '../components/ApplicationForm';

// Reached via a client's personal chase link (?t=...) after an email/SMS follow-up — see
// ApplicationForm for the shared field set and submission logic.
const ProgressApplication = () => (
    <ApplicationForm
        /* "Application" came out on 2026-11-26 (Mark's call): at this stage nobody has
           applied for anything, and the word implies credit checks and commitment, which
           puts people off answering. The URL stays /progress-your-application because
           client chase links already in the wild point at it, and the page is noindex so
           there is no SEO cost to the mismatch. */
        heroTitle={<>A Few More <span className="text-highlight">Details</span></>}
        heroSubtitle="Tell us a bit more about the property and the plan, and we can get you accurate terms."
        seoTitle="Your Bridging Loan Details"
        seoDescription="Share a few more details about your property and plans so your Boxx Finance adviser can get you accurate bridging loan terms."
        /* Left as-is: this is the CRM's funding-type label, not visitor-facing copy. */
        fundingTypeLabel="Progress Application (Bridging)"
        enableTokenLookup={true}
        showQuestionsLink={true}
        factFindLayout={true}
    />
);

export default ProgressApplication;
