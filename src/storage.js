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
// localStorage-backed drop-in for the window.storage API used by the app.
// NOTE: this is per-browser/per-device persistence. For real cross-device
// sharing (one community board for everyone), swap this for a backend
// (e.g. Supabase) — the same get/set/delete/list interface applies.
const LS = typeof window !== "undefined" ? window.localStorage : null;
const pfx = (shared) => (shared ? "blocscore:s::" : "blocscore:u::");
const k = (key, shared) => pfx(shared) + key;

const storage = {
  async get(key, shared = false) {
    if (!LS) return null;
    const v = LS.getItem(k(key, shared));
    return v == null ? null : { key, value: v, shared };
  },
  async set(key, value, shared = false) {
    if (!LS) return null;
    try { LS.setItem(k(key, shared), value); }
    catch (e) { console.warn("blocscore: storage write failed (quota?)", e); return null; }
    return { key, value, shared };
  },
  async delete(key, shared = false) {
    if (!LS) return null;
    LS.removeItem(k(key, shared));
    return { key, deleted: true, shared };
  },
  async list(prefix = "", shared = false) {
    const out = [];
    if (LS) {
      const p = pfx(shared);
      for (let i = 0; i < LS.length; i++) {
        const kk = LS.key(i);
        if (kk && kk.startsWith(p)) {
          const bare = kk.slice(p.length);
          if (bare.startsWith(prefix)) out.push(bare);
        }
      }
    }
    return { keys: out, prefix, shared };
  },
};
export default storage;
