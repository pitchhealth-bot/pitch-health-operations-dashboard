# Pitch Health Operations Dashboard

Internal Licensing & Contracting dashboard for Pitch Health Solutions.

## Data model
Airtable is the source of truth. The dashboard reads Airtable server-side using a Personal Access Token.

## Environment variables
Copy `.env.example` to `.env.local` for local development or set the variables in Vercel.

- `AIRTABLE_PAT`
- `AIRTABLE_BASE_ID`
- `AIRTABLE_AGENTS_TABLE` (defaults to `Agents`)

If Airtable variables are not configured, the app renders sample data so the UI can be reviewed safely.

## Initial Airtable field mapping
The first pass recognizes these fields where present:

- Name / Agent Name
- Email / Personal email / PHS Email
- Stage / Pipeline Stage
- Sub-Stage / Sub Stage
- Stage Entered Date / Days in Stage
- Owner / Assigned To
- Blocker Details / Blocker
- Blocker Status / Blocker Type
- Missing Fields, or SSN / DOB / Discord / PDB / NPN
- License Expiration / License Expiry
- Hierarchy Verified
- Carrier RTS Summary / RTS Summary
- CE Due Date

## Run locally

```bash
npm install
npm run dev
```
