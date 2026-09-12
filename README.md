# Malik Fajar — Portfolio

Personal portfolio of **Muhammad Malik Fajar El Syarif**, a PPLG student at SMK Informatika Fithrah Insani in Cimahi, Indonesia.

Live: [malikfajar.me](https://malikfajar.me)

The visual system, motion, and three-layer architecture are adapted from the award-winning site [giats.me](https://giats.me).

> Original portfolio design and development by Evangelos Giatsidis — [giats.me](https://giats.me)

## Stack

- **Framework:** Next.js (Pages Router)
- **3D & Canvas:** React Three Fiber, Rapier, custom WebGL fluid
- **Animation:** GSAP + ScrollTrigger, Lenis smooth scroll
- **Styling:** SCSS / CSS Modules

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Chatbot (`/projects/chatbot`)

Interactive multimodal chat (text, image, MP4, files) with session memory and a 30-minute media purge.

Set these **server-only** variables on Vercel (Production + Preview). Do not commit secrets.

| Variable | Required | Notes |
| --- | --- | --- |
| `NVIDIA_API_KEY` | Primary | NVIDIA Integrate API key. `NVAPI_KEY` also works. Values are trimmed. |
| `OPENROUTER_API_KEY` | Strongly recommended | Free account key for `:free` multimodal fallback when NVIDIA returns 429/503 quota errors. |
| `OPENROUTER_API_KEYS` | Optional | Extra OpenRouter keys, comma or newline separated. After NVIDIA fails, up to 3 keys are picked at random from the merged pool. |
| `OPENROUTER_MODEL` | Optional | Override the first OpenRouter model. Default is `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free`. `xiaomi/mimo-v2.5` is omnimodal but **paid**. |
| `OPENROUTER_FALLBACK_MODELS` | Optional | Comma-separated extra OpenRouter model ids. |
| `OPENROUTER_SITE_URL` / `OPENROUTER_APP_NAME` | Optional | Referer metadata for OpenRouter. |

There is no safe keyless public multimodal API. OpenRouter `:free` models still need `OPENROUTER_API_KEY`.

## License

The original source is MIT with attribution required. See `LICENSE`.
