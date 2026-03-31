# GDG Vibe Coding SEO Scanner

A React/Next.js site to scan any URL and generate an SEO report with metadata, headings, links, and image checks.

## Features

- Submit any public URL
- Server-side fetch (API route) to avoid CORS issues
- Extract:
  - title, meta description, canonical, robots, viewport, lang
  - headings (H1–H3)
  - images + missing alt
  - links (internal/external and rel flags)
  - performance status code and fetch time

## Local development

1. Install dependencies

```bash
npm install
```

2. Start dev server

```bash
npm run dev
```

3. Open http://localhost:3000

## Deploy to Vercel

1. Push repo to GitHub
2. Connect project in Vercel dashboard
3. Set framework: Next.js
4. Build command: `npm run build`
5. Output directory: `.next`

## Notes

- The scanner uses a server-side API route in `pages/api/scan.js`.
- For more advanced SEO checks (a11y, schema, lighthouse), extend the API route or add worker functions.
