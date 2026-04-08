import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import locationPages from "../data/locationPages.json";

export default function LocationPage() {
  const { slug } = useParams();

  const cleanSlug = slug ? slug.replace(/\.html$/, "") : "";

  const page = locationPages.find(
    (item) => item.slug === cleanSlug && item.status === "published"
  );

  const pageStyle = {
    paddingTop: "140px",
    paddingRight: "40px",
    paddingBottom: "40px",
    paddingLeft: "40px",
    maxWidth: "900px",
    margin: "0 auto"
  };

  if (!page) {
    return (
      <>
        <Helmet>
          <title>Page Not Found | Boxx Commercial Finance</title>
          <meta
            name="description"
            content="The page you are looking for could not be found."
          />
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>

        <main style={pageStyle} data-page-type="location-not-found">
          <h1>Page not found</h1>
          <p>The page you are looking for does not exist.</p>
        </main>
      </>
    );
  }

  const canonicalUrl = `https://boxxfinance.co.uk/locations/${page.slug}`;
  const pageTitle = page.metaTitle || `${page.title} | Boxx Commercial Finance`;
  const pageDescription =
    page.metaDescription ||
    `Explore funding options with Boxx Commercial Finance in ${page.location}.`;

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <meta
          name="keywords"
          content={`${page.title.toLowerCase()}, ${page.location.toLowerCase()} business finance, uk commercial finance`}
        />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:url" content={canonicalUrl} />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDescription} />

        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FinancialService",
            name: "Boxx Commercial Finance",
            url: canonicalUrl,
            areaServed: page.location,
            description: pageDescription,
            serviceType: page.service,
            provider: {
              "@type": "Organization",
              name: "Boxx Commercial Finance",
              url: "https://boxxfinance.co.uk"
            }
          })}
        </script>
      </Helmet>

      <main style={pageStyle} data-page-type="location-page">
        <h1>{page.title}</h1>
        <div dangerouslySetInnerHTML={{ __html: page.content }} />
        <div style={{ marginTop: "40px" }}>
          <h3>Speak to Boxx Commercial Finance</h3>
          <p>
            <a href="/chat-about-funding">Start your enquiry here</a>
          </p>
        </div>
      </main>
    </>
  );
}
