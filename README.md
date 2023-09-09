# **communique**

A web platform that enables sharing, browsing & generation of email message templates.

Let the collective voice rise.

## Stack

- Frontend: [SvelteKit](https://kit.svelte.dev/), [tailwindcss](https://tailwindcss.com/), [TinyMCE](https://www.tiny.cloud/docs/tinymce/6/)
- Database: [CockroachDB](https://www.cockroachlabs.com/docs/)
- Object-relational mapping: [Prisma](https://www.prisma.io/cockroachdb)

## Running locally for development

1. Install [Node.js v18.x](https://nodejs.org/en/download/)
2. Download dependencies into app directory with `npm install`
3. Define or stub environment variables listed below into a `.env` file at repo root

   ```.env

   TINYMCE_KEY={Public client token for TinyMCE editor}

   DATABASE_URL={Cockroachdb connection URL for Prisma}

   DISCORD_CLIENT_SECRET={Authorization token for Discord}
   DISCORD_CLIENT_ID={Authorization ID for Discord}
   AUTH_SECRET={Cryptography seed for auth.js}
   ```

4. Run development server on `localhost:5173` with `npm run dev`

## Notes

Versioning is done on a milestone basis—these milestones are themed by project board. [Find them here.](https://github.com/orgs/communisaas/projects)
