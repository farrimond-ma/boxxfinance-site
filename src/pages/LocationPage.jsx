import { useParams } from "react-router-dom";
import locationPages from "../data/locationPages.json";

export default function LocationPage() {
  const { slug } = useParams();

  const page = locationPages.find(
    (item) => item.slug === slug && item.status === "published"
  );

  if (!page) {
    return (
      <main style={{ padding: "40px" }}>
        <h1>Page not found</h1>
        <p>The page you are looking for does not exist.</p>
      </main>
    );
  }

  return (
    <main style={{ padding: "40px", maxWidth: "900px", margin: "0 auto" }}>
      <h1>{page.title}</h1>

      <div
        dangerouslySetInnerHTML={{ __html: page.content }}
      />

      <div style={{ marginTop: "40px" }}>
        <h3>Speak to Boxx Commercial Finance</h3>
        <p>
          <a href="/chat-about-funding">
            Start your enquiry here
          </a>
        </p>
      </div>
    </main>
  );
}
