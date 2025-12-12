"use client";

// Minimal 404 page that completely avoids provider contexts
export default function NotFound() {
  return (
    <html lang="en">
      <head>
        <title>Page Not Found</title>
        <style
          dangerouslySetInnerHTML={{
            __html: `
            html, body {
              margin: 0;
              padding: 0;
              height: 100%;
              background: #000000;
              color: #ffffff;
              font-family: system-ui, -apple-system, sans-serif;
            }
            .notfound-container {
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              padding: 2rem;
              text-align: center;
            }
            .notfound-title {
              font-size: 4rem;
              font-weight: bold;
              margin-bottom: 1rem;
            }
            .notfound-subtitle {
              font-size: 1.5rem;
              font-weight: 600;
              margin-bottom: 1.5rem;
            }
            .notfound-message {
              color: #cccccc;
              margin-bottom: 2rem;
              font-size: 1.1rem;
              line-height: 1.6;
            }
            .notfound-link {
              display: inline-block;
              background: #3b82f6;
              color: white;
              text-decoration: none;
              padding: 0.75rem 1.5rem;
              border-radius: 0.5rem;
              transition: background-color 0.2s;
            }
            .notfound-link:hover {
              background: #2563eb;
            }
          `,
          }}
        />
      </head>
      <body>
        <div className="notfound-container">
          <div>
            <h1 className="notfound-title">404</h1>
            <h2 className="notfound-subtitle">Page Not Found</h2>
            <p className="notfound-message">The page you're looking for doesn't exist or has been moved.</p>
            <a href="/" className="notfound-link">
              Go Home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
