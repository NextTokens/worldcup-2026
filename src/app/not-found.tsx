// Global fallback for routes outside the [locale] segment.
// Renders its own document because the html/body live in [locale]/layout.tsx.
export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: 'system-ui, sans-serif',
          display: 'flex',
          minHeight: '100dvh',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <p>
          Page not found. <a href="/">Go home</a>
        </p>
      </body>
    </html>
  );
}
