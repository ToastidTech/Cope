# Cope AWS Deployment

Cope now has an AWS-first backend pattern matching the Toastid Cloud direction used by BiteFact.

## Runtime

- PWA and API are served by the same Node.js/Express container.
- Container port: `8080`.
- Health check: `GET /health`.
- AI endpoint: `POST /api/cope-ai`.
- AI provider: Anthropic Messages API.
- API credential: server-side only via `ANTHROPIC_API_KEY`.
- Optional model override: `COPE_MODEL` (defaults to `claude-opus-4-8`).
- Optional CORS origin: `COPE_ALLOWED_ORIGIN`.

## AWS secret

Store the Anthropic API key in AWS SSM Parameter Store and inject it into the ECS task as the container environment variable `ANTHROPIC_API_KEY`.

Do not put the Anthropic key in the PWA, GitHub source, Docker image build arguments, or client-side JavaScript.

## Security

The API applies a 20-request-per-IP rolling limit over 10 minutes, validates the conversation payload, caps message sizes, and never exposes the Anthropic credential to the browser.

## Frontend cutover

The Docker build runs `prepare.js` before the application starts. That build step removes the legacy browser-side Cloudflare AI endpoint and shared API key from the served frontend and points Cope AI at `/api/cope-ai`.

The legacy Cloudflare Worker files remain in the repository temporarily because the existing payment-confirmation flow still references the worker. They are not used by the new Cope AI path.

## Model note

The old Cope frontend referenced Claude Opus 4.1. Anthropic retired Opus 4.1 on August 5, 2026, so the AWS backend defaults to the active Claude Opus 4.8 model instead.
