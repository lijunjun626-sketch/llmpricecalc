# LLM Price Calc

Source for [llmpricecalc.com](https://llmpricecalc.com/), an independent collection of LLM API pricing calculators, model comparisons, and cost guides.

The site is static HTML, CSS, and JavaScript. Open `index.html` through a local static HTTP server for development.

## Key pages

- `/` — Claude Haiku 5.5 pricing calculator
- `/llm-api-pricing/` — multi-model LLM API price comparison and calculator
- `/claude-api-pricing/` — Claude API pricing hub
- `/gemini-4-carbon-pricing/` — Gemini 4 Carbon Developer API calculator, including the December 1, 2026 rate change
- `/claude-fable-5-2-pricing/` — Claude Fable 5.2 standard, Fast, and Batch calculator
- `/step-5-preview-pricing/` — Step 5 Preview pricing guide
- Model comparison and newly released model pricing pages

## Checks

There is no site build. Run `npm test` before publishing. Preview with any static file server, for example `python3 -m http.server 8765`.

## Publishing

Verify canonical URLs, `sitemap.xml`, `robots.txt`, pricing sources, and verification dates before deployment. The site is static files. This repository does not contain a deployment workflow or production credentials.
