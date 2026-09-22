import React from 'react';
import ApplicationForm from '../components/ApplicationForm';

// Paid-traffic (Facebook) landing page sending cold clicks straight to the repossession fact
// find, rather than a generic enquiry form — every field here maps straight onto the CRM's Fact
// Find tab (see ApplicationForm). No ?t=... link exists for this traffic, so it always submits
// as a brand new lead/case, never a pre-filled existing one.
const AdStopRepossession = () => (
    <ApplicationForm
        heroTitle="Worried about repossession?"
        heroSubtitle="Complete your details below and we will help you to prevent it"
        seoTitle="Stop Repossession with a Bridging Loan | Boxx Finance"
        seoDescription="Facing repossession or receivership? A bridging loan can pay off your existing mortgage and give you time to get back on track. Complete your details and we'll help."
        fundingTypeLabel="Stop Repossession (Bridging)"
        enableTokenLookup={false}
        showQuestionsLink={true}
        multiStep={true}
    />
);

export default AdStopRepossession;
