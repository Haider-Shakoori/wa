# Bot Builder loopback-only staging gateway

This Nginx gateway is for isolated VPS staging only. Bind `127.0.0.1:3159:8080`; never expose it publicly or route production traffic here.

- `/` -> staging Next.js container on port 3158
- `/api/` -> staging NestJS API container on port 3157
- Staging API and PostgreSQL have no production credentials, databases, Redis or WhatsApp session access.
- Stripe provider is disabled in staging; no payment or live message sending is exercised.
- The staging DB contains only the minimal synthetic baseline plus migrations 056-061. It is **not** a fully functional account-registration or production-equivalent database.
- Do not merge/deploy to production on the basis of these smoke tests alone.
