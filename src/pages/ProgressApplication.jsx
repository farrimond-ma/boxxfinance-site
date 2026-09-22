import React from 'react';
import ApplicationForm from '../components/ApplicationForm';

// Reached via a client's personal chase link (?t=...) after an email/SMS follow-up — see
// ApplicationForm for the shared field set and submission logic.
const ProgressApplication = () => (
    <ApplicationForm
        heroTitle={<>Progress Your <span className="text-highlight">Application</span></>}
        heroSubtitle="We just need a few more details so we can move your bridging loan forward."
        seoTitle="Progress Your Bridging Loan Application"
        seoDescription="Add a few more details so your Boxx Finance adviser can move your bridging loan application forward."
        fundingTypeLabel="Progress Application (Bridging)"
        enableTokenLookup={true}
        showQuestionsLink={true}
    />
);

export default ProgressApplication;
