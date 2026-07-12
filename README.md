# asas-runner

Hosted runner for **Asas**. The Asas app fires a `repository_dispatch` (type `ship`) with a
project payload; this Action generates a branded site (`scaffold`) or an AI-built v1 (`build`,
via the `GEMINI_API_KEY` secret) into `public/sites/<name>/`, commits it, and deploys **GitHub
Pages**. No Cloudflare token needed.

Live sites: `https://jilaltahadi-create.github.io/asas-runner/sites/<name>/`

Secrets: `GEMINI_API_KEY` (for `build` mode).
