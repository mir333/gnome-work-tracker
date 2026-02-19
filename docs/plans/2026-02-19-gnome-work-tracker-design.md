# GNOME Work Tracker — Design Document

**Date:** 2026-02-19

## Overview

A personal work time tracking system consisting of two components:

1. **Web application** — manage projects, log work items, configure a quick dashboard
2. **GNOME Shell extension** — 7 buttons in the top bar for one-click time tracking

The core principle: at any given time you are working on only one thing. Starting work on a project automatically closes the previous active work item. No overlapping work items.

## Architecture

### Monorepo Structure

```
gnome-work-tracker/
├── packages/
│   ├── server/              # Bun + Hono API
│   ├── web/                 # React + Vite frontend
│   └── gnome-extension/     # GNOME Shell extension (GJS)
├── prisma/
│   └── schema.prisma        # Database schema
├── package.json             # Workspace root (Bun workspaces)
└── bunfig.toml
```

### Tech Stack

| Component        | Technology                                   |
| ---------------- | -------------------------------------------- |
| Frontend         | React + Vite + TypeScript + Tailwind + shadcn/ui |
| Backend          | Bun + Hono (REST API)                        |
| Auth             | Better Auth (username + password, no email)  |
| Database         | Prisma with SQLite (switchable to PostgreSQL) |
| GNOME Extension  | GJS, GNOME 45+ (ESM modules), Soup for HTTP |

### Server Layering

```
Routes (Hono) → Services (business logic) → Repositories (Prisma)
```

Each layer depends only on the one below it. Business rules (e.g., close active work item before starting a new one) live in the service layer.

## Data Model

### User

Managed by Better Auth. The library owns the user table (id, username, passwordHash, etc.). We extend with:

**UserProfile** (or Better Auth metadata):

| Field    | Type   | Notes                              |
| -------- | ------ | ---------------------------------- |
| userId   | FK     | References Better Auth user        |
| apiToken | string | Persistent token for trigger URLs  |

### Project

| Field     | Type     | Notes                            |
| --------- | -------- | -------------------------------- |
| id        | uuid, PK |                                  |
| slug      | string   | Globally unique, auto-generated from name, editable |
| name      | string   |                                  |
| userId    | FK       | Owner (Better Auth user)         |
| createdAt | datetime |                                  |
| updatedAt | datetime |                                  |

### WorkItem

| Field       | Type              | Notes                                  |
| ----------- | ----------------- | -------------------------------------- |
| id          | uuid, PK          |                                        |
| projectId   | FK                | References Project                     |
| userId      | FK                | References User                        |
| startedAt   | datetime          |                                        |
| endedAt     | datetime, nullable | null = currently active                |
| description | string, nullable  |                                        |
| createdAt   | datetime          |                                        |
| updatedAt   | datetime          |                                        |

### DashboardConfig

| Field     | Type   | Notes                     |
| --------- | ------ | ------------------------- |
| id        | uuid, PK |                         |
| userId    | FK     | References User           |
| slot      | int    | 1–6                       |
| projectId | FK     | References Project        |
| updatedAt | datetime |                         |

## API Endpoints

### Auth (Better Auth)

- `POST /api/auth/sign-up` — register (username + password)
- `POST /api/auth/sign-in` — login
- `POST /api/auth/sign-out` — logout

### Projects

- `GET /api/projects` — list user's projects
- `POST /api/projects` — create project (name → auto-generates slug)
- `GET /api/projects/:id` — project details + work items
- `PUT /api/projects/:id` — update project (name, slug)
- `DELETE /api/projects/:id` — delete project

### Work Items

- `GET /api/projects/:id/work-items` — list work items (with date filters)
- `POST /api/projects/:id/work-items` — manual entry (startedAt, endedAt, description)
- `PUT /api/work-items/:id` — edit a work item
- `DELETE /api/work-items/:id` — delete a work item

### Trigger (stateless, token-based)

- `GET /api/trigger/{apiToken}/{slug}` — start work on project (closes any active item)
- `GET /api/trigger/{apiToken}/stop` — stop all work (closes active item)

### Dashboard Config

- `GET /api/dashboard` — get current user's 6 slots (session auth)
- `PUT /api/dashboard` — update slot assignments (session auth)
- `GET /api/dashboard/{apiToken}` — get slots (token auth, for GNOME extension)

### Active Status

- `GET /api/status` — current active work item + today's time slots (session auth)
- `GET /api/status/{apiToken}` — same, token-based

## Business Rules

1. **One active work item at a time per user** — starting a new one closes the previous (sets `endedAt = now`)
2. **No overlapping work items** — enforced at the service layer, including manual entries
3. **Trigger URLs are stateless** — API token auth, no session required
4. **Project slugs are globally unique**
5. **Dashboard has exactly 6 configurable slots** — each maps to one of the user's projects
6. **Stop All** closes the active item with `endedAt = now`, starts nothing
7. **Manual work entries** are validated against existing items to prevent overlaps

## Web App Views

### 1. Login / Register

Simple username + password forms. Better Auth handles the flow. No email verification.

### 2. Projects List

Table of all user's projects. Each row: name, slug, total tracked time (today), actions (edit/delete). "New Project" button at the top.

### 3. Project Detail

- Project name, slug, trigger URL (copyable)
- Work items list with date filtering
- Each work item: date, start time, end time, duration, description
- "Add Work Entry" button for manual entries (form with from/to/description)

### 4. Quick Dashboard

- **Top:** current date, currently active project (highlighted), running timer
- **Middle:** 6 project buttons in a 3x2 grid + 1 "Stop All" button below
- **Bottom:** today's timeline — a bar divided into colored time slots, labeled with project name and duration
- **Configure:** icon that opens a panel to assign projects to the 6 slots (dropdown per slot)

## GNOME Extension

### UI

- **7 buttons rendered directly in the top bar** — 6 project buttons + 1 stop button
- Single click triggers the action (no popup menu for buttons)
- Buttons display project name labels
- **Active project button is visually highlighted** (distinct background/style)
- Highlight moves when switching projects, no highlight after "Stop All"

### Settings / Login

- A gear/settings button opens a popup with:
  - First use: server URL + username/password login form
  - If no account: link redirects to web app for registration
  - On successful login: credentials/token stored in GSettings, config loaded, buttons appear
  - Refresh button to manually reload config

### Button Behavior

- Click project button → calls `GET /api/trigger/{apiToken}/{slug}`, highlights that button
- Click "Stop All" → calls `GET /api/trigger/{apiToken}/stop`, removes all highlights

### Config Refresh

Config is fetched from the server only on:
- Login
- Manual refresh button press

No polling. Active state is tracked locally after each button click.

### Technical

- GNOME 45+ compatible (ESM modules)
- HTTP via Soup library (native GJS)
- Settings stored in GSettings
