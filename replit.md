# LobsterOps

**AI Agent Observability & Debug Console**
*Flight recorder and debug console for AI agents*

## Overview

LobsterOps is a lightweight, flexible observability platform specifically designed for AI agents. It provides structured event logging, querying, and analytics for AI agent behavior in production.

## Architecture

This is a Node.js library project (not a web app). It provides a pluggable SDK for AI agent observability.

### Project Structure

```
src/
  core/
    LobsterOps.js         - Main class with all logging methods
  storage/
    StorageAdapter.js     - Abstract base class for storage backends
    StorageFactory.js     - Factory for creating storage backends
    JsonFileStorage.js    - JSON file-based storage (default)
    MemoryStorage.js      - In-memory storage (for testing)
    SQLiteStorage.js      - SQLite storage backend
    SupabaseStorage.js    - Supabase cloud storage backend
tests/
  LobsterOps.test.js      - Jest test suite (19 tests, all passing)
example.js                - Usage example demonstrating all features
index.js                  - Package entry point
```

## Storage Backends

| Backend | Type | Notes |
|---------|------|-------|
| JSON Files | `json` | Default, zero-config, file-based |
| Memory | `memory` | For testing, no persistence |
| SQLite | `sqlite` | Requires `sqlite3` npm package |
| Supabase | `supabase` | Requires `@supabase/supabase-js` |

## Key Dependencies

- `uuid@9` - UUID generation (v9 required for CommonJS compatibility)
- `sqlite3` - SQLite storage backend
- `@supabase/supabase-js` - Supabase storage backend
- `jest@29` - Test runner (v29 required, v30 has startup performance issues)

## Workflow

- **Start application**: Runs `node example.js` — demonstrates all features using SQLite backend

## Running Tests

```bash
npm test
```

All 19 tests pass in ~1.2 seconds.

## Known Bug Fixes Applied

1. `MemoryStorage.saveEvent`: Fixed `new Date().isoString()` → `new Date().toISOString()`
2. `MemoryStorage.deleteEvents`: Fixed inverted deletion logic (now correctly deletes matching events)
3. `JsonFileStorage.init`: Fixed infinite recursion — moved `this.initialized = true` before calling `cleanupOld()`
4. `JsonFileStorage.deleteEvents`: Fixed inverted keep/delete logic

## npm Package Notes

- `uuid` must be v9 (not v10+) because v10 is ESM-only and this project uses CommonJS
- `jest` must be v29 (not v30) because v30 has extremely slow startup in this environment
