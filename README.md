# Tally

Tally helps you keep every recurring charge, reminder, and linked account in one place so you can see how much you really spend on subscriptions.

## What you get out of the box

- **Unified dashboard** with an overall, monthly, and yearly view of spend broken down by categories such as Entertainment, Productivity, Finance, and more. The donut chart and category drill-downs help highlight where the wallet leak happens.
- **Subscriptions tab** that shows active and wishlist services as cards where you can edit metadata, delete entries, or link each subscription to a stored credential.
- **Add / edit workflow** that supports billing type selection (monthly, yearly, lifetime), credential linking, start dates, renewal reminders powered by Expo Notifications, and heuristic suggestions for common services such as Netflix, ChatGPT, or Microsoft 365.
- **Credential store** that masks sensitive values and keeps your personal, work, or mobile accounts handy for linking with subscriptions.
- **Realtime reminders** that schedule or cancel notifications whenever a subscription with reminders enabled is created, updated, or deleted.

## Architecture overview

- `app/` is the Expo Router entry point. `_layout.tsx` bootstraps the database, applies the theme, and hosts `(tabs)` and the `add-subscription` modal screen.
- `(tabs)/` contains the dashboard, subscriptions list, settings, and wishlist views with shared patterns for analytics, filtering, and presentation.
- `components/` holds reusable UI such as the credential reveal control, animated waves, and the collapsible drawer used across tabs.
- `lib/db/` manages the SQLite-backed persistence layer for subscriptions and credentials, including schema migrations and helper conversions.
- `lib/reminders.ts` connects with `expo-notifications` so reminders survive across launches.
- `hooks/` expose color scheme helpers that keep the app in sync with device theming.
- `constants/theme.ts` centralizes colors, spacing, and typography tokens for consistent styling.

## Setup

1. Install dependencies with `npm install`.
2. Run the project with `npx expo start` (or use `npm run android`, `npm run ios`, `npm run web` for platform-specific consoles).

## Helpful scripts

- `npm run start` – starts the Expo Metro bundler (`npx expo start`).
- `npm run android` / `npm run ios` / `npm run web` – open the project directly in the platform simulator or browser.
- `npm run lint` – runs `expo lint` over the workspace.
- `npm run reset-project` – archives the current `app/` tree to `app-example/` and regenerates a fresh `app/` directory so you can start over without losing this setup.

## Data insights & persistence

- Every subscription record lives in `subscriptions.db` via `expo-sqlite`. The schema stores metadata such as category, billing type, amount, linked credential, notes, and reminder configuration.
- Credentials are managed in the same database and exposed through `CredentialReveal`, so you never copy plaintext secrets into the UI.
- The analytics pane calculates spend by iterating subscriptions and adjusting contributions based on billing cadence, wishlist toggles, and the year/month selectors.
