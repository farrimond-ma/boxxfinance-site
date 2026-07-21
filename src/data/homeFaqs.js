/**
 * Home page FAQs — rendered on the page AND emitted as FAQPage schema.
 *
 * Kept in one file so the two can never drift apart: a visible FAQ whose
 * answers differ from the structured data is a Google structured-data
 * violation, and the blog generator has already been bitten once by schema
 * and body copy disagreeing.
 *
 * Answers deliberately avoid specific rates, LTV percentages and completion
 * times. Those vary by lender and case, and publishing an unsourced figure on
 * a regulated firm's home page is a financial-promotion problem, not just an
 * accuracy one. Where a number is genuinely useful it should come from a cited
 * source (see smeFundingData.json for the Bank of England series already used
 * elsewhere on the site).
 */

export const HOME_FAQS = [
    {
        q: 'What is a bridging loan?',
        a: 'A bridging loan is short-term property finance used to cover a gap between needing funds and securing longer-term money or a sale. Terms are typically measured in months rather than years, and lenders assess the security and the exit plan rather than monthly affordability, so they suit time-critical purchases where a mortgage would be too slow.',
    },
    {
        q: 'What can a bridging loan be used for?',
        a: 'Common uses are auction purchases with tight completion deadlines, breaking a property chain, funding refurbishment or conversion work, buying before probate completes, and releasing equity while a sale goes through. They are also used by developers for site acquisition ahead of a development finance facility.',
    },
    {
        q: 'Who can apply for a bridging loan?',
        a: 'Homeowners, landlords, property investors, developers and businesses can all apply. Applications are accepted from individuals, limited companies, partnerships and trusts. Lending is secured against property, so the key questions are what the security is worth and how the loan will be repaid.',
    },
    {
        q: 'How is a bridging loan repaid?',
        a: 'Through an exit: usually the sale of a property, refinancing onto a mortgage or development facility, or another defined source of funds. Interest is often retained or rolled up and settled at the end rather than paid monthly. Lenders will want the exit evidenced, so a credible plan matters more than a headline rate.',
    },
    {
        q: 'What is the difference between an open and a closed bridging loan?',
        a: 'A closed bridge has a fixed repayment date, typically because a sale has already exchanged. An open bridge has no fixed date, only an intended exit. Closed bridges are usually priced more keenly because the lender can see exactly when they will be repaid.',
    },
    {
        q: 'Do you arrange finance other than bridging loans?',
        a: 'Yes. Alongside bridging loans we arrange asset finance, asset refinance, business loans, commercial mortgages, development finance, invoice finance, merchant cash advances, structured finance, and tax and VAT funding for UK businesses.',
    },
    {
        q: 'Are you a lender or a broker?',
        a: 'We are a commercial finance broker. We do not lend our own money — we assess your requirement and place it with lenders whose criteria and pricing fit the case, which means the structure is chosen around your circumstances rather than around a single lender\'s product range.',
    },
];

/** FAQPage structured data built from the same source as the visible list. */
export const homeFaqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: HOME_FAQS.map(({ q, a }) => ({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a },
    })),
};
