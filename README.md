# Portfolio V5 Template

A shareable Next.js portfolio template with GSAP motion, WebGL fluid effects, React Three Fiber scenes, and a built-in multimodal AI chatbot demo.

Visual structure and interaction patterns are adapted from the award-winning site [giats.me](https://giats.me).

> Original portfolio design and development by Evangelos Giatsidis — [giats.me](https://giats.me)

## Quick start

```bash
git clone https://github.com/Malikkun09/portofoliov5-template.git
cd portofoliov5-template
npm install
cp .env.example .env.local   # optional — only needed for live chatbot API calls
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Customize

1. Edit `src/constants/profile.js` — name, location, contact, and site URL.
2. Edit `src/constants/projects.js` — project list, colors, images, and descriptions.
3. Replace placeholder copy in `src/pages/components/` and `src/pages/about/`.
4. Update `public/` favicons, `og.png`, and manifest files for your brand.
5. Set `siteUrl` in `next-sitemap.config.js` before deploying.

## Chatbot (`/projects/chatbot`)

The template includes a multimodal chat demo (text, image, MP4, files) with session memory and a 30-minute media purge. It builds and runs without API keys; live AI responses require server-side keys.

Set these **server-only** variables on Vercel (Production + Preview). Do not commit secrets.

| Variable | Required | Notes |
| --- | --- | --- |
| `NVIDIA_API_KEY` | Primary | NVIDIA Integrate API key. `NVAPI_KEY` also works. |
| `OPENROUTER_API_KEY` | Recommended | Free-account key for `:free` multimodal fallback when NVIDIA is rate-limited. |
| `OPENROUTER_API_KEYS` | Optional | Extra OpenRouter keys, comma or newline separated. |
| `OPENROUTER_MODEL` | Optional | Override the first OpenRouter model. |
| `OPENROUTER_FALLBACK_MODELS` | Optional | Comma-separated extra OpenRouter model ids. |
| `OPENROUTER_SITE_URL` / `OPENROUTER_APP_NAME` | Optional | Referer metadata for OpenRouter. |

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start development server |
| `npm run build` | Production build (+ sitemap via `postbuild`) |
| `npm test` | Run Vitest unit tests |
| `npm run lint` | ESLint |

## Deploy

Deploy to [Vercel](https://vercel.com) or any Node host that supports Next.js 14. Add the chatbot env vars in your project settings if you want live AI responses on `/projects/chatbot`.

## License

MIT with attribution required. See `LICENSE`.
