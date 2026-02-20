# GNOME Work Tracker

A time-tracking application with a web dashboard and GNOME Shell extension for one-click project switching from the desktop panel.

## Architecture

- **packages/server** - Hono API server with Prisma ORM, SQLite, and Better Auth
- **packages/web** - React SPA with Vite, Tailwind CSS v4, and shadcn/ui
- **packages/gnome-extension** - GNOME Shell extension (GJS) with panel buttons

## Prerequisites

- [Bun](https://bun.sh) (v1.0+)
- GNOME Shell 45-49 (for the extension)

## Quick Start (Development)

```bash
# 1. Install dependencies
bun install

# 2. Configure environment
cp packages/server/.env.example packages/server/.env
cp packages/web/.env.example packages/web/.env

# 3. Generate a secret for Better Auth
openssl rand -base64 32
# Paste the output into packages/server/.env as BETTER_AUTH_SECRET

# 4. Set up the database
bun run db:generate
bun run db:migrate

# 5. Start both server and web app
bun run dev
```

The server runs at `http://localhost:3000` and the web app at `http://localhost:5173`.

## Environment Variables

### Server (`packages/server/.env`)

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | SQLite database path | `file:./dev.db` |
| `BETTER_AUTH_SECRET` | Auth signing secret (32+ chars) | - |
| `BETTER_AUTH_BASE_URL` | Public URL of the server | `http://localhost:3000` |
| `PORT` | Server listen port | `3000` |
| `CORS_ORIGIN` | Allowed CORS origin (web app URL) | `http://localhost:5173` |

### Web (`packages/web/.env`)

| Variable | Description | Default |
|---|---|---|
| `VITE_API_URL` | Server API base URL | `http://localhost:3000` |

## Available Scripts

Run from the repository root:

| Script | Description |
|---|---|
| `bun run dev` | Start server and web app concurrently |
| `bun run dev:server` | Start only the API server |
| `bun run dev:web` | Start only the web app |
| `bun run build:web` | Build the web app for production |
| `bun run db:generate` | Generate Prisma client |
| `bun run db:migrate` | Run database migrations |
| `bun run db:studio` | Open Prisma Studio |

## Docker Deployment

The quickest way to deploy both the server and web app:

```bash
# 1. Create your .env from the template
cp .env.example .env

# 2. Generate and set your auth secret
echo "BETTER_AUTH_SECRET=$(openssl rand -base64 32)" >> .env

# 3. Build and start
docker compose up -d
```

The web app is available at `http://localhost:8080` and the API server at `http://localhost:3000`.

SQLite data is persisted in a Docker volume (`db-data`).

To customize for a production domain, edit `.env`:

```bash
BETTER_AUTH_SECRET=your-secret-here
BETTER_AUTH_BASE_URL=https://api.tracker.example.com
VITE_API_URL=https://api.tracker.example.com
CORS_ORIGIN=https://tracker.example.com
```

Then rebuild the web container (since `VITE_API_URL` is baked in at build time):

```bash
docker compose up -d --build web
```

## Manual Production Deployment

### Server

```bash
# Build is not required — Bun runs TypeScript directly
cd packages/server
cp .env.example .env
# Edit .env with production values:
#   DATABASE_URL — path to your SQLite file
#   BETTER_AUTH_SECRET — generate with: openssl rand -base64 32
#   BETTER_AUTH_BASE_URL — your public server URL (e.g. https://tracker.example.com)
#   PORT — port to listen on
#   CORS_ORIGIN — your web app's public URL

# Run migrations
bunx --bun prisma generate
bunx --bun prisma migrate deploy

# Start
bun run src/index.ts
```

You can run the server behind a reverse proxy (nginx, Caddy, etc.) for TLS and domain routing.

### Web App

```bash
cd packages/web
cp .env.example .env
# Set VITE_API_URL to your production server URL

bun run build
```

This produces a `dist/` folder with static files. Serve them with any static file server (nginx, Caddy, etc.):

```nginx
# Example nginx config
server {
    listen 80;
    server_name tracker.example.com;
    root /path/to/packages/web/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### GNOME Shell Extension

```bash
cd packages/gnome-extension
chmod +x install.sh
./install.sh
```

This copies files to `~/.local/share/gnome-shell/extensions/work-tracker@gnome-work-tracker/`.

After installing:

1. **Reload GNOME Shell**
   - Wayland: Log out and log back in
   - X11: `Alt+F2` then type `r`

2. **Enable the extension**
   ```bash
   gnome-extensions enable work-tracker@gnome-work-tracker
   ```

3. **Configure the extension** via `gsettings`:
   ```bash
   SCHEMA_DIR=~/.local/share/gnome-shell/extensions/work-tracker@gnome-work-tracker/schemas

   # Set your server URL
   gsettings --schemadir "$SCHEMA_DIR" set org.gnome.shell.extensions.work-tracker \
     server-url "http://localhost:3000"

   # Set your API token (from your user profile in the web app)
   gsettings --schemadir "$SCHEMA_DIR" set org.gnome.shell.extensions.work-tracker \
     api-token "your-token-here"
   ```

   Then click "Refresh Config" in the extension's panel menu to fetch your dashboard projects.
