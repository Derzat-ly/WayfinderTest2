# Auth options for Organiser sign-up and login

Research for the ticket "Managed auth options for Organiser sign-up" on the map "Wayfinder map: Group Meetings MVP spec".
Researched 2026-09-28 against official docs and pricing pages. **Facts only, no recommendation.** The choice belongs to "What stack and hosting should the MVP use?".

Domain framing: the **Organiser** is the only account holder. **Members** are contacts who never log in, so they never count toward any provider's MAU/MRU. Each Organiser sees only their own Members, Groups and Meetings. That scoping is application authorization, and none of the options below enforce it for you. (Supabase can express it as Postgres Row Level Security keyed on the user id.)

Options compared (the 6 most relevant today):

- Managed: **Clerk**, **Auth0**, **Supabase Auth**, **Firebase Authentication**, **WorkOS AuthKit**
- Self-hosted library: **Better Auth** (which now also maintains **Auth.js / NextAuth.js**)

## Summary table

| | Clerk | Auth0 | Supabase Auth | Firebase Auth | WorkOS AuthKit | Better Auth |
|---|---|---|---|---|---|---|
| Model | Managed SaaS | Managed SaaS | Managed (auth data lives in your project's Postgres) | Managed (Google) | Managed SaaS, hosted UI | Self-hosted OSS library (MIT) |
| Email magic link | Yes (free) | Yes, but **Classic Login only**; email OTP otherwise | Yes (plus 6-digit email OTP) | Yes (email link) | **6-digit code** ("Magic Auth"), not a link | Yes, via plugin; you send the email |
| Password | Yes | Yes | Yes | Yes | Yes | Yes |
| Google / OAuth | Yes; **up to 3 social connections on free** | Yes; unlimited social on free | Yes; 19 social providers | Yes | Yes | Yes |
| Free tier | 50,000 MRU per app | 25,000 MAU | 50,000 MAU (project pauses after 1 week inactive) | 50,000 MAU (Spark) | 1,000,000 MAU | Free (you pay hosting + DB + email) |
| First paid step | Pro $25/mo ($20 annual), 50k MRU incl., then $0.02/MRU | Essentials from $35/mo at 500 MAU | Pro from $25/mo, 100k MAU incl., then $0.00325/MAU | Blaze pay-as-you-go beyond 50k MAU | $2,500/mo per extra 1M MAU; custom domain $99/mo | n/a |
| Next.js | First-party SDK | First-party quickstart | `@supabase/ssr` guide | JS SDK (no dedicated Next.js auth SDK found) | First-party SDK | First-party handler |
| Other frameworks (examples) | React Router, Astro, Nuxt, TanStack Start, Express; Svelte community-maintained | Express, Nuxt, TanStack Start, Django, Rails, Laravel | SvelteKit guide | Any JS (web SDK) | React Router, TanStack Start, Remix, SvelteKit, Node/Express | Nuxt, SvelteKit, React Router, Astro, Hono, Express, TanStack Start |
| Password-hash export | Yes, dashboard CSV includes hashes | Only by support ticket; **not on Free tier** | Yes, it is in your own Postgres (`auth` schema) | Yes, via CLI `auth:export` plus hash params from console | Export not documented (import only) | N/A, the data is already in your DB |

## Per-option facts

### Clerk

- Free "Hobby": "50,000 MRU limit per app". MRU (Monthly Retained User) counts a user only if they return "at least one day after signing up" ("First Day Free"). [clerk.com/pricing](https://clerk.com/pricing)
- Pro: $25/mo, or $20/mo billed annually. It includes 50,000 MRU, then $0.02/MRU. Business: $300/mo. [clerk.com/pricing](https://clerk.com/pricing)
- On free: email magic links, passwords, social OAuth (up to 3), custom domain. Removing Clerk branding, MFA and passkeys are Pro. [clerk.com/pricing](https://clerk.com/pricing)
- SDKs: Next.js, React, React Router, TanStack React Start, Astro, Nuxt, Vue, Express, Fastify, plus backend SDKs (Go, Python, Ruby on Rails, PHP, etc.). Svelte and Hono are community-maintained. [clerk.com/docs](https://clerk.com/docs)
- Lock-in and migration: user records are held by Clerk. Admins can "export and download a CSV file containing a list of their application's users that _includes their hashed passwords_". [Clerk migration overview](https://clerk.com/docs/guides/development/migrating/overview)

### Auth0 (Okta)

- Free: "Up to 25,000 monthly active users", no credit card. Passwordless is included, social connections are unlimited, and 1 custom domain is included (credit-card verification required). [auth0.com/pricing](https://auth0.com/pricing)
- Paid B2C Essentials: $35/mo at 500 MAU, $70 at 1,000, $175 at 2,500, $350 at 5,000. Professional: $240/mo at 500 to 1,000 MAU. [auth0.com/pricing](https://auth0.com/pricing)
- Passwordless supports email OTP codes and magic links, but "Magic links can only be implemented in Classic Login" (not Universal Login). [Auth0 passwordless docs](https://auth0.com/docs/authenticate/passwordless)
- Regular web app quickstarts: Next.js, Express, Fastify, Hono, TanStack Start, Nuxt, Django, Flask, FastAPI, Laravel, Rails, ASP.NET Core, Spring Boot, Go. [auth0.com/docs/quickstarts](https://auth0.com/docs/quickstarts)
- Lock-in and migration: "The only information which is not available through the API (for security reasons) are the password hashes... You can still request this information by opening a support ticket." That operation "is not available for our Free subscription tier". [Auth0 export data](https://auth0.com/docs/troubleshoot/customer-support/manage-subscriptions/export-data)

### Supabase Auth

- Free: 50,000 MAU. Pro from $25/mo with 100,000 MAU, then $0.00325/MAU. "Free projects are paused after 1 week of inactivity." Removing Supabase branding from emails needs Pro or higher. [supabase.com/pricing](https://supabase.com/pricing)
- Methods: email and password, magic links, email/SMS OTP, 19 social providers (incl. Google), phone, SSO, MFA. [Supabase Auth docs](https://supabase.com/docs/guides/auth) Magic links and email OTP can be requested "once every 60 seconds" and "expire after 1 hour". [Passwordless email](https://supabase.com/docs/guides/auth/auth-email-passwordless)
- Email caveat: the built-in SMTP sends only "2 messages per hour", and only to team members' addresses. Production needs custom SMTP; the rate starts at 30/hour and is adjustable. [Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- Frameworks: the `@supabase/ssr` cookie-based guides cover Next.js and SvelteKit. [Server-side auth](https://supabase.com/docs/guides/auth/server-side)
- Data ownership: "Auth uses your project's Postgres database under the hood, storing user data... in a special schema." [Supabase Auth docs](https://supabase.com/docs/guides/auth) App tables reference `auth.users` by primary key, and you can export users with `select * from auth.users`. [Managing user data](https://supabase.com/docs/guides/auth/managing-user-data)

### Firebase Authentication

- Spark (free): "No-cost up to 50K MAUs". SAML/OIDC is free only up to 50 MAUs. Blaze bills beyond that at Google Cloud Identity Platform rates. Phone auth is billed per SMS. [firebase.google.com/pricing](https://firebase.google.com/pricing)
- Email-link sign-in sending limit: **Spark 5 emails/day**, Blaze 25,000/day. Password reset: Spark 150/day, Blaze 10,000/day. Sign-ups are limited to 100 accounts/hour per IP. [Auth limits](https://firebase.google.com/docs/auth/limits)
- Methods: email and password, email link, Google and other federated providers, phone.
- Frameworks: web JS SDK. No first-party Next.js-specific auth SDK was found in the docs reviewed.
- Lock-in and migration: `firebase auth:export` exports users, and the console exposes "Password Hash Parameters" (modified scrypt) needed to verify the hashes elsewhere. [CLI auth import/export](https://firebase.google.com/docs/cli/auth), [Import users](https://firebase.google.com/docs/auth/admin/import-users) WorkOS, for example, accepts `firebase-scrypt` hashes on import. [WorkOS migration](https://workos.com/docs/migrate/other-services)

### WorkOS AuthKit

- User management is free for the "First 1M MAUs". Each additional 1M MAU costs $2,500/mo. A custom domain is $99/mo. Enterprise SSO starts at $125 per connection. [workos.com/pricing](https://workos.com/pricing)
- Includes email and password, social login, passkeys, MFA and Magic Auth. [workos.com/pricing](https://workos.com/pricing) Magic Auth is a "six digit one-time-use code sent to their email inbox" (expires in 10 minutes), not a clickable link. [Magic Auth docs](https://workos.com/docs/authkit/magic-auth)
- Integration: a hosted sign-in page redirects back to your callback, which exchanges a code for a sealed session cookie. Guides cover Next.js, React Router, TanStack Start, Remix, SvelteKit and Node/Express. [AuthKit Node guide](https://workos.com/docs/authkit/vanilla/nodejs)
- Lock-in and migration: import supports bcrypt, scrypt, pbkdf2, firebase-scrypt, argon2 and more. The migration docs do not describe exporting users or password hashes *out* of WorkOS. [WorkOS migration](https://workos.com/docs/migrate/other-services)

### Better Auth (and Auth.js / NextAuth.js)

- MIT-licensed, "framework-agnostic authentication (and authorization) framework for TypeScript". [GitHub](https://github.com/better-auth/better-auth)
- Databases: PostgreSQL, MySQL and SQLite directly, plus Prisma, Drizzle, MongoDB and Kysely adapters. A CLI `generate` command emits a schema or migration, and `migrate` creates tables in your DB. [Installation](https://www.better-auth.com/docs/installation)
- Frameworks with handlers: Next.js (App and Pages Router), Nuxt, SvelteKit, React Router, Solid Start, Astro, Hono, Express, Elysia, TanStack Start, Cloudflare Workers. [Installation](https://www.better-auth.com/docs/installation) In Next.js you mount `/api/auth/[...all]` with `toNextJsHandler`. [Next.js integration](https://www.better-auth.com/docs/integrations/next)
- Magic link is a plugin: "The `sendMagicLink` function is called when a user requests a magic link". You supply the email delivery, for example via a transactional email provider. [Magic link plugin](https://www.better-auth.com/docs/plugins/magic-link)
- Cost: no vendor fee. You run the DB, hosting and email sender yourself, and you own the security patching.
- Auth.js: on 2025-09-22 it was announced that "Auth.js, formerly known as NextAuth.js, is now being maintained and overseen by Better Auth team". The team "strongly recommend[s] new projects to start with Better Auth" unless they need stateless sessions without a database. Existing Auth.js users get security patches. [Announcement](https://www.better-auth.com/blog/authjs-joins-better-auth)
- Lock-in: user, session and account tables live in your own database.

## Facts the stack decision will hinge on

1. **Magic-link semantics differ.** Real clickable links are offered by Clerk, Supabase, Firebase and Better Auth. Auth0 offers them only in Classic Login. WorkOS sends a 6-digit code instead.
2. **Email sending is on you** with Better Auth (always) and Supabase (custom SMTP needed beyond 2 emails/hour to team members). Firebase free Spark allows only 5 email-link sign-in emails/day.
3. **Data location:** only Supabase and Better Auth keep user rows in *your* Postgres, so Organiser-scoped data can foreign-key to them directly. Clerk, Auth0, Firebase and WorkOS hold users externally, and you store their user id.
4. **Exit cost:** Clerk and Firebase give self-serve hash export. Auth0 requires a support ticket and paid tier. WorkOS documents no export. Supabase and Better Auth data is already yours.
5. **Free headroom** far exceeds MVP scale everywhere: 25k (Auth0), 50k (Clerk MRU, Supabase, Firebase), 1M (WorkOS). Only Organisers count, since Members never log in. The practical free-tier gotchas are Supabase pausing after 1 week of inactivity, Clerk branding, and Firebase Spark's email-link cap.
6. **Framework coverage:** everything supports Next.js. Breadth beyond it is widest for Clerk, Auth0 and Better Auth. Supabase's SSR guides cover Next.js and SvelteKit.
