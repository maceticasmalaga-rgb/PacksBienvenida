# MÁLAGA WELCOME

Web de catálogo y solicitudes de presupuesto para packs de bienvenida e higiene destinados a gestores de apartamentos turísticos de Málaga y la Costa del Sol.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- Open the managed `artifacts/malaga-welcome: web` workflow to run the website preview.
- `pnpm --filter @workspace/malaga-welcome run typecheck` — check the website package.
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/malaga-welcome/src/data/catalog.ts` — product and combo names, compositions, prices, images, and optional stock.
- `artifacts/malaga-welcome/src/data/business.ts` — WhatsApp, email, and legal-detail configuration; real details are intentionally blank until supplied.
- `artifacts/malaga-welcome/public/images/` — optimized product images provided by the user.
- `artifacts/api-server/src/routes/quotes.ts` — quote submission endpoint.
- `lib/db/src/schema/index.ts` — stored quote-request schema.
- `lib/api-spec/openapi.yaml` — source of truth for the API contract.

## Architecture decisions

- Quote submissions are non-binding leads stored in PostgreSQL; the site does not confirm orders or send an email notification.
- Product and bundle prices are editable site configuration. Bundle prices are proposed and must be confirmed before accepting an order.
- Stock starts unset; once stock values are entered, the quantity builder checks individual products and bundle components together.

## Product

- Presents four welcome/hygiene packs with product photos, contents, and VAT-inclusive prices.
- Shows three proposed combos and a custom quantity calculator.
- Collects quote requests and prepares a WhatsApp message without inventing a contact number.
- Includes draft legal and privacy pages that require business details and legal review before publication.

## User preferences

- Do not publish the website or start paid services without the user's authorization.
- Do not invent the business's contact details, legal identity, certifications, or customer reviews.

## Gotchas

- Legal and privacy text is explicitly a draft; complete and review it before publication.
- WhatsApp and email configuration values are blank until the business supplies them.
- Quote requests are saved to the database for the owner; no notification email is configured yet.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
