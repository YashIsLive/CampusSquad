"use client";

/** Last-resort error page when the root layout itself fails. Must render its own <html>. */
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en-IN">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#f4f1ea", color: "#1a1714", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <main style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 24, marginBottom: 8 }}>CampusSquad is having a moment</h1>
          <p style={{ color: "#5d564c", marginBottom: 16 }}>Something broke on our side. Please try again in a few seconds.</p>
          <button
            type="button"
            onClick={() => retry()}
            style={{ background: "#c23c17", color: "#fff", border: 0, borderRadius: 8, padding: "10px 16px", fontSize: 15, cursor: "pointer" }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
