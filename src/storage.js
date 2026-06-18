/*
 * blocscore — a bouldering-gym scoreboard.
 * Copyright (C) 2026 manubloc
 *
 * This program is free software: you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation, either version 3 of the License, or (at your option)
 * any later version. See <https://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * blocscore storage adapter
 * ─────────────────────────
 * Implements the get / set / delete / list interface used throughout the app.
 *
 * HOW IT WORKS
 * ────────────
 * • shared: true  → Supabase (one database for the whole gym, all devices)
 * • shared: false → localStorage (per-browser: session, language preference)
 *
 * SETUP (one-time, ~5 minutes)
 * ─────────────────────────────
 * 1. Create a free project at https://supabase.com
 * 2. In the Supabase dashboard → SQL Editor, run the SQL in supabase_setup.sql
 * 3. Copy your project URL and anon key from Settings → API
 * 4. Add them to your repository:
 *      GitHub → Settings → Secrets and variables → Actions → New repository secret
 *      Name: VITE_SUPABASE_URL   Value: https://xxxx.supabase.co
 *      Name: VITE_SUPABASE_KEY   Value: eyJ...  (anon/public key)
 * 5. Commit any file to trigger a new deploy — done!
 *
 * The anon key is safe to expose publicly (it's designed for that).
 * Row Level Security (RLS) is disabled for simplicity; enable it later
 * if you want per-user access control.
 */

// ── Supabase client (lazy-initialised) ──────────────────────────────────────

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;
const TABLE = "blocscore_store";

let _sb = null;
async function sb() {
  if (_sb) return _sb;
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;           // not configured yet
  const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
  _sb = createClient(SUPABASE_URL, SUPABASE_KEY);
  return _sb;
}

// ── localStorage fallback (for non-shared or when Supabase not configured) ──

const LS = typeof window !== "undefined" ? window.localStorage : null;
const lsPfx = (shared) => (shared ? "blocscore:s::" : "blocscore:u::");
const lsKey  = (key, shared) => lsPfx(shared) + key;

function lsGet(key, shared)    { const v = LS?.getItem(lsKey(key, shared)); return v == null ? null : { key, value: v, shared }; }
function lsSet(key, val, shared) { try { LS?.setItem(lsKey(key, shared), val); return { key, value: val, shared }; } catch { return null; } }
function lsDel(key, shared)    { LS?.removeItem(lsKey(key, shared)); return { key, deleted: true, shared }; }
function lsList(prefix, shared) {
  const out = [], p = lsPfx(shared);
  if (LS) for (let i = 0; i < LS.length; i++) { const k = LS.key(i); if (k?.startsWith(p)) { const b = k.slice(p.length); if (b.startsWith(prefix)) out.push(b); } }
  return { keys: out, prefix, shared };
}

// ── Supabase helpers ─────────────────────────────────────────────────────────

async function sbGet(key) {
  const client = await sb(); if (!client) return null;
  const { data, error } = await client.from(TABLE).select("value").eq("key", key).maybeSingle();
  // WICHTIG: bei einem echten Fehler WERFEN — nicht null zurückgeben. Sonst kann die App
  // einen Verbindungsfehler nicht von "Zeile existiert nicht" unterscheiden und überschreibt
  // im schlimmsten Fall echte Daten mit Seed-Daten. null bedeutet ausschließlich: Zeile fehlt.
  if (error) { throw new Error("blocscore/storage: get failed — " + (error.message || "unknown")); }
  return data ? { key, value: data.value, shared: true } : null;
}

async function sbSet(key, value) {
  const client = await sb(); if (!client) return lsSet(key, value, true); // fallback to LS
  const { error } = await client.from(TABLE).upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) { console.warn("blocscore/storage: set error", error.message); return null; }
  return { key, value, shared: true };
}

async function sbDel(key) {
  const client = await sb(); if (!client) return lsDel(key, true);
  const { error } = await client.from(TABLE).delete().eq("key", key);
  if (error) { console.warn("blocscore/storage: delete error", error.message); return null; }
  return { key, deleted: true, shared: true };
}

async function sbList(prefix) {
  const client = await sb(); if (!client) return lsList(prefix, true);
  const { data, error } = await client.from(TABLE).select("key").like("key", prefix + "%");
  if (error) { console.warn("blocscore/storage: list error", error.message); return { keys: [], prefix, shared: true }; }
  return { keys: (data || []).map(r => r.key), prefix, shared: true };
}

// ── Public API ────────────────────────────────────────────────────────────────

const storage = {
  /** Retrieve a value. shared=true → Supabase, shared=false → localStorage */
  async get(key, shared = false) {
    if (shared) return sbGet(key);
    return lsGet(key, false);
  },

  /** Store a value. shared=true → Supabase, shared=false → localStorage */
  async set(key, value, shared = false) {
    if (shared) return sbSet(key, value);
    return lsSet(key, value, false);
  },

  /** Delete a value. */
  async delete(key, shared = false) {
    if (shared) return sbDel(key);
    return lsDel(key, false);
  },

  /** List keys by prefix. */
  async list(prefix = "", shared = false) {
    if (shared) return sbList(prefix);
    return lsList(prefix, false);
  },
};

export default storage;
