# Idempotent Project Trigger

## Problem

When the backend receives a trigger for a project that is already active for the user, it needlessly closes the current work item and creates a new one. This causes fragmented time entries when users double-click a project button or when multiple API calls are made for the same project.

## Solution

Add an early return in `triggerService.startWork()`. Before closing/creating anything, check whether the currently active work item already belongs to the requested project. If so, return the existing work item immediately with no DB writes.

## Change

**File:** `packages/server/src/services/trigger.service.ts` — `startWork()` method.

After fetching the active work item, compare `active.projectId` to `project.id`. If they match, return `active` directly.

Switching to a different project continues to work exactly as before. The `stopAll()` method, routes, and response shape are all unchanged.

## Edge Cases

- **Rapid double-click, same project:** First call creates the work item, second call returns it. No duplicate entry.
- **Same project triggered minutes later:** Returns existing work item. Timer keeps running uninterrupted.
- **Different project triggered:** Normal switch behavior, unchanged.

## Response Contract

Both session and token trigger endpoints continue to return `{ ok: true, workItem }`. The frontend sees no difference between a newly created and an already-active work item.
