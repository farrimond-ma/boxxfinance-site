import { serviceContent } from './services';

// Which services the site promotes, kept out of services.jsx so that file
// exports only its content object (react-refresh objects to a JSX module
// exporting loose constants).

// The six services the business is concentrating on (decided 2026-09).
// Everything the site *promotes* is driven off this list — the homepage grid,
// the funding-solutions grid, the "you may also need" cards — so narrowing
// the focus is one edit here rather than six edits across components.
export const FOCUS_SERVICES = [
    'bridging-loans',
    'development-finance',
    'buy-to-let-refinance',
    'bad-credit-mortgages',
    'second-charge-mortgages',
    'secured-loans',
];

// Everything else. Still live, still in the sitemap, but only linked from the
// "Other funding we arrange" row at the foot of /funding-solutions — enough to
// keep them crawlable without promoting them. Deliberately derived rather than
// listed, so a service added to services.jsx can never be silently orphaned.
export const RETIRED_SERVICES = Object.keys(serviceContent).filter(
    (slug) => !FOCUS_SERVICES.includes(slug)
);

// Where an enquiry from a de-listed service should now land. All of them point
// at secured loans: it is the broadest of the six, and each de-listed product
// is at root "an owner or business raising money", which secured borrowing
// answers. Used by serviceCtaTo so the CTAs on the ~76 existing blog and
// location pages written for those services feed a focus service instead.
export const RETIRED_SERVICE_CTA = 'secured-loans';
