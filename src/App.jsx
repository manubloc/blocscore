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

import React, { useState, useEffect, useMemo, useRef, useId } from "react";
import { SEED, BG_LOGIN } from "./seed.js";


/* ============================ Punkte ============================ */
// STEP and FLASH_BONUS are now community-configurable
// These globals are used outside App (e.g. computeAgg); overridden at runtime via module-level vars
let _STEP = 0.25;
let _FLASH_BONUS = 0.25;
const GRADES = [1, 2, 3, 4, 5, 6, 7, 8];
const GRADE_COLOR = { 1: "#b8ff00", 2: "#b8ff00", 3: "#b8ff00", 4: "#b8ff00", 5: "#b8ff00", 6: "#b8ff00", 7: "#b8ff00", 8: "#b8ff00" };
function topPts(g) { return g * _STEP; }
function pointsFor(grade, status) { if (!status) return 0; return grade * _STEP + (status === "flash" ? _FLASH_BONUS : 0); }
/* ============================ Wände ============================ */
const WALLS = [
  { code: "v", name: "Block vorne", short: "V", aliases: ["bv", "block vorne", "block_vorne"] },
  { code: "h", name: "Block hinten", short: "H", aliases: ["bh", "block hinten", "block_hinten"] },
  { code: "tb", name: "Training & Bug", short: "TB", aliases: ["training & bug", "training und bug", "trainingsbereich", "training"] },
  { code: "pl", name: "Platte & Bug", short: "PL", aliases: ["pt", "pp", "platte", "platte & bug"] },
  { code: "wkw", name: "Wettkampfwand", short: "WKW", aliases: ["ww", "bw", "wettkampfwand"] },
];
const WALL_BY = {};
WALLS.forEach(w => { WALL_BY[w.code] = w; (w.aliases || []).forEach(a => WALL_BY[a] = w); });
function wallOf(c) { return WALL_BY[(c || "").toLowerCase()] || null; }
function wallName(c) { const w = wallOf(c); return w ? w.name : (c || "—"); }
function wallShort(c) { const w = wallOf(c); return w ? w.short : (c || "?").toUpperCase(); }
function wallCanon(c) { const w = wallOf(c); return w ? w.code : (c || ""); }

function WallIcon({ code, size = 20 }) {
  const c = wallCanon(code);
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinejoin: "round", strokeLinecap: "round" };
  if (c === "tb") return (<svg {...p}><rect x="3" y="9" width="3.2" height="6" rx="1" /><rect x="17.8" y="9" width="3.2" height="6" rx="1" /><path d="M6.2 12h11.6" /></svg>); // Hantel (Training)
  if (c === "v") return (<svg {...p}><rect x="5" y="6" width="13" height="13" rx="2" /><path d="M5 10h13" /></svg>); // Block vorne
  if (c === "h") return (<svg {...p}><rect x="8" y="4.5" width="11" height="11" rx="2" /><rect x="4.5" y="9" width="11" height="11" rx="2" fill="var(--panel)" /></svg>); // Block hinten (Tiefe)
  if (c === "pl") return (<svg {...p}><path d="M3.5 14.5 L11 7 L20.5 10 L13 17.5 Z" /></svg>); // Platte (Slab)
  if (c === "wkw") return (<svg {...p}><path d="M7.5 4.5h9v2.5a4.5 4.5 0 0 1-9 0z" /><path d="M12 11.5V15" /><path d="M9 18.5h6" /><path d="M7.5 5H5.5a2 2 0 0 0 2 2" /><path d="M16.5 5h2a2 2 0 0 1-2 2" /></svg>); // Pokal
  return (<svg {...p}><circle cx="12" cy="12" r="7" /></svg>);
}

/* ============================ Helpers ============================ */
const COLOR_DOT = {
  rot: "#D93025", gelb: "#F5C800", "weiß": "#EEEEE4", weiss: "#EEEEE4",
  blau: "#1A6FD4", "grün": "#1E9E48", gruen: "#1E9E48", lila: "#7B3FC8",
  violett: "#6E38C0", pink: "#D4287A", schwarz: "#181C22", holz: "#9A5020",
  orange: "#D46A10", braun: "#6E3C18", "türkis": "#0E8A80",
};
const COLOR_FG = {
  rot: "#fff", gelb: "#111", "weiß": "#111", weiss: "#111",
  blau: "#fff", "grün": "#111", gruen: "#111", lila: "#fff",
  violett: "#fff", pink: "#fff", schwarz: "#fff", holz: "#fff",
  orange: "#111", braun: "#fff", "türkis": "#111",
};
function colorFgOf(name) { const t = (name || "").toLowerCase(); for (const k of Object.keys(COLOR_FG)) if (t.includes(k)) return COLOR_FG[k]; return "#fff"; }
function colorOf(name) { const t = (name || "").toLowerCase(); for (const k of Object.keys(COLOR_DOT)) if (t.includes(k)) return COLOR_DOT[k]; return null; }
function initials(n) { const p = (n || "?").trim().split(/\s+/); return (p[0][0] + (p[1] ? p[1][0] : "")).toUpperCase(); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function fmtDate(iso) { if (!iso) return "—"; const [y, m, d] = iso.split("-"); return `${d}.${m}.${y}`; }
function todayISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }

/* ── PIN-Sicherheit: Hashing statt Klartext (PBKDF2/SHA-256, Salt pro Account) ── */
const CRYPTO_OK = typeof crypto !== "undefined" && !!crypto.subtle && typeof TextEncoder !== "undefined";
function _b64(buf) { let s = ""; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s); }
function _unb64(s) { return Uint8Array.from(atob(s), c => c.charCodeAt(0)); }
function genSalt() { const a = new Uint8Array(16); crypto.getRandomValues(a); return _b64(a); }
async function hashPin(pin, saltB64) {
  const km = await crypto.subtle.importKey("raw", new TextEncoder().encode(String(pin)), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: _unb64(saltB64), iterations: 120000, hash: "SHA-256" }, km, 256);
  return _b64(bits);
}
async function verifyPin(pin, acc) {
  if (acc && acc.pinHash && acc.pinSalt) {
    if (!CRYPTO_OK) return false;
    try { return (await hashPin(pin, acc.pinSalt)) === acc.pinHash; } catch (e) { return false; }
  }
  if (acc && acc.pin) return pin === acc.pin; // Legacy-Fallback (noch nicht migriert)
  return true; // kein PIN gesetzt → offen
}
// Liefert die zu speichernden PIN-Felder (gehasht); ohne Crypto-Kontext Fallback auf Klartext
async function makePinFields(pin) {
  if (!pin) return { pinHash: "", pinSalt: "" };
  if (!CRYPTO_OK) return { pin };
  const salt = genSalt();
  return { pinHash: await hashPin(pin, salt), pinSalt: salt };
}
// Einmalige Migration: bestehende Klartext-PINs → Hash (Daten bleiben erhalten, PIN funktioniert weiter)
async function migrateAccountPins(c) {
  if (!c || !c.accounts || !CRYPTO_OK) return c;
  let changed = false;
  const accounts = [];
  for (const a of c.accounts) {
    if (a.pin && !a.pinHash) {
      const salt = genSalt();
      const pinHash = await hashPin(a.pin, salt);
      const { pin, ...rest } = a;
      accounts.push({ ...rest, pinHash, pinSalt: salt });
      changed = true;
    } else accounts.push(a);
  }
  return changed ? { ...c, accounts } : c;
}
function fmtPts(n) { return (Math.round(n * 100) / 100).toLocaleString("de-DE", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }); }
function avColor(name) { let h = 0; for (let i = 0; i < (name || "").length; i++) h = (h * 31 + name.charCodeAt(i)) % 360; return `hsl(${h} 45% 62%)`; }
function ago(ts) { const s = (Date.now() - ts) / 1000; if (s < 60) return "gerade eben"; if (s < 3600) return Math.floor(s / 60) + " min"; if (s < 86400) return Math.floor(s / 3600) + " h"; return Math.floor(s / 86400) + " d"; }
function medal(i) { return null; } // always use numbers
function roleLabel(r) { return r === "superadmin" ? "Super Admin" : r === "admin" ? "Admin" : r === "schrauber" ? "Route Creator" : r === "archived" ? "Archived" : "Climber"; }
const YEAR_MS = 365 * 24 * 3600 * 1000;
function lastActiveISO(acc, routes) { if (acc.lastSeen) return acc.lastSeen; let m = null; for (const r of (routes || [])) { if (r.results && r.results[acc.name] && r.date && (!m || r.date > m)) m = r.date; } return m; }
function isArchivedAcc(acc, routes, todayISO) { if (!acc || acc.staff) return false; if (acc.archived) return true; const la = lastActiveISO(acc, routes); if (!la) return false; return (new Date(todayISO) - new Date(la)) > YEAR_MS; }
function textOn(hex) { if (!hex) return "#fff"; const h = hex.replace("#", ""); const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16); return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? "#14171c" : "#fff"; }

/* ---- lustige Routennamen: mehrere Muster (Tiere, Brocken, englische Combos) ---- */
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const ADJ = {
  easy: ["müde", "gemütliche", "sanfte", "faule", "brave", "verträumte", "gnädige", "entspannte", "schläfrige", "nette", "kuschelige", "gemächliche"],
  mid: ["flinke", "listige", "freche", "wilde", "mutige", "zähe", "sture", "trickreiche", "neugierige", "ruppige", "kesse", "schräge"],
  hard: ["brutale", "grimmige", "gnadenlose", "wahnsinnige", "furchtlose", "monströse", "teuflische", "epische", "eisige", "berüchtigte", "böse", "fiese"],
};
// Stamm-Adjektive für starke Deklination (ohne Artikel): m -er, f -e, n -es
const ADJ_STRONG = { easy: ["sanft", "lahm", "faul", "brav", "weich", "ruhig"], mid: ["zäh", "wild", "frech", "stur", "schräg", "fix"], hard: ["hart", "brutal", "fies", "krass", "gemein", "wuchtig", "fett", "grob"] };
const NOUNS = [
  { a: "Der", g: "m", n: "Dachs" }, { a: "Die", g: "f", n: "Wurzel" }, { a: "Das", g: "n", n: "Murmeltier" }, { a: "Der", g: "m", n: "Krake" },
  { a: "Die", g: "f", n: "Echse" }, { a: "Der", g: "m", n: "Yeti" }, { a: "Die", g: "f", n: "Hummel" }, { a: "Das", g: "n", n: "Walross" },
  { a: "Der", g: "m", n: "Specht" }, { a: "Die", g: "f", n: "Qualle" }, { a: "Der", g: "m", n: "Biber" }, { a: "Das", g: "n", n: "Faultier" },
  { a: "Die", g: "f", n: "Natter" }, { a: "Der", g: "m", n: "Pinguin" }, { a: "Das", g: "n", n: "Nashorn" }, { a: "Der", g: "m", n: "Waschbär" },
  { a: "Die", g: "f", n: "Krähe" }, { a: "Der", g: "m", n: "Gecko" }, { a: "Das", g: "n", n: "Erdmännchen" }, { a: "Der", g: "m", n: "Wadenbeißer" },
  { a: "Die", g: "f", n: "Bohnenstange" }, { a: "Der", g: "m", n: "Wackelpudding" }, { a: "Die", g: "f", n: "Bratwurst" }, { a: "Der", g: "m", n: "Tintenfisch" },
];
// Sachen-Nomen für „harter Brocken"-Stil
const THINGS = [
  { g: "m", n: "Brocken" }, { g: "m", n: "Hammer" }, { g: "m", n: "Klopper" }, { g: "m", n: "Riese" }, { g: "m", n: "Henkel" }, { g: "m", n: "Schinken" },
  { g: "n", n: "Brett" }, { g: "n", n: "Teil" }, { g: "n", n: "Monster" }, { g: "n", n: "Biest" }, { g: "n", n: "Ungetüm" },
  { g: "f", n: "Wand" }, { g: "f", n: "Platte" }, { g: "f", n: "Wucht" }, { g: "f", n: "Granate" },
];
const ENG_ADJ = ["Crazy", "Mega", "Turbo", "Epic", "Wild", "Super", "Hyper", "Ultra", "Savage", "Funky", "Insane", "Cosmic", "Atomic", "Electric", "Maximum", "Smooth"];
const ENG_NOUN = ["Crusher", "Booster", "Rollercoaster", "Sender", "Dyno", "Beast", "Machine", "Rocket", "Thunder", "Smash", "Vortex", "Monster", "Blaster", "Power", "Grip", "Flow"];
const ENG_TAIL = ["boost", "mania", "rush", "blast", "core", "wave", "drive", "storm"];
function strongEnd(g) { return g === "m" ? "er" : g === "f" ? "e" : "es"; }
function genName(seed, grade) {
  const h = hashStr(seed);
  const tier = grade <= 3 ? "easy" : grade <= 6 ? "mid" : "hard";
  const p = h % 100;
  if (LANG === "en") { // English-only combinations
    if (p < 55) return `${ENG_ADJ[h % ENG_ADJ.length]} ${ENG_NOUN[Math.floor(h / 5) % ENG_NOUN.length]}`;
    return `${ENG_ADJ[h % ENG_ADJ.length]} ${ENG_NOUN[Math.floor(h / 13) % ENG_NOUN.length]}${ENG_TAIL[Math.floor(h / 17) % ENG_TAIL.length]}`;
  }
  if (p < 38) { // Artikel + Adjektiv(-e) + Tier
    const adj = ADJ[tier][h % ADJ[tier].length];
    const noun = NOUNS[Math.floor(h / 7) % NOUNS.length];
    return `${noun.a} ${adj} ${noun.n}`;
  } else if (p < 64) { // starkes Adjektiv + Sache  ("harter Brocken")
    const base = ADJ_STRONG[tier][Math.floor(h / 3) % ADJ_STRONG[tier].length];
    const noun = THINGS[Math.floor(h / 11) % THINGS.length];
    return `${cap(base + strongEnd(noun.g))} ${noun.n}`;
  } else if (p < 86) { // englisch: Adjektiv + Noun  ("Epic Crusher")
    return `${ENG_ADJ[h % ENG_ADJ.length]} ${ENG_NOUN[Math.floor(h / 5) % ENG_NOUN.length]}`;
  } else { // Denglish-Kompositum ("Crazy Rollercoasterboost")
    const en = ENG_NOUN[Math.floor(h / 13) % ENG_NOUN.length];
    return `${ENG_ADJ[h % ENG_ADJ.length]} ${en}${ENG_TAIL[Math.floor(h / 17) % ENG_TAIL.length]}`;
  }
}
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

/* ============================ i18n (DE/EN) ============================ */
let LANG = "de";
function setLangG(l) { LANG = l === "en" ? "en" : "de"; }
const STR = {
  de: {
    "nav.routes": "Routen", "nav.ach": "Erfolge", "nav.groups": "Gruppen", "nav.board": "Board", "nav.account": "Konto",
    "common.save": "Speichern", "common.cancel": "Abbrechen", "common.delete": "Löschen", "common.back": "Zurück", "common.all": "Alle",
    "login.signin": "Anmelden", "login.signup": "Registrieren", "login.name": "Name", "login.pin": "PIN",
    "login.namePh": "Dein Name", "login.pinPh": "PIN", "login.pinSet": "PIN festlegen (mind. 4 Zeichen)",
    "login.suggest": "🎲 Vorschlag", "login.create": "Konto erstellen",
    "login.privTitle": "Privater Modus", "login.privDesc": "Du trackst alles, erscheinst aber für niemanden in Ranglisten — nur du siehst deine Platzierung.",
    "login.demoShow": "Demo-Konten anzeigen", "login.demoHide": "Demo-Konten ausblenden",
    "login.demoHint": "Beispiel-Konten · PIN für alle: 1234 · Admin: Login admin, Passwort admin",
    "login.foot": "Lokaler Prototyp · Daten bleiben in diesem Browser",
    "login.errNoAcc": "Kein Konto mit diesem Namen.", "login.errPin": "PIN stimmt nicht.",
    "login.errName": "Bitte einen Namen eingeben.", "login.errTaken": "Name ist schon vergeben.", "login.errShort": "PIN braucht mindestens 4 Zeichen.",
    "board.einzel": "Einzel", "board.gruppen": "Gruppen", "board.aktuell": "Aktuell", "board.gesamt": "Gesamt", "board.erfolge": "Erfolge", "board.achpts": "Erfolge",
    "board.points": "Punkte", "board.members": "Mitglieder", "board.noGroups": "Noch keine Gruppen. Erstell im Tab „Gruppen“ die erste.",
    "routes.map": "Karte", "routes.list": "Liste", "routes.tapHint": "Tippe einen Bereich oder eine farbige Grad-Bubble an, um die Routen zu sehen.",
    "routes.done": "geschafft", "routes.search": "Route suchen (Name, Farbe, Wand…)", "routes.allWalls": "alle Wände",
    "routes.scope.aktuell": "Aktuell", "routes.scope.archiv": "Archiv", "routes.scope.alle": "Alle", "routes.allGrades": "Alle Grade",
    "routes.empty": "Keine Routen in dieser Ansicht.", "routes.add": "Route", "routes.rescrewed": "umgeschraubt",
    "ach.unlocked": "Erfolge freigeschaltet", "ach.points": "Punkte", "ach.done": "Geschafft", "ach.next": "Als Nächstes", "ach.cats": "Kategorien", "ach.view.ach": "Erfolge", "ach.view.grade": "Grade",
    "groups.intro": "Eine Gruppe = dein Team. Die Punkte aller Mitglieder zählen zusammen. Max. 10 Mitglieder, du kannst nur in einer Gruppe sein. Beitritt per Anfrage an den Ersteller oder per Einladung.",
    "groups.yours": "Deine Gruppe", "groups.create": "+ Eigene Gruppe erstellen", "groups.discover": "Gruppen entdecken",
    "groups.request": "Anfragen", "groups.requested": "Angefragt ✕", "groups.full": "voll", "groups.manageHint": "Tippe deine Gruppe an, um Mitglieder, Anfragen und Einladungen zu verwalten.",
    "cmt.title": "Kommentare", "cmt.empty": "Noch keine Kommentare", "cmt.emptyHint": "Teile den ersten Tipp oder Move für diese Route!", "cmt.ph": "Kommentar schreiben…",
    "acc.role.admin": "Administrator", "acc.role.schrauber": "Schrauber", "acc.role.community": "Community",
    "acc.changePw": "Passwort ändern", "acc.logout": "Abmelden", "acc.privOn": "Privater Modus an", "acc.privOff": "Privater Modus aus",
    "acc.privDesc": "Wenn an, erscheinst du für niemanden in Ranglisten — nur du siehst deine Platzierung.",
    "acc.language": "Sprache", "acc.members": "Mitglieder", "acc.points": "Punktesystem", "acc.canSet": "Du darfst Routen anlegen, bearbeiten und Fotos hinzufügen.",
    "acc.cannotSet": "Du trägst deine eigenen Ergebnisse ein und kannst Gruppen bilden. Routen anlegen dürfen Route Creator & Admins.",
    "plan.title": "Umschraubplan", "plan.fresh": "frisch", "plan.next": "als nächstes",
    "card.tops": "Tops", "card.flash": "Flash", "card.sends": "Begehungen",
    "acc.emoji": "Profil-Emoji", "acc.pickEmoji": "Emoji wählen", "acc.none": "keins",
    "acc.reqCreator": "Route Creator werden (anfragen)", "acc.reqPending": "Anfrage gesendet ✓", "acc.reqInfo": "Ein Admin schaltet dich frei.",
    "acc.users": "Nutzerverwaltung", "acc.wantsCreator": "möchte Route Creator", "acc.archived": "Archiviert (inaktiv > 1 Jahr)", "acc.reactivate": "Reaktivieren", "acc.reqReactivate": "Reaktivierung anfragen", "acc.archivedSelf": "Dein Konto ist wegen Inaktivität archiviert und erscheint nicht in Wertungen.",
    "grp.create": "Gruppe erstellen", "grp.name": "Gruppenname", "grp.symbol": "Symbol", "grp.roll": "🎲 neu würfeln", "grp.pickMore": "Mehr Symbole", "grp.nameHint": "Teamname mit Mehrzahl-Nomen — frei änderbar.",
    "prof.nameHint": "Wird automatisch erzeugt — frei änderbar.",
    "route.note": "Beschreibung (optional)", "route.notePh": "z. B. große Griffe · Route am Fenster", "route.noteHint": "Nur nötig, um Routen mit gleicher Farbe & Grad zu unterscheiden.",
    "lock.comments": "Kommentare werden ab 100 Punkten freigeschaltet (du hast {n}).", "lock.group": "Gruppen erstellen wird ab 1000 Punkten freigeschaltet (du hast {n}).", "lock.creator": "Route Creator kannst du ab 10000 Punkten anfragen (du hast {n}).",
    "cf.title": "Route Creator werden?", "cf.body": "Bist du sicher, dass du das Zeug zum Route Creator hast? Du übernimmst Verantwortung fürs Schrauben und Pflegen der Routen — ein Admin muss die Anfrage noch bestätigen.", "cf.yes": "Ja, anfragen", "cf.cancel": "Abbrechen", "lock.label": "🔒 gesperrt",
    "lang.de": "Deutsch", "lang.en": "English",
    "nav.hall": "Stats",
    "hall.activity": "Gym Activity", "hall.creator": "Route Creator",
    "hall.today": "Heute", "hall.week": "Diese Woche", "hall.month": "Dieser Monat", "hall.total": "Gesamt",
    "hall.sends": "Begehungen", "hall.flashes": "Flashes", "hall.routes": "Aktive Routen",
    "hall.popular": "Beliebteste Routen", "hall.climbers": "Aktivste Kletterer",
    "hall.walls": "Wände im Überblick", "hall.sessions": "Schraubsessions",
    "hall.session": "Session", "hall.routeCount": "Routen", "hall.sendCount": "Begehungen",
    "hall.flashCount": "Flashes", "hall.popularity": "Beliebtheit",
    "hall.creatorHint": "An analysis of setter sessions — popular routes indicate quality.",
  },
  en: {
    "nav.routes": "Routes", "nav.ach": "Achievements", "nav.groups": "Groups", "nav.board": "Board", "nav.account": "Account", "nav.hall": "Stats",
    "common.save": "Save", "common.cancel": "Cancel", "common.delete": "Delete", "common.back": "Back", "common.all": "All",
    "login.signin": "Sign in", "login.signup": "Sign up", "login.name": "Name", "login.pin": "PIN",
    "login.namePh": "Your name", "login.pinPh": "PIN", "login.pinSet": "Set a PIN (min. 4 characters)",
    "login.suggest": "🎲 Suggest", "login.create": "Create account",
    "login.privTitle": "Private mode", "login.privDesc": "You track everything but won't appear in anyone's leaderboards — only you see your rank.",
    "login.demoShow": "Show demo accounts", "login.demoHide": "Hide demo accounts",
    "login.demoHint": "Example accounts · PIN for all: 1234 · Admin: login admin, password admin",
    "login.foot": "Local prototype · Data stays in this browser",
    "login.errNoAcc": "No account with this name.", "login.errPin": "Wrong PIN.", "login.errName": "Please enter a name.",
    "login.errTaken": "Name is already taken.", "login.errShort": "PIN needs at least 4 characters.",
    "board.einzel": "Solo", "board.gruppen": "Groups", "board.aktuell": "Current", "board.gesamt": "All time",
    "board.erfolge": "Achievements", "board.achpts": "Ach. pts", "board.points": "Points", "board.members": "Members",
    "board.noGroups": "No groups yet. Create the first one in the Groups tab.",
    "routes.map": "Map", "routes.list": "List",
    "routes.tapHint": "Tap a wall area or a colored grade bubble to see its routes.",
    "routes.done": "done", "routes.search": "Search routes (name, color, wall…)",
    "routes.allWalls": "all walls", "routes.scope.aktuell": "Current", "routes.scope.archiv": "Archive", "routes.scope.alle": "All",
    "routes.allGrades": "All grades", "routes.empty": "No routes in this view.", "routes.add": "Route", "routes.rescrewed": "reset",
    "ach.unlocked": "Achievements unlocked", "ach.points": "Points", "ach.done": "Unlocked", "ach.next": "Up next", "ach.intro.title": "How do achievements work?", "ach.intro.body": "Every route earns you Skillpoints. Additional Skillpoints come from achievements — milestones like first 10 tops, 25 flashes or all colors on a wall. Use your Skillpoints to unlock more app features:",
    "ach.cats": "Categories", "ach.view.ach": "Achievements", "ach.view.grade": "Grades",
    "groups.intro": "One group = your team. All members' points count together. Max 10 members, you can only be in one group. Join by requesting or by invitation.",
    "groups.yours": "Your group", "groups.create": "+ Create your group", "groups.discover": "Discover groups",
    "groups.request": "Request to join", "groups.requested": "Requested ✕", "groups.full": "full",
    "groups.manageHint": "Tap your group to manage members, requests and invitations.",
    "cmt.title": "Comments", "cmt.empty": "No comments yet",
    "cmt.emptyHint": "Share the first tip or move for this route!", "cmt.ph": "Write a comment…",
    "acc.role.admin": "Admin", "acc.role.schrauber": "Route Creator", "acc.role.community": "Climber",
    "acc.changePw": "Change PIN", "acc.logout": "Sign out",
    "acc.privOn": "Private mode on", "acc.privOff": "Private mode off",
    "acc.privDesc": "When on, you won't appear in anyone's leaderboards — only you see your rank.",
    "acc.language": "Language", "acc.members": "Members", "acc.users": "Members",
    "acc.points": "Scoring system", "acc.canSet": "You can create and edit routes and add photos.",
    "acc.wantsCreator": "wants to become Route Creator", "acc.reqReactivate": "Reactivation requested",
    "acc.reactivate": "Reactivate", "acc.archived": "Archived (inactive > 1 year)",
    "acc.pickEmoji": "Pick an emoji",
    "hall.activity": "Gym Activity", "hall.creator": "Route Creator",
    "hall.today": "Today", "hall.week": "This week", "hall.month": "This month", "hall.total": "All time",
    "hall.sends": "Sends", "hall.flashes": "Flashes", "hall.routes": "Active routes",
    "hall.popular": "Most popular routes", "hall.climbers": "Most active climbers", "hall.walls": "Walls overview",
    "hall.sessions": "Setter sessions", "hall.session": "Session",
    "hall.routeCount": "Routes", "hall.sendCount": "Sends", "hall.flashCount": "Flashes",
    "hall.popularity": "Popularity", "hall.creatorHint": "Setter session overview — popular routes signal quality.",
    "grp.create": "Create group", "grp.name": "Group name", "grp.symbol": "Symbol",
    "grp.roll": "🎲 reroll", "grp.pickMore": "More symbols", "grp.nameHint": "Pick a team name — fully editable.",
    "cf.title": "Become a Route Creator?",
    "cf.body": "As a Route Creator you can add, edit and photo routes. The admin needs to approve the role.",
    "cf.yes": "Request", "cf.cancel": "Cancel",
    "lock.label": "🔒 locked",
    "lock.comments": "Comments unlock at {n} achievement points",
    "lock.group": "Create a group at {n} achievement points",
    "lock.creator": "Request Route Creator role at {n} achievement points",
    "plan.title": "Reset schedule", "plan.fresh": "New", "plan.next": "Next wall", "plan.screwedOn": "Last reset:",
    "lang.de": "Deutsch", "lang.en": "English",
  },
};
function t(k, v) { let s = (STR[LANG] && STR[LANG][k]) != null ? STR[LANG][k] : (STR.de[k] != null ? STR.de[k] : k); if (v) for (const key in v) s = s.split("{" + key + "}").join(v[key]); return s; }
function routeTitle(r) { return (r.nick && r.nick.trim()) ? r.nick : genName((r.id || "") + "|" + (r.name || ""), r.grade); }
function colorWord(name) { const t = (name || "").toLowerCase(); for (const k of Object.keys(COLOR_DOT)) if (t.includes(k)) return k.charAt(0).toUpperCase() + k.slice(1); return null; }

/* ---- Profilnamen (Gamertag-Stil) · sprachabhängig ---- */
const TAG_A = ["krawatten", "zangen", "turbo", "gummi", "stein", "kletter", "chalk", "sloper", "crimp", "mega", "wackel", "donner", "keks", "nebel", "disco", "raketen", "kaktus", "pudding", "glitzer", "beton", "senf", "wasabi", "samt", "neon"];
const TAG_B = ["elch", "affe", "bock", "dachs", "yeti", "krake", "biber", "gecko", "wal", "specht", "panda", "otter", "luchs", "keiler", "molch", "nashorn", "koala", "tapir"];
const TAG_A_EN = ["turbo", "mega", "chalk", "crimp", "sloper", "dyno", "neon", "cosmic", "thunder", "rocket", "savage", "electric", "pixel", "hyper", "atomic", "wild", "epic", "funky", "frost", "shadow"];
const TAG_B_EN = ["yeti", "gecko", "panda", "otter", "lynx", "raptor", "beast", "goat", "crusher", "dragon", "rhino", "koala", "falcon", "wolf", "kraken", "moose", "sloth", "badger"];
const rnd = a => a[Math.floor(Math.random() * a.length)];
function genTag(lang) { const en = (lang || LANG) === "en"; const A = en ? TAG_A_EN : TAG_A, B = en ? TAG_B_EN : TAG_B; return rnd(A) + rnd(B) + Math.floor(Math.random() * 900 + 100); }

/* ---- Gruppennamen: Team-Namen mit Mehrzahl-Nomen ---- */
const GADJ_DE = ["coolen", "harten", "wilden", "zähen", "frechen", "sturen", "fiesen", "flinken", "mutigen", "starken", "krassen", "lässigen", "eisigen", "wütenden", "klebrigen"];
const GNOUN_DE = ["Steinböcke", "Brocken", "Dachse", "Kraken", "Yetis", "Biber", "Geckos", "Raketen", "Affen", "Elche", "Adler", "Drachen", "Pandas", "Otter", "Luchse", "Wale", "Spechte", "Koalas"];
const GADJ_EN = ["Hard", "Wild", "Mighty", "Crazy", "Epic", "Savage", "Mega", "Turbo", "Cosmic", "Electric", "Frosty", "Brutal", "Sticky", "Fearless"];
const GNOUN_EN = ["Rockers", "Crushers", "Climbers", "Crimps", "Slopers", "Dynos", "Beasts", "Goats", "Rockets", "Monsters", "Yetis", "Dragons", "Pandas", "Falcons", "Sloths"];
function genGroupName(lang) { const en = (lang || LANG) === "en"; return en ? `The ${rnd(GADJ_EN)} ${rnd(GNOUN_EN)}` : `Die ${rnd(GADJ_DE)} ${rnd(GNOUN_DE)}`; }

/* ---- große Emoji-Pools (≥1000), getrennt für Gruppen vs. Profil ---- */
// ── Kuratierte Emoji-Listen (alle getestet, keine defekten Zeichen) ──────────
// Starter: 100 Emojis für alle von Anfang an
// ── Emoji Pools ──────────────────────────────────────────────────────────
// Starter: 100 Emojis — immer verfügbar
const EMOJI_STARTER = [
  // Klettern & Berg & Natur
  "🧗","🏔","⛰️","🪨","🏕","🌄","🌅","🌊","🌈","🌟",
  // Energie & Feuer
  "🔥","💥","✨","⚡","💫","❄️","🌙","☀️","🌪","🌀",
  // Sport & Sieg
  "🏆","🥇","🥈","🥉","🎯","🎖","🏅","💪","🤜","👊",
  // Tiere stark
  "🦁","🐯","🦊","🐺","🦝","🐻","🐼","🦅","🦉","🦋",
  // Tiere Wasser & Luft
  "🐬","🦈","🦑","🐙","🦜","🐧","🦩","🦢","🐝","🦋",
  // Essen witzig
  "🍕","🍔","🌮","🍜","🍣","🍦","🎂","🍩","☕","🧃",
  // Sport
  "⚽","🏀","🏈","🎾","🏐","🏉","🎱","🏓","🥊","🎿",
  // Abenteuer
  "🚀","✈️","🏎","⛵","🛸","🎢","🎡","🎪","🪂","🏄",
  // Musik
  "🎸","🎹","🎺","🎻","🥁","🎷","🎵","🎶","🎤","🎧",
  // Magie
  "💎","🔮","🪄","🧲","🔭","🌍","🗺","🧭","⚓","🎃",
];

// Wave 1: +60 ab 50 Ach-Pts (~12 Anfänger-Sessions / 6 Gut-Sessions)
const EMOJI_WAVE1 = [
  // Drachen & Fantasie
  "🐲","🦄","🐉","🦕","🦖","🦎","🐍","👻","🧟","🧛",
  // Blumen & Pflanzen
  "🌵","🌴","🌿","🍀","🌸","🌺","🌻","🌹","🌷","🌼",
  // Früchte
  "🍎","🍊","🍋","🍇","🍓","🍑","🥭","🍍","🥥","🍄",
  // Wassersport & Action
  "🤿","🏊","🚣","🛶","🏋️","🤸","🤺","🥋","🏇","⛷️",
  // Feier
  "🎊","🎉","🎆","🎇","🧨","🎋","🎍","🎎","🎏","🎐",
  // Mehr Tiere
  "🦘","🦏","🐘","🦒","🦓","🐊","🦚","🦆","🐦","🕊️",
];

// Wave 2: +60 ab 150 Ach-Pts (~45 Anfänger / 23 Gut / 17 Pro Sessions)
const EMOJI_WAVE2 = [
  // Games & Tech
  "🤖","👾","🎮","🕹️","🃏","🎲","🧩","🎳","🎰","🎭",
  // Gebäude & Orte
  "🏰","🗼","🗽","⛩️","🕌","⛪","🏯","🛕","🗿","🏛",
  // Landschaften
  "🌋","🏜","🏝","🏞","🌁","🌃","🌆","🌇","🌉","🌌",
  // Fantasy Wesen
  "🦸","🦹","🧙","🧝","🧜","🧚","🧞","🧿","👁","💀",
  // Bäume & Natur
  "🍁","🍂","🍃","🪴","🌾","☘️","🌱","🌲","🌳","🪵",
  // Tiere selten
  "🦦","🦥","🐿","🦔","🦬","🐃","🐎","🦙","🐐","🦌",
];

// Wave 3: +60 ab 300 Ach-Pts (~89 Anfänger / 45 Gut / 34 Pro Sessions)
const EMOJI_WAVE3 = [
  // Wissenschaft
  "⚗️","🔬","🧪","🧬","💊","🩺","🩻","🧠","🫀","🫁",
  // Tech & Digital
  "🌐","📡","🛰","💻","📱","⌚","🎙","📷","📸","🎬",
  // Abenteuer & Waffen
  "💣","⚔️","🛡","🔱","⚜️","🏴‍☠️","🚩","☠️","🦴","👣",
  // Weltraum
  "🪐","🌠","☄️","🌑","🌒","🌓","🌔","🌕","🔭","🛸",
  // Meer & Tiefsee
  "🐚","🪸","🦭","🐳","🦀","🦞","🦐","🐡","🐠","🐟",
  // Mehr Komisches
  "🫧","🪩","🎪","🎠","🎡","🎢","🎯","🎳","🎲","🧸",
];

// Wave 4: +60 ab 500 Ach-Pts (~134 Anfänger / 67 Gut / 50 Pro Sessions)
const EMOJI_WAVE4 = [
  // Süßes Essen
  "🧁","🍰","🍫","🍬","🍭","🍮","🧇","🥞","🧆","🥐",
  // Fahrzeuge
  "🚁","🛩","🚂","🚢","🛳","🛥","🚤","⛴","🛟","⚓",
  // Kunst & Kreativität
  "🎨","🖼","🖌","🖍","✏️","📝","📚","📖","🗓","📌",
  // Mehr Pflanzen
  "💐","🌹","🥀","🌷","🪷","🌻","🌼","🌺","🌸","🌱",
  // Energie & Licht
  "🌡","🧲","🔋","💡","🔦","🕯","🪔","🏮","🔆","🌈",
  // Tiere exotisch
  "🦋","🐛","🐌","🪲","🪳","🦗","🪰","🐜","🐝","🪱",
];

// Wave 5: +60 ab 700 Ach-Pts (~178 Anfänger / 89 Gut / 67 Pro Sessions)
const EMOJI_WAVE5 = [
  // Neue 2023/24 Emojis
  "🫨","🪬","🪤","🪆","🪅","🎑","🀄","🫶","🤝","🫂",
  // Herzen & Gefühle
  "🩷","🩶","🩵","💜","💙","💚","💛","🧡","❤️","🖤",
  // Essen Asiatisch
  "🍱","🥟","🦪","🍤","🍙","🍘","🍥","🥮","🍡","🧋",
  // Mehr Sport
  "🏂","🏌️","🤼","🤾","🏊","🚴","🛹","🛷","🥌","🎣",
  // Mehr Natur
  "🦠","🧫","🧬","🔬","🌡","🧪","🔭","🌍","🌎","🌏",
  // Lifestyle
  "🛋","🪑","🚪","🪟","🧳","👜","👝","🎒","💼","🪮",
];

// Wave 6: +60 ab 900 Ach-Pts (~223 Anfänger / 112 Gut / 84 Pro Sessions)
const EMOJI_WAVE6 = [
  // Exklusiv & Selten — die coolsten
  "👑","💯","🔱","🎭","🃏","🧧","🎴","🎑","🀄","🎖",
  "🦄","🐲","🐉","🦕","🦖","🦅","🦁","🐯","🦊","🦝",
  "🌋","🗻","🏔","🏕","🏖","🏜","🏝","🏞","🌌","🌠",
  "💎","🔮","🪄","✨","💥","🔥","⭐","🌟","💫","⚡",
  // Ultra rare
  "🧿","☯️","☮️","✡️","🕎","🔯","🪬","🧲","🌀","💠",
  "🏹","🗡","⚔️","🛡","🪃","🔱","⚜️","🎯","💣","🎪",
];

// Gesamter Emoji-Pool (deduplicated)
const EMOJI_POOL_ALL = [...new Set([
  ...EMOJI_STARTER, ...EMOJI_WAVE1, ...EMOJI_WAVE2,
  ...EMOJI_WAVE3, ...EMOJI_WAVE4, ...EMOJI_WAVE5, ...EMOJI_WAVE6,
])];
// Starter ohne Duplikate
const EMOJI_BASE = [...new Set(EMOJI_STARTER)];
// Restlicher Pool — wird linear freigeschaltet
const EMOJI_LOCKABLE = EMOJI_POOL_ALL.filter(e => !EMOJI_BASE.includes(e));

const EMOJI_STEP = 5;           // Alle 5 Ach-Pts...
const EMOJI_BATCH = 5;          // ...gibt es 5 neue Emojis

function getUnlockedEmojis(achScore, isAdmin = false) {
  if (isAdmin) return EMOJI_POOL_ALL;
  const extraSlots = Math.floor((achScore || 0) / EMOJI_STEP) * EMOJI_BATCH;
  const extras = EMOJI_LOCKABLE.slice(0, extraSlots);
  return [...EMOJI_BASE, ...extras];
}

// (Legacy-Funktion bleibt für Kompatibilität, wird nicht mehr genutzt)
function _legacyEmojis(achScore, isAdmin = false) {
  if (isAdmin) {
    return [...new Set([...EMOJI_STARTER,...EMOJI_WAVE1,...EMOJI_WAVE2,...EMOJI_WAVE3,...EMOJI_WAVE4,...EMOJI_WAVE5,...EMOJI_WAVE6])];
  }
  return [...new Set([
    ...EMOJI_STARTER,
    ...(achScore >= 50   ? EMOJI_WAVE1 : []),
    ...(achScore >= 150  ? EMOJI_WAVE2 : []),
    ...(achScore >= 300  ? EMOJI_WAVE3 : []),
    ...(achScore >= 500  ? EMOJI_WAVE4 : []),
    ...(achScore >= 700  ? EMOJI_WAVE5 : []),
    ...(achScore >= 900  ? EMOJI_WAVE6 : []),
  ])];
}
function getNextEmojiUnlock(achScore) {
  const score = achScore || 0;
  const slotsUnlocked = Math.floor(score / EMOJI_STEP) * EMOJI_BATCH;
  if (slotsUnlocked >= EMOJI_LOCKABLE.length) return null; // alles freigeschaltet
  const nextSlotAt = (Math.floor(score / EMOJI_STEP) + 1) * EMOJI_STEP;
  return { at: nextSlotAt, count: EMOJI_BATCH, total: EMOJI_POOL_ALL.length, unlocked: EMOJI_BASE.length + slotsUnlocked };
}

// ── Garmin-style Activity Chart ──────────────────────
function ActivityChart({ results, routeDate, label, color="#b8ff00" }) {
  const [mode, setMode] = useState("week"); // week | month | year
  const [metric, setMetric] = useState("tops"); // tops | flashes | both

  const today = new Date();
  const todayISO = today.toISOString().slice(0,10);

  // Berechne Buckets
  const buckets = useMemo(() => {
    const map = {};
    const myR = results || [];
    myR.forEach(r => {
      const d = r.date;
      if (!d) return;
      let key;
      if (mode === "week") {
        // Last 8 weeks
        const dt = new Date(d);
        const diffMs = today - dt;
        const diffW = Math.floor(diffMs / (7*86400000));
        if (diffW < 0 || diffW >= 8) return;
        // ISO week key
        const weekStart = new Date(today);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay() - diffW*7);
        key = weekStart.toISOString().slice(0,10);
      } else if (mode === "month") {
        // Last 6 months
        const dt = new Date(d);
        const diffM = (today.getFullYear() - dt.getFullYear())*12 + (today.getMonth() - dt.getMonth());
        if (diffM < 0 || diffM >= 6) return;
        key = d.slice(0,7); // YYYY-MM
      } else {
        // Last 12 months
        const dt = new Date(d);
        const diffM = (today.getFullYear() - dt.getFullYear())*12 + (today.getMonth() - dt.getMonth());
        if (diffM < 0 || diffM >= 12) return;
        key = d.slice(0,7);
      }
      if (!map[key]) map[key] = { tops:0, flashes:0 };
      if (r.status === "flash") { map[key].flashes++; map[key].tops++; }
      else { map[key].tops++; }
    });
    return map;
  }, [results, mode]);

  // Erzeuge geordnete Buckets
  const keys = useMemo(() => {
    const arr = [];
    if (mode === "week") {
      for (let i=7; i>=0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - d.getDay() - i*7);
        arr.push(d.toISOString().slice(0,10));
      }
    } else if (mode === "month") {
      for (let i=5; i>=0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth()-i, 1);
        arr.push(d.toISOString().slice(0,7));
      }
    } else {
      for (let i=11; i>=0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth()-i, 1);
        arr.push(d.toISOString().slice(0,7));
      }
    }
    return arr;
  }, [mode]);

  const vals = keys.map(k => buckets[k] || {tops:0, flashes:0});
  const maxVal = Math.max(1, ...vals.map(v => metric==="flashes" ? v.flashes : v.tops));

  const BAR_H = 120;
  const BAR_W = 100 / keys.length;
  const GAP = 0.4;

  const labels = keys.map(k => {
    if (mode === "week") {
      const d = new Date(k);
      const weekDays = LANG==="en" ? ["Su","Mo","Tu","We","Th","Fr","Sa","Su"] : ["So","Mo","Di","Mi","Do","Fr","Sa","So"];
      return weekDays[d.getDay()] + " " + d.getDate() + ".";
    } else {
      const parts = k.split("-");
      const months = LANG==="en" ? ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"] : ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];
      return months[parseInt(parts[1])-1];
    }
  });

  return (
    <div className="achart">
      <div className="achart-controls">
        <div className="seg" style={{marginBottom:0}}>
          {["week","month","year"].map(m => <button key={m} className={mode===m?"on":""} onClick={()=>setMode(m)}>{m==="week"?"8W":m==="month"?"6M":"12M"}</button>)}
        </div>
        <div className="seg" style={{marginBottom:0}}>
          <button className={metric==="tops"?"on":""} onClick={()=>setMetric("tops")}>Tops</button>
          <button className={metric==="flashes"?"on":""} onClick={()=>setMetric("flashes")}>Flashes</button>
          <button className={metric==="both"?"on":""} onClick={()=>setMetric("both")}>{LANG==="en"?"Both":"Beide"}</button>
        </div>
      </div>
      <svg viewBox={"0 0 100 " + (BAR_H+20)} preserveAspectRatio="none" className="achart-svg">
        {vals.map((v,i) => {
          const x = i * BAR_W + GAP;
          const w = BAR_W - GAP*2;
          const topH = ((metric==="flashes" ? v.flashes : v.tops) / maxVal) * BAR_H;
          const flashH = metric==="both" ? (v.flashes / maxVal) * BAR_H : 0;
          return (
            <g key={i}>
              {/* Top bar */}
              {(metric!=="flashes") && topH > 0 && <rect x={x} y={BAR_H-topH} width={w} height={topH} fill="rgba(184,255,0,0.25)" rx="0.5"/>}
              {/* Flash overlay */}
              {metric==="both" && flashH > 0 && <rect x={x} y={BAR_H-flashH} width={w} height={flashH} fill={color} rx="0.5"/>}
              {/* Flash only */}
              {metric==="flashes" && topH > 0 && <rect x={x} y={BAR_H-topH} width={w} height={topH} fill={color} rx="0.5"/>}
            </g>
          );
        })}
        {/* Baseline */}
        <line x1="0" y1={BAR_H} x2="100" y2={BAR_H} stroke="rgba(255,255,255,0.1)" strokeWidth="0.3"/>
        {/* Y max label */}
        <text x="1" y="5" fontSize="4" fill="rgba(255,255,255,0.5)" fontFamily="Barlow Condensed">{maxVal}</text>
      </svg>
      <div className="achart-labels">
        {labels.map((l,i) => <span key={i}>{l}</span>)}
      </div>
      {metric==="both" && <div className="achart-legend">
        <span className="achart-dot" style={{background:"rgba(184,255,0,0.25)"}}/> Tops &nbsp;
        <span className="achart-dot" style={{background:color}}/> Flashes
      </div>}
    </div>
  );
}


// ── First-run Intro Modal ─────────────────────────────
function IntroModal({ me, onClose, onDismiss }) {
  const en = LANG === "en";
  return (
    <div className="scrim" onClick={onClose} style={{zIndex:200, alignItems:"center", padding:"20px 16px", backgroundImage:`url(${BG_LOGIN})`, backgroundSize:"cover", backgroundPosition:"center"}}>
      <div className="intro-modal" onClick={e=>e.stopPropagation()}>
        <div className="intro-header">
          <img src={LOGIN_LOGO} alt="blocscore" style={{width:72,height:72,objectFit:"contain",borderRadius:12,marginBottom:8,display:"block",margin:"0 auto 10px"}} />
          <h2 className="intro-ttl">{en?"Welcome to blocscore":"Willkommen bei blocscore"}</h2>
          <p className="intro-sub">{en?"Track your sends, earn achievements, compete with friends.":"Trage deine Begehungen ein, sammle Erfolge und vergleich dich."}</p>
        </div>

        <div className="intro-cards">
          <div className="intro-card">
            <div className="intro-card-icon">
              <svg width="22" height="22" viewBox="0 0 10 10" fill="none" stroke="#b8ff00" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="1.5,5.5 4,8 8.5,2"/></svg>
            </div>
            <div>
              <div className="intro-card-ttl">Top</div>
              <div className="intro-card-txt">{en?"You climbed the route — maybe not on the first try.":"Du hast die Route geschafft — vielleicht nicht beim ersten Versuch."}</div>
            </div>
          </div>

          <div className="intro-card">
            <div className="intro-card-icon">
              <svg width="20" height="22" viewBox="0 0 10 12" fill="#b8ff00"><path d="M7 1L1 7h4l-2 4 6-6H5z"/></svg>
            </div>
            <div>
              <div className="intro-card-ttl">Flash ⚡</div>
              <div className="intro-card-txt">{en?"First try, no falls, no beta — pure send!":"Erster Versuch, kein Sturz, kein Vorschauen — pure Begehung!"}</div>
            </div>
          </div>

          <div className="intro-card">
            <div className="intro-card-icon" style={{fontSize:20}}>📥</div>
            <div>
              <div className="intro-card-ttl">{en?"Log a route":"Route eintragen"}</div>
              <div className="intro-card-txt">{en?"Tap any route → +Enter → choose Top or Flash.":"Tippe eine Route an → +Eintragen → Top oder Flash wählen."}</div>
            </div>
          </div>

          <div className="intro-card">
            <div className="intro-card-icon" style={{fontSize:20}}>🏆</div>
            <div>
              <div className="intro-card-ttl">{en?"Skillpoints & achievements":"Skillpoints & Erfolge"}</div>
              <div className="intro-card-txt">{en?"Earn Skillpoints by climbing. Unlock emojis, comments and groups.":"Klettere für Skillpoints. Schalte Emojis, Kommentare und Gruppen frei."}</div>
            </div>
          </div>
        </div>

        <div className="intro-actions">
          <button className="btn" style={{marginTop:0}} onClick={onClose}>
            {en?"Let's go! 🚀":"Los geht's! 🚀"}
          </button>
          <button className="btn ghost" style={{marginTop:8, fontSize:13}} onClick={onDismiss}>
            {en?"Got it — don't show again":"Verstanden — nicht mehr anzeigen"}
          </button>
        </div>
      </div>
    </div>
  );
}


// ── Day Summary Share Card ────────────────────────────
function ShareCard({ me, routes, today, onClose, logoSrc }) {
  const canvasRef = useRef(null);
  const [generated, setGenerated] = useState(false);
  const [shareUrl, setShareUrl] = useState(null);

  const todayRoutes = routes.filter(r => r.date === today && r.results?.[me?.name]);
  const todayTops = todayRoutes.filter(r => r.results[me.name] === "top").length;
  const todayFlashes = todayRoutes.filter(r => r.results[me.name] === "flash").length;
  const todayPts = todayRoutes.reduce((s,r) => s + pointsFor(r.grade, r.results[me.name]), 0);
  const todayMeters = todayRoutes.length * WALL_HEIGHT;
  const gradeMap = {};
  todayRoutes.forEach(r => { gradeMap[r.grade] = (gradeMap[r.grade]||0)+1; });
  const bestGrade = todayRoutes.length ? Math.max(...todayRoutes.map(r=>r.grade)) : 0;
  const en = LANG === "en";

  const COLOR_MAP = {
    blau:"#4a90d9",gelb:"#f5c800",rot:"#d93025",grün:"#2ecc6a",
    lila:"#9b59b6",schwarz:"#555566",weiß:"#dddddd",pink:"#e5477d"
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || todayRoutes.length === 0) return;
    const ctx = canvas.getContext("2d");
    const W = 400, H = 520;
    canvas.width = W * 2; canvas.height = H * 2;
    ctx.scale(2, 2);

    // Background
    ctx.fillStyle = "#13141a";
    ctx.fillRect(0, 0, W, H);

    // Subtle lime gradient top
    const grad = ctx.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, "rgba(184,255,0,0.08)");
    grad.addColorStop(1, "rgba(184,255,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Border
    ctx.strokeStyle = "rgba(184,255,0,0.3)";
    ctx.lineWidth = 1.5;
    roundRect(ctx, 1, 1, W-2, H-2, 16);
    ctx.stroke();

    // Logo
    if (logoSrc) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 18, 18, 32, 32);
        drawText(ctx, W, H);
      };
      img.src = logoSrc;
    } else { drawText(ctx, W, H); }

    function roundRect(c, x, y, w, h, r) {
      c.beginPath(); c.moveTo(x+r,y);
      c.lineTo(x+w-r,y); c.arcTo(x+w,y,x+w,y+r,r);
      c.lineTo(x+w,y+h-r); c.arcTo(x+w,y+h,x+w-r,y+h,r);
      c.lineTo(x+r,y+h); c.arcTo(x,y+h,x,y+h-r,r);
      c.lineTo(x,y+r); c.arcTo(x,y,x+r,y,r); c.closePath();
    }

    function drawText(ctx, W, H) {
      // blocscore label
      ctx.fillStyle = "#b8ff00";
      ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
      ctx.fillText("blocscore", 58, 36);

      // Date
      const dateStr = new Date(today+"T12:00:00").toLocaleDateString(en?"en-GB":"de-DE",{weekday:"long",day:"numeric",month:"long"});
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "12px system-ui, sans-serif";
      ctx.fillText(dateStr, 18, 60);

      // User name
      ctx.fillStyle = "#fff";
      ctx.font = "bold 22px system-ui, sans-serif";
      ctx.fillText(me?.name || "?", 18, 90);

      // Divider
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(18, 104); ctx.lineTo(W-18, 104); ctx.stroke();

      // Big KPIs
      const kpis = [
        { label: en?"Tops":"Tops", value: todayTops, sub: "" },
        { label: "Flashes", value: todayFlashes, sub: "" },
        { label: en?"Points":"Punkte", value: fmtPts(todayPts), sub: "" },
        { label: en?"Meters":"Meter", value: Math.round(todayMeters)+"m", sub: "" },
      ];
      const colW = (W-36) / kpis.length;
      kpis.forEach((k, i) => {
        const x = 18 + i * colW + colW/2;
        ctx.fillStyle = "#b8ff00";
        ctx.font = "bold 28px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(k.value, x, 145);
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.font = "10px system-ui, sans-serif";
        ctx.fillText(k.label.toUpperCase(), x, 160);
      });
      ctx.textAlign = "left";

      // Divider
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.beginPath(); ctx.moveTo(18, 174); ctx.lineTo(W-18, 174); ctx.stroke();

      // Grade breakdown
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.fillText(en?"BY GRADE":"NACH GRAD", 18, 192);

      const grades = [1,2,3,4,5,6,7,8];
      const maxCount = Math.max(1, ...grades.map(g => gradeMap[g]||0));
      const bW = (W-36)/grades.length;
      const bMaxH = 60;
      grades.forEach((g, i) => {
        const cnt = gradeMap[g] || 0;
        const x = 18 + i*bW;
        const bH = cnt > 0 ? Math.max(4, (cnt/maxCount)*bMaxH) : 2;
        const y = 200 + bMaxH - bH;
        ctx.fillStyle = cnt > 0 ? "rgba(184,255,0,0.85)" : "rgba(255,255,255,0.08)";
        roundRect(ctx, x+2, y, bW-4, bH, 2);
        ctx.fill();
        if (cnt > 0) {
          ctx.fillStyle = "#b8ff00";
          ctx.font = "bold 11px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(cnt, x + bW/2, y-4);
        }
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.font = "10px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(g, x + bW/2, 274);
      });
      ctx.textAlign = "left";

      // Color dots
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.fillText(en?"COLORS":"FARBEN", 18, 300);
      const colorMap2 = {};
      todayRoutes.forEach(r => { const c = (r.name||"").toLowerCase(); colorMap2[c] = (colorMap2[c]||0)+1; });
      let cx = 18, cy = 316;
      Object.entries(colorMap2).sort((a,b)=>b[1]-a[1]).forEach(([c, cnt]) => {
        ctx.fillStyle = COLOR_MAP[c] || "#888";
        ctx.beginPath(); ctx.arc(cx+8, cy+8, 8, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.font = "11px system-ui, sans-serif";
        ctx.fillText("×"+cnt, cx+20, cy+13);
        cx += 48;
        if (cx > W-60) { cx = 18; cy += 26; }
      });

      // Best grade badge
      if (bestGrade > 0) {
        cy = Math.max(cy + 30, 370);
        ctx.strokeStyle = "rgba(184,255,0,0.4)";
        ctx.lineWidth = 1;
        ctx.fillStyle = "rgba(184,255,0,0.08)";
        roundRect(ctx, 18, cy, W-36, 44, 10);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#b8ff00";
        ctx.font = "bold 14px system-ui, sans-serif";
        ctx.fillText(en?"Best grade today:":"Bester Grad heute:", 32, cy+17);
        ctx.font = "bold 22px system-ui, sans-serif";
        ctx.fillText(bestGrade+"er", 32, cy+36);
      }

      // Footer
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("blocscore.de  ·  elevate. score. repeat.", W/2, H-14);
      ctx.textAlign = "left";

      // Done!
      const url = canvas.toDataURL("image/png");
      setShareUrl(url);
      setGenerated(true);
    }
  }, []);

  const handleShare = async () => {
    if (!shareUrl) return;
    const blob = await (await fetch(shareUrl)).blob();
    const file = new File([blob], `blocscore-${today}.png`, { type: "image/png" });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      navigator.share({ files: [file], title: "blocscore Day Summary" });
    } else {
      const a = document.createElement("a");
      a.href = shareUrl; a.download = `blocscore-${today}.png`;
      a.click();
    }
  };

  return (
    <div className="scrim" onClick={onClose} style={{zIndex:190, alignItems:"center", padding:"20px 16px"}}>
      <div className="share-card-modal" onClick={e=>e.stopPropagation()}>
        <div className="shead">
          <h2>{en?"Day Summary":"Tages-Zusammenfassung"}</h2>
          <button className="x" onClick={onClose}><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 2l10 10M12 2L2 12"/></svg></button>
        </div>
        {todayRoutes.length === 0 ? (
          <div className="sbody" style={{padding:24, textAlign:"center", color:"var(--muted)"}}>
            {en?"No routes logged today yet.":"Noch keine Routen heute eingetragen."}
          </div>
        ) : (
          <div className="sbody" style={{padding:"12px 16px 20px"}}>
            <canvas ref={canvasRef} style={{ width:"100%", borderRadius:8, display:"block", border:"1px solid rgba(255,255,255,.1)" }} />
            <div style={{display:"flex", gap:10, marginTop:14}}>
              <button className="btn" style={{marginTop:0}} onClick={handleShare}>
                {en?"Share / Download":"Teilen / Herunterladen"} ↗
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


function buildAchievements(lang) {
  const en = lang === "en";
  const A = []; let id = 0;
  const push = (cat, icon, name, desc, target, key, p) => A.push({ id: "a"+(id++), cat, icon, name, desc, target, key, pts: p });
  const COLORS = ["blau","grün","rot","gelb","lila","schwarz","weiß","pink"];
  const CEN = {blau:"blue",grün:"green",rot:"red",gelb:"yellow",lila:"purple",schwarz:"black",weiß:"white",pink:"pink"};
  const cap = s => s.charAt(0).toUpperCase()+s.slice(1);
  const cName = c => en ? cap(CEN[c]||c) : cap(c);
  const tier = (arr, i, f) => arr[i] || `${f} ${i+1}`;
  // Scaling: log-based, capped, calibrated to profiles
  const pts = n => Math.min(150, Math.max(5, Math.round(Math.log2(n+1)*9+3)));
  const L = {Gesamt:en?"Total":"Gesamt",Flash:"Flash",Punkte:en?"Points":"Punkte",Kombi:en?"Combo":"Kombi",Tagesform:en?"Day form":"Tagesform",Spezial:en?"Special":"Spezial",Treue:en?"Loyalty":"Treue",Straßen:en?"Straights":"Straßen",Mehrling:en?"Multiples":"Mehrling",Ausdauer:en?"Endurance":"Ausdauer"};

  // GESAMT TOPS — Anfänger 14/sess→~1000 nach 70 sess; Gut 19/sess; Pro 32/sess
  const TOPS=[25,60,120,250,500,900,1500,2500,4000,6500,10000,15000,22000,32000,45000];
  const TNAMES_DE=["Erster Zug","Handflächen warm","Dabei","Stammgast","Fleißig","Ehrgeizig","Halbhundert","Hartnäckig","Hundert!","Obsessiv","Zweihundert","Dreihundert","Fünfhundert","Dreiviertel-Tausend","Tausendsassa","Zweitausend","Dreitausend","Boulder-Gott"];
  const TNAMES_EN=["First Move","Palms Warm","On Board","Regular","Diligent","Ambitious","Half Century","Persistent","Hundred!","Obsessed","Two Hundred","Three Hundred","Five Hundred","Three-Quarter K","Jack of All","Two Thousand","Three Thousand","Boulder God"];
  TOPS.forEach((n,i)=>push(L.Gesamt,"🧗",tier(en?TNAMES_EN:TNAMES_DE,i,""),en?`Climb ${n} routes total`:`Schaffe ${n} Routen insgesamt`,n,"tops",pts(n)+Math.floor(n/10)));

  // FLASH — harder, Anfänger flasst selten, Pro flasht ~6/sess
  const FLASHES=[15,40,90,200,400,800,1800,3500];
  const FDE=["Erster Flash","Flash-Trio","Flash-Fünf","Flash-Zehn","Flash-Profi","Flash-Meister","Flash-Legende","Flash-Elite","Flash-Gott","Flash-Mythos"];
  const FEN=["First Flash","Flash Trio","Flash Five","Flash Ten","Flash Pro","Flash Master","Flash Legend","Flash Elite","Flash God","Flash Myth"];
  FLASHES.forEach((n,i)=>push("Flash","⚡",tier(en?FEN:FDE,i,""),en?`Flash ${n} routes`:`Flashe ${n} Routen`,n,"flashes",Math.round(pts(n)*2.2)));

  // PUNKTE — Anfänger: 7pts/sess→100pts nach 14 sess; Gut: 22.5; Pro: 51.5
  const PTS_V=[150,400,1000,2500,6000,13000,28000,65000,130000,260000];
  const PDE=["Erste Punkte","Guter Start","Dreißig","Dreistellig","Gut","Sehr gut","Sechshundert","Tausend","Elite","Hochleistung","Punktegott"];
  const PEN=["First Points","Good Start","Thirty","Triple Digits","Good","Very Good","Six Hundred","Thousand","Elite","High Performance","Point God"];
  PTS_V.forEach((n,i)=>push(L.Punkte,"💎",tier(en?PEN:PDE,i,""),en?`Earn ${n} total points`:`Erreiche ${n} Spielpunkte`,n,"points",pts(n)+5));

  // GRADE — kalibriert: 1er/2er/3er Anfänger, 4er/5er Gut, 6er/7er Fortgeschritten, 8er Pro
  const gScale=[0,1,1.2,1.5,2,3,5,8,15];
  GRADES.forEach(g=>{
    const tC=g<=2?[25,75,150,300,600,1200,2500]:g<=4?[15,40,100,200,400,750,1500]:g<=6?[5,20,50,120,250,500]:g===7?[2,10,30,75,150]:[1,5,20,50,100];
    tC.forEach((n)=>push(`${g}`,"🪨",en?`${n}× Grade ${g}`:`${n}× ${g}er`,en?`Climb ${n} grade-${g} routes`:`Klettere ${n} ${g}er-Routen`,n,`grade:${g}:t`,Math.round(pts(n)*gScale[g])));
    const fC=g<=3?[25,75,180]:g<=5?[15,50,120,250,500]:g<=7?[5,25,60,150,300]:[2,12,40,100];
    fC.forEach((n)=>push(`${g}`,"⚡",en?`Flash ${n}× Grade ${g}`:`Flash ${n}× ${g}er`,en?`Flash ${n} grade-${g} routes`:`Flashe ${n} ${g}er-Routen`,n,`grade:${g}:f`,Math.round(pts(n)*gScale[g]*2)));
  });

  // FARBE
  COLORS.forEach(c=>{
    [10,30,75,150,300,600,1200].forEach(n=>push(cName(c),"🎨",en?`${n}× ${cName(c)}`:`${n}× ${cName(c)}`,en?`Climb ${n} ${cName(c)} routes`:`Klettere ${n} ${cName(c)}-Routen`,n,`color:${c}:t`,pts(n)+2));
    [15,40,90,200,400].forEach(n=>push(cName(c),"⚡",en?`Flash ${n}× ${cName(c)}`:`Flash ${n}× ${cName(c)}`,en?`Flash ${n} ${cName(c)} routes`:`Flashe ${n} ${cName(c)}-Routen`,n,`color:${c}:f`,pts(n)+7));
  });

  // TAGESFORM — Anfänger max ~14, Gut ~19, Pro ~32+
  [15,20,25,30,36,42,50].forEach(n=>push(L.Tagesform,"🔥",en?`${n} in one day`:`${n} an einem Tag`,en?`Climb ${n} routes in one day`:`Schaffe ${n} Routen an einem Tag`,n,"maxDayTops",pts(n)*2));
  [8,12,16,20,25,30,38].forEach(n=>push(L.Tagesform,"⚡",en?`Flash ${n} in one day`:`${n} Flashes an einem Tag`,en?`Flash ${n} routes in one day`:`Flashe ${n} Routen an einem Tag`,n,"maxDayFlashes",pts(n)*3));

  // KOMBI / SPEZIAL
  [1,3,5,10,25].forEach((n,i)=>push(L.Spezial,"🌈",tier(en?["Rainbow","Double Rainbow","Rainbow Collector","Rainbow Pro","Rainbow Legend"]:["Regenbogen","Doppel-Regenbogen","Regenbogen-Sammler","Regenbogen-Profi","Regenbogen-Legende"],i,""),en?`On ${n} day(s) climb blue+green+red+yellow+purple`:`An ${n} Tag(en) blau+grün+rot+gelb+lila`,n,"rainbowDays",40+i*18));
  [1,2,3,5].forEach((n,i)=>push(L.Spezial,"📊",en?`All grades in one day (${n}×)`:`Alle Grade an einem Tag (${n}×)`,en?`On ${n} day(s) climb all grades 1–8`:`An ${n} Tag(en) alle Grade 1–8`,n,"allGradeDays",60+i*25));

  // STRASSEN
  [[4,50],[5,70],[6,100],[7,135],[8,175]].forEach(([k,p])=>push(L.Straßen,"🛤️",en?`Grades 1–${k} in one day`:`Grade 1–${k} an einem Tag`,en?`Climb grades 1–${k} in one day`:`Schaffe Grade 1–${k} an einem Tag`,k,"maxFrom1",p));
  [[4,45],[5,65],[6,90],[7,120]].forEach(([k,p])=>push(L.Straßen,"🛤️",en?`${k} consecutive grades`:`${k} aufein­ander­folgende Grade`,en?`Climb ${k} consecutive grades in one day`:`Schaffe ${k} aufeinanderfolgende Grade`,k,"maxRun",p));

  // MEHRLING
  [[5,50],[8,90],[10,130],[12,175],[15,230],[20,320]].forEach(([k,p])=>push(L.Mehrling,"🎲",en?`${k} of a kind`:`${k}er-Ling`,en?`Climb ${k} routes of same grade in one day`:`Schaffe ${k} Routen im selben Grad an einem Tag`,k,"maxOfAKind",p));

  // TREUE — Anfänger: 50 Tage nach ~50 Sessions, Pro viel schneller
  [[5,8],[10,14],[20,20],[40,30],[65,42],[95,55],[130,68],[175,85],[230,105],[300,135],[380,168],[480,220],[600,300]].forEach(([n,p])=>push(L.Treue,"📅",en?`${n} climbing day${n>1?"s":""}`:`${n} Klettertag${n>1?"e":""}`,en?`Climb on ${n} different days`:`Klettere an ${n} verschiedenen Tagen`,n,"distinctDays",p));

  // AUSDAUER
  [2,3,5,7,10,13,17,22,28,36,44,52,78].forEach(n=>push(L.Ausdauer,"⏳",en?`${n} weeks in a row`:`${n} Wochen in Folge`,en?`At least 1×/week for ${n} weeks`:`Mindestens 1×/Woche für ${n} Wochen`,n,"weekStreak1",pts(n*3)+6));
  [3,5,8,12,16,22,32,52].forEach(n=>push(L.Ausdauer,"⏳",en?`2×/week · ${n} weeks`:`2×/Woche · ${n} Wochen`,en?`At least 2×/week for ${n} weeks`:`Mindestens 2×/Woche für ${n} Wochen`,n,"weekStreak2",pts(n*5)+10));
  [20,35,55,75,90,100].forEach(n=>push(L.Ausdauer,"📆",en?`${n} days in 100`:`${n} Tage in 100`,en?`Climb on ${n} days within 100 days`:`An ${n} Tagen innerhalb von 100 Tagen`,n,"daysIn100",pts(n*3)+6));
  [40,80,120,170,220,270,320,360].forEach(n=>push(L.Ausdauer,"📆",en?`${n} days/year`:`${n} Tage/Jahr`,en?`Climb on ${n} days within a year`:`An ${n} Tagen innerhalb eines Jahres`,n,"daysIn365",pts(n*2)+6));

  // BERGE — totalRoutes × wallHeight(3.5m default)
  [
    [143,"500 Höhenmeter 🌱",en?"500m — First Summit Feeling":"500m — Erstes Gipfelgefühl",25],
    [426,"Feldberg (1493m) 🌲",en?"Black Forest Top — Germany's highest in the West":"Feldberg — höchster Berg des Schwarzwalds",45],
    [619,"Mount Olympus (2917m) 🏛",en?"Climb the throne of the Greek gods":"Erklimm den Thron der griechischen Götter",65],
    [847,"Zugspitze (2962m) 🇩🇪",en?"Germany's highest peak — you made it!":"Zugspitze — höchster Berg Deutschlands — geschafft!",80],
    [1137,"Großglockner (3798m) 🇦🇹",en?"Austria's crown — the Großglockner":"Österreichs Krone — der Großglockner",100],
    [1280,"Matterhorn (4478m) 🇨🇭",en?"The iconic Swiss pyramid — the Matterhorn":"Die ikonische Schweizer Pyramide — das Matterhorn",120],
    [1374,"Mont Blanc (4806m) 🇫🇷",en?"Western Europe's highest — Mont Blanc!":"Höchster Berg Westeuropas — Mont Blanc!",145],
    [1615,"Mount Elbrus (5642m) 🇷🇺",en?"Europe's highest — the sleeping volcano Elbrus":"Europas höchster — der schlafende Vulkan Elbrus",180],
    [1684,"Kilimanjaro (5895m) 🌍",en?"Roof of Africa — the lonely giant":"Dach Afrikas — der einsame Riese",205],
    [1769,"Denali (6190m) 🌎",en?"The Great One — North America's throne":"The Great One — Nordamerikas Thron",250],
    [1989,"Aconcagua (6961m) 🏔",en?"Stone Sentinel — highest in the Americas":"Steinerner Wächter — höchster Berg der Amerikas",310],
    [2460,"K2 (8611m) ☠️",en?"The Savage Mountain — world's second highest":"The Savage Mountain — zweithöchster der Welt",410],
    [2528,"Mount Everest (8849m) 🏆",en?"MOUNT EVEREST — THE ULTIMATE!":"MOUNT EVEREST — DIE ULTIMATIVE LEISTUNG!",500],
  ].forEach(([n,name,desc,p])=>push("Berge","🔥",name,desc,n,"totalRoutes",p));

  // KLETTERKLASSIKER — kumulierte Höhenmeter entsprechen der Länge legendärer Routen
  // Jede Route in der Halle = WALL_HEIGHT Meter (Standard 3.5m)
  // Diese Achievements feiern, wenn deine Gesamt-Höhenmeter eine berühmte Route "erklimmen"
  const KLETTERR = "Klassiker";
  [
    // Höhenmeter-Äquivalente berühmter Routen (Länge der Route in Meter / 3.5)
    [86,   en?"Via Ferrata Königsjodler (300m) 🇦🇹":"Via Ferrata Königsjodler (300m) 🇦🇹",
           en?"Your total meters = the legendary Austrian via ferrata (300m)":"Deine Gesamtmeter = die legendäre österreichische Klettersteig-Route (300m)",30],
    [257,  en?"El Capitan – The Nose (900m) 🏔":"El Capitan – The Nose (900m) 🏔",
           en?"900m of climbing — as long as the most famous big wall route ever":"900m geklettert — so lang wie die berühmteste Big-Wall-Route der Welt",85],
    [486,  en?"Trollveggen – Troll Wall (1700m) 🧌":"Trollveggen – Trollwand (1700m) 🧌",
           en?"1700m — the height of Europe's tallest vertical rock face (Norway)":"1700m — Europas höchste senkrechte Felswand in Norwegen",155],
    [514,  en?"Eiger Nordwand (1800m) ⚡":"Eiger Nordwand (1800m) ⚡",
           en?"1800m — the height of the legendary Eiger North Face":"1800m — Höhe der legendären Eiger Nordwand",165],
    [686,  en?"Grand Capucin – East Face (2400m) 🇫🇷":"Grand Capucin – Ostwand (2400m) 🇫🇷",
           en?"2400m — like the classic Mont Blanc massif granite route":"2400m — wie die klassische Granit-Route am Mont-Blanc-Massiv",210],
    [857,  en?"Yosemite Triple Crown (3000m) 👑":"Yosemite Triple Crown (3000m) 👑",
           en?"3000m — like climbing El Capitan, Half Dome & Mt Watkins in a day":"3000m — wie El Capitan, Half Dome & Mt Watkins an einem Tag",280],
  ].forEach(([n,name,desc,p])=>push(KLETTERR,"🧗",name,desc,n,"totalRoutes",p));

  // ZEIT-CHALLENGES (Routen an einem Tag = maxDayTops)
  const ZEIT = en?"Speed":"Speed";
  [
    [15,en?"Speed Rookie (15 in 1 day) ⏱":"Speed Rookie (15 an 1 Tag) ⏱",
      en?"15 routes in one day — solid session!":"15 Routen an einem Tag — starke Session!",80],
    [20,en?"El Cap Free Solo (20 in 1 day) 🎬":"El Cap Free Solo (20 an 1 Tag) 🎬",
      en?"20 routes in one day — like Alex Honnold's free solo pace":"20 an einem Tag — wie Alex Honnolds Free Solo Tempo",130],
    [25,en?"Ueli Steck – Eiger (25 in 1 day) 💨":"Ueli Steck – Eiger (25 an 1 Tag) 💨",
      en?"25 routes in one day — like Ueli Steck's Eiger record pace":"25 an einem Tag — wie Ueli Stecks Eiger-Rekord Tempo",190],
    [30,en?"Dawn Wall (30 in 1 day) 🌅":"Dawn Wall (30 an 1 Tag) 🌅",
      en?"30 routes in one day — legendary like the Dawn Wall":"30 an einem Tag — legendär wie die Dawn Wall",260],
    [40,en?"Deep Water Solo Mode (40 in 1 day) 🌊":"Deep Water Solo Modus (40 an 1 Tag) 🌊",
      en?"40 routes in one day — no mercy":"40 an einem Tag — gnadenlos",360],
    [50,en?"Project Moonboard (50 in 1 day) 🌙":"Project Moonboard (50 an 1 Tag) 🌙",
      en?"50 routes in one day — you are on another level":"50 an einem Tag — du bist auf einem anderen Level",500],
  ].forEach(([n,name,desc,p])=>push(ZEIT,"⏱",name,desc,n,"maxDayTops",p));

  return A;
}

const ACH_DE = buildAchievements("de");
const ACH_EN = buildAchievements("en");
function ACHS() { return LANG === "en" ? ACH_EN : ACH_DE; }
function catIcon(c) { const a = ACHS().find(x => x.cat === c); return a ? a.icon : "🏅"; }

const RAINBOW = ["blau", "grün", "rot", "gelb", "lila"];
function normColor(c) { return c === "gruen" ? "grün" : c === "weiss" ? "weiß" : c; }
function computeAgg(routes, name) {
  const agg = { tops: 0, flashes: 0, points: 0, grade: {}, color: {}, wall: {}, gradeColor: {}, days: {} };
  routes.forEach(r => {
    const st = r.results?.[name]; if (!st) return;
    const g = r.grade, w = wallCanon(r.gym), isF = st === "flash";
    const cw = colorWord(r.name); const c = cw ? normColor(cw.toLowerCase()) : null;
  agg.tops++; if (isF) agg.flashes++; agg.points += pointsFor(g, st); agg.totalRoutes = (agg.totalRoutes || 0) + 1;
    (agg.grade[g] = agg.grade[g] || { t: 0, f: 0 }).t++; if (isF) agg.grade[g].f++;
    (agg.wall[w] = agg.wall[w] || { t: 0, f: 0 }).t++; if (isF) agg.wall[w].f++;
    if (c) { (agg.color[c] = agg.color[c] || { t: 0, f: 0 }).t++; if (isF) agg.color[c].f++; const k = g + "|" + c; (agg.gradeColor[k] = agg.gradeColor[k] || { t: 0, f: 0 }).t++; if (isF) agg.gradeColor[k].f++; }
    const day = r.date || "?"; const D = agg.days[day] = agg.days[day] || { t: 0, f: 0, colors: new Set(), grades: new Set(), cc: {}, gc: {} };
    D.t++; if (isF) D.f++; D.grades.add(g); D.gc[g] = (D.gc[g] || 0) + 1; if (c) { D.colors.add(c); D.cc[c] = (D.cc[c] || 0) + 1; }
  });
  agg.maxDayTops = 0; agg.maxDayFlashes = 0; agg.maxColorDay = {}; agg.maxGradeDay = {}; agg.rainbowDays = 0; agg.allGradeDays = 0;
  agg.maxFrom1 = 0; agg.maxRun = 0; agg.maxOfAKind = 0;
  agg.distinctDays = Object.keys(agg.days).length;
  // Ausdauer / Konsistenz
  const dayNums = Object.keys(agg.days).filter(d => d && d !== "?").map(d => Math.floor(Date.parse(d) / 86400000)).filter(n => !isNaN(n)).sort((a, b) => a - b);
  const wk = {}; dayNums.forEach(n => { const w = Math.floor((n - 4) / 7); wk[w] = (wk[w] || 0) + 1; });
  const weeks = Object.keys(wk).map(Number).sort((a, b) => a - b);
  const streak = minC => { let best = 0, run = 0, prev = null; for (const w of weeks) { if (wk[w] >= minC) { run = (prev !== null && w === prev + 1) ? run + 1 : 1; prev = w; best = Math.max(best, run); } else { prev = null; run = 0; } } return best; };
  agg.weekStreak1 = streak(1); agg.weekStreak2 = streak(2);
  const inWin = span => { let best = 0, l = 0; for (let r = 0; r < dayNums.length; r++) { while (dayNums[r] - dayNums[l] >= span) l++; best = Math.max(best, r - l + 1); } return best; };
  agg.daysIn100 = inWin(100); agg.daysIn365 = inWin(365);
  Object.values(agg.days).forEach(D => {
    agg.maxDayTops = Math.max(agg.maxDayTops, D.t); agg.maxDayFlashes = Math.max(agg.maxDayFlashes, D.f);
    Object.entries(D.cc).forEach(([c, n]) => { agg.maxColorDay[c] = Math.max(agg.maxColorDay[c] || 0, n); });
    Object.entries(D.gc).forEach(([g, n]) => { agg.maxGradeDay[g] = Math.max(agg.maxGradeDay[g] || 0, n); agg.maxOfAKind = Math.max(agg.maxOfAKind, n); });
    if (RAINBOW.every(c => D.colors.has(c))) agg.rainbowDays++;
    if ([1, 2, 3, 4, 5, 6, 7, 8].every(g => D.grades.has(g))) agg.allGradeDays++;
    let k = 0; while (D.grades.has(k + 1)) k++; agg.maxFrom1 = Math.max(agg.maxFrom1, k);
    let run = 0, best = 0; for (let g = 1; g <= 8; g++) { if (D.grades.has(g)) { run++; best = Math.max(best, run); } else run = 0; } agg.maxRun = Math.max(agg.maxRun, best);
  });
  return agg;
}
function achValue(agg, key) {
  if (key === "tops") return agg.tops;
  if (key === "flashes") return agg.flashes;
  if (key === "points") return Math.floor(agg.points);
  if (key === "maxDayTops") return agg.maxDayTops;
  if (key === "maxDayFlashes") return agg.maxDayFlashes;
  if (key === "rainbowDays") return agg.rainbowDays;
  if (key === "allGradeDays") return agg.allGradeDays;
  if (key === "maxFrom1") return agg.maxFrom1;
  if (key === "maxRun") return agg.maxRun;
  if (key === "maxOfAKind") return agg.maxOfAKind;
  if (key === "totalRoutes") return agg.totalRoutes || 0;
  if (key === "weekStreak1") return agg.weekStreak1 || 0;
  if (key === "weekStreak2") return agg.weekStreak2 || 0;
  if (key === "daysIn100") return agg.daysIn100 || 0;
  if (key === "daysIn365") return agg.daysIn365 || 0;
  const p = key.split(":");
  if (p[0] === "grade") return (agg.grade[p[1]]?.[p[2]]) || 0;
  if (p[0] === "color") return (agg.color[p[1]]?.[p[2]]) || 0;
  if (p[0] === "wall") return (agg.wall[p[1]]?.[p[2]]) || 0;
  if (p[0] === "gc") return (agg.gradeColor[p[1] + "|" + p[2]]?.[p[3]]) || 0;
  if (p[0] === "maxColorDay") return agg.maxColorDay[p[1]] || 0;
  if (p[0] === "maxGradeDay") return agg.maxGradeDay[p[1]] || 0;
  return 0;
}

const LOGO_IMG = "/logo.png";
const LOGIN_LOGO = "/logo.png";
const BG_LOGIN_WALL = "/login-bg.jpg";
const HEADER_BG = "/header-bg.jpg";

function BrandMark({ size = 20, sw = 2.6 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 25 L10 15 L13.5 20 L18 9 L21.5 14 L27 5" />
      <path d="M27 5 L23.6 5.4 M27 5 L26.4 8.6" />
    </svg>
  );
}

/* ============================ Persistenz ============================ */
const KEY_COMMUNITY = "boulder:community:v11";
const KEY_SESSION = "boulder:session";
async function loadCommunity() { try { const r = await window.storage.get(KEY_COMMUNITY, true); if (r && r.value) return JSON.parse(r.value); } catch (e) {} return null; }
async function saveCommunity(d) { try { await window.storage.set(KEY_COMMUNITY, JSON.stringify(d), true); } catch (e) {} }
async function loadSession() { try { const r = await window.storage.get(KEY_SESSION, false); if (r && r.value) return JSON.parse(r.value); } catch (e) {} return null; }
async function saveSession(s) { try { if (s) await window.storage.set(KEY_SESSION, JSON.stringify(s), false); else await window.storage.delete(KEY_SESSION, false); } catch (e) {} }
async function loadPhotoBlob(id) { try { const r = await window.storage.get("boulder:photo:" + id, true); return r && r.value ? r.value : null; } catch (e) { return null; } }
async function savePhotoBlob(id, d) { try { await window.storage.set("boulder:photo:" + id, d, true); } catch (e) {} }
async function deletePhotoBlob(id) { try { await window.storage.delete("boulder:photo:" + id, true); } catch (e) {} }
function downscale(file, maxDim = 1080, targetKB = 70) {
  return new Promise((res, rej) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      let w = img.naturalWidth, h = img.naturalHeight;
      const s = Math.min(1, maxDim / Math.max(w, h));
      w = Math.round(w * s); h = Math.round(h * s);
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      // Two-pass: try quality 0.72, if still too big drop to 0.5
      try {
        let data = c.toDataURL("image/jpeg", 0.72);
        const kb = Math.round(data.length * 3 / 4 / 1024);
        if (kb > targetKB * 1.4) data = c.toDataURL("image/jpeg", 0.52);
        res(data);
      } catch (e) { rej(e); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("bild")); }; img.src = url;
  });
}
const SEED_COMMUNITY = {
  accounts: [
    // Standard-Logins (nur für die Erst-Einrichtung) — BITTE nach dem ersten Login in der App ändern!
    { id: "acc-admin", name: "admin", role: "admin", pin: "bloc-admin-2748", staff: true },
    { id: "acc-superadmin", name: "superadmin", role: "superadmin", pin: "bloc-crux-superadmin-5193", staff: true },
  ],
  routes: SEED.routes.map(r => ({ ...r, results: {} })),
  groups: [],
  screwDates: { v: "2026-06-04", tb: "2026-06-11", h: "2026-06-18", pl: "2026-06-25", wkw: "2026-05-28" },
};

// ── Global in-memory photo cache (survives re-renders, gone on reload) ──
const _PHOTO_CACHE = new Map();
const _PHOTO_LOADING = new Map(); // promise deduplication

async function cachedLoadPhoto(id) {
  if (_PHOTO_CACHE.has(id)) return _PHOTO_CACHE.get(id);
  if (_PHOTO_LOADING.has(id)) return _PHOTO_LOADING.get(id);
  const p = loadPhotoBlob(id).then(b => { _PHOTO_CACHE.set(id, b); _PHOTO_LOADING.delete(id); return b; });
  _PHOTO_LOADING.set(id, p);
  return p;
}

function RoutePhoto({ photoId, className, style, onClick }) {
  const inline = typeof photoId === "string" && (photoId.startsWith("data:") || photoId.startsWith("/") || photoId.startsWith("http"));
  const [src, setSrc] = useState(inline ? photoId : (_PHOTO_CACHE.get(photoId) || null));
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  // IntersectionObserver: nur laden wenn sichtbar
  useEffect(() => {
    if (inline || _PHOTO_CACHE.has(photoId)) { setVisible(true); return; }
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { rootMargin: "200px" }); // 200px Vorausladen
    obs.observe(el);
    return () => obs.disconnect();
  }, [photoId]);

  // Laden wenn sichtbar + noch nicht gecacht
  useEffect(() => {
    if (!visible || inline) return;
    if (_PHOTO_CACHE.has(photoId)) { setSrc(_PHOTO_CACHE.get(photoId)); return; }
    let on = true;
    cachedLoadPhoto(photoId).then(b => { if (on) setSrc(b); });
    return () => { on = false; };
  }, [visible, photoId]);

  // Placeholder während laden
  if (!src) return (
    <div
      ref={ref}
      className={className}
      style={{ ...style, background: "var(--panel2)", display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      {visible && <div style={{ width: 24, height: 24, border: "2px solid rgba(255,255,255,.15)", borderTopColor: "#b8ff00", borderRadius: "50%", animation: "spin .7s linear infinite" }} />}
    </div>
  );
  return <img className={className} style={{ ...style, cursor: "zoom-in" }} src={src} alt="" onClick={onClick} loading="lazy" decoding="async" />;
}
function PhotoLightbox({ src, onClose }) {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const lastTouchDist = useRef(null);
  const imgRef = useRef(null);

  useEffect(() => {
    const fn = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, []);

  // Wheel zoom
  function onWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.85 : 1.18;
    setScale(s => Math.min(6, Math.max(1, s * delta)));
  }

  // Double-tap / double-click to toggle zoom
  const lastTap = useRef(0);
  function onImgClick(e) {
    e.stopPropagation();
    const now = Date.now();
    if (now - lastTap.current < 300) {
      // double tap
      setScale(s => s > 1.5 ? 1 : 2.5);
      setPos({ x: 0, y: 0 });
    }
    lastTap.current = now;
  }

  // Mouse drag
  function onMouseDown(e) {
    if (scale <= 1) return;
    e.preventDefault();
    setDragging(true);
    setDragStart({ x: e.clientX - pos.x, y: e.clientY - pos.y });
  }
  function onMouseMove(e) {
    if (!dragging || !dragStart) return;
    setPos({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  }
  function onMouseUp() { setDragging(false); setDragStart(null); }

  // Touch pinch zoom + pan
  function onTouchStart(e) {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastTouchDist.current = Math.sqrt(dx*dx + dy*dy);
    } else if (e.touches.length === 1 && scale > 1) {
      setDragging(true);
      setDragStart({ x: e.touches[0].clientX - pos.x, y: e.touches[0].clientY - pos.y });
    }
  }
  function onTouchMove(e) {
    e.preventDefault();
    if (e.touches.length === 2 && lastTouchDist.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const ratio = dist / lastTouchDist.current;
      setScale(s => Math.min(6, Math.max(1, s * ratio)));
      lastTouchDist.current = dist;
    } else if (e.touches.length === 1 && dragging && dragStart) {
      setPos({ x: e.touches[0].clientX - dragStart.x, y: e.touches[0].clientY - dragStart.y });
    }
  }
  function onTouchEnd() { lastTouchDist.current = null; setDragging(false); }

  return (
    <div className="lightbox"
      onClick={scale <= 1 ? onClose : undefined}
      onWheel={onWheel}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <button className="lb-close" onClick={onClose} style={{zIndex:201}}>✕</button>
      {scale > 1 && <div className="lb-hint">{LANG==="en"?"Double-tap to reset":"Doppeltippen zum Zurücksetzen"}</div>}
      <img
        ref={imgRef}
        src={src}
        alt=""
        className="lb-img"
        style={{
          transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
          cursor: scale > 1 ? (dragging ? "grabbing" : "grab") : "zoom-in",
          transition: dragging ? "none" : "transform .15s ease",
          userSelect: "none",
        }}
        onClick={onImgClick}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        draggable={false}
      />
    </div>
  );
}
const AVATAR_EMOJI = {};
function Avatar({ name, size = 22, ring, emoji }) {
  const em = emoji || AVATAR_EMOJI[name];
  if (em) return <span className="ava ava-em" style={{ width: size, height: size, fontSize: size * 0.62, boxShadow: ring ? `0 0 0 2px ${ring}` : "none" }}>{em}</span>;
  return <span className="ava" style={{ width: size, height: size, background: avColor(name), fontSize: size * 0.42, boxShadow: ring ? `0 0 0 2px ${ring}` : "none" }}>{initials(name)}</span>;
}

/* ============================ Styles ============================ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@200;300;400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap');
* { box-sizing:border-box; }
.bld, .login { --bg:#13141a; --panel:#1d222a; --panel2:#262d37; --line:#323a46; --chalk:#edeee8; --muted:#909caa; --amber:#b8ff00; --topfill:#aeb9c4; --topbg:#33414e; --topbd:#46586a; }
.bld { position:fixed; inset:0; background:var(--bg); color:var(--chalk); font-family:'Figtree',system-ui,sans-serif; -webkit-font-smoothing:antialiased; display:flex; flex-direction:column; overflow:hidden; }
.bld *, .login * { font-family:inherit; }
.bld button, .login button { cursor:pointer; background:none; color:inherit; font:inherit; outline:none; } /* NO border:none — let specific classes set their own */
.scroll { overflow-y:auto; -webkit-overflow-scrolling:touch; flex:1; }
.scroll::-webkit-scrollbar { width:0; }
/* ── Responsive desktop layout ── */
@media (min-width: 700px) {
  .bld { max-width:900px; margin:0 auto; box-shadow:0 0 60px rgba(0,0,0,.6); }
  .route-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:10px; }
  .route-grid .rc { margin-bottom:0; }
  .rc .rbanner { height:160px; object-fit:cover; }
  .hkpi-grid { grid-template-columns:repeat(4,1fr); }
  .stcard { break-inside:avoid; }
  .brand-logo { height:30px !important; max-height:30px !important; }
  .tab svg { width:24px !important; height:24px !important; }
  .tabbar { min-height:66px !important; height:66px !important; }
}
@media (min-width: 1100px) {
  .bld { max-width:1100px; }
  .route-grid { grid-template-columns:repeat(3,1fr); }
}
.ava { border-radius:50%; flex:none; display:inline-flex; align-items:center; justify-content:center; font-family:'Barlow Condensed'; font-weight:700; color:var(--bg); }
.ava-em { background:var(--panel2); line-height:1; }
.loginlang { position:absolute; top:16px; right:16px; display:flex; gap:4px; background:rgba(20,23,28,.5); border:1px solid rgba(255,255,255,.14); border-radius:10px; padding:3px; backdrop-filter:blur(6px); z-index:3; }
.loginlang button { padding:5px 11px; border-radius:7px; font-size:12px; font-weight:700; letter-spacing:.06em; color:#cdd4dc; }
.loginlang button.on { background:var(--chalk); color:#13161a; }

/* login */
.login { position:fixed; inset:0; display:flex; flex-direction:column; overflow-y:auto; color:var(--chalk); font-family:'Figtree',sans-serif; background:#14171c; }
.sec { font-size:11px; letter-spacing:.1em; text-transform:uppercase; color:var(--muted); font-weight:600; margin:22px 2px 11px; }
.acctgrid { display:grid; grid-template-columns:repeat(2,1fr); gap:9px; }
.acct { display:flex; align-items:center; gap:10px; background:var(--panel); border:1px solid var(--line); border-radius:13px; padding:12px; text-align:left; }
.acct .nm { font-weight:600; font-size:14px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.acct .rl { font-size:10.5px; color:var(--muted); margin-top:1px; }
.pinbox { background:var(--panel); border:1px solid var(--line); border-radius:14px; padding:16px; margin-top:14px; }
.pinbox .who { display:flex; align-items:center; gap:11px; margin-bottom:13px; }
.pinbox .who .nm { font-weight:700; font-size:16px; }
.inp { width:100%; background:var(--panel2); border:1px solid var(--line); color:var(--chalk); border-radius:11px; padding:13px 14px; font-size:16px; outline:none; }
.inp:focus { border-color:var(--amber); }
.btn { width:100%; background:transparent; color:#b8ff00; font-weight:700; font-size:16px; padding:13px; border-radius:10px; margin-top:12px; border:1.5px solid #b8ff00; transition:background .12s; }
.btn:hover { background:rgba(184,255,0,.08); }
.btn:active { background:rgba(184,255,0,.16); }
.btn.ghost { background:transparent; color:rgba(255,255,255,.85); border:1.5px solid rgba(255,255,255,.18); }
.btn.ghost:hover { border-color:rgba(255,255,255,.35); color:#fff; }
.err { color:#dd5468; font-size:13px; margin-top:10px; }
.linkbtn { color:var(--amber); font-weight:600; font-size:14px; padding:14px 4px; display:block; width:100%; text-align:center; margin-top:6px; }
.hint { font-size:12px; color:var(--muted); line-height:1.5; background:var(--panel); border:1px solid var(--line); border-radius:11px; padding:11px 12px; margin-top:18px; }
.roleseg { display:flex; gap:8px; margin-top:8px; }
.roleseg button { flex:1; padding:11px; border-radius:10px; background:var(--panel2); border:1px solid var(--line); color:var(--muted); font-weight:600; font-size:13.5px; }
.roleseg button.on { background:var(--chalk); color:var(--bg); border-color:var(--chalk); }

/* top bar */
.topbar { padding:6px 12px; display:flex; align-items:center; justify-content:space-between; gap:10px; position:relative; background-size:cover; background-position:center 40%; height:60px; min-height:60px; max-height:60px; border-bottom:1px solid rgba(255,255,255,.08); background-color:#252830; overflow:hidden; }
.topbar-overlay { position:absolute; inset:0; background:linear-gradient(90deg, #13141a 0%, #13141a 33%, rgba(19,20,26,.6) 55%, rgba(19,20,26,0) 90%); pointer-events:none; }
.brand { display:flex; align-items:center; position:relative; z-index:2; padding-left:0; }
.brand-logo { height:24px; width:auto; object-fit:contain; display:block; max-height:24px; }
.brand h1 { font-family:'Barlow Condensed'; font-weight:300; font-size:27px; margin:0; line-height:1; letter-spacing:.05em; color:var(--chalk); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.uchip { display:flex; align-items:center; gap:8px; background:rgba(255,255,255,.1); border:1px solid rgba(255,255,255,.18); backdrop-filter:blur(8px); border-radius:22px; padding:4px 5px 4px 10px; flex:none; position:relative; z-index:1; }
.uchip .un { font-size:12.5px; font-weight:600; max-width:74px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.adminpill { font-size:8px; letter-spacing:.1em; text-transform:uppercase; color:var(--amber); border:1px solid rgba(184,255,0,.3); background:rgba(184,255,0,.08); padding:2px 6px; border-radius:4px; font-weight:700; }
.seg { display:flex; background:transparent; border:1.5px solid rgba(255,255,255,.15); border-radius:8px; padding:2px; width:fit-content; }
.seg button { font-size:12px; font-weight:600; padding:6px 12px; border-radius:5px; color:rgba(255,255,255,.6); white-space:nowrap; background:none; border:none !important; transition:color .12s; }
.seg button.on { background:rgba(184,255,0,.1); color:#b8ff00; border:none !important; }
.segwrap { padding:0 16px 4px; display:flex; align-items:center; gap:10px; }
.seg.full, .segwrap .seg { width:fit-content; }
.addtop-tb { flex:none; height:34px; padding:0 14px 0 10px; border-radius:9px; background:var(--amber); border:1px solid rgba(255,255,255,.18); color:#13161a; font-weight:700; font-size:13px; display:flex; align-items:center; gap:5px; position:relative; z-index:1; }
.installtb { flex:none; width:34px; height:34px; border-radius:9px; background:rgba(184,255,0,.14); border:1px solid rgba(184,255,0,.55); color:#b8ff00; display:flex; align-items:center; justify-content:center; position:relative; z-index:1; cursor:pointer; padding:0; margin-right:6px; }
.installtb:active { background:rgba(184,255,0,.26); }
.iosstep { display:flex; gap:11px; align-items:flex-start; padding:9px 0; font-size:14px; color:var(--chalk); line-height:1.5; border-bottom:1px solid var(--line); }
.iosstep:last-of-type { border-bottom:none; }
.iosnum { flex:none; width:24px; height:24px; border-radius:12px; background:var(--amber); color:#13161a; font-weight:800; font-size:13px; display:flex; align-items:center; justify-content:center; margin-top:1px; }
.addtop-tb .plus { font-size:17px; font-weight:300; line-height:1; }


/* leaderboard */
.lb { padding:4px 14px 96px; }
.lbrow { display:flex; align-items:center; gap:13px; padding:13px 12px; border-radius:13px; margin-bottom:8px; background:var(--panel); border:1px solid var(--line); }
.lbrow.lead { background:transparent; border:1.5px solid rgba(184,255,0,.35); }
.lbrow.meRow { border:1px solid #b8ff00; }
.rank { font-family:'Barlow Condensed'; font-weight:700; font-size:22px; width:24px; text-align:center; color:var(--muted); }
.lbrow.lead .rank { color:#b8ff00; }
.who { flex:1; min-width:0; }
.who .nm { font-weight:600; font-size:15.5px; display:flex; align-items:center; gap:7px; }
.youtag { font-size:9px; letter-spacing:.1em; color:var(--bg); background:var(--amber); padding:1px 5px; border-radius:4px; font-weight:700; }
.who .meta { font-size:11.5px; color:var(--muted); margin-top:2px; display:flex; gap:10px; }
.who .meta b { color:var(--amber); font-weight:600; }
.pts { text-align:right; }
.pts .v { font-family:'Barlow Condensed'; font-weight:700; font-size:30px; line-height:.9; color:#b8ff00; }
.pts .u { font-size:10px; color:var(--muted); letter-spacing:.12em; text-transform:uppercase; }
.bar { height:4px; background:var(--line); border-radius:3px; margin-top:7px; overflow:hidden; }
.bar > i { display:block; height:100%; background:#b8ff00; border-radius:3px; }

/* filters */
.filters { padding:6px 12px 2px; display:flex; gap:7px; overflow-x:auto; }
.filters::-webkit-scrollbar { display:none; }
.chip { font-size:12px; font-weight:600; padding:5px 11px; border-radius:18px; white-space:nowrap; background:transparent; border:1.5px solid rgba(255,255,255,.15); color:rgba(255,255,255,.6); display:inline-flex; align-items:center; gap:5px; transition:all .12s; }
.chip.on { background:transparent; color:#b8ff00; border-color:#b8ff00; }
.search { margin:8px 14px 0; }
.search input { width:100%; background:var(--panel); border:1px solid var(--line); color:var(--chalk); border-radius:10px; padding:10px 13px; font-size:14px; outline:none; }
.search input::placeholder { color:var(--muted); }

/* routes */
.routes { padding:6px 14px 120px; }
.sesh { font-family:'Barlow Condensed'; font-weight:600; letter-spacing:.03em; font-size:14px; color:var(--muted); margin:18px 2px 9px; display:flex; align-items:center; gap:8px; }
.sesh .ic { color:var(--chalk); display:flex; }
.gymfull { font-family:'Barlow Condensed'; font-weight:600; color:var(--chalk); font-size:15px; }
.sesh .ln { flex:1; height:1px; background:var(--line); }

.rc { background:var(--panel); border:1px solid var(--line); border-radius:14px; margin-bottom:8px; overflow:hidden; }
.rc.arch { opacity:.6; }
.rbanner { width:100%; height:150px; object-fit:cover; display:block; background:var(--panel2); will-change:opacity; transition:opacity .2s ease; }
.rbody { padding:9px 11px 10px; }
.rchead { display:flex; align-items:center; gap:10px; }
.wicon { width:34px; height:34px; border-radius:9px; background:var(--panel2); border:1px solid var(--line); color:var(--chalk); display:flex; align-items:center; justify-content:center; flex:none; }

.rname { flex:1; min-width:0; }
.rname .t1 { font-weight:600; font-size:14.5px; display:flex; align-items:center; gap:7px; line-height:1.1; }
.rname .t1 .dot { width:11px; height:11px; border-radius:50%; flex:none; border:1px solid rgba(255,255,255,.18); }
.rname .t1 .txt { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.rname .t2 { font-size:11px; color:var(--muted); margin-top:1px; }
.rname .rnote { font-size:11.5px; color:#c4ccd6; margin-top:2px; line-height:1.2; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.edit { color:rgba(255,255,255,.5); padding:5px 8px; font-size:14px; flex:none; background:transparent; border:1.5px solid rgba(255,255,255,.15); border-radius:7px; transition:all .12s; }
.edit:hover { border-color:#b8ff00; color:#b8ff00; }
.archtag { font-size:9px; letter-spacing:.12em; color:var(--muted); border:1px solid var(--line); padding:2px 6px; border-radius:5px; text-transform:uppercase; }

.rfoot { display:flex; align-items:center; gap:8px; margin-top:8px; }
.du { flex:1; display:flex; align-items:center; justify-content:center; gap:6px; padding:9px 10px; border-radius:9px; border:1px solid rgba(255,255,255,.12); background:transparent; color:var(--muted); font-weight:600; font-size:13px; user-select:none; }

 50% { box-shadow:0 0 11px 0 rgba(242,180,65,.28);} }
.du:active { transform:scale(.98); }
.du.top { background:transparent; border-color:#3fae5e; color:#5cc97e; }
.du.flash { background:transparent; border-color:#b8ff00; color:#b8ff00; }
.du .dpts { font-family:'Barlow Condensed'; font-weight:700; opacity:.85; }
.pill { display:inline-flex; align-items:center; gap:5px; padding:7px 11px; border-radius:9px; background:transparent; border:1.5px solid rgba(255,255,255,.18); color:rgba(255,255,255,.85); font-weight:600; font-size:13px; flex:none; transition:all .12s; }
.pill.has { color:var(--chalk); }

/* route stats */
.rc { position:relative; }



/* unified color+grade chip */
.gcol { width:36px; height:36px; border-radius:7px; flex:none; display:flex; align-items:center; justify-content:center; border:2px solid var(--gcol-color, #b8ff00); background:transparent; }
.gcol .ggrade { font-family:'Barlow Condensed'; font-weight:300; font-size:23px; line-height:1; text-align:center; color:var(--gcol-color, #b8ff00); letter-spacing:.02em; }
.wldone { font-family:'Barlow Condensed'; font-weight:700; font-size:14px; color:#b8ff00; margin-left:auto; padding:0 6px; }
.wlcount { min-width:20px; text-align:right; }
.ovdone { font-size:12px; font-weight:700; color:#5cc97e; margin-left:6px; }
.ovb { position:relative; }
.ovb.done { border:1px solid #5cc97e !important; }
.ovchk { position:absolute; right:-3px; top:-3px; width:17px; height:17px; border-radius:50%; background:#3fae5e; color:#0d130f; font-size:11px; font-weight:800; font-style:normal; display:flex; align-items:center; justify-content:center; border:1px solid var(--panel); }
.routebadge { position:absolute; top:8px; right:8px; display:flex; gap:4px; z-index:4; }
.rbadge { font-size:13px; line-height:1; opacity:.85; }
.rpills { display:flex; gap:5px; align-items:center; flex:none; margin-left:auto; }
.rschip { font-size:10px; font-weight:700; padding:2px 6px; border-radius:4px; white-space:nowrap; letter-spacing:.04em; background:transparent; color:rgba(255,255,255,.35); border:1px solid rgba(255,255,255,.12); display:inline-flex; align-items:center; }
.rschip.has { color:#b8ff00; border-color:rgba(184,255,0,.35); background:rgba(184,255,0,.06); }

/* stats */
.stats { padding:8px 14px 120px; }
.stcard { background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.08); border-radius:12px; padding:14px; margin-bottom:8px; }
.stcard.meCard { border:1px solid var(--amber); }
.stcard h3 { margin:0 0 11px; font-size:15px; font-weight:700; display:flex; justify-content:space-between; align-items:baseline; gap:8px; }
.stcard h3 .r { font-family:'Barlow Condensed'; font-size:13px; color:var(--muted); font-weight:600; }
.gradeline { display:flex; align-items:center; gap:10px; margin:9px 0; }
.gradeline .lab { font-family:'Barlow Condensed'; font-weight:700; width:30px; font-size:15px; }
.gtrack { flex:1; height:9px; background:var(--panel2); border-radius:5px; overflow:hidden; }
.gtrack > i { display:block; height:100%; border-radius:5px; }
.gnum { font-size:11.5px; color:var(--muted); width:62px; text-align:right; font-variant-numeric:tabular-nums; }
.ptbl { display:grid; grid-template-columns:auto 1fr 1fr; gap:7px 12px; align-items:center; }
.ptbl .ph { font-size:10.5px; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); font-weight:600; }
.ptbl .pg { font-family:'Barlow Condensed'; font-weight:700; font-size:15px; }
.ptbl .pv { font-variant-numeric:tabular-nums; font-size:14px; }

/* account */
.note { font-size:12px; color:var(--muted); line-height:1.5; background:var(--panel2); border:1px solid var(--line); border-radius:10px; padding:11px 12px; margin-bottom:12px; }
.prow { display:flex; align-items:center; justify-content:space-between; background:var(--panel2); border:1px solid var(--line); border-radius:10px; padding:9px 11px; gap:8px; margin-bottom:8px; }
.prow .pinfo { display:flex; align-items:center; gap:10px; min-width:0; }
.prow .pn { font-size:14px; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.prow .prole { font-size:10.5px; color:var(--muted); margin-top:1px; }
.rolebtn { font-size:11px; font-weight:700; padding:6px 10px; border-radius:8px; border:1px solid var(--line); color:var(--muted); background:var(--bg); white-space:nowrap; }
.rolebtn.adm { color:var(--amber); border-color:rgba(184,255,0,.3); }
.removex { color:#e98b7d; font-size:16px; padding:3px 9px; background:transparent; border-radius:7px; border:1.5px solid rgba(233,139,125,.35); font-weight:700; transition:all .12s; }
.removex:hover { border-color:#e98b7d; background:rgba(233,139,125,.08); }
.danger { color:#dd5468 !important; }
.miniaction { width:100%; text-align:center; background:transparent; border:1.5px solid rgba(255,255,255,.2); border-radius:10px; padding:10px 12px; font-size:13.5px; font-weight:700; margin-top:8px; color:rgba(255,255,255,.85); display:inline-flex; align-items:center; justify-content:center; gap:7px; transition:all .12s; }
.miniaction:hover { border-color:#b8ff00; color:#b8ff00; }
.miniaction:active { background:rgba(184,255,0,.08); }
.miniaction.primary { background:transparent; border:1.5px solid #b8ff00; color:#b8ff00; }
.miniaction.primary:hover { background:rgba(184,255,0,.1); }
.miniaction.danger { background:transparent; color:#e98b7d; border-color:rgba(233,139,125,.4); }
.miniaction.danger:hover { border-color:#e98b7d; background:rgba(233,139,125,.08); }
.miniaction.locked { opacity:.6; cursor:not-allowed; }
.miniaction .mi-ic { font-size:15px; line-height:1; }

/* tabbar / fab */
.tabbar { display:flex; background:#1e2028; border-top:1px solid rgba(255,255,255,.09); padding:7px 2px calc(5px + env(safe-area-inset-bottom)); gap:1px; min-height:60px; height:60px; box-sizing:border-box; flex-shrink:0; width:100%; position:relative; z-index:10; }
.tab { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; padding:8px 2px 4px; border-radius:8px; color:var(--muted); border:none; font-size:11px; text-transform:uppercase; font-family:'Figtree',sans-serif; font-weight:700; min-width:0; overflow:visible; }
.tab span { font-size:9px; }
.tab svg { width:24px; height:24px; flex-shrink:0; display:block; }
.tab.on { color:#b8ff00; }
.tab.on svg { color:#b8ff00; }
.tab.on svg { stroke-width:2; color:#b8ff00; }
.tab .ic { font-size:18px; line-height:1; }
.tab .tl { font-size:10px; font-weight:600; }
.fab { position:fixed; right:18px; bottom:84px; height:50px; padding:0 20px 0 16px; border-radius:25px; background:#13141a; color:#b8ff00; font-size:15px; font-weight:700; display:flex; align-items:center; gap:7px; border:1.5px solid #b8ff00; z-index:60; transition:background .12s; }
.fab:hover { background:rgba(184,255,0,.08); }
.fab:active { transform:scale(.96); }
.fab .plus { font-size:24px; font-weight:300; }

/* sheet */
.scrim { position:fixed; inset:0; background:rgba(8,10,13,.72); z-index:50; display:flex; align-items:flex-end; backdrop-filter:blur(2px); }
.sheet { background:var(--panel); width:100%; max-height:92dvh; border-radius:20px 20px 0 0; border-top:1px solid rgba(255,255,255,.15); display:flex; flex-direction:column; animation:up .22s ease; }
@keyframes up { from { transform:translateY(100%);} to { transform:translateY(0);} }
@keyframes spin { to { transform:rotate(360deg); } }
.grip { width:38px; height:4px; background:var(--line); border-radius:3px; margin:10px auto 4px; }
.shead { display:flex; align-items:center; justify-content:space-between; padding:8px 20px 12px; border-bottom:1px solid rgba(255,255,255,.07); }
.shead h2 { font-family:'Barlow Condensed'; font-weight:700; font-size:22px; margin:0; }
.x { color:var(--muted); font-size:20px; padding:4px 8px; border:1px solid rgba(255,255,255,.15); border-radius:7px; line-height:1; }
.sbody { overflow-y:auto; padding:12px 20px 32px; -webkit-overflow-scrolling:touch; }
.field { margin-bottom:16px; }
.field > label { display:block; font-size:11px; letter-spacing:.1em; text-transform:uppercase; color:var(--muted); margin-bottom:8px; font-weight:600; }
.field input[type=text], .field input[type=date], .field textarea { width:100%; background:var(--panel2); border:1px solid var(--line); color:var(--chalk); border-radius:10px; padding:11px 13px; font-size:15px; outline:none; }
.field input:focus, .field textarea:focus { border-color:var(--amber); }
.walltiles { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
.wtile { display:flex; flex-direction:column; align-items:center; gap:6px; padding:12px 6px; border-radius:12px; background:var(--panel2); border:1px solid var(--line); color:var(--muted); }
.wtile.on { background:#23262a; border-color:var(--amber); color:var(--chalk); }
.wtile .wl { font-size:11px; font-weight:600; text-align:center; line-height:1.2; }
.fpttl { font-size:13px; color:var(--muted); text-align:center; line-height:1.5; margin:2px 6px 12px; }
.fpwrap { padding:6px 0; }
.scrim.full { align-items:stretch; }
.sheet.planmode { max-height:100dvh; height:100dvh; border-radius:0; display:flex; flex-direction:column; }
.sheet.planmode .sbody { flex:1; display:flex; flex-direction:column; padding:0; }
.planpick { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:24px 16px; min-height:0; }
.planpick-ttl { font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:26px; text-align:center; color:#fff; letter-spacing:.02em; }
.planpick-sub { font-size:14px; color:rgba(255,255,255,.6); text-align:center; margin-top:6px; margin-bottom:24px; }
.planpick-wrap { flex:1; width:100%; max-width:560px; display:flex; align-items:center; justify-content:center; min-height:0; }
.planpick-wrap > * { width:100%; height:auto; max-height:100%; }
.fp { width:100%; max-width:420px; display:block; margin:0 auto; }
.fp text { user-select:none; }
.wallbar { display:flex; align-items:center; gap:11px; background:var(--panel2); border:1px solid var(--line); border-radius:12px; padding:11px 12px; margin-bottom:16px; }
.wallbar-ic { width:34px; height:34px; border-radius:9px; background:var(--bg); border:1px solid var(--line); color:var(--chalk); display:flex; align-items:center; justify-content:center; flex:none; }
.wb-name { flex:1; font-weight:600; font-size:15.5px; }
.wb-change { color:var(--amber); font-weight:600; font-size:13px; padding:6px 10px; border:1px solid rgba(184,255,0,.3); border-radius:8px; background:transparent; }
.gradepick { display:grid; grid-template-columns:repeat(4,1fr); gap:7px; }
.gradepick button { padding:11px 0; border-radius:10px; background:var(--panel2); border:1px solid var(--line); color:var(--muted); font-weight:700; font-family:'Barlow Condensed'; font-size:18px; }
.gradepick button.on { color:#13161a; }
.statusseg { display:grid; grid-template-columns:repeat(2,1fr); gap:8px; }
.statusseg button { padding:11px 0; border-radius:10px; background:var(--panel2); border:1px solid var(--line); color:var(--muted); font-weight:700; }
.statusseg button.on { color:#13161a; }
.ghint { font-size:12px; color:var(--muted); margin-top:8px; }
.ghint b { color:var(--chalk); }
.bigtri { display:flex; gap:8px; }
.bigtri button { flex:1; padding:12px 4px; border-radius:9px; border:1px solid rgba(255,255,255,.1); font-weight:600; font-size:13px; color:var(--muted); background:transparent; display:flex; flex-direction:column; gap:3px; align-items:center; }
.bigtri button .sp { font-family:'Barlow Condensed'; font-size:12px; opacity:.8; }
.bigtri button.a { background:transparent; border-color:rgba(255,255,255,.3); color:var(--chalk); }
.bigtri button.f { background:transparent; border-color:#b8ff00; color:#b8ff00; }
.photos { display:flex; gap:8px; flex-wrap:wrap; }
.thumb { position:relative; width:84px; height:84px; border-radius:11px; overflow:hidden; border:1px solid var(--line); }
.thumb img { width:100%; height:100%; object-fit:cover; display:block; }
.thx { position:absolute; top:4px; right:4px; width:21px; height:21px; border-radius:50%; background:rgba(8,10,13,.74); color:#fff; font-size:11px; display:flex; align-items:center; justify-content:center; }
.addphoto { width:84px; height:84px; border-radius:11px; border:1px dashed var(--line); color:var(--muted); background:var(--panel2); font-size:12.5px; font-weight:600; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; }
.phint { font-size:11px; color:var(--muted); margin-top:8px; line-height:1.4; }
.save { width:100%; background:#b8ff00; color:#0d0e0f; font-weight:700; font-size:16px; padding:14px; border-radius:12px; margin-top:6px; border:1px solid rgba(255,255,255,.18); }
.save.disabled { opacity:.4; }
.del { width:100%; background:none; color:#dd5468; font-weight:600; font-size:14px; padding:12px; margin-top:8px; }
.empty { text-align:center; color:var(--muted); padding:50px 20px; font-size:14px; }
.empty .big { font-size:30px; margin-bottom:10px; }

/* tips */
.tip { background:var(--panel2); border:1px solid var(--line); border-radius:12px; padding:11px 12px; margin-bottom:9px; }
.tip .th { display:flex; align-items:center; gap:8px; margin-bottom:6px; }
.tip .tn { font-size:13px; font-weight:600; }
.tip .tt { font-size:11px; color:var(--muted); }
.tip .tx { font-size:14px; line-height:1.45; }
.tip .trash { margin-left:auto; color:var(--muted); font-size:14px; padding:2px 6px; }
.tipcompose { display:flex; gap:8px; margin-top:10px; }
.tipcompose textarea { flex:1; min-height:44px; resize:vertical; }
.tipcompose button { background:#b8ff00; color:#0d0e0f; font-weight:700; border-radius:10px; padding:0 16px; align-self:stretch; }

/* map browse */
.mapbrowse { padding:0 0 120px; }
.walllegend { margin-top:12px; display:flex; flex-direction:column; gap:7px; }
.wlrow { display:flex; align-items:center; gap:11px; background:var(--panel); border:1px solid var(--line); border-radius:11px; padding:10px 12px; text-align:left; width:100%; }
.wlrow:active { transform:scale(.99); }
.wlic { width:30px; height:30px; border-radius:8px; background:var(--panel2); border:1px solid var(--line); color:var(--chalk); display:flex; align-items:center; justify-content:center; flex:none; }
.wlname { flex:1; font-weight:600; font-size:14px; }
.wlcount { font-family:'Barlow Condensed'; font-weight:700; font-size:16px; color:#b8ff00; min-width:20px; text-align:right; }

/* groups */
.gemoji { width:38px; height:38px; border-radius:10px; background:var(--panel2); border:1px solid var(--line); display:flex; align-items:center; justify-content:center; font-size:20px; flex:none; }
.lbrow .gemoji { width:34px; height:34px; font-size:18px; }
.primaryaction { width:100%; background:transparent; color:#b8ff00; font-weight:700; font-size:15px; border-radius:10px; padding:12px; margin-bottom:14px; border:1.5px solid #b8ff00; transition:background .12s; }
.primaryaction:hover { background:rgba(184,255,0,.08); }
.primaryaction:active { background:rgba(184,255,0,.16); }

.primaryaction.locked { opacity:.5; cursor:not-allowed; background:transparent; color:rgba(255,255,255,.4); border:1.5px solid rgba(255,255,255,.15); }
/* Accordion */
.routefilters { padding:10px 14px 14px; display:flex; flex-direction:column; gap:10px; }
.filterrow { display:flex; flex-wrap:wrap; gap:6px; align-items:center; }
.searchinp { width:100%; padding:11px 14px; border-radius:12px; background:#242c3a; border:1px solid rgba(255,255,255,.22); color:var(--chalk); font-size:14px; outline:none; }
.searchinp:focus { border-color:#b8ff00; }
.searchinp::placeholder { color:var(--muted); }
.gradefilter { display:flex; flex-wrap:wrap; gap:5px; }
.wallsection { border-radius:12px; overflow:hidden; margin:0 14px 8px; border:1px solid rgba(255,255,255,.09); }
.wallacchead { width:100%; display:flex; align-items:center; gap:10px; padding:13px 16px; background:#2c3650; text-align:left; border:none; color:var(--chalk); cursor:pointer; }
.wallacchead:active { background:rgba(255,255,255,.04); }
.wallacchead.open { background:#2a3545; border-bottom:1px solid #4a6080; }
.waname { flex:1; font-weight:600; font-size:13px; letter-spacing:.01em; }
.waic { display:flex; align-items:center; color:var(--muted); }
.wadone { font-size:10px; font-weight:700; padding:2px 6px; border-radius:4px; white-space:nowrap; letter-spacing:.04em; color:#b8ff00; border:1px solid rgba(184,255,0,.35); background:rgba(184,255,0,.06); display:inline-flex; align-items:center; }
.wacount { font-family:'Barlow Condensed'; font-weight:700; font-size:12px; color:var(--muted); }
.waflash { font-size:10px; font-weight:700; padding:2px 6px; border-radius:4px; white-space:nowrap; letter-spacing:.04em; color:#b8ff00; border:1px solid rgba(184,255,0,.35); background:rgba(184,255,0,.06); display:inline-flex; align-items:center; }
.wachevron { font-size:11px; color:var(--muted); }
.wallbody { padding:10px 12px 14px; background:var(--panel); }
.lhsub { font-size:11.5px; color:var(--muted); margin-bottom:8px; }
.gcard { display:flex; align-items:center; gap:12px; background:var(--panel); border:1px solid var(--line); border-radius:13px; padding:11px 12px; margin-bottom:9px; }
.gcard .ginfo { flex:1; min-width:0; }
.gcard .gn { font-weight:600; font-size:15px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.gcard .gm { font-size:11.5px; color:var(--muted); margin-top:2px; }
.gcard .gp { text-align:right; flex:none; }
.gcard .gp .v { font-family:'Barlow Condensed'; font-weight:700; font-size:22px; line-height:.9; }
.gcard .gp .u { font-size:9px; color:var(--muted); text-transform:uppercase; letter-spacing:.1em; }
.joinbtn { background:#b8ff00; color:#0d0e0f; font-weight:700; font-size:13px; border-radius:9px; padding:9px 14px; flex:none; border:1px solid rgba(255,255,255,.18); }
.leavebtn { background:var(--panel2); border:1px solid var(--line); color:var(--muted); font-weight:600; font-size:14px; border-radius:11px; }
.emojipick { display:flex; gap:6px; flex-wrap:wrap; }
.emojipick button { width:44px; height:44px; border-radius:11px; background:var(--panel2); border:1px solid var(--line); font-size:22px; display:flex; align-items:center; justify-content:center; }
.emojipick button.on { border-color:var(--amber); background:rgba(184,255,0,.06); }
.emojipick.big { display:grid; grid-template-columns:repeat(auto-fill, minmax(44px, 1fr)); gap:6px; max-height:260px; overflow-y:auto; padding:8px; background:var(--panel); border:1px solid var(--line); border-radius:12px; }
.emojipick.big .epick { width:100%; height:44px; border-radius:9px; font-size:22px; background:transparent; border:1px solid transparent; cursor:pointer; display:flex; align-items:center; justify-content:center; }
.emojipick.big .epick.on { border-color:var(--amber); background:rgba(184,255,0,.06); }
.emojipick.big .epick.locked { opacity:.28; cursor:default; filter:grayscale(1); }
.emojipick.big.locked { opacity:.5; pointer-events:none; }
.emoji-info-card { background:transparent; border:1.5px solid rgba(184,255,0,.25); border-radius:10px; padding:12px 14px; margin-bottom:14px; }
.emoji-info-stats { display:flex; align-items:baseline; gap:6px; margin-bottom:4px; }
.emoji-info-num { font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:24px; color:#b8ff00; line-height:1; }
.emoji-info-lbl { font-size:12px; color:rgba(255,255,255,.6); font-weight:500; }
.emoji-info-next { font-size:12px; color:rgba(255,255,255,.7); }
.emoji-info-next b { color:#b8ff00; font-weight:700; }
.emojiunlock-hint { font-size:12px; color:var(--muted); background:var(--panel2); border:1px solid var(--line); border-radius:9px; padding:8px 12px; margin-bottom:10px; line-height:1.5; }
.emojisep { font-size:11px; color:var(--muted); text-align:center; margin:14px 0 8px; letter-spacing:.06em; }
.gtot { display:flex; gap:10px; margin-bottom:8px; }
.gtot > div { flex:1; background:var(--panel2); border:1px solid var(--line); border-radius:12px; padding:11px 8px; text-align:center; }
.gtv { font-family:'Barlow Condensed'; font-weight:700; font-size:24px; line-height:1; }
.gtu { font-size:9.5px; color:var(--muted); text-transform:uppercase; letter-spacing:.08em; margin-top:4px; }
.memrow { display:flex; align-items:center; gap:10px; padding:9px 2px; border-bottom:1px solid var(--line); }
.memrow:last-child { border-bottom:none; }
.memrow .mr { font-family:'Barlow Condensed'; font-weight:700; width:22px; text-align:center; color:var(--muted); font-size:15px; }
.memrow .mn { flex:1; font-size:14px; font-weight:600; }
.memrow .mp { font-family:'Barlow Condensed'; font-weight:700; font-size:17px; }

/* grade pills + wall header */
.gpill { display:inline-flex; align-items:center; justify-content:center; min-width:26px; height:28px; padding:0 9px; border-radius:14px; font-family:'Barlow Condensed'; font-weight:700; font-size:15px; color:#13161a; border:1px solid transparent; }
.gpill.gp0 { background:var(--panel2); border-color:var(--line); color:var(--muted); }
.gpill.gp0.on { background:var(--chalk); color:var(--bg); border-color:var(--chalk); }
.listhead { padding:8px 14px 2px; }
.gpillrow { display:flex; gap:7px; overflow-x:auto; padding-bottom:4px; }
.gpillrow::-webkit-scrollbar { display:none; }
.lhwall { display:flex; align-items:center; gap:11px; background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:10px 12px; margin-bottom:9px; }
.lhmeta { flex:1; min-width:0; }
.lhname { font-weight:700; font-size:15.5px; display:flex; align-items:center; gap:7px; }
.lhsub { font-size:11.5px; color:var(--muted); margin-top:1px; }
.lhclear { color:var(--amber); font-weight:600; font-size:12.5px; padding:6px 8px; flex:none; }
.freshbadge { font-size:9px; letter-spacing:.08em; font-weight:700; color:#13161a; background:#5cc97e; padding:2px 6px; border-radius:5px; text-transform:uppercase; }
.nextbadge { font-size:9px; letter-spacing:.08em; font-weight:700; color:var(--muted); border:1px solid var(--line); padding:1px 6px; border-radius:5px; text-transform:uppercase; }

/* wall legend rows with pills */
.wlrow2 { background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:4px 6px 9px; margin-bottom:8px; }
.wlhead { display:flex; align-items:center; gap:11px; width:100%; text-align:left; padding:8px 6px 7px; }
.wlhead .wlname { display:flex; align-items:center; gap:7px; }
.wlpills { display:flex; gap:6px; flex-wrap:wrap; padding:0 6px; }
.wlpills .gpill { min-width:24px; height:24px; font-size:13px; }

/* screw plan */
.plancard { background:var(--panel); border:1px solid var(--line); border-radius:14px; padding:13px 14px; margin-top:14px; }
.planttl { font-weight:700; font-size:14px; margin-bottom:10px; }
.planrow { display:flex; align-items:center; gap:10px; padding:9px 0; border-bottom:1px solid var(--line); font-size:13.5px; flex-wrap:nowrap; }
.planrow:last-child { border-bottom:none; }
.planrow .plw { flex:1; min-width:0; display:flex; align-items:center; gap:7px; }
.planrow .plwn { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.planrow .plright { display:flex; align-items:center; gap:7px; flex:none; margin-left:auto; }
.planrow .pld { font-family:'Barlow Condensed'; font-weight:700; white-space:nowrap; color:var(--muted); font-variant-numeric:tabular-nums; }
.lightbox { position:fixed; inset:0; background:rgba(0,0,0,.92); z-index:200; display:flex; align-items:center; justify-content:center; padding:16px; animation:fadeIn .15s ease; overflow:hidden; touch-action:none; }
.lb-hint { position:absolute; bottom:24px; left:50%; transform:translateX(-50%); font-size:12px; color:rgba(255,255,255,.5); background:rgba(0,0,0,.4); padding:4px 12px; border-radius:20px; pointer-events:none; z-index:202; white-space:nowrap; }
@keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
.lb-img { max-width:100%; max-height:100%; object-fit:contain; border-radius:10px; box-shadow:0 8px 40px rgba(0,0,0,.6); }
.lb-close { position:absolute; top:18px; right:18px; width:40px; height:40px; border-radius:50%; background:rgba(255,255,255,.15); color:#fff; font-size:18px; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(6px); border:1px solid rgba(255,255,255,.2); z-index:201; }
.colpicker { display:grid; grid-template-columns:repeat(auto-fill,minmax(44px,1fr)); gap:8px; padding:4px 0; }
.colbtn { width:100%; aspect-ratio:1; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:0; transition:all .12s; cursor:pointer; }
.colbtn:hover { transform:scale(1.05); }
.colbtn:active { transform:scale(.95); }
.colbtn.on { box-shadow:0 0 0 2px #13141a, 0 0 0 4px #b8ff00; }
.colcheck { font-size:20px; line-height:1; }
.planrow .pld { font-family:'Barlow Condensed'; font-weight:700; flex:none; white-space:nowrap; color:var(--muted); font-variant-numeric:tabular-nums; }
.pldInput { font-family:'Barlow Condensed'; font-weight:700; font-size:14px; color:var(--chalk); background:var(--panel2); border:1px solid var(--line); border-radius:8px; padding:4px 8px; flex:none; cursor:pointer; }
.pldInput::-webkit-calendar-picker-indicator { filter:invert(0.7); cursor:pointer; }
.planrow .plw { flex:1; min-width:0; display:flex; align-items:center; gap:7px; }
.planrow .plwn { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.planrow .freshbadge, .planrow .nextbadge { flex:none; margin-left:auto; }
.planrow.fresh { color:var(--chalk); }
.planrow.fresh .pld { color:#5cc97e; }
.planrow.next .pld { color:var(--amber); }

.reroll { font-size:11px; font-weight:600; color:var(--amber); background:transparent; border:1px solid rgba(184,255,0,.3); border-radius:7px; padding:4px 8px; text-transform:none; letter-spacing:0; }

/* professional login */
.login { display:flex; flex-direction:column; background-size:cover; background-position:center top; background-repeat:no-repeat; }
.loginhero { padding:62px 26px 24px; text-align:center; display:flex; flex-direction:column; align-items:center; }
.lmark { width:50px; height:50px; border-radius:14px; background:#b8ff00; color:#0d0e0f; display:flex; align-items:center; justify-content:center; flex:none; }
.login-logo { width:125px; height:auto; object-fit:contain; margin-top:24px; filter:drop-shadow(0 4px 16px rgba(0,0,0,.6)); }
.lwordmark { font-family:'Barlow Condensed',sans-serif; font-weight:300; font-size:56px; letter-spacing:.04em; line-height:.9; margin:20px 0 0; color:#fff; text-shadow:0 2px 22px rgba(0,0,0,.55); }
.lwordmark span { color:var(--amber); }
.ltagline { font-family:'Figtree',sans-serif; font-weight:300; font-size:13px; letter-spacing:.36em; text-transform:uppercase; color:rgba(255,255,255,.84); margin-top:13px; padding-left:.36em; text-shadow:0 1px 12px rgba(0,0,0,.7); }
.logincard { background:rgba(22,26,32,.65); backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px); border:1.5px solid rgba(255,255,255,.12); border-radius:18px; margin:16px 18px 0; padding:18px; max-width:440px; width:calc(100% - 36px); align-self:center; }
.authtabs { display:flex; background:transparent; border:1.5px solid rgba(255,255,255,.15); border-radius:10px; padding:3px; margin-bottom:18px; gap:2px; }
.authtabs button { flex:1; padding:10px; border-radius:7px; font-weight:700; font-size:14px; color:rgba(255,255,255,.55); background:transparent; border:none; transition:color .12s, background .12s; }
.authtabs button:hover { color:rgba(255,255,255,.9); }
.authtabs button.on { background:rgba(184,255,0,.1); color:#b8ff00; }
.flbl { display:block; font-size:11px; letter-spacing:.1em; text-transform:uppercase; color:var(--muted); font-weight:600; margin-bottom:7px; }
.privtoggle { display:flex; align-items:flex-start; gap:11px; width:100%; text-align:left; background:var(--panel2); border:1px solid var(--line); border-radius:12px; padding:12px; margin-top:14px; }
.switch { width:42px; height:25px; border-radius:13px; background:var(--line); flex:none; position:relative; transition:background .15s; margin-top:1px; }
.switch.on { background:var(--amber); }
.switch .knob { position:absolute; top:2.5px; left:2.5px; width:20px; height:20px; border-radius:50%; background:#fff; transition:left .15s; }
.switch.on .knob { left:19.5px; }
.privtext { font-size:12px; color:var(--muted); line-height:1.45; }
.privtext b { display:block; color:var(--chalk); font-size:13.5px; margin-bottom:2px; }
.langrow { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-top:12px; }
.langlbl { font-size:11px; letter-spacing:.1em; text-transform:uppercase; color:var(--muted); font-weight:600; }
.emojirow { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-top:12px; }
.emojirowr { display:flex; align-items:center; gap:8px; }
.reqnote { margin-top:10px; font-size:12.5px; color:var(--chalk); background:var(--panel2); border:1px solid var(--line); border-radius:10px; padding:9px 11px; }
.reqnote span { display:block; color:var(--muted); font-size:11.5px; margin-top:2px; }
.reqnote.warn { border-color:rgba(184,255,0,.3); background:#2a230f; }
.reqbadge { display:inline-block; margin-left:7px; font-size:10.5px; font-weight:700; color:var(--amber); background:#21240a; border:1px solid #3a4010; border-radius:6px; padding:1px 6px; }
.synclog { margin-top:14px; padding:10px 12px; background:rgba(0,0,0,.25); border:1px solid rgba(255,255,255,.08); border-radius:8px; font-family:ui-monospace,Menlo,monospace; font-size:11.5px; line-height:1.55; max-height:280px; overflow-y:auto; }
.synclog-ttl { font-weight:700; color:#b8ff00; margin-bottom:4px; font-family:'Figtree',sans-serif; font-size:12px; }
.synclog-line { color:rgba(255,255,255,.8); }
.synclog-line.warn { color:#f5c25c; }
.synclog-line.err { color:#e98b7d; }
.synclog-line.ok { color:#b8ff00; font-weight:600; }
.achart { background:transparent; border:1.5px solid rgba(255,255,255,.1); border-radius:12px; padding:14px; margin-bottom:14px; }
.achart-controls { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px; }
.achart-svg { width:100%; height:140px; display:block; }
.achart-labels { display:flex; justify-content:space-between; margin-top:4px; }
.achart-labels span { font-size:9px; color:rgba(255,255,255,.5); text-align:center; flex:1; }
.achart-legend { font-size:11px; color:rgba(255,255,255,.6); margin-top:6px; display:flex; align-items:center; gap:4px; }
.achart-dot { display:inline-block; width:10px; height:10px; border-radius:2px; }
.intro-modal { background:var(--panel); border-radius:20px; border:1.5px solid rgba(255,255,255,.12); width:100%; max-width:480px; overflow:hidden; animation:up .22s ease; }
.intro-header { padding:28px 24px 16px; text-align:center; background:linear-gradient(180deg,rgba(184,255,0,.05) 0%,transparent 100%); }
.intro-logo { font-size:40px; margin-bottom:10px; }
.intro-ttl { font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:26px; margin:0 0 6px; color:#fff; }
.intro-sub { font-size:13px; color:rgba(255,255,255,.65); margin:0; line-height:1.5; }
.intro-cards { padding:12px 16px; display:flex; flex-direction:column; gap:10px; }
.intro-card { display:flex; align-items:flex-start; gap:14px; background:transparent; border:1px solid rgba(255,255,255,.08); border-radius:12px; padding:12px 14px; }
.intro-card-icon { width:36px; height:36px; flex:none; display:flex; align-items:center; justify-content:center; background:rgba(184,255,0,.08); border-radius:8px; border:1px solid rgba(184,255,0,.2); }
.intro-card-ttl { font-weight:700; font-size:14px; color:#fff; margin-bottom:2px; }
.intro-card-txt { font-size:12.5px; color:rgba(255,255,255,.65); line-height:1.45; }
.intro-actions { padding:12px 16px 20px; display:flex; flex-direction:column; gap:0; }
.share-card-modal { background:var(--panel); border-radius:20px; border:1.5px solid rgba(255,255,255,.12); width:100%; max-width:480px; overflow:hidden; animation:up .22s ease; max-height:90dvh; display:flex; flex-direction:column; }
.share-card-modal .sbody { overflow-y:auto; flex:1; }
.archbadge { display:inline-block; font-size:10.5px; font-weight:700; color:#cdd4dc; background:var(--panel2); border:1px solid var(--line); border-radius:6px; padding:1px 6px; }
/* Hall stats */
.hkpi-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:10px; }
.hkpi { background:transparent; border:1px solid rgba(255,255,255,.12); border-radius:10px; padding:10px 12px; }
.hkv { font-family:'Barlow Condensed'; font-weight:700; font-size:32px; color:var(--chalk); line-height:1; }
.hku { font-size:11px; color:var(--muted); margin-top:3px; letter-spacing:.04em; }
.hwall-row { display:flex; align-items:center; gap:8px; padding:9px 0; border-bottom:1px solid var(--line); font-size:13px; flex-wrap:wrap; }
.hwall-row:last-child { border-bottom:none; }
.hwn { display:flex; align-items:center; gap:6px; font-weight:600; flex:1; min-width:100px; }
.hwr { font-size:11.5px; color:var(--muted); }
.hws { font-size:11.5px; color:var(--chalk); font-weight:600; }
.hwf { font-size:11.5px; color:var(--amber); }
.hwbar { width:100%; height:4px; background:var(--panel2); border-radius:2px; margin-top:4px; }
.hwbar i { display:block; height:100%; background:var(--amber); border-radius:2px; max-width:100%; }
.hpop-row { display:flex; align-items:center; gap:9px; padding:9px 0; border-bottom:1px solid var(--line); }
.hpop-row:last-child { border-bottom:none; }
.hrank { font-family:'Barlow Condensed'; font-weight:700; font-size:17px; width:22px; flex:none; text-align:center; }
.hrswatch { width:24px; height:24px; border-radius:6px; flex:none; border:2px solid; }
.hrswatch.sm { width:18px; height:18px; border-radius:4px; }
.hrname { flex:1; min-width:0; }
.hrname .t1 { font-size:14px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.hrname .t2 { font-size:11px; color:var(--muted); margin-top:1px; }
.hrstat { display:flex; gap:5px; flex:none; }
.hcl-row { display:flex; align-items:center; gap:9px; padding:8px 0; border-bottom:1px solid var(--line); }
.hcl-row:last-child { border-bottom:none; }
.hcln { flex:1; font-weight:600; font-size:14px; }
.hclv { font-size:12px; color:var(--muted); font-weight:600; }
/* Session cards */
.sess-kpi { display:flex; gap:10px; margin:10px 0 12px; }
.skpi { flex:1; background:transparent; border:1px solid rgba(255,255,255,.12); border-radius:10px; padding:9px 10px; text-align:center; }
.skv { display:block; font-family:'Barlow Condensed'; font-weight:700; font-size:20px; color:var(--chalk); }
.sku { display:block; font-size:10.5px; color:var(--muted); margin-top:2px; }
.sess-routes { display:flex; flex-direction:column; gap:6px; }
.sroute-row { display:flex; align-items:center; gap:7px; font-size:13px; padding:5px 0; border-bottom:1px solid var(--line); }
.sroute-row:last-child { border-bottom:none; }
.srn { flex:1; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.sgrade { color:var(--muted); font-size:11px; margin-left:4px; }
.lockhint { font-size:11.5px; color:var(--muted); margin-top:6px; line-height:1.35; }
.pill.locked { color:var(--muted); opacity:.75; }
.primaryaction.locked { opacity:.6; cursor:not-allowed; }
.confirm { width:min(360px,92vw); background:var(--panel); border:1px solid rgba(255,255,255,.15); border-radius:18px; padding:22px 20px 18px; margin:auto; text-align:center; }
.confirm .cf-ic { font-size:34px; line-height:1; margin-bottom:6px; }
.confirm h3 { margin:0 0 8px; font-size:18px; font-weight:700; color:var(--chalk); }
.confirm p { margin:0 0 16px; font-size:13.5px; line-height:1.5; color:var(--muted); }
.confirm .cf-btns { display:flex; gap:10px; }
.confirm .cf-cancel { flex:1; padding:12px; border-radius:11px; background:var(--panel2); border:1px solid var(--line); color:var(--chalk); font-weight:700; font-size:14px; }
.confirm .cf-yes { flex:1; padding:12px; border-radius:11px; background:#b8ff00; color:#0d0e0f; font-weight:700; font-size:14px; }
.langseg { display:flex; background:var(--panel); border:1px solid rgba(255,255,255,.15); border-radius:8px; padding:3px; }
.langseg button { padding:7px 14px; border-radius:6px; font-size:13px; font-weight:600; color:var(--muted); border:1px solid transparent; }
.langseg button.on { background:var(--panel2); color:var(--chalk); border:1px solid rgba(255,255,255,.28); }
.demolink { display:block; width:100%; text-align:center; color:var(--muted); font-size:12.5px; font-weight:600; padding:14px 0 4px; }
.demogrid { display:flex; flex-wrap:wrap; gap:7px; margin-top:6px; }
.demoacc { display:flex; align-items:center; gap:7px; background:var(--panel2); border:1px solid var(--line); border-radius:20px; padding:5px 11px 5px 5px; font-size:13px; font-weight:600; }
.demohint { width:100%; font-size:11.5px; color:var(--muted); text-align:center; margin-top:4px; }
.loginfoot { text-align:center; color:var(--muted); font-size:11.5px; padding:22px 20px 30px; }
.invlist { max-height:230px; overflow-y:auto; }
.joinbtn[disabled] { pointer-events:none; }

/* segment bubble overview */
.ovcard { background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.1); border-radius:14px; padding:14px; margin-bottom:14px; }
.ovttl { display:flex; align-items:center; gap:9px; font-weight:700; font-size:15px; margin-bottom:12px; }
.ovbubbles { display:flex; flex-wrap:wrap; gap:9px; }
.ovb { width:48px; height:48px; border-radius:50%; display:flex; flex-direction:column; align-items:center; justify-content:center; transition:transform .12s; position:relative; gap:0; }
.ovb:active { transform:scale(.88); }
.ovb.fl { animation:ovpulse 1.6s ease; }
@keyframes ovpulse { 0%,100% { transform:scale(1);} 20% { transform:scale(1.25);} }
.ovgrade { font-family:'Barlow Condensed'; font-weight:800; font-size:21px; line-height:1; }
.ovchk { font-style:normal; font-size:11px; line-height:1; }
.ovlegend { font-size:11px; color:var(--muted); margin-top:11px; }
/* small hold-color pills in wall legend */
.gpill2 { width:34px; height:34px; border-radius:50%; font-family:'Barlow Condensed'; font-weight:800; font-size:15px; display:inline-flex; align-items:center; justify-content:center; transition:transform .12s; flex-none; }
.gpill2:active { transform:scale(.88); }
.gpill2.done { opacity:.65; }
.rc.flash { border-color:#b8ff00; }

/* role dropdown */
.roledd { background:transparent; border:1.5px solid rgba(255,255,255,.18); color:rgba(255,255,255,.85); border-radius:7px; padding:6px 10px; font-size:12.5px; font-weight:700; outline:none; cursor:pointer; transition:border-color .12s; }
.roledd:focus, .roledd:hover { border-color:#b8ff00; color:#b8ff00; }

/* achievements */
.achintro { background:transparent; border:1.5px solid rgba(255,255,255,.1); border-radius:14px; padding:14px 16px; margin-bottom:14px; }
.achintro-ttl { font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:18px; color:#fff; margin-bottom:6px; letter-spacing:.01em; }
.achintro-txt { font-size:13px; color:rgba(255,255,255,.7); line-height:1.5; margin-bottom:12px; }
.achintro-txt b { color:#b8ff00; font-weight:700; }
.achintro-unlocks { display:flex; flex-direction:column; gap:6px; }
.achunl { font-size:12.5px; color:rgba(255,255,255,.75); display:flex; align-items:center; gap:8px; line-height:1.4; }
.achunl-num { display:inline-block; min-width:34px; text-align:center; padding:2px 7px; border:1.5px solid rgba(184,255,0,.35); border-radius:6px; color:#b8ff00; font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:14px; flex:none; }
.achhero { display:flex; align-items:center; gap:16px; background:transparent; border:1.5px solid rgba(184,255,0,.25); border-radius:16px; padding:18px; margin-bottom:16px; }
.achring { width:74px; height:74px; position:relative; flex:none; }
.achring svg { width:100%; height:100%; }
.achpct { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-family:'Barlow Condensed'; font-weight:700; font-size:18px; }
.achbig { font-family:'Barlow Condensed'; font-weight:700; font-size:32px; line-height:.9; }
.achbig span { color:var(--muted); font-size:18px; }
.achsub { color:var(--muted); font-size:12.5px; margin-top:3px; }
.achscore { margin-top:8px; font-weight:700; font-size:13px; color:var(--amber); }
.ssec { margin:6px 2px 10px; font-size:15px; font-weight:700; }
.ssecn { color:#5cc97e; font-family:'Barlow Condensed'; font-weight:700; }
.achstrip { display:flex; gap:9px; overflow-x:auto; padding:2px 2px 12px; margin:0 -2px; }
.achstrip::-webkit-scrollbar { display:none; }
.achbadge { flex:none; width:120px; background:transparent; border:1.5px solid rgba(184,255,0,.35); border-radius:12px; padding:11px; display:flex; flex-direction:column; gap:5px; }
.achbadge .abic { font-size:22px; }
.achbadge .abn { font-size:12px; font-weight:700; color:#f6e8c8; line-height:1.2; }
.achbadge .abp { font-family:'Barlow Condensed'; font-weight:700; font-size:13px; color:var(--amber); }
.achrow, .catrow { display:flex; align-items:center; gap:12px; background:var(--panel); border:1px solid var(--line); border-radius:13px; padding:11px 12px; margin-bottom:8px; width:100%; text-align:left; }
.achrow.done { background:rgba(184,255,0,.04); border-color:rgba(184,255,0,.25); }
.achic { width:38px; height:38px; border-radius:10px; background:var(--panel2); border:1px solid var(--line); display:flex; align-items:center; justify-content:center; font-size:19px; flex:none; }
.achinfo { flex:1; min-width:0; }
.achn { font-weight:700; font-size:14px; display:flex; align-items:center; gap:6px; }
.achchk { color:#5cc97e; }
.achd { font-size:11.5px; color:var(--muted); margin:2px 0 6px; }
.achbar { height:6px; border-radius:3px; background:var(--panel2); overflow:hidden; }
.achbar i { display:block; height:100%; background:#b8ff00; border-radius:3px; }
.achprog { font-family:'Barlow Condensed'; font-weight:700; font-size:15px; text-align:right; flex:none; }
.achpts { font-size:10px; color:var(--amber); font-family:'Figtree'; font-weight:600; }
.catrow .achbar { margin-top:7px; }

/* comments */
.cmprose { margin:6px 0 8px; display:flex; flex-direction:column; gap:14px; }
.cmt { display:flex; gap:10px; align-items:flex-start; }
.cmt.mine { flex-direction:row-reverse; }
.cmtbody { flex:1; min-width:0; display:flex; flex-direction:column; }
.cmt.mine .cmtbody { align-items:flex-end; }
.cmthead { display:flex; align-items:center; gap:8px; margin-bottom:4px; }
.cmt.mine .cmthead { flex-direction:row-reverse; }
.cmtn { font-weight:700; font-size:13px; }
.cmtt { font-size:10.5px; color:var(--muted); }
.cmtdel { font-size:10.5px; color:var(--muted); }
.cmt.mine .cmtdel { margin-right:auto; }
.cmt:not(.mine) .cmtdel { margin-left:auto; }
.cmttext { font-size:14px; line-height:1.5; padding:9px 12px; background:var(--panel2); border:1px solid var(--line); border-radius:3px 13px 13px 13px; max-width:88%; word-break:break-word; }
.cmt.mine .cmttext { background:transparent; border:1.5px solid rgba(184,255,0,.3); color:rgba(255,255,255,.9); border-radius:13px 3px 13px 13px; }
.cmempty { text-align:center; color:var(--muted); padding:34px 10px; display:flex; flex-direction:column; align-items:center; gap:4px; }
.cmempty .big { font-size:34px; margin-bottom:4px; }
.cmempty b { color:var(--chalk); font-size:15px; }
.cmempty span { font-size:12.5px; }
.cmcompose { display:flex; align-items:flex-end; gap:9px; margin-top:14px; position:sticky; bottom:0; background:var(--panel); padding:8px 0 2px; }
.cmcompose textarea { flex:1; min-height:44px; max-height:120px; resize:none; border-radius:20px; padding:11px 15px; background:var(--panel2); border:1px solid var(--line); color:var(--chalk); font-size:14px; outline:none; }
.cmcompose textarea:focus { border-color:var(--amber); }
.cmsend { width:44px; height:44px; border-radius:50%; background:var(--panel2); border:1px solid var(--line); color:var(--muted); font-size:16px; flex:none; transition:.12s; }
.cmsend.on { background:#b8ff00; color:#0d0e0f; border-color:var(--amber); }
`;

/* ============================ Login ============================ */
function LoginScreen({ accounts, onLogin, onSignup, lang, onLang }) {
  const [mode, setMode] = useState("login"); // login | signup
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [role, setRole] = useState("community");
  const [priv, setPriv] = useState(false);
  const [err, setErr] = useState("");

  async function doLogin() {
    const acc = accounts.find(a => a.name.toLowerCase() === name.trim().toLowerCase());
    if (!acc) return setErr(t("login.errNoAcc"));
    if (!(await verifyPin(pin, acc))) return setErr(t("login.errPin"));
    onLogin(acc.id);
  }
  function doSignup() {
    const nm = name.trim();
    if (!nm) return setErr(t("login.errName"));
    if (accounts.some(a => a.name.toLowerCase() === nm.toLowerCase())) return setErr(t("login.errTaken"));
    if (pin.length < 4) return setErr(t("login.errShort"));
    onSignup({ name: nm, pin, role: "community", private: priv });
  }

  return (
    <div className="login" style={{ backgroundImage: `linear-gradient(180deg, rgba(15,17,20,.30) 0%, rgba(15,17,20,.55) 38%, rgba(15,17,20,.93) 72%, rgba(15,17,20,.99) 100%), url(${BG_LOGIN_WALL || (typeof BG_LOGIN !== "undefined" ? BG_LOGIN : "")})` }}>
      <style>{CSS}</style>
      <div className="loginlang">
        <button className={lang === "de" ? "on" : ""} onClick={() => onLang("de")}>DE</button>
        <button className={lang === "en" ? "on" : ""} onClick={() => onLang("en")}>EN</button>
      </div>
      <div className="loginhero">
        <img src={LOGIN_LOGO} alt="blocscore" className="login-logo" />
        <div className="ltagline">elevate. score. repeat.</div>
      </div>
      <div className="logincard">
        <div className="authtabs">
          <button className={mode === "login" ? "on" : ""} onClick={() => { setMode("login"); setName(""); setErr(""); }}>{t("login.signin")}</button>
          <button className={mode === "signup" ? "on" : ""} onClick={() => { setMode("signup"); setName(genTag(lang)); setErr(""); }}>{t("login.signup")}</button>
        </div>

        <label className="flbl" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>{t("login.name")} {mode === "signup" && <button type="button" className="reroll" onClick={() => setName(genTag(lang))}>{t("login.suggest")}</button>}</label>
        <input className="inp" type="text" value={name} placeholder={t("login.namePh")} onChange={e => { setName(e.target.value); setErr(""); }} />

        <label className="flbl" style={{ marginTop: 12 }}>{t("login.pin")}</label>
        <input className="inp" type="password" inputMode="numeric" value={pin} placeholder={mode === "login" ? t("login.pinPh") : t("login.pinSet")} onChange={e => { setPin(e.target.value); setErr(""); }} onKeyDown={e => { if (e.key === "Enter") (mode === "login" ? doLogin() : doSignup()); }} />

        {mode === "signup" && (<>
          <button className="privtoggle" onClick={() => setPriv(!priv)}>
            <span className={"switch" + (priv ? " on" : "")}><span className="knob" /></span>
            <span className="privtext"><b>{t("login.privTitle")}</b><span>{t("login.privDesc")}</span></span>
          </button>
        </>)}

        {err && <div className="err">{err}</div>}
        <button className="btn" onClick={mode === "login" ? doLogin : doSignup}>{mode === "login" ? t("login.signin") : t("login.create")}</button>
      </div>
    </div>
  );
}

/* ============================ App ============================ */
export default function App() {
  const [community, setCommunity] = useState(null);
  const [session, setSession] = useState(null);
  const [showIntro, setShowIntro] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState("routes");
  const [boardMode, setBoardMode] = useState("aktuell");
  const [filterScope, setFilterScope] = useState("aktuell");
  const [fWall, setFWall] = useState("alle");
  const [fGrade, setFGrade] = useState(0);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(null);
  const [tipsRouteId, setTipsRouteId] = useState(null);
  const [boardScope, setBoardScope] = useState("einzel");
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [openGroupId, setOpenGroupId] = useState(null);
  const [flashId, setFlashId] = useState(null);
  const [changePinOpen, setChangePinOpen] = useState(false);
  const [scoringOpen, setScoringOpen] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [photoStorageKB, setPhotoStorageKB] = useState(null);
  async function measurePhotoStorage() {
    setPhotoStorageKB("…");
    let total = 0;
    for (const r of routes) {
      for (const pid of (r.photos || [])) {
        if (typeof pid === "string" && (pid.startsWith("/") || pid.startsWith("http"))) { continue; }
        if (typeof pid === "string" && pid.startsWith("data:")) { total += Math.round(pid.length * 3/4); }
        else { try { const d = await loadPhotoBlob(pid); if (d) total += Math.round(d.length * 3/4); } catch(_){} }
      }
    }
    setPhotoStorageKB(Math.round(total / 1024));
  } // src string when open
  const [confirmCreator, setConfirmCreator] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [statsView, setStatsView] = useState("erfolge");
  const [achCat, setAchCat] = useState(null);
  const [hallTab, setHallTab] = useState("meine"); // meine | halle | creator
  const [cmpMetric, setCmpMetric] = useState("pts"); // Gruppen-Vergleichsmetrik (Hook muss top-level sein)
  const [lang, setLang] = useState("de");
  setLangG(lang);
  function changeLang(l) { setLang(l); setLangG(l); try { window.storage.set("blocscore:lang", l, false); } catch (e) {} }
  function jumpToRoute(id) { setFlashId(id); setTimeout(() => { const el = document.getElementById("r-" + id); if (el) el.scrollIntoView({ behavior: "smooth", block: "center" }); }, 30); setTimeout(() => setFlashId(null), 1700); }
  const firstSave = useRef(false);

  // PWA-Installation: beforeinstallprompt einfangen (Chromium), iOS-Fallback erkennen
  const [installEvt, setInstallEvt] = useState(null);
  const [iosInstallOpen, setIosInstallOpen] = useState(false);
  useEffect(() => {
    const onBip = (e) => { e.preventDefault(); setInstallEvt(e); };
    const onInstalled = () => setInstallEvt(null);
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onBip); window.removeEventListener("appinstalled", onInstalled); };
  }, []);
  const isStandalone = typeof window !== "undefined" && ((window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true);
  const isIOS = typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent || "");
  const canInstall = !!installEvt;
  const showInstall = !isStandalone && (canInstall || isIOS);
  async function doInstall() {
    if (installEvt) { installEvt.prompt(); try { await installEvt.userChoice; } catch (e) {} setInstallEvt(null); }
    else if (isIOS) { setIosInstallOpen(true); }
  }

  useEffect(() => { (async () => { let c = await loadCommunity(); c = c && c.accounts ? c : SEED_COMMUNITY; const mig = await migrateAccountPins(c); setCommunity(mig); if (mig !== c) { try { await saveCommunity(mig); } catch (e) {} } setSession(await loadSession()); try { const lr = await window.storage.get("blocscore:lang", false); if (lr && lr.value) { setLang(lr.value); setLangG(lr.value); } } catch (e) {} setReady(true); })(); }, []);
  useEffect(() => { if (!ready || !community) return; if (!firstSave.current) { firstSave.current = true; return; } saveCommunity(community); }, [community, ready]);

  const accounts = community?.accounts || [];
  const routes = community?.routes || [];
  const today = todayISO();
  const archivedSet = useMemo(() => { const s = new Set(); accounts.forEach(a => { if (isArchivedAcc(a, routes, today)) s.add(a.name); }); return s; }, [accounts, routes, today]);
  accounts.forEach(a => { AVATAR_EMOJI[a.name] = a.emoji || ""; });
  const players = useMemo(() => accounts.filter(a => !archivedSet.has(a.name) && a.role !== "superadmin").map(a => a.name), [accounts, archivedSet]);
  const me = accounts.find(a => a.id === session?.accountId) || null;
  const isSuperAdmin = me?.role === "superadmin";
  const isAdmin = me?.role === "admin" || isSuperAdmin;
  const canSetRoutes = isAdmin || me?.role === "schrauber";
  useEffect(() => { if (!canSetRoutes && filterScope === "archiv") setFilterScope("aktuell"); }, [canSetRoutes]);
  const visName = useMemo(() => new Set(accounts.filter(a => !a.staff && a.role !== "superadmin" && !archivedSet.has(a.name) && (!a.private || a.id === me?.id)).map(a => a.name)), [accounts, me, archivedSet]);

  const totals = useMemo(() => {
    const t = {}; players.forEach(p => t[p] = { aktuell: 0, gesamt: 0, sends: 0, flashes: 0, erfolge: 0 });
    routes.forEach(r => players.forEach(p => {
      const s = r.results?.[p]; if (!s) return; const pts = pointsFor(r.grade, s);
      t[p].gesamt += pts; if (!r.archived) { t[p].aktuell += pts; t[p].sends += 1; if (s === "flash") t[p].flashes += 1; }
    }));
    const list = ACHS();
    players.forEach(p => { const agg = computeAgg(routes, p); let sc = 0; for (const a of list) if (achValue(agg, a.key) >= a.target) sc += a.pts; t[p].erfolge = sc; });
    return t;
  }, [routes, players]);
  const ranked = useMemo(() => [...players].filter(p => visName.has(p)).sort((a, b) => (totals[b]?.[boardMode] || 0) - (totals[a]?.[boardMode] || 0)), [players, totals, boardMode, visName]);
  const maxPts = Math.max(1, ...[...visName].map(p => totals[p]?.[boardMode] || 0));
  const wallsPresent = useMemo(() => { const set = new Set(routes.map(r => wallCanon(r.gym))); return WALLS.filter(w => set.has(w.code)); }, [routes]);
  const gradesPresent = useMemo(() => GRADES.filter(g => routes.some(r => r.grade === g)), [routes]);
  const groups = community?.groups || [];
  const accById = useMemo(() => { const m = {}; accounts.forEach(a => m[a.id] = a); return m; }, [accounts]);
  const wallCounts = useMemo(() => { const m = {}; routes.forEach(r => { if (r.archived) return; const c = wallCanon(r.gym); m[c] = (m[c] || 0) + 1; }); return m; }, [routes]);
  const gradesByWall = useMemo(() => { const m = {}; routes.forEach(r => { if (r.archived) return; const c = wallCanon(r.gym); (m[c] = m[c] || new Set()).add(r.grade); }); const o = {}; Object.keys(m).forEach(k => o[k] = Array.from(m[k]).sort((a, b) => a - b)); return o; }, [routes]);
  const myWallDone = useMemo(() => { const m = {}; routes.forEach(r => { if (r.archived) return; if (r.results?.[me?.name]) { const c = wallCanon(r.gym); m[c] = (m[c] || 0) + 1; } }); return m; }, [routes, me]);
  const screwDates = community?.screwDates || {};
  const STEP = community?.scoring?.step ?? 0.25;
  const WALL_HEIGHT = community?.wallHeight ?? 3.5; // Meter pro Route (Wandhöhe)
  const FLASH_BONUS = community?.scoring?.flash ?? 0.25;
  _STEP = STEP; _FLASH_BONUS = FLASH_BONUS; // sync global for computeAgg etc.
  function setScoring(step, flash) { setCommunity(c => ({ ...c, scoring: { step: Number(step), flash: Number(flash) } })); }
  function setWallHeight(h) { setCommunity(c => ({ ...c, wallHeight: Number(h) })); }
  const newestWall = useMemo(() => { let best = null, bd = ""; Object.entries(screwDates).forEach(([w, d]) => { if (d <= today && d > bd) { bd = d; best = w; } }); return best; }, [screwDates, today]);
  const nextWall = useMemo(() => { let best = null, bd = "9999"; Object.entries(screwDates).forEach(([w, d]) => { if (d > today && d < bd) { bd = d; best = w; } }); return best; }, [screwDates, today]);
  const groupStats = useMemo(() => groups.map(g => {
    let aktuell = 0, gesamt = 0, erfolge = 0; const mem = [];
    (g.members || []).forEach(id => { const a = accById[id]; if (!a || a.staff) return; if (a.private && a.id !== me?.id) return; const t = totals[a.name] || {}; aktuell += t.aktuell || 0; gesamt += t.gesamt || 0; erfolge += t.erfolge || 0; mem.push({ acc: a, pts: t }); });
    mem.sort((x, y) => (y.pts[boardMode] || 0) - (x.pts[boardMode] || 0));
    return { ...g, aktuell, gesamt, erfolge, mem };
  }), [groups, accById, totals, boardMode, me]);
  const groupsRanked = useMemo(() => [...groupStats].sort((a, b) => (b[boardMode] || 0) - (a[boardMode] || 0)), [groupStats, boardMode]);
  const boardGroupsRanked = useMemo(() => groupsRanked.filter(g => !g.private), [groupsRanked]);
  const myGroups = groupStats.filter(g => (g.members || []).includes(me?.id));
  const otherGroups = groupStats.filter(g => !(g.members || []).includes(me?.id) && !g.private);

  const filteredSessions = useMemo(() => {
    const scope = canSetRoutes ? filterScope : "aktuell";
    let rs = routes.filter(r => {
      if (scope === "aktuell" && r.archived) return false;
      if (scope === "archiv" && !r.archived) return false;
      if (fWall !== "alle" && wallCanon(r.gym) !== fWall) return false;
      if (fGrade && r.grade !== fGrade) return false;
      if (q && !((r.name || "").toLowerCase().includes(q.toLowerCase()) || routeTitle(r).toLowerCase().includes(q.toLowerCase()) || wallName(r.gym).toLowerCase().includes(q.toLowerCase()))) return false;
      return true;
    });
    // Group by wall (accordion) — show each wall as one section
    const wallOrder = WALLS.map(w => w.code);
    const map = new Map();
    wallOrder.forEach(w => map.set(w, { wall: w, items: [] }));
    rs.forEach(r => { const w = wallCanon(r.gym); if (!map.has(w)) map.set(w, { wall: w, items: [] }); map.get(w).items.push(r); });
    const arr = Array.from(map.values()).filter(s => s.items.length > 0);
    arr.forEach(s => s.items.sort((a, b) => a.grade - b.grade || (a.date || "").localeCompare(b.date || "")));
    return arr;
  }, [routes, filterScope, fWall, fGrade, q, canSetRoutes]);

  function cycleMine(routeId) {
    if (!me) return;
    const td = todayISO();
    setCommunity(c => ({ ...c, routes: c.routes.map(r => {
      if (r.id !== routeId) return r;
      const cur = r.results?.[me.name] || null;
      const next = cur === null ? "top" : cur === "top" ? "flash" : null;
      const resultDates = { ...(r.resultDates || {}) };
      if (next === null) delete resultDates[me.name]; else resultDates[me.name] = td;
      return { ...r, results: { ...r.results, [me.name]: next }, resultDates };
    }) }));
  }
  function upsertRoute(route) { setCommunity(c => { const ex = c.routes.some(r => r.id === route.id); return { ...c, routes: ex ? c.routes.map(r => r.id === route.id ? route : r) : [route, ...c.routes] }; }); }
  function deleteRoute(id) { setCommunity(c => ({ ...c, routes: c.routes.filter(r => r.id !== id) })); }
  const MAX_MEMBERS = 10;
  const myGroup = useMemo(() => groups.find(g => (g.members || []).includes(me?.id)) || null, [groups, me]);
  const myGroupsList = useMemo(() => groups.filter(g => (g.members || []).includes(me?.id)), [groups, me]);
  const myAgg = useMemo(() => computeAgg(routes, me?.name || ""), [routes, me]);
  const achState = useMemo(() => {
    let unlocked = 0, score = 0; const cats = {}; const order = []; const icons = {};
    const evald = ACHS().map(a => { const cur = achValue(myAgg, a.key); const done = cur >= a.target; if (done) { unlocked++; score += a.pts; } if (!cats[a.cat]) { cats[a.cat] = { total: 0, done: 0 }; order.push(a.cat); icons[a.cat] = a.icon; } cats[a.cat].total++; if (done) cats[a.cat].done++; return { ...a, cur, done, ratio: Math.min(1, cur / a.target) }; });
    const total = evald.length;
    const catList = order.map(c => ({ cat: c, icon: icons[c], done: cats[c].done, total: cats[c].total }));
    return { evald, unlocked, score, cats, catList, total };
  }, [myAgg, lang]);
  const nextUp = useMemo(() => achState.evald.filter(a => !a.done).sort((a, b) => (b.ratio - a.ratio) || (a.target - b.target)).slice(0, 10), [achState]);
  const achScore = achState.score;
  const NEED_COMMENT = 100, NEED_GROUP = 200, NEED_CREATOR = 0;
  // Max groups: 1 ab 200 Pts, 2 ab 500 Pts, 3 ab 1500 Pts
  const maxGroupsAllowed = isAdmin ? 3 : achScore >= 1500 ? 3 : achScore >= 500 ? 2 : achScore >= 200 ? 1 : 0;
  const myGroupIds = groups.filter(g => (g.members||[]).includes(me?.id)).map(g => g.id);
  const canComment = isAdmin || canSetRoutes || achScore >= NEED_COMMENT;
  const canCreateGroup = isAdmin || canSetRoutes || achScore >= NEED_GROUP;
  const canJoinGroup = isAdmin || myGroupsList.length < maxGroupsAllowed;
  const canRequestCreator = achScore >= NEED_CREATOR;

  // ── Hallen-Statistiken ──────────────────────────────────────────────────
  const hallStats = useMemo(() => {
    const activeRoutes = routes.filter(r => !r.archived);
    const allResults = []; // { player, routeId, wall, grade, status, date, screwedAt }
    routes.forEach(r => { Object.entries(r.results || {}).forEach(([p, st]) => { if (st) allResults.push({ player: p, routeId: r.id, wall: wallCanon(r.gym), grade: r.grade, status: st, date: r.date, screwedAt: r.date }); }); });
    const now = new Date(today);
    const dayMs = 86400000;
    const todayStr = today;
    const weekAgo = new Date(now - 7 * dayMs).toISOString().slice(0, 10);
    const monthAgo = new Date(now - 30 * dayMs).toISOString().slice(0, 10);
    // climbs per day/week/month — we track by route date logged (use route date as proxy)
    // actually: results don't have a timestamp; we count unique routes climbed total
    const todaySends = allResults.filter(r => r.date === todayStr).length;
    const weekSends = allResults.filter(r => r.date >= weekAgo).length;
    const monthSends = allResults.filter(r => r.date >= monthAgo).length;
    const totalSends = allResults.length;
    const totalFlashes = allResults.filter(r => r.status === "flash").length;
    // most popular routes
    const routeSendCount = {};
    allResults.forEach(r => { routeSendCount[r.routeId] = (routeSendCount[r.routeId] || 0) + 1; });
    const popularRoutes = activeRoutes.map(r => ({ ...r, sendCount: routeSendCount[r.id] || 0 })).sort((a, b) => b.sendCount - a.sendCount).slice(0, 10);
    const flashCount = {};
    allResults.filter(r => r.status === "flash").forEach(r => { flashCount[r.routeId] = (flashCount[r.routeId] || 0) + 1; });
    const topSendsId = popularRoutes[0]?.id || null;
    const topFlashId2 = Object.entries(flashCount).sort((a,b) => b[1]-a[1])[0]?.[0] || null;
    // most active climbers
    const playerSends = {};
    allResults.forEach(r => { playerSends[r.player] = (playerSends[r.player] || 0) + 1; });
    const activeClimbers = Object.entries(playerSends).sort((a, b) => b[1] - a[1]).slice(0, 10);
    // per-wall stats
    const wallStats = WALLS.map(w => {
      const wr = activeRoutes.filter(r => wallCanon(r.gym) === w.code);
      const ws = allResults.filter(r => r.wall === w.code);
      return { ...w, routeCount: wr.length, sendCount: ws.length, flashCount: ws.filter(r => r.status === "flash").length };
    }).filter(w => w.routeCount > 0);
    // ── Route Creator Auswertung (nur Admin) ─────────────────────────────
    const creators = accounts.filter(a => a.role === "schrauber" || a.role === "admin");  // superadmin excluded by staff flag
    // group routes by screwSession (wall + date)
    const sessions = {};
    routes.forEach(r => {
      const key = wallCanon(r.gym) + "|" + r.date;
      if (!sessions[key]) sessions[key] = { wall: wallCanon(r.gym), date: r.date, routes: [], sends: 0, flashes: 0 };
      sessions[key].routes.push(r);
      const sc = Object.values(r.results || {}).filter(Boolean).length;
      const fc = Object.values(r.results || {}).filter(s => s === "flash").length;
      sessions[key].sends += sc; sessions[key].flashes += fc;
    });
    // Since we don't store who screwed which route, we show sessions with counts
    // Admin can see which sessions exist and their popularity
    const sessionList = Object.values(sessions).sort((a, b) => b.date.localeCompare(a.date));
    // comments total
    const totalComments = routes.reduce((s, r) => s + (r.tips || []).length, 0);
    // most commented routes
    const mostCommented = [...routes].filter(r => !r.archived && (r.tips || []).length > 0)
      .sort((a, b) => (b.tips || []).length - (a.tips || []).length).slice(0, 5);
    // storage estimate (community JSON without photo blobs)
    const communityKB = Math.round(JSON.stringify({ ...community, _noPhotos: true }).length / 1024);
    const archivedWithPhoto = routes.filter(r => r.archived && r.photos?.length > 0);
    return { activeRoutes, todaySends, weekSends, monthSends, totalSends, totalFlashes, popularRoutes, activeClimbers, wallStats, sessionList, creators, totalComments, mostCommented, communityKB, archivedWithPhoto, topSendsId, topFlashId2 };
  }, [routes, accounts, today]);
  function groupOf(accId) { return groups.find(g => (g.members || []).includes(accId)); }
  function createGroup(name, emoji, isPrivate=false) { if (myGroupsList.length >= maxGroupsAllowed) return; const g = { id: uid(), name, emoji, private: !!isPrivate, members: [me.id], requests: [], createdBy: me.id }; setCommunity(c => ({ ...c, groups: [...(c.groups || []), g] })); }
  function setGroupPrivate(gId, val) { setCommunity(c => ({ ...c, groups: c.groups.map(g => g.id === gId ? { ...g, private: val } : g) })); }
  function requestJoin(id) {
    if (myGroupsList.length >= maxGroupsAllowed) return;
    setCommunity(c => ({ ...c, groups: (c.groups || []).map(g => g.id === id && !(g.requests || []).includes(me.id) && !g.members.includes(me.id) ? { ...g, requests: [...(g.requests || []), me.id] } : g) }));
  }
  function cancelRequest(id) { setCommunity(c => ({ ...c, groups: (c.groups || []).map(g => g.id === id ? { ...g, requests: (g.requests || []).filter(r => r !== me.id) } : g) })); }
  function acceptRequest(id, accId) {
    setCommunity(c => ({ ...c, groups: (c.groups || []).map(g => {
      if (g.id !== id) return { ...g, requests: (g.requests || []).filter(r => r !== accId) }; // remove from other reqs implicitly handled below
      if (g.members.length >= MAX_MEMBERS) return g;
      if ((c.groups || []).some(x => x.members.includes(accId))) return { ...g, requests: (g.requests || []).filter(r => r !== accId) };
      return { ...g, members: [...g.members, accId], requests: (g.requests || []).filter(r => r !== accId) };
    }) }));
  }
  function declineRequest(id, accId) { setCommunity(c => ({ ...c, groups: (c.groups || []).map(g => g.id === id ? { ...g, requests: (g.requests || []).filter(r => r !== accId) } : g) })); }
  function inviteMember(id, accId) {
    setCommunity(c => ({ ...c, groups: (c.groups || []).map(g => {
      if (g.id !== id) return g;
      if (g.members.length >= MAX_MEMBERS) return g;
      if ((c.groups || []).some(x => x.members.includes(accId))) return g;
      return { ...g, members: [...g.members, accId], requests: (g.requests || []).filter(r => r !== accId) };
    }) }));
  }
  function leaveGroup(id) {
    setCommunity(c => ({ ...c, groups: (c.groups || []).flatMap(g => {
      if (g.id !== id) return [g];
      const members = g.members.filter(m => m !== me.id);
      if (members.length === 0) return [];
      const createdBy = g.createdBy === me.id ? members[0] : g.createdBy;
      return [{ ...g, members, createdBy }];
    }) }));
  }
  function deleteGroup(id) { setCommunity(c => ({ ...c, groups: (c.groups || []).filter(g => g.id !== id) })); }
  function setPrivate(v) { setCommunity(c => ({ ...c, accounts: c.accounts.map(a => a.id === me.id ? { ...a, private: v } : a) })); }
  function renameAccount(newName) {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === me.name) return { ok: false, err: "same" };
    const exists = accounts.some(a => a.id !== me.id && a.name.toLowerCase() === trimmed.toLowerCase());
    if (exists) return { ok: false, err: "taken" };
    const oldName = me.name;
    setCommunity(c => ({
      ...c,
      accounts: c.accounts.map(a => a.id === me.id ? { ...a, name: trimmed } : a),
      routes: c.routes.map(r => {
        if (!r.results?.[oldName]) return r;
        const results = { ...r.results };
        results[trimmed] = results[oldName];
        delete results[oldName];
        return { ...r, results };
      }),
    }));
    return { ok: true };
  }
  function setMyEmoji(e) { setCommunity(c => ({ ...c, accounts: c.accounts.map(a => a.id === me.id ? { ...a, emoji: e } : a) })); }

  // ── Sendly Sync ──
  const [syncLog, setSyncLog] = useState([]);
  function pushSyncLog(text, kind = "") { setSyncLog(s => [...s, { text, kind }]); }

  async function handleSendlySync(file, fullReset) {
    if (!file) return;
    setSyncLog([]);
    pushSyncLog(`📂 Datei: ${file.name} (${Math.round(file.size/1024)} KB)`);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const incoming = Array.isArray(data) ? data : (data.routes || []);
      if (!incoming.length) { pushSyncLog("⚠️ Keine Routen in der Datei gefunden.", "warn"); return; }
      pushSyncLog(`✅ ${incoming.length} Routen in Import-Datei`);

      // Sektor-Mapping sendly → blocscore
      const SECTOR_MAP = { BH: "h", BV: "v", PL: "pl", TB: "tb", WK: "wkw", "Block Hinten": "h", "Block Vorne": "v", Platte: "pl", "Training & Bug": "tb", "Wettkampfwand": "wkw", Trainingsbereich: "tb" };
      const COLOR_MAP = { Pink: "pink", Gelb: "gelb", Blau: "blau", Weiss: "weiß", Weiß: "weiß", Rot: "rot", Grün: "grün", Gruen: "grün", Orange: "orange", Lila: "lila", Violett: "lila", Schwarz: "schwarz", Türkis: "türkis", Tuerkis: "türkis", Mint: "mint", Braun: "braun", Grau: "grau" };

      // Normalisiere eingehende Routen
      const normalized = incoming.map((r, idx) => ({
        _idx: idx,
        color: COLOR_MAP[r.color] || (r.color || "").toLowerCase().trim(),
        grade: Number(r.grade) || 0,
        sector: SECTOR_MAP[r.sector] || SECTOR_MAP[r.gym] || r.sector || r.gym,
        date: r.date || todayISO(),
        imageUrl: r.imageUrl || r.image || null,
        sourceName: r.name || null,
      })).filter(r => r.color && r.grade && r.sector);

      pushSyncLog(`🔍 ${normalized.length} valide Routen (Farbe + Grade + Sektor vorhanden)`);

      let matched = 0, created = 0, archived = 0, imageAdded = 0;
      const today = todayISO();

      setCommunity(c => {
        let newRoutes = [...(c.routes || [])];
        let newAccounts = c.accounts;
        const usedIds = new Set();

        // FULL RESET: alle bisherigen Routen entfernen (Ergebnisse werden mit Route weggeschmissen)
        if (fullReset) {
          archived = newRoutes.filter(r => !r.archived).length;
          newRoutes = [];
          pushSyncLog(`🗑️ Hard-Reset: ${archived} alte Routen entfernt`, "warn");
        }

        for (const inc of normalized) {
          // Suche Match: gleiche Farbe + Sektor + Schwierigkeit, nicht archiviert
          const matchIdx = newRoutes.findIndex(r => !r.archived && r.name === inc.color && r.grade === inc.grade && r.gym === inc.sector && !usedIds.has(r.id));
          if (matchIdx >= 0) {
            // MATCH: Bild übertragen falls vorhanden
            usedIds.add(newRoutes[matchIdx].id);
            matched++;
            if (inc.imageUrl && (!newRoutes[matchIdx].photos || newRoutes[matchIdx].photos.length === 0)) {
              // Bild später async laden
              newRoutes[matchIdx] = { ...newRoutes[matchIdx], _pendingImageUrl: inc.imageUrl };
            }
          } else if (fullReset || (inc.date && inc.date >= today)) {
            // Kein Match aber aktuelles Datum → neue Route
            const nick = genName(uid() + "|" + inc.color, inc.grade);
            const newRoute = {
              id: uid(),
              date: inc.date || today,
              gym: inc.sector,
              grade: inc.grade,
              name: inc.color,
              nick: nick,
              note: "",
              archived: false,
              results: {},
              photos: [],
              tips: [],
            };
            if (inc.imageUrl) newRoute._pendingImageUrl = inc.imageUrl;
            newRoutes.push(newRoute);
            created++;
          }
        }

        // Archiviere alte Routen die nicht gematcht wurden (nur bei Additivem Sync mit gleichem Sektor)
        if (!fullReset) {
          const sectorsInSync = new Set(normalized.map(n => n.sector));
          newRoutes = newRoutes.map(r => {
            if (!r.archived && sectorsInSync.has(r.gym) && !usedIds.has(r.id)) {
              archived++;
              return { ...r, archived: true };
            }
            return r;
          });
        }

        return { ...c, routes: newRoutes };
      });

      pushSyncLog(`✓ ${matched} bestehende Routen aktualisiert`);
      pushSyncLog(`✓ ${created} neue Routen angelegt`);
      if (archived > 0) pushSyncLog(`⏸ ${archived} alte Routen archiviert`, "warn");

      // Async: Bilder nachladen + komprimieren
      pushSyncLog("⏳ Lade Bilder im Hintergrund (komprimiert auf max. 1080px)...");
      setTimeout(async () => {
        const community = JSON.parse(JSON.stringify(await loadCommunity() || {}));
        if (!community.routes) return;
        let imgOk = 0, imgFail = 0;
        for (const r of community.routes) {
          if (r._pendingImageUrl && (!r.photos || r.photos.length === 0)) {
            try {
              const resp = await fetch(r._pendingImageUrl, { mode: "cors" });
              const blob = await resp.blob();
              const f = new File([blob], "img.jpg", { type: blob.type });
              const dataUrl = await downscale(f);
              const photoId = uid();
              await savePhotoBlob(photoId, dataUrl);
              r.photos = [photoId];
              delete r._pendingImageUrl;
              imgOk++;
            } catch (err) {
              imgFail++;
              delete r._pendingImageUrl;
            }
          }
        }
        setCommunity(c => ({ ...c, routes: community.routes }));
        pushSyncLog(`📸 ${imgOk} Bilder geladen` + (imgFail ? ` (${imgFail} fehlgeschlagen — vermutlich CORS-Block)` : ""), imgFail ? "warn" : "");
        pushSyncLog("✅ Sync abgeschlossen.", "ok");
      }, 200);

    } catch (err) {
      pushSyncLog("❌ Fehler beim Sync: " + (err.message || err), "err");
    }
  }
  async function setMyPin(p) { const f = await makePinFields(p); setCommunity(c => ({ ...c, accounts: c.accounts.map(a => { if (a.id !== me.id) return a; const { pin, pinHash, pinSalt, ...rest } = a; return { ...rest, ...f }; }) })); }
  function setScrewDate(wall, date) {
    setCommunity(c => ({ ...c, screwDates: { ...c.screwDates, [wall]: date } }));
  }
  function requestRole() { setCommunity(c => ({ ...c, accounts: c.accounts.map(a => a.id === me.id ? { ...a, roleRequest: "schrauber" } : a) })); }
  function requestReactivate() { setCommunity(c => ({ ...c, accounts: c.accounts.map(a => a.id === me.id ? { ...a, reactivateRequest: true } : a) })); }
  function reactivateAccount(id) { setCommunity(c => ({ ...c, accounts: c.accounts.map(a => a.id === id ? { ...a, archived: false, reactivateRequest: false, lastSeen: todayISO() } : a) })); }
  function addTip(routeId, text) { setCommunity(c => ({ ...c, routes: c.routes.map(r => r.id === routeId ? { ...r, tips: [...(r.tips || []), { id: uid(), by: me.name, text, ts: Date.now() }] } : r) })); }
  function delTip(routeId, tipId) { setCommunity(c => ({ ...c, routes: c.routes.map(r => r.id === routeId ? { ...r, tips: (r.tips || []).filter(t => t.id !== tipId) } : r) })); }
  function setAccRole(id, role) { setCommunity(c => ({ ...c, accounts: c.accounts.map(a => a.id === id ? { ...a, role, roleRequest: null } : a) })); }
  function removeAccount(id) { setCommunity(c => ({ ...c, accounts: c.accounts.filter(a => a.id !== id) })); }
  function deleteMyAccount() { if (confirm("Dein Konto wirklich löschen? Alle deine Ergebnisse bleiben erhalten, du kannst dich aber nicht mehr einloggen.")) { removeAccount(me.id); logout(); } }
  function handleLogin(id) {
    const s = { accountId: id };
    setSession(s);
    saveSession(s);
    setCommunity(c => ({ ...c, accounts: c.accounts.map(a => a.id === id ? { ...a, lastSeen: todayISO() } : a) }));
    // Show intro if not dismissed before
    const acc = accounts.find(a => a.id === id);
    if (!acc?.skipIntro) setShowIntro(true);
  }
  async function handleSignup({ name, pin, role, private: priv, emoji }) { const f = await makePinFields(pin); const acc = { id: uid(), name, ...f, role, private: !!priv, emoji: emoji || "", lastSeen: todayISO() }; setCommunity(c => ({ ...c, accounts: [...c.accounts, acc] })); handleLogin(acc.id); }
  function logout() { setSession(null); saveSession(null); setTab("routes"); }
  function dismissIntro() {
    setShowIntro(false);
    if (me) setCommunity(c => ({ ...c, accounts: c.accounts.map(a => a.id === me.id ? { ...a, skipIntro: true } : a) }));
  }

  if (!ready) return <div className="bld"><style>{CSS}</style><div className="empty" style={{ margin: "auto" }}>Lädt…</div></div>;
  if (!me) return <LoginScreen accounts={accounts} onLogin={handleLogin} onSignup={handleSignup} lang={lang} onLang={changeLang} />;
  const introEl = showIntro && !me?.skipIntro ? <IntroModal me={me} onClose={() => setShowIntro(false)} onDismiss={dismissIntro} /> : null;

  const tipsRoute = routes.find(r => r.id === tipsRouteId) || null;

  return (
    <div className="bld">
      {introEl}
      {showShare && <ShareCard me={me} routes={routes} today={today} logoSrc={LOGO_IMG} onClose={() => setShowShare(false)} />}
      <style>{CSS}</style>
      <div className="topbar" style={{ backgroundImage: `url(${HEADER_BG})` }}>
        <div className="topbar-overlay" />
        <div className="brand">
          <button onClick={() => { setTab("routes"); setFWall("alle"); setFGrade(0); setFilterScope("aktuell"); setQ(""); }} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center" }}>
            <img src={LOGO_IMG} alt="blocscore" className="brand-logo" />
          </button>
        </div>
        {tab === "routes" && canSetRoutes && <button className="addtop-tb" onClick={() => setEditing("new")}><span className="plus">+</span>{t("routes.add")}</button>}
        {showInstall && (
          <button className="installtb" onClick={doInstall} aria-label={LANG === "en" ? "Install app" : "App installieren"} title={LANG === "en" ? "Install app" : "App installieren"}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v11" /><path d="M8 11l4 4 4-4" /><path d="M5 20h14" /></svg>
          </button>
        )}
        <button className="uchip" onClick={() => setTab("account")}>
          {me.role !== "community" && me.role !== "superadmin" && <span className="adminpill">{me.role === "admin" ? "Admin" : "Route Creator"}</span>}
          <span className="un">{me.name}</span>
          <Avatar name={me.name} size={28} emoji={me.emoji} />
        </button>
      </div>

      {/* BOARD */}
      {tab === "board" && (<>
        <div className="segwrap" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <div className="seg">
            <button className={boardScope === "einzel" ? "on" : ""} onClick={() => setBoardScope("einzel")}>{t("board.einzel")}</button>
            <button className={boardScope === "gruppen" ? "on" : ""} onClick={() => setBoardScope("gruppen")}>{t("board.gruppen")}</button>
          </div>
          <div className="seg">
            <button className={boardMode === "aktuell" ? "on" : ""} onClick={() => setBoardMode("aktuell")}>{t("board.aktuell")}</button>
            <button className={boardMode === "gesamt" ? "on" : ""} onClick={() => setBoardMode("gesamt")}>{t("board.gesamt")}</button>
            <button className={boardMode === "erfolge" ? "on" : ""} onClick={() => setBoardMode("erfolge")}>{t("board.erfolge")}</button>
          </div>
        </div>
        <div className="scroll"><div className="lb">
          {boardScope === "einzel" && ranked.map((p, i) => { const tot = totals[p] || {}; const v = tot[boardMode] || 0; const isMe = p === me.name; const isErf = boardMode === "erfolge"; return (
            <div key={p} className={"lbrow" + (i === 0 && v > 0 ? " lead" : "") + (isMe ? " meRow" : "")}>
              <div className="rank">{medal(i) || (i + 1)}</div>
              <div className="who">
                <div className="nm">{p}{isMe && <span className="youtag">DU</span>}</div>
                <div className="meta"><span><b>{tot.flashes || 0}</b> Flashes</span><span>{tot.sends || 0} Tops</span></div>
                <div className="bar"><i style={{ width: `${(v / maxPts) * 100}%` }} /></div>
              </div>
              <div className="pts"><div className="v">{isErf ? Math.round(v) : fmtPts(v)}</div><div className="u">{isErf ? t("board.achpts") : t("board.points")}</div></div>
            </div>
          ); })}

          {boardScope === "gruppen" && boardGroupsRanked.length === 0 && (
            <div className="empty"><div className="big">👥</div>{t("board.noGroups")}</div>
          )}
          {boardScope === "gruppen" && (() => { const gmax = Math.max(1, ...boardGroupsRanked.map(g => g[boardMode] || 0)); return boardGroupsRanked.map((g, i) => { const v = g[boardMode] || 0; const mine = (g.members || []).includes(me.id); return (
            <div key={g.id} className={"lbrow" + (i === 0 && v > 0 ? " lead" : "") + (mine ? " meRow" : "")} onClick={() => setOpenGroupId(g.id)} style={{ cursor: "pointer" }}>
              <div className="rank">{medal(i) || (i + 1)}</div>
              <div className="gemoji">{g.emoji || "👥"}</div>
              <div className="who">
                <div className="nm">{g.name}{mine && <span className="youtag">DABEI</span>}</div>
                <div className="meta"><span>{(g.members || []).length} {t("board.members")}</span>{g.mem[0] && <span>Top: {g.mem[0].acc.name}</span>}</div>
                <div className="bar"><i style={{ width: `${(v / gmax) * 100}%` }} /></div>
              </div>
              <div className="pts"><div className="v">{boardMode === "erfolge" ? Math.round(v) : fmtPts(v)}</div><div className="u">{boardMode === "erfolge" ? t("board.achpts") : t("board.points")}</div></div>
            </div>
          ); }); })()}
        </div></div>
      </>)}

      {/* ROUTES */}
      {tab === "routes" && (<>
        <div className="scroll"><div className="mapbrowse">

          {/* Floor Plan */}
          <div className="fpwrap"><FloorPlan value={fWall === "alle" ? null : fWall} counts={wallCounts} newest={newestWall} onChange={(c) => { setFWall(fWall === c ? "alle" : c); setFGrade(0); }} /></div>

          {/* Filter + Suche */}
          <div className="routefilters">
            <div className="filterrow">
              {canSetRoutes && [...["aktuell", "alle"], ...["archiv"]].map(s => <button key={s} className={"chip" + (filterScope === s ? " on" : "")} onClick={() => setFilterScope(s)}>{s === "aktuell" ? t("routes.scope.aktuell") : s === "archiv" ? t("routes.scope.archiv") : t("routes.scope.alle")}</button>)}
              {!canSetRoutes && ["aktuell"].map(s => <button key={s} className={"chip on"} onClick={() => {}}>{t("routes.scope.aktuell")}</button>)}
              <div className="gradefilter">
                <button className={"chip" + (!fGrade ? " on" : "")} onClick={() => setFGrade(0)}>{t("routes.allGrades")}</button>
                {GRADES.map(g => <button key={g} className={"chip" + (fGrade === g ? " on" : "")} style={{ borderColor: fGrade === g ? "#b8ff00" : undefined, color: fGrade === g ? "#b8ff00" : undefined, background: fGrade === g ? "#b8ff0022" : undefined }} onClick={() => setFGrade(fGrade === g ? 0 : g)}>{g}</button>)}
              </div>
            </div>
            <input className="searchinp" value={q} onChange={e => setQ(e.target.value)} placeholder={t("routes.search")} />
          </div>

          {/* Accordion per Wall */}
          {filteredSessions.length === 0 && <div className="empty"><div className="big">🪨</div>{t("routes.empty")}</div>}
          {filteredSessions.map(s => {
            const isOpen = fWall === s.wall || (fWall === "alle" && (q.length > 0 || fGrade > 0));
            return (
              <div key={s.wall} className="wallsection">
                <button className={"wallacchead" + (isOpen ? " open" : "")} onClick={() => setFWall(fWall === s.wall ? "alle" : s.wall)}>
                  <span className="waic"><WallIcon code={s.wall} size={18} /></span>
                  <span className="waname">{wallName(s.wall)}</span>
                  {newestWall === s.wall && <span className="freshbadge">{t("plan.fresh")}</span>}
                  {nextWall === s.wall && <span className="nextbadge">{t("plan.next")}</span>}
                  {myWallDone[s.wall] > 0 && <span className="wadone"><svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{display:"inline-block",verticalAlign:"middle",marginRight:2,marginTop:-1}}><polyline points="1.5,5.5 4,8 8.5,2"/></svg>{myWallDone[s.wall]}</span>}
                  {(() => { const flN = s.items.filter(r => r.results?.[me.name] === "flash").length; return flN > 0 ? <span className="waflash"><svg width="8" height="9" viewBox="0 0 10 12" fill="currentColor" style={{display:"inline-block",verticalAlign:"middle",marginRight:2,marginTop:-1}}><path d="M7 1L1 7h4l-2 4 6-6H5z"/></svg>{flN}</span> : null; })()}
                  <span className="wacount">{s.items.length} Routen</span>
                  <span className="wachevron">{isOpen ? "▲" : "▼"}</span>
                </button>
                {isOpen && (
                  <div className="wallbody">
                    {screwDates[s.wall] && <div className="lhsub">{t("routes.rescrewed")} {fmtDate(screwDates[s.wall])}</div>}
                    <div className="route-grid">
                    {s.items.map(r => {
                      const myStatus = r.results?.[me.name] || null;
                      const senders = players.filter(p => visName.has(p) && r.results?.[p]);
                      const sendsN = senders.length;
                      const flashN = senders.filter(p => r.results[p] === "flash").length;
                      const topN = sendsN - flashN;
                      const col = colorOf(r.name);
                      const hasPhoto = r.photos?.length > 0;
                      const tipsN = (r.tips || []).length;
                      return (
                        <div key={r.id} id={"r-" + r.id} className={"rc" + (col ? " rccol" : "") + (r.archived ? " arch" : "") + (flashId === r.id ? " flash" : "")} style={col ? { "--rcol": col } : undefined}>
                          {hasPhoto && <RoutePhoto photoId={r.photos[0]} className="rbanner" onClick={async () => { const inline = r.photos[0].startsWith("data:"); const src = inline ? r.photos[0] : await loadPhotoBlob(r.photos[0]); setLightbox(src); }} />}
                          <div className="rbody">
                            <div className="rchead">
                              <div className="gcol" style={col ? { "--gcol-color": col, background: col === "#181C22" ? "rgba(255,255,255,0.35)" : "transparent" } : { "--gcol-color": "#b8ff00" }}>
                                <span className="ggrade">{r.grade}</span>
                              </div>
                              <div className="rname">
                                <div className="t1"><span className="txt">{routeTitle(r)}</span>{r.archived && <span className="archtag">Archiv</span>}</div>
                                {r.note ? <div className="rnote">{r.note}</div> : null}
                                <div className="t2">{colorWord(r.name) ? colorWord(r.name) + " · " : ""}{r.grade}er · {wallName(r.gym)}</div>
                              </div>
                              <div className="rpills">
                                <span className={"rschip top" + (topN > 0 ? " has" : "")}><svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{display:"inline-block",verticalAlign:"middle",marginRight:2,marginTop:-1}}><polyline points="1.5,5.5 4,8 8.5,2"/></svg>{topN}</span>
                                <span className={"rschip flash" + (flashN > 0 ? " has" : "")}><svg width="8" height="9" viewBox="0 0 10 12" fill="currentColor" style={{display:"inline-block",verticalAlign:"middle",marginRight:2,marginTop:-1}}><path d="M7 1L1 7h4l-2 4 6-6H5z"/></svg>{flashN}</span>
                              </div>
                              {canSetRoutes && <button className="edit" onClick={(e) => { e.stopPropagation(); setEditing(r); }} title={LANG==="en"?"Edit route":"Route bearbeiten"}><svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17l3.5-1L17 5.5 14.5 3 4 13.5 3 17z"/></svg></button>}
                            </div>
                            <div className="rfoot">
                              <button className={"du " + (myStatus || "")} onClick={() => cycleMine(r.id)}>
                                {myStatus === "flash" ? <><svg width="11" height="13" viewBox="0 0 10 12" fill="currentColor"><path d="M7 1L1 7h4l-2 4 6-6H5z"/></svg>Flash <span className="dpts">+{fmtPts(pointsFor(r.grade, "flash"))}</span></>
                                  : myStatus === "top" ? <><svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1.5,5.5 4,8 8.5,2"/></svg>Top <span className="dpts">+{fmtPts(pointsFor(r.grade, "top"))}</span></>
                                    : <><svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M7 1v12M1 7h12"/></svg> Eintragen</>}
                              </button>
                              <button className={"pill" + (tipsN ? " has" : "") + (canComment ? "" : " locked")} title={canComment ? "" : t("lock.comments", { n: achScore })} onClick={() => { if (canComment) setTipsRouteId(r.id); }}>
                                {canComment ? <><svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 10c0 4-3.6 7-8 7a8.8 8.8 0 0 1-4-.9L2 17l1-3.7A6.6 6.6 0 0 1 2 10c0-3.9 3.6-7 8-7s8 3.1 8 7Z"/></svg>{tipsN ? ` ${tipsN}` : ""}</> : <>🔒</>}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Umschraubplan */}
          {fWall === "alle" && (<div className="plancard" style={{ marginTop: 16, margin: "16px 14px 0" }}>
            <div className="planttl">🛠 {t("plan.title")}</div>
            {Object.entries(screwDates).sort((a, b) => a[1].localeCompare(b[1])).map(([w, d]) => { const fresh = newestWall === w; const nxt = nextWall === w; return (
              <div key={w} className={"planrow" + (fresh ? " fresh" : "") + (nxt ? " next" : "")}>
                <span className="plw"><WallIcon code={w} size={14} /> <span className="plwn">{wallName(w)}</span></span>
                <div className="plright">
                  {fresh && <span className="freshbadge">{t("plan.fresh")}</span>}
                  {nxt && <span className="nextbadge">{t("plan.next")}</span>}
                  {canSetRoutes
                    ? <input type="date" className="pldInput" value={d} onChange={e => { if (e.target.value) setScrewDate(w, e.target.value); }} />
                    : <span className="pld">{fmtDate(d)}</span>}
                </div>
              </div>
            ); })}
            {canSetRoutes && <div className="phint" style={{ marginTop: 8 }}>Datum ändern → neue Routen dieser Wand erben automatisch das Schraubdatum.</div>}
          </div>)}

        </div></div>
      </>)}


      {/* STATS */}
      {tab === "stats" && (
        <>
        <div className="segwrap"><div className="seg">
          <button className={statsView === "erfolge" ? "on" : ""} onClick={() => setStatsView("erfolge")}>{t("ach.view.ach")}</button>
          <button className={statsView === "grade" ? "on" : ""} onClick={() => setStatsView("grade")}>{t("ach.view.grade")}</button>
        </div></div>

        {statsView === "erfolge" && (
          <div className="scroll"><div className="stats">
            <div className="achintro">
              <div className="achintro-ttl">{LANG==="en"?"How do achievements work?":"Wie funktionieren Erfolge?"}</div>
              <div className="achintro-txt">{LANG==="en"?<>Every route earns you <b>Skillpoints</b>. Additional Skillpoints come from achievements — milestones like first 10 tops, 25 flashes or all colors on a wall. Use your Skillpoints to unlock more app features:</>:<>Jede Route bringt dir Skillpoints. Zusätzliche Skillpoints sammelst du durch Erfolge — Meilensteine wie z.B. erste 10 Tops, 25 Flashes oder alle Farben einer Wand. Mit deinen <b>Skillpoints</b> schaltest du weitere App-Features frei:</>}</div>
              <div className="achintro-unlocks">
                <div className="achunl"><span className="achunl-num">5</span> Skillpoints &rarr; {LANG==="en"?"5 new profile emojis":"5 neue Profil-Emojis"}</div>
                <div className="achunl"><span className="achunl-num">100</span> Skillpoints &rarr; {LANG==="en"?"Route comments":"Kommentare zu Routen"}</div>
                <div className="achunl"><span className="achunl-num">200</span> Skillpoints &rarr; {LANG==="en"?"Create a group":"Eigene Gruppe erstellen"}</div>
              </div>
            </div>
            <div className="achhero">
              <div className="achring"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15.9" fill="none" stroke="#2c313a" strokeWidth="3" /><circle cx="18" cy="18" r="15.9" fill="none" stroke="#f2b441" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${(achState.unlocked / Math.max(1, achState.total)) * 100} 100`} transform="rotate(-90 18 18)" /></svg><div className="achpct">{Math.round((achState.unlocked / Math.max(1, achState.total)) * 100)}%</div></div>
              <div className="achmeta">
                <div className="achbig">{achState.unlocked} <span>/ {achState.total}</span></div>
                <div className="achsub">{t("ach.unlocked")}</div>
                <div className="achscore">🏅 {achState.score} {t("ach.points")}</div>
              </div>
            </div>

            {(() => { const done = achState.evald.filter(a => a.done).sort((a, b) => b.pts - a.pts); return done.length > 0 ? (
              <>
                <h3 className="ssec">{t("ach.done")} 🏅 <span className="ssecn">{done.length}</span></h3>
                <div className="achstrip">{done.slice(0, 16).map(a => (
                  <div className="achbadge" key={a.id} title={a.desc}><span className="abic">{a.icon}</span><span className="abn">{a.name}</span><span className="abp">+{a.pts}</span></div>
                ))}</div>
              </>
            ) : null; })()}

            <h3 className="ssec">{t("ach.next")}</h3>
            {nextUp.map(a => (
              <div key={a.id} className="achrow">
                <span className="achic">{a.icon}</span>
                <div className="achinfo"><div className="achn">{a.name}</div><div className="achd">{a.desc}</div><div className="achbar"><i style={{ width: `${a.ratio * 100}%` }} /></div></div>
                <div className="achprog">{Math.min(a.cur, a.target)}/{a.target}</div>
              </div>
            ))}

            <h3 className="ssec">{t("ach.cats")}</h3>
            {achState.catList.map(c => (
              <button key={c.cat} className="catrow" onClick={() => setAchCat(c.cat)}>
                <span className="achic">{c.icon}</span>
                <div className="achinfo"><div className="achn">{c.cat}</div><div className="achbar"><i style={{ width: `${(c.done / c.total) * 100}%` }} /></div></div>
                <div className="achprog">{c.done}/{c.total}</div>
              </button>
            ))}
          </div></div>
        )}

        {statsView === "grade" && (
          <div className="scroll"><div className="stats">
            <div className="note">Routen je Schwierigkeitsgrad — aktuelle Saison und (gesamt).</div>
            {ranked.map(p => {
              const per = {}; GRADES.forEach(g => per[g] = { aD: 0, aT: 0, lD: 0, lT: 0 });
              routes.forEach(r => { if (!GRADES.includes(r.grade)) return; const done = !!r.results?.[p]; per[r.grade].lT++; if (done) per[r.grade].lD++; if (!r.archived) { per[r.grade].aT++; if (done) per[r.grade].aD++; } });
              return (
                <div key={p} className={"stcard" + (p === me.name ? " meCard" : "")}>
                  <h3><span>{p}{p === me.name ? " · Du" : ""}</span><span className="r">{fmtPts(totals[p]?.aktuell || 0)} akt · {fmtPts(totals[p]?.gesamt || 0)} ges</span></h3>
                  {gradesPresent.map(g => { const d = per[g]; const pct = d.aT ? (d.aD / d.aT) * 100 : 0; return (
                    <div key={g} className="gradeline"><span className="lab" style={{ color: GRADE_COLOR[g] }}>{g}er</span><div className="gtrack"><i style={{ width: `${pct}%`, background: GRADE_COLOR[g] }} /></div><span className="gnum">{d.aD}/{d.aT} <span style={{ opacity: .55 }}>({d.lD}/{d.lT})</span></span></div>
                  ); })}
                </div>
              );
            })}
          </div></div>
        )}
        </>
      )}

      {/* STATISTIK */}
      {tab === "hall" && (
        <div className="scroll"><div className="stats">

          {/* Umschalter: Halle / Route Creator (nur Admin) */}
          <div className="segwrap" style={{ marginBottom: 4 }}>
            <div className="seg" style={{ flexWrap:"wrap" }}>
              <button className={hallTab === "meine" ? "on" : ""} onClick={() => setHallTab("meine")}>{LANG==="en"?"My Stats":"Meine Stats"}</button>
              <button className={hallTab === "halle" ? "on" : ""} onClick={() => setHallTab("halle")}>{t("hall.activity")}</button>
              {myGroupsList.map(g => <button key={g.id} className={hallTab === "grp:"+g.id ? "on" : ""} onClick={() => setHallTab("grp:"+g.id)}>{g.emoji||"👥"} {g.name}</button>)}
              {isAdmin && <button className={hallTab === "creator" ? "on" : ""} onClick={() => setHallTab("creator")}>{t("hall.creator")}</button>}
            </div>
          </div>

          {/* ── Hallenaktivität (alle sehen das) ── */}
          {hallTab === "halle" && (<>

            {/* Kennzahlen */}
            <div className="stcard" style={{ padding: "12px" }}>
              <div className="hkpi-grid">
                <div className="hkpi"><div className="hkv">{hallStats.activeRoutes.length}</div><div className="hku">{t("hall.routes")}</div></div>
                <div className="hkpi"><div className="hkv">{hallStats.totalSends}</div><div className="hku">{t("hall.sends")}</div></div>
                <div className="hkpi"><div className="hkv">{hallStats.totalFlashes}</div><div className="hku">{t("hall.flashes")}</div></div>
                <div className="hkpi"><div className="hkv">{accounts.filter(a => !a.staff && a.role !== "superadmin").length}</div><div className="hku">{t("acc.members")}</div></div>
              </div>
            </div>

            {/* Wände */}
            <div className="stcard">
              <h3><span>{t("hall.walls")}</span></h3>
              {hallStats.wallStats.map(w => (
                <div key={w.code} className="hwall-row">
                  <span className="hwn"><WallIcon code={w.code} size={16} /> {w.name}</span>
                  <span className="hwr">{w.routeCount} {t("hall.routeCount")}</span>
                  <span className="hws"><svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{display:"inline-block",verticalAlign:"middle",marginRight:2}}><polyline points="1.5,5.5 4,8 8.5,2"/></svg>{w.sendCount}</span>
                  <span className="hwf"><svg width="8" height="9" viewBox="0 0 10 12" fill="currentColor" style={{display:"inline-block",verticalAlign:"middle",marginRight:2}}><path d="M7 1L1 7h4l-2 4 6-6H5z"/></svg>{w.flashCount}</span>
                  <div className="hwbar"><i style={{ width: `${Math.min(100, (w.sendCount / Math.max(1, hallStats.totalSends)) * 100 * 3)}%` }} /></div>
                </div>
              ))}
            </div>

            {/* Beliebteste Routen */}
            <div className="stcard">
              <h3><span>{t("hall.popular")}</span></h3>
              {hallStats.popularRoutes.map((r, i) => (
                <div key={r.id} className="hpop-row" onClick={() => { setTab("routes"); setTimeout(() => jumpToRoute(r.id), 80); }} style={{ cursor: "pointer" }}>
                  <span className="hrank">{medal(i) || (i + 1)}</span>
                  <div className="gcol" style={colorOf(r.name) ? { "--gcol-color": colorOf(r.name), background: colorOf(r.name) === "#181C22" ? "rgba(255,255,255,0.35)" : "transparent" } : { "--gcol-color": "#b8ff00" }}>
                    <span className="ggrade">{r.grade}</span>
                  </div>
                  <div className="hrname">
                    <div className="t1">{routeTitle(r)}</div>
                    <div className="t2">{colorWord(r.name) || ""}{colorWord(r.name) ? " · " : ""}{wallName(r.gym)} · 🛠 {fmtDate(r.date)}</div>
                  </div>
                  <div className="hrstat">
                    <span className={"rschip top" + ((r.sendCount - Object.values(r.results || {}).filter(s => s === "flash").length) > 0 ? " has" : "")}><svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{display:"inline-block",verticalAlign:"middle",marginRight:2,marginTop:-1}}><polyline points="1.5,5.5 4,8 8.5,2"/></svg>{r.sendCount - Object.values(r.results || {}).filter(s => s === "flash").length}</span>
                    <span className={"rschip flash" + (Object.values(r.results || {}).filter(s => s === "flash").length > 0 ? " has" : "")}><svg width="8" height="9" viewBox="0 0 10 12" fill="currentColor" style={{display:"inline-block",verticalAlign:"middle",marginRight:2,marginTop:-1}}><path d="M7 1L1 7h4l-2 4 6-6H5z"/></svg>{Object.values(r.results || {}).filter(s => s === "flash").length}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Aktivste Kletterer */}
            <div className="stcard">
              <h3><span>{t("hall.climbers")}</span></h3>
              {hallStats.activeClimbers.map(([name, count], i) => {
                const acc = accounts.find(a => a.name === name);
                return (
                  <div key={name} className="hcl-row">
                    <span className="hrank">{medal(i) || (i + 1)}</span>
                    <Avatar name={name} emoji={acc?.emoji} size={28} />
                    <span className="hcln">{name}</span>
                    <span className="hclv">{count} {t("hall.sends")}</span>
                  </div>
                );
              })}
            </div>
          </>)}


          {/* ── Gruppen-Stats ── */}
          {hallTab.startsWith("grp:") && (() => {
            const gId = hallTab.slice(4);
            const grp = groups.find(g => g.id === gId);
            if (!grp) return <div className="note">{LANG==="en"?"Group not found.":"Gruppe nicht gefunden."}</div>;
            const members = (grp.members || []).map(id => accounts.find(a => a.id === id)).filter(Boolean);

            const memberStats = members.map(m => {
              const mRoutes = routes.filter(r => r.results?.[m.name]);
              const mFlashes = mRoutes.filter(r => r.results[m.name] === "flash").length;
              const mPts = mRoutes.reduce((sum,r) => sum + pointsFor(r.grade, r.results[m.name]), 0);
              const mMeters = mRoutes.length * WALL_HEIGHT;
              return { acc: m, tops: mRoutes.length, flashes: mFlashes, pts: mPts, meters: mMeters };
            }).sort((a,b) => b.pts - a.pts);

            const isMe = a => a.id === me.id;
            const maxTops = Math.max(1, ...memberStats.map(x => x.tops));

            return (<div className="scroll"><div className="stats">
              {/* Header */}
              <div className="stcard">
                <h3><span>{grp.emoji||"👥"} {grp.name}</span><span className="r">{members.length} {LANG==="en"?"members":"Mitglieder"}</span></h3>
                {(grp.createdBy === me.id || isAdmin) && (
                  <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:"var(--panel2)",borderRadius:10,border:"1px solid var(--line)",marginBottom:10,marginTop:8}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:600,color:"var(--chalk)"}}>{LANG==="en"?"Private group":"Private Gruppe"}</div>
                      <div style={{fontSize:11,color:"var(--muted)",marginTop:2}}>{LANG==="en"?"Hidden from community ranking":"Nicht im Community-Ranking sichtbar"}</div>
                    </div>
                    <button type="button" onClick={()=>setGroupPrivate(gId, !grp.private)} style={{width:44,height:24,borderRadius:12,background:grp.private?"#b8ff00":"var(--line)",border:"none",cursor:"pointer",position:"relative",transition:"background .2s",flexShrink:0}}>
                      <span style={{position:"absolute",top:3,left:grp.private?22:3,width:18,height:18,borderRadius:9,background:grp.private?"#13141a":"var(--chalk)",transition:"left .2s",display:"block"}}/>
                    </button>
                  </div>
                )}
                <div className="hkpi-grid" style={{gridTemplateColumns:"repeat(2,1fr)",marginTop:8}}>
                  <div className="hkpi"><div className="hkv">{memberStats.reduce((s,m)=>s+m.tops,0)}</div><div className="hku">{LANG==="en"?"Total tops":"Tops gesamt"}</div></div>
                  <div className="hkpi"><div className="hkv">{memberStats.reduce((s,m)=>s+m.flashes,0)}</div><div className="hku">Flashes gesamt</div></div>
                  <div className="hkpi"><div className="hkv">{fmtPts(memberStats.reduce((s,m)=>s+m.pts,0))}</div><div className="hku">{LANG==="en"?"Total points":"Punkte gesamt"}</div></div>
                  <div className="hkpi"><div className="hkv">{Math.round(memberStats.reduce((s,m)=>s+m.meters,0))} m</div><div className="hku">{LANG==="en"?"Total meters":"Höhenmeter gesamt"}</div></div>
                </div>
              </div>

              {/* Ranking */}
              <div className="stcard">
                <h3><span>{LANG==="en"?"Ranking":"Ranking"}</span></h3>
                {memberStats.map((ms, i) => (
                  <div key={ms.acc.id} className={"lbrow" + (isMe(ms.acc) ? " lead" : "")} style={{marginBottom:6}}>
                    <span className="lbn">{i===0?"🥇":i===1?"🥈":i===2?"🥉":i+1}</span>
                    <Avatar name={ms.acc.name} emoji={ms.acc.emoji} size={32} />
                    <div style={{flex:1,minWidth:0}}>
                      <div className="lbname" style={{color:isMe(ms.acc)?"#b8ff00":"inherit"}}>{ms.acc.name}</div>
                      <div style={{fontSize:11,color:"var(--muted)"}}>{ms.tops} Tops · {ms.flashes} Flashes · {Math.round(ms.meters)}m</div>
                    </div>
                    <span className="lbscore">{fmtPts(ms.pts)}</span>
                  </div>
                ))}
              </div>

              {/* Vergleichsbalken mit Metrik-Toggle */}
              {(() => {
                const metrics = [
                  { key:"pts", label:LANG==="en"?"Points":"Punkte", val: ms => ms.pts, fmt: v => fmtPts(v) },
                  { key:"tops", label:"Tops", val: ms => ms.tops, fmt: v => v },
                  { key:"flashes", label:"Flashes", val: ms => ms.flashes, fmt: v => v },
                  { key:"meters", label: LANG==="en"?"Meters":"Meter", val: ms => Math.round(ms.meters), fmt: v => v+"m" },
                ];
                const curMetric = metrics.find(m => m.key === cmpMetric) || metrics[0];
                const sorted = [...memberStats].sort((a,b) => curMetric.val(b) - curMetric.val(a));
                const maxVal = Math.max(1, ...sorted.map(ms => curMetric.val(ms)));
                return (
                  <div className="stcard">
                    <h3><span>{LANG==="en"?"Comparison":"Vergleich"}</span></h3>
                    <div className="seg" style={{marginBottom:14}}>
                      {metrics.map(m => <button key={m.key} className={cmpMetric===m.key?"on":""} onClick={()=>setCmpMetric(m.key)}>{m.label}</button>)}
                    </div>
                    {sorted.map(ms => {
                      const v = curMetric.val(ms);
                      const pct = Math.round((v / maxVal) * 100);
                      return (
                        <div key={ms.acc.id} style={{marginBottom:14}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:12,marginBottom:5}}>
                            <div style={{display:"flex",alignItems:"center",gap:6}}>
                              <Avatar name={ms.acc.name} emoji={ms.acc.emoji} size={20} />
                              <span style={{color:isMe(ms.acc)?"#b8ff00":"var(--chalk)",fontWeight:isMe(ms.acc)?700:400}}>{ms.acc.name}</span>
                            </div>
                            <span style={{color:isMe(ms.acc)?"#b8ff00":"var(--muted)",fontWeight:isMe(ms.acc)?700:400}}>{curMetric.fmt(v)}</span>
                          </div>
                          <div style={{height:8,background:"var(--panel2)",borderRadius:4,overflow:"hidden"}}>
                            <div style={{height:"100%",width:`${pct}%`,background:isMe(ms.acc)?"#b8ff00":"rgba(255,255,255,0.2)",borderRadius:4,transition:"width .5s"}}/>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Meine Aktivität */}
              <div className="stcard">
                <h3><span>{LANG==="en"?"My activity":"Meine Aktivität"}</span></h3>
                <ActivityChart
                  results={(() => {
                    const r = [];
                    routes.forEach(rt => {
                      const st = rt.results?.[me.name];
                      if (st) r.push({ date: rt.date, status: st, grade: rt.grade });
                    });
                    return r;
                  })()}
                />
              </div>
            </div></div>);
          })()}

          {/* ── Route Creator Auswertung (nur Admin) ── */}
          {hallTab === "creator" && isAdmin && (<>
            <div className="note" style={{ marginBottom: 8 }}>{t("hall.creatorHint")}</div>

            {/* Gesamt-KPIs für Admin */}
            <div className="hkpi-grid">
              <div className="hkpi"><div className="hkv">{hallStats.creators.length}</div><div className="hku">Route Creator</div></div>
              <div className="hkpi"><div className="hkv">{hallStats.totalComments}</div><div className="hku">Kommentare</div></div>
              <div className="hkpi"><div className="hkv">{hallStats.sessionList.length}</div><div className="hku">Schraubsessions</div></div>
              <div className="hkpi"><div className="hkv">{hallStats.popularRoutes[0]?.sendCount || 0}</div><div className="hku">Max. Begehungen</div></div>
            </div>

            {/* Meistkommentierte Routen */}
            {hallStats.mostCommented.length > 0 && (
              <div className="stcard" style={{ marginBottom: 10 }}>
                <h3><span>💬 Meistkommentierte Routen</span></h3>
                {hallStats.mostCommented.map((r, i) => (
                  <div key={r.id} className="hpop-row">
                    <span className="hrank">{i + 1}</span>
                    {colorOf(r.name) && <span className="hrswatch" style={{ borderColor: colorOf(r.name), background: colorOf(r.name) === "#181C22" ? "rgba(255,255,255,.15)" : colorOf(r.name) + "22" }} />}
                    <div className="hrname">
                      <div className="t1">{routeTitle(r)}</div>
                      <div className="t2">{r.grade}er · {wallName(r.gym)}</div>
                    </div>
                    <span className="rschip top">💬 {(r.tips || []).length}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Schraubsessions */}
            {hallStats.sessionList.map((sess, i) => {
              const popularity = sess.sends > 0 ? Math.round((sess.sends / Math.max(1, sess.routes.length)) * 10) / 10 : 0;
              return (
                <div key={i} className="stcard" style={{ marginBottom: 10 }}>
                  <h3>
                    <span>🛠 {fmtDate(sess.date)} · {wallName(sess.wall)}</span>
                    <span className="r">{sess.routes.length} {t("hall.routeCount")}</span>
                  </h3>
                  <div className="sess-kpi">
                    <div className="skpi"><span className="skv">{sess.sends}</span><span className="sku">{t("hall.sendCount")}</span></div>
                    <div className="skpi"><span className="skv"><svg width="8" height="9" viewBox="0 0 10 12" fill="currentColor" style={{display:"inline-block",verticalAlign:"middle",marginRight:2}}><path d="M7 1L1 7h4l-2 4 6-6H5z"/></svg>{sess.flashes}</span><span className="sku">{t("hall.flashCount")}</span></div>
                    <div className="skpi"><span className="skv">★ {popularity}</span><span className="sku">{t("hall.popularity")}</span></div>
                  </div>
                  <div className="sess-routes">
                    {sess.routes.sort((a, b) => {
                      const as = Object.values(a.results || {}).filter(Boolean).length;
                      const bs = Object.values(b.results || {}).filter(Boolean).length;
                      return bs - as;
                    }).map(r => {
                      const sends = Object.values(r.results || {}).filter(Boolean).length;
                      const flashes = Object.values(r.results || {}).filter(s => s === "flash").length;
                      const comments = (r.tips || []).length;
                      return (
                        <div key={r.id} className="sroute-row">
                          {colorOf(r.name) && <span className="hrswatch sm" style={{ borderColor: colorOf(r.name), background: colorOf(r.name) === "#181C22" ? "rgba(255,255,255,.15)" : colorOf(r.name) + "22" }} />}
                          <span className="srn">{routeTitle(r)} <span className="sgrade">{r.grade}er</span></span>
                          <span className="rschip top" style={{ marginLeft: "auto" }}><svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{display:"inline-block",verticalAlign:"middle",marginRight:2,marginTop:-1}}><polyline points="1.5,5.5 4,8 8.5,2"/></svg>{sends - flashes}</span>
                          <span className="rschip flash"><svg width="8" height="9" viewBox="0 0 10 12" fill="currentColor" style={{display:"inline-block",verticalAlign:"middle",marginRight:2,marginTop:-1}}><path d="M7 1L1 7h4l-2 4 6-6H5z"/></svg>{flashes}</span>
                          {comments > 0 && <span style={{ fontSize: 11, color: "var(--muted)" }}>💬{comments}</span>}
                          {r.archived && <span className="archtag">Archiv</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </>)}

          {/* ── Meine Stats ── */}
          {hallTab === "meine" && (() => {
            const myRoutes = routes.filter(r => r.results?.[me.name]);
            const myFlashes = myRoutes.filter(r => r.results[me.name] === "flash").length;
            const myTops = myRoutes.length - myFlashes;
            const myPts = myRoutes.reduce((s,r) => s + pointsFor(r.grade, r.results[r.id] || r.results[me.name]), 0);
            const myMeters = myRoutes.length * WALL_HEIGHT;
            // Daily / weekly / monthly / yearly
            const now = new Date(today);
            const weekAgo = new Date(now - 7*86400000).toISOString().slice(0,10);
            const monthAgo = new Date(now - 30*86400000).toISOString().slice(0,10);
            const yearAgo = new Date(now - 365*86400000).toISOString().slice(0,10);
            // Echtes Begehungsdatum nutzen; für Alt-Begehungen ohne Datum Fallback auf Schraub-Datum
            const ascentDate = r => (r.resultDates && r.resultDates[me.name]) || r.date;
            const rByDate = (from) => routes.filter(r => r.results?.[me.name] && ascentDate(r) >= from);
            const todayR = routes.filter(r => r.results?.[me.name] && ascentDate(r) === today);
            const weekR = rByDate(weekAgo); const monthR = rByDate(monthAgo); const yearR = rByDate(yearAgo);
            // Mountain comparison
            const MOUNTAINS = [
              {name:"Feldberg (DE)",m:1493},{name:"Zugspitze (DE)",m:2962},{name:"Großglockner (AT)",m:3798},
              {name:"Matterhorn",m:4478},{name:"Mont Blanc",m:4806},{name:"Elbrus",m:5642},
              {name:"Kilimanjaro",m:5895},{name:"Denali",m:6190},{name:"Aconcagua",m:6961},
              {name:"Mount Everest",m:8849},
            ];
            const climbed = MOUNTAINS.filter(mn => myMeters >= mn.m);
            const nextMtn = MOUNTAINS.find(mn => myMeters < mn.m);
            return (<>
              {/* Gesamt KPIs */}
              <div className="stcard" style={{ padding:12 }}>
                <div className="hkpi-grid" style={{ gridTemplateColumns:"repeat(2,1fr)" }}>
                  <div className="hkpi"><div className="hkv">{myRoutes.length}</div><div className="hku">{LANG==="en"?"Sends":"Begehungen"}</div></div>
                  <div className="hkpi"><div className="hkv">{myFlashes}</div><div className="hku">Flashes ⚡</div></div>
                  <div className="hkpi"><div className="hkv">{Math.round(myMeters)} m</div><div className="hku">{LANG==="en"?"Elevation 🏔":"Höhenmeter 🏔"}</div></div>
                  <div className="hkpi"><div className="hkv">{fmtPts(myPts)}</div><div className="hku">{LANG==="en"?"Points":"Punkte"}</div></div>
                </div>
              </div>

              {/* Zeitraum */}
              <div className="stcard">
                <h3><span>📅 Aktivität</span></h3>
                {[
                  ["Heute",todayR],["Diese Woche",weekR],["Diesen Monat",monthR],["Dieses Jahr",yearR]
                ].map(([label, rs]) => (
                  <div key={label} className="hwall-row">
                    <span className="hwn">{label}</span>
                    <span className="hws">{rs.length} Begehungen</span>
                    <span className="hwf"><svg width="8" height="9" viewBox="0 0 10 12" fill="currentColor" style={{display:"inline-block",verticalAlign:"middle",marginRight:2}}><path d="M7 1L1 7h4l-2 4 6-6H5z"/></svg>{rs.filter(r=>r.results[me.name]==="flash").length}</span>
                    <span style={{fontSize:12,color:"var(--muted)"}}>{Math.round(rs.length*WALL_HEIGHT)} m</span>
                  </div>
                ))}
              </div>

              {/* Höhenmeter / Berge */}
              <div className="stcard">
                <h3><span>{LANG==="en"?"Peaks Climbed":"Erklommene Berge"}</span></h3>
                <div className="phint" style={{marginBottom:10}}>{LANG==="en"?`Each route = ${WALL_HEIGHT}m · Total: ${Math.round(myMeters)}m`:`Jede Route = ${WALL_HEIGHT} Höhenmeter · Gesamt: ${Math.round(myMeters)} m`}</div>
                {MOUNTAINS.map(mn => {
                  const done = myMeters >= mn.m;
                  const pct = Math.min(100, (myMeters/mn.m)*100);
                  return (
                    <div key={mn.name} className="hwall-row" style={{opacity: done ? 1 : 0.6}}>
                      <span className="hwn">{done ? <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="#b8ff00" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{display:"inline-block",verticalAlign:"middle",marginRight:4}}><polyline points="1.5,6.5 4.5,9.5 10.5,2.5"/></svg> : <svg width="11" height="13" viewBox="0 0 12 14" fill="none" stroke="#b8ff00" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{display:"inline-block",verticalAlign:"middle",marginRight:4}}><rect x="2" y="6" width="8" height="7" rx="1.5"/><path d="M4 6V4a2 2 0 0 1 4 0v2"/></svg>}{mn.name}</span>
                      <span className="hws" style={{color:done?"var(--amber)":"var(--muted)"}}>{mn.m} m</span>
                      {!done && <div style={{flex:1,height:4,background:"var(--panel2)",borderRadius:2,overflow:"hidden",marginLeft:8}}>
                        <div style={{height:"100%",width:`${pct}%`,background:"var(--amber)",borderRadius:2}}/>
                      </div>}
                    </div>
                  );
                })}
                {nextMtn && <div className="note" style={{marginTop:10}}>{LANG==="en"?<>{Math.ceil(nextMtn.m - myMeters)}m to go until <b>{nextMtn.name}</b> ({nextMtn.m}m)</>:<>Noch {Math.ceil(nextMtn.m - myMeters)} m bis zum <b>{nextMtn.name}</b> ({nextMtn.m} m)</>}</div>}
                {!nextMtn && <div className="note" style={{marginTop:10,color:"var(--amber)"}}>🏆 {LANG==="en"?"You've climbed them all — even Mount Everest!":"Du hast alle Berge erklommen — sogar den Mount Everest!"}</div>}
              </div>
            </>);
          })()}



        </div></div>
      )}

      {/* ACCOUNT */}
      {tab === "account" && (
        <div className="scroll"><div className="stats">
          <div className="stcard meCard">
            <h3><span>{me.name}</span><span className="r">{roleLabel(me.role)}</span></h3>
            <div className="note" style={{ marginBottom: 0 }}>{canSetRoutes ? t("acc.canSet") : t("acc.cannotSet")}</div>
            <button className="privtoggle" style={{ marginTop: 10 }} onClick={() => setPrivate(!me.private)}>
              <span className={"switch" + (me.private ? " on" : "")}><span className="knob" /></span>
              <span className="privtext"><b>{me.private ? t("acc.privOn") : t("acc.privOff")}</b><span>{t("acc.privDesc")}</span></span>
            </button>
            <div className="emojirow">
              <span className="langlbl">{t("acc.emoji")}</span>
              <div className="emojirowr">
                <Avatar name={me.name} emoji={me.emoji} size={34} />
                <button className="miniaction" style={{ marginTop: 0 }} onClick={() => setEmojiOpen(true)}><span className="mi-ic">😀</span>{t("acc.pickEmoji")}</button>
                {me.emoji ? <button className="miniaction" style={{ marginTop: 0 }} onClick={() => setMyEmoji("")}><span className="mi-ic">✕</span>{t("acc.none")}</button> : null}
              </div>
            </div>
            {me.role === "community" && (
              me.roleRequest === "schrauber"
                ? <div className="reqnote">{t("acc.reqPending")} <span>{t("acc.reqInfo")}</span></div>
                : canRequestCreator
                  ? <button className="miniaction primary" style={{ marginTop: 10 }} onClick={() => setConfirmCreator(true)}><span className="mi-ic">🛠</span>{t("acc.reqCreator")}</button>
                  : <><button className="miniaction locked" style={{ marginTop: 10 }} title={t("lock.creator", { n: achScore })} onClick={() => { }}><span className="mi-ic">🔒</span>{t("acc.reqCreator")}</button><div className="lockhint">{t("lock.creator", { n: achScore })}</div></>
            )}
            {archivedSet.has(me.name) && (
              me.reactivateRequest
                ? <div className="reqnote">{t("acc.reqPending")}</div>
                : <div className="reqnote warn">{t("acc.archivedSelf")} <button className="miniaction" style={{ marginTop: 8 }} onClick={requestReactivate}><span className="mi-ic">♻️</span>{t("acc.reqReactivate")}</button></div>
            )}
            <div className="langrow">
              <span className="langlbl">{t("acc.language")}</span>
              <div className="langseg">
                <button className={lang === "de" ? "on" : ""} onClick={() => changeLang("de")}>Deutsch</button>
                <button className={lang === "en" ? "on" : ""} onClick={() => changeLang("en")}>English</button>
              </div>
            </div>
            <div className="rowbtns" style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button className="miniaction" style={{ marginTop: 0 }} onClick={() => setChangePinOpen(true)}><span className="mi-ic">🔑</span>{t("acc.changePw")}</button>
              <button className="miniaction danger" style={{ marginTop: 0 }} onClick={logout}><span className="mi-ic">🚪</span>{t("acc.logout")}</button>
            </div>
            {!isAdmin && <button className="miniaction" style={{ marginTop: 8, color: "#e98b7d", borderColor: "rgba(233,139,125,.3)", background: "rgba(233,139,125,.08)" }} onClick={deleteMyAccount}><span className="mi-ic">🗑</span>Konto löschen</button>}
          </div>
          <div className="stcard">
            <h3><span>{t("acc.points")}</span>{isAdmin && <button className="miniaction" style={{ marginTop:0, marginLeft:"auto", width:"auto", padding:"4px 10px", fontSize:12 }} onClick={() => setScoringOpen(true)}>✎ Bearbeiten</button>}</h3>
            <div className="ptbl">
              <span className="ph">Grad</span><span className="ph">Top</span><span className="ph">Flash</span>
              {GRADES.map(g => [
                <span key={g+"n"} className="pg" style={{ color: GRADE_COLOR[g] }}>{g}er</span>,
                <span key={g+"t"} className="pv">{fmtPts(topPts(g))}</span>,
                <span key={g+"f"} className="pv">{fmtPts(topPts(g) + FLASH_BONUS)}</span>
              ])}
            </div>
          </div>

          {/* Admin-Einstellungen */}
          {isAdmin && (<>
            <div className="stcard">
              <h3><span>⚙️ Hallenkonfiguration</span></h3>
              <div className="field" style={{ margin: 0 }}>
                <label>Wandhöhe (Meter pro Route)</label>
                <input type="number" step="0.1" min="1" max="15" defaultValue={WALL_HEIGHT}
                  onBlur={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v > 0) setWallHeight(v); }}
                  style={{ background: "var(--panel2)", border: "1px solid rgba(255,255,255,.2)", borderRadius: 10, padding: "9px 12px", color: "var(--chalk)", fontSize: 15, width: "100%" }} />
                <div className="phint">Standard: 3.5 m · Wird für Höhenmeter-Berechnung genutzt</div>
              </div>
            </div>
            <div className="stcard">
              <h3><span>💾 Data Management</span></h3>
              <div className="hkpi-grid" style={{ gridTemplateColumns: "repeat(2,1fr)", marginBottom: 12 }}>
                <div className="hkpi"><div className="hkv">{hallStats.communityKB} KB</div><div className="hku">Daten (ohne Fotos)</div></div>
                <div className="hkpi"><div className="hkv">{photoStorageKB === null ? "—" : photoStorageKB === "…" ? "⏳" : `${photoStorageKB >= 1024 ? (photoStorageKB / 1024).toFixed(1) + " MB" : photoStorageKB + " KB"}`}</div><div className="hku">Fotos gesamt</div></div>
                <div className="hkpi"><div className="hkv">{routes.filter(r => r.photos?.length).length}</div><div className="hku">Routen mit Foto</div></div>
                <div className="hkpi"><div className="hkv">{hallStats.archivedWithPhoto.length}</div><div className="hku">Archiv mit Foto</div></div>
              </div>
              <button className="miniaction" onClick={measurePhotoStorage}>📏 Fotos messen</button>
              {hallStats.archivedWithPhoto.length > 0 && <div className="note" style={{ marginTop: 10, color: "var(--amber)" }}>⚠️ {hallStats.archivedWithPhoto.length} archivierte Routen haben noch Fotos — beim Löschen wird Speicher freigegeben.</div>}
              <div className="phint" style={{ marginTop: 8 }}>Fotos werden auf max. 1080px / ~70 KB komprimiert. Supabase Free: 1 GB.</div>
            </div>
          </>)}
          <div className="stcard">
            <h3><span>{isAdmin ? t("acc.users") : t("acc.members")}</span><span className="r">{isAdmin ? accounts.filter(a => a.role !== "superadmin").length : accounts.filter(a => a.role !== "admin" && a.role !== "superadmin").length}</span></h3>
            {(() => {
              const list = isAdmin ? accounts.filter(a => a.role !== "superadmin") : accounts.filter(a => a.role !== "admin" && a.role !== "superadmin");
              if (list.length === 0) return <div className="phint" style={{ padding: "12px 0", textAlign: "center" }}>Noch keine Mitglieder registriert. Sobald sich jemand über den Login mit „Registrieren" anmeldet, taucht er hier auf.</div>;
              return list.map(a => { const arch = isArchivedAcc(a, routes, today); return (
              <div className="prow" key={a.id}>
                <div className="pinfo"><Avatar name={a.name} emoji={a.emoji} size={34} /><div style={{ minWidth: 0 }}><div className="pn">{a.name}{a.id === me.id ? " · Du" : ""}{a.private ? " · 🔒" : ""}</div><div className="prole">{arch ? <span className="archbadge">{t("acc.archived")}</span> : roleLabel(a.role)}{a.roleRequest === "schrauber" && !arch ? <span className="reqbadge">🔔 {t("acc.wantsCreator")}</span> : null}{a.reactivateRequest ? <span className="reqbadge">🔔 {t("acc.reqReactivate")}</span> : null}</div></div></div>
                {isAdmin && a.id !== me.id && (
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    {arch && <button className="miniaction" style={{ marginTop: 0 }} onClick={() => reactivateAccount(a.id)}>{t("acc.reactivate")}</button>}
                    <select className="roledd" value={a.role || "community"} onChange={e => setAccRole(a.id, e.target.value)}>
                      <option value="community">Climber</option>
                      <option value="schrauber">Route Creator</option>
                      <option value="admin">Admin</option>
                      {isSuperAdmin && <option value="superadmin">Super Admin</option>}
                    </select>
                    <button className="removex danger" onClick={() => { if (confirm(`${a.name} entfernen? Eingetragene Ergebnisse bleiben erhalten.`)) removeAccount(a.id); }}>✕</button>
                  </div>
                )}
              </div>
            ); });
            })()}
            {isAdmin && <div className="phint" style={{ marginTop: 4 }}>Route Creator & Admins dürfen Routen anlegen und bearbeiten. Climber tragen nur eigene Ergebnisse ein und bilden Gruppen. Konten ohne Aktivität über 1 Jahr werden automatisch archiviert.</div>}
          </div>
          {isSuperAdmin && (
            <>
              <div className="stcard"><h3><span>🔄 Sendly-Sync</span></h3>
                <div className="note">Importiere Routen von <b>sendly.diezunddaz.xyz</b>. Matching erfolgt über Farbe + Sektor + Schwierigkeit. Bei Match wird das Bild übernommen, bei neuen Routen werden sie angelegt — alte werden archiviert.</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                  <label className="miniaction" style={{ marginTop: 0, cursor: "pointer" }}>
                    <input type="file" accept="application/json" style={{ display: "none" }} onChange={(e) => handleSendlySync(e.target.files?.[0], false)} />
                    📥 Sync-Import (additiv & matchend)
                  </label>
                  <label className="miniaction danger" style={{ marginTop: 0, cursor: "pointer" }}>
                    <input type="file" accept="application/json" style={{ display: "none" }} onChange={(e) => handleSendlySync(e.target.files?.[0], true)} />
                    🆕 Initial-Reset + Komplett-Import
                  </label>
                </div>
                {syncLog.length > 0 && (
                  <div className="synclog">
                    <div className="synclog-ttl">Sync-Protokoll:</div>
                    {syncLog.map((line, i) => <div key={i} className={"synclog-line " + (line.kind || "")}>{line.text}</div>)}
                  </div>
                )}
              </div>
              <div className="stcard"><h3><span>⚠️ Hard Reset</span></h3>
                <div className="note">Vorsicht: setzt das Board auf die importierten Original-Daten zurück.</div>
                <button className="miniaction danger" onClick={() => { const pw = prompt("Sicherheitspasswort eingeben:"); if (pw === "1234567890") { if (confirm("Board wirklich zurücksetzen? Alle Daten gehen verloren.")) setCommunity(SEED_COMMUNITY); } else if (pw !== null) alert("Falsches Passwort."); }}>Board zurücksetzen</button>
              </div>
            </>
          )}
        </div></div>
      )}

      {/* GRUPPEN */}
      {tab === "gruppen" && (
        <div className="scroll"><div className="stats">
          <div className="note">{t("groups.intro")}</div>

          {myGroup ? (() => { const g = groupStats.find(x => x.id === myGroup.id); const reqN = (myGroup.createdBy === me.id) ? (myGroup.requests || []).length : 0; return (
            <>
              <h3 style={{ margin: "4px 2px 10px", fontSize: 15, fontWeight: 700 }}>{t("groups.yours")}</h3>
              <button className="gcard" onClick={() => setOpenGroupId(g.id)} style={{ width: "100%", textAlign: "left" }}>
                <span className="gemoji">{g.emoji || "👥"}</span>
                <span className="ginfo"><div className="gn">{g.name}</div><div className="gm">{(g.members || []).length}/10 Mitglieder · Platz {groupsRanked.findIndex(x => x.id === g.id) + 1}{reqN ? ` · ${reqN} Anfrage(n)` : ""}</div></span>
                <span className="gp"><div className="v">{boardMode === "erfolge" ? Math.round(g[boardMode] || 0) : fmtPts(g[boardMode] || 0)}</div><div className="u">{boardMode === "aktuell" ? "akt." : boardMode === "erfolge" ? "Erf." : "ges."}</div></span>
              </button>
              <div className="note" style={{ marginTop: 4 }}>{t("groups.manageHint")}</div>
            </>
          ); })() : (
            <>
              {canCreateGroup
                ? <button className="primaryaction" onClick={() => setNewGroupOpen(true)}>{t("groups.create")}</button>
                : <><button className="primaryaction locked" title={t("lock.group", { n: achScore })} onClick={() => { }}>🔒 {t("groups.create")}</button><div className="lockhint">{t("lock.group", { n: achScore })}</div></>}
              <h3 style={{ margin: "4px 2px 10px", fontSize: 15, fontWeight: 700 }}>{t("groups.discover")}</h3>
              {groupStats.length === 0 && <div className="empty" style={{ padding: "20px 10px" }}>Noch keine Gruppen.</div>}
              {groupsRanked.map(g => { const requested = (g.requests || []).includes(me.id); const full = (g.members || []).length >= MAX_MEMBERS; return (
                <div key={g.id} className="gcard">
                  <span className="gemoji">{g.emoji || "👥"}</span>
                  <span className="ginfo" onClick={() => setOpenGroupId(g.id)} style={{ cursor: "pointer" }}><div className="gn">{g.name}</div><div className="gm">{(g.members || []).length}/10 · {boardMode === "erfolge" ? Math.round(g[boardMode] || 0) + " Erf." : fmtPts(g[boardMode] || 0) + " Pkt"}</div></span>
                  {full ? <span className="nextbadge">{t("groups.full")}</span>
                    : requested ? <button className="leavebtn" style={{ padding: "8px 12px", fontSize: 12.5 }} onClick={() => cancelRequest(g.id)}>{t("groups.requested")}</button>
                      : <button className="joinbtn" onClick={() => requestJoin(g.id)}>{t("groups.request")}</button>}
                </div>
              ); })}
            </>
          )}
        </div></div>
      )}

      <nav className="tabbar">
        <button className={"tab" + (tab === "routes" ? " on" : "")} onClick={() => setTab("routes")}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17l4-8 4 4 3-6 4 10"/><circle cx="19" cy="5" r="2"/></svg>
          <span>{t("nav.routes")}</span>
        </button>
        <button className={"tab" + (tab === "stats" ? " on" : "")} onClick={() => setTab("stats")}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="5"/><path d="M9 21h6M12 13v8M7.5 16.5l-2 2M16.5 16.5l2 2"/></svg>
          <span>{t("nav.ach")}</span>
        </button>
        <button className={"tab" + (tab === "gruppen" ? " on" : "")} onClick={() => setTab("gruppen")}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="7" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M2 20c0-3.3 3.1-6 7-6s7 2.7 7 6"/><path d="M22 20c0-2.2-2-4-4.5-4"/></svg>
          <span>{t("nav.groups")}</span>
        </button>
        <button className={"tab" + (tab === "board" ? " on" : "")} onClick={() => setTab("board")}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M6 20V10M12 20V4M18 20v-6"/></svg>
          <span>{t("nav.board")}</span>
        </button>
        <button className={"tab" + (tab === "hall" ? " on" : "")} onClick={() => setTab("hall")}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 17h7M17.5 14v7"/></svg>
          <span>{t("nav.hall")}</span>
        </button>
      </nav>

      {editing && (
        <RouteSheetBoundary onClose={() => setEditing(null)}>
        <RouteSheet route={editing === "new" ? null : editing} me={me} gyms={wallsPresent.map(w => w.code)} isAdmin={isAdmin} canSetRoutes={canSetRoutes} screwDates={screwDates}
          onClose={() => setEditing(null)} onSave={(r) => { upsertRoute(r); setEditing(null); }} onDelete={(id) => { deleteRoute(id); setEditing(null); }} />
        </RouteSheetBoundary>
      )}
      {tipsRoute && (
        <TipsSheet route={tipsRoute} me={me} isAdmin={isAdmin} onClose={() => setTipsRouteId(null)} onAdd={(t) => addTip(tipsRoute.id, t)} onDelete={(id) => delTip(tipsRoute.id, id)} />
      )}
      {newGroupOpen && <NewGroupSheet onClose={() => setNewGroupOpen(false)} achScore={achScore} isAdmin={isAdmin} onCreate={(n, e, isPriv) => { createGroup(n, e, isPriv); setNewGroupOpen(false); }} />}
      {changePinOpen && <ChangePinSheet me={me} onClose={() => setChangePinOpen(false)} onSave={(p) => { setMyPin(p); setChangePinOpen(false); }} />}
      {scoringOpen && <ScoringSheet step={STEP} flash={FLASH_BONUS} onClose={() => setScoringOpen(false)} onSave={(s,f) => { setScoring(s,f); setScoringOpen(false); }} />}
      {iosInstallOpen && (
        <div className="scrim" onClick={() => setIosInstallOpen(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="grip" />
            <div className="shead"><h2>{LANG === "en" ? "Install blocscore" : "blocscore installieren"}</h2><button className="x" onClick={() => setIosInstallOpen(false)}>✕</button></div>
            <div className="sbody">
              <div className="note" style={{ marginBottom: 14 }}>{LANG === "en" ? "On iPhone/iPad, add the app to your home screen via Safari:" : "Auf iPhone/iPad fügst du die App über Safari zum Home-Bildschirm hinzu:"}</div>
              <div className="iosstep"><span className="iosnum">1</span><span>{LANG === "en" ? <>Tap the <b>Share</b> icon <span style={{whiteSpace:"nowrap"}}>( ⬆️ )</span> in the Safari toolbar.</> : <>Tippe in der Safari-Leiste auf das <b>Teilen</b>-Symbol <span style={{whiteSpace:"nowrap"}}>( ⬆️ )</span>.</>}</span></div>
              <div className="iosstep"><span className="iosnum">2</span><span>{LANG === "en" ? <>Scroll down and tap <b>“Add to Home Screen”</b>.</> : <>Scrolle nach unten und tippe auf <b>„Zum Home-Bildschirm"</b>.</>}</span></div>
              <div className="iosstep"><span className="iosnum">3</span><span>{LANG === "en" ? <>Tap <b>“Add”</b> — done!</> : <>Tippe oben rechts auf <b>„Hinzufügen"</b> — fertig!</>}</span></div>
              <button className="save" style={{ marginTop: 16 }} onClick={() => setIosInstallOpen(false)}>{LANG === "en" ? "Got it" : "Verstanden"}</button>
            </div>
          </div>
        </div>
      )}
      {lightbox && <PhotoLightbox src={lightbox} onClose={() => setLightbox(null)} />}
      {emojiOpen && <ProfileEmojiSheet me={me} achScore={achScore} isAdmin={isAdmin} onClose={() => setEmojiOpen(false)} onPick={(e) => { setMyEmoji(e); setEmojiOpen(false); }} />}
      {confirmCreator && (
        <div className="scrim" onClick={() => setConfirmCreator(false)}>
          <div className="confirm" onClick={e => e.stopPropagation()}>
            <div className="cf-ic">🛠</div>
            <h3>{t("cf.title")}</h3>
            <p>{t("cf.body")}</p>
            <div className="cf-btns">
              <button className="cf-cancel" onClick={() => setConfirmCreator(false)}>{t("cf.cancel")}</button>
              <button className="cf-yes" onClick={() => { requestRole(); setConfirmCreator(false); }}>{t("cf.yes")}</button>
            </div>
          </div>
        </div>
      )}
      {achCat && <CategorySheet cat={achCat} items={achState.evald.filter(a => a.cat === achCat)} onClose={() => setAchCat(null)} />}
      {openGroupId && (() => {
        const g = groupStats.find(x => x.id === openGroupId); if (!g) return null;
        const isMember = (g.members || []).includes(me.id);
        const isCreator = g.createdBy === me.id;
        const requested = (g.requests || []).includes(me.id);
        const full = (g.members || []).length >= MAX_MEMBERS;
        const inviteables = accounts.filter(a => !groupOf(a.id) && a.id !== me.id && a.role !== "superadmin");
        return (
          <GroupSheet group={g} me={me} accById={accById} boardMode={boardMode}
            isMember={isMember} isCreator={isCreator} requested={requested} full={full} meHasGroup={!!myGroup} inviteables={inviteables}
            onClose={() => setOpenGroupId(null)}
            onRequest={() => requestJoin(g.id)} onCancelReq={() => cancelRequest(g.id)}
            onAccept={(aid) => acceptRequest(g.id, aid)} onDecline={(aid) => declineRequest(g.id, aid)} onInvite={(aid) => inviteMember(g.id, aid)}
            onLeave={() => { leaveGroup(g.id); setOpenGroupId(null); }}
            onDelete={() => { if (confirm("Gruppe wirklich löschen?")) { deleteGroup(g.id); setOpenGroupId(null); } }} />
        );
      })()}
    </div>
  );
}

/* ============================ Kommentare ============================ */
function TipsSheet({ route, me, isAdmin, onClose, onAdd, onDelete }) {
  const [text, setText] = useState("");
  const tips = route.tips || [];
  function add() { const t = text.trim(); if (!t) return; onAdd(t); setText(""); }
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="grip" />
        <div className="shead"><h2>💬 {t("cmt.title")}{tips.length ? ` · ${tips.length}` : ""}</h2><button className="x" onClick={onClose}>✕</button></div>
        <div className="sbody">
          <div className="note" style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span className="wicon" style={{ width: 30, height: 30 }}><WallIcon code={route.gym} size={17} /></span>
            <span><b style={{ color: "var(--chalk)" }}>{routeTitle(route)}</b> · {route.grade}er · {wallName(route.gym)}</span>
          </div>
          <div className="cmprose">
            {tips.length === 0 && <div className="cmempty"><div className="big">💬</div><b>{t("cmt.empty")}</b><span>{t("cmt.emptyHint")}</span></div>}
            {tips.map(t => { const mine = t.by === me.name; return (
              <div className={"cmt" + (mine ? " mine" : "")} key={t.id}>
                <Avatar name={t.by} size={32} />
                <div className="cmtbody">
                  <div className="cmthead"><span className="cmtn">{mine ? "Du" : t.by}</span><span className="cmtt">{ago(t.ts)}</span>
                    {(isAdmin || t.by === me.name) && <button className="cmtdel" onClick={() => onDelete(t.id)}>Löschen</button>}
                  </div>
                  <div className="cmttext">{t.text}</div>
                </div>
              </div>
            ); })}
          </div>
          <div className="cmcompose">
            <Avatar name={me.name} size={30} />
            <textarea value={text} onChange={e => setText(e.target.value)} placeholder={t("cmt.ph")} onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) add(); }} />
            <button className={"cmsend" + (text.trim() ? " on" : "")} onClick={add} aria-label="Senden">➤</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================ Draufsicht (Hallenplan) ============================ */
function getFpData() {
  const en = LANG === "en";
  // Kantige Wand-Silhouetten (Polygone) – Schrift bleibt innerhalb der Konturen
  const walls = [
    { code: "wkw", pts: "6,6 22,6 17,30 22,52 17,74 22,96 18,110 6,110", orient: "v", lx: 11, ly: 58, fs: 6.0, label: en ? "COMP WALL" : "WETTKAMPFWAND" },
    { code: "h",   pts: "60,9 71,10 79,19 81,30 75,42 64,47 54,43 52,31 54,18", orient: "h", lx: 66, ly: 25.5, fs: 6.0, label: en ? ["BACK", "BLOCK"] : ["BLOCK", "HINTEN"] },
    { code: "v",   pts: "61,52 73,55 80,66 80,82 72,96 60,101 50,93 48,78 51,62", orient: "h", lx: 64, ly: 74.5, fs: 6.0, label: en ? ["FRONT", "BLOCK"] : ["BLOCK", "VORNE"] },
    { code: "pl",  pts: "90,10 96,12 97,40 98,60 95,80 92,95 89,78 88,45 89,20", orient: "v", lx: 93, ly: 52, fs: 5.6, label: en ? "SLAB" : "PLATTE" },
    { code: "tb",  pts: "102,17 117,21 117,72 110,80 102,74 100,55 100,30", orient: "v", lx: 108, ly: 46, fs: 5.0, label: en ? "TRAINING AREA" : "TRAININGSBEREICH" },
  ];
  // Trainings-Boards & Kinderbereich (gestrichelt, nicht wählbar)
  const boards = [
    { code: "kilter", x: 122, y: 30,   w: 13, h: 14, rx: 3, fs: 3.1, label: ["KILTER", "BOARD"] },
    { code: "moon",   x: 122, y: 50.5, w: 13, h: 14, rx: 3, fs: 3.1, label: ["MOON", "BOARD"] },
    { code: "kids",   x: 118, y: 84,   w: 16, h: 22, rx: 3, fs: 3.4, label: en ? ["KIDS", "AREA"] : ["KINDER-", "BEREICH"] },
  ];
  const entrance = { cx: 64, ty: 112, label: en ? "ENTRANCE" : "EINGANG" };
  return { walls, boards, entrance };
}
function FloorPlan({ value, onChange, newest }) {
  const rid = useId().replace(/[:]/g, "");
  const { walls, boards, entrance } = getFpData();
  const TEX = "/floorplan-tex.png";
  return (
    <svg className="fp" viewBox="0 0 142 116">
      <defs>
        <filter id={`g${rid}`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="1.15" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        {walls.map(w => <clipPath key={w.code} id={`c${rid}-${w.code}`}><polygon points={w.pts} /></clipPath>)}
        {boards.map(b => <clipPath key={b.code} id={`c${rid}-${b.code}`}><rect x={b.x} y={b.y} width={b.w} height={b.h} rx={b.rx} /></clipPath>)}
      </defs>

      {walls.map(w => {
        const on = value === w.code;
        const fresh = newest === w.code;
        const tcol = on ? "#0c0f14" : "#f2f4ef";
        return (
          <g key={w.code} onClick={() => onChange(w.code)} style={{ cursor: "pointer" }}>
            {on ? (
              <polygon points={w.pts} fill="#b8ff00" filter={`url(#g${rid})`} />
            ) : (<>
              <image href={TEX} x="0" y="0" width="142" height="116" preserveAspectRatio="xMidYMid slice" clipPath={`url(#c${rid}-${w.code})`} />
              <polygon points={w.pts} fill="none" stroke="#b8ff00" strokeWidth={fresh ? 1.5 : 1.05} strokeLinejoin="round" filter={`url(#g${rid})`} />
            </>)}
            {w.orient === "v" ? (
              <text x={w.lx} y={w.ly} transform={`rotate(-90 ${w.lx} ${w.ly})`} textAnchor="middle" dominantBaseline="middle" fontFamily="'Barlow Condensed'" fontWeight="700" fontSize={w.fs} letterSpacing="0.5" fill={tcol}>{w.label}</text>
            ) : (
              <text textAnchor="middle" fontFamily="'Barlow Condensed'" fontWeight="700" fontSize={w.fs} letterSpacing="0.4" fill={tcol}><tspan x={w.lx} y={w.ly}>{w.label[0]}</tspan><tspan x={w.lx} dy={w.fs + 0.6}>{w.label[1]}</tspan></text>
            )}
          </g>
        );
      })}

      {boards.map(b => {
        const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
        return (
          <g key={b.code}>
            <image href={TEX} x="0" y="0" width="142" height="116" preserveAspectRatio="xMidYMid slice" clipPath={`url(#c${rid}-${b.code})`} />
            <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={b.rx} fill="none" stroke="#b8ff00" strokeWidth="0.8" strokeDasharray="2.8 2" opacity="0.9" />
            <text textAnchor="middle" fontFamily="'Barlow Condensed'" fontWeight="700" fontSize={b.fs} fill="#e7eadf"><tspan x={cx} y={cy - 0.4}>{b.label[0]}</tspan><tspan x={cx} dy={b.fs + 0.4}>{b.label[1]}</tspan></text>
          </g>
        );
      })}

      {(() => { const e = entrance; return (
        <text x={e.cx} y={e.ty} textAnchor="middle" fontFamily="'Barlow Condensed'" fontWeight="700" fontSize="4.2" letterSpacing="1.6" fill="#b8ff00">{e.label}</text>
      ); })()}
    </svg>
  );
}

/* ============================ Achievement-Kategorie ============================ */
function CategorySheet({ cat, items, onClose }) {
  const sorted = [...items].sort((a, b) => (b.done - a.done) || (a.target - b.target));
  const shown = sorted.slice(0, 150);
  const done = items.filter(a => a.done).length;
  const headIcon = items[0]?.icon || "🏅";
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="grip" />
        <div className="shead"><h2>{headIcon} {cat}</h2><button className="x" onClick={onClose}>✕</button></div>
        <div className="sbody">
          <div className="note" style={{ marginBottom: 12 }}>{done} / {items.length} {t("ach.unlocked")}</div>
          {shown.map(a => (
            <div key={a.id} className={"achrow" + (a.done ? " done" : "")}>
              <span className="achic">{a.done ? "🏅" : a.icon}</span>
              <div className="achinfo"><div className="achn">{a.name}{a.done && <span className="achchk">✓</span>}</div><div className="achd">{a.desc}</div>{!a.done && <div className="achbar"><i style={{ width: `${a.ratio * 100}%` }} /></div>}</div>
              <div className="achprog">{Math.min(a.cur, a.target)}/{a.target}<div className="achpts">+{a.pts}</div></div>
            </div>
          ))}
          {items.length > 150 && <div className="note" style={{ textAlign: "center", marginTop: 10 }}>… +{items.length - 150}</div>}
        </div>
      </div>
    </div>
  );
}

/* ============================ Konto: Passwort ändern ============================ */
function ProfileEmojiSheet({ me, achScore, isAdmin, onClose, onPick }) {
  const unlocked = getUnlockedEmojis(achScore, isAdmin);
  const next = getNextEmojiUnlock(achScore);
  const locked = [...EMOJI_WAVE1,...EMOJI_WAVE2,...EMOJI_WAVE3,...EMOJI_WAVE4,...EMOJI_WAVE5,...EMOJI_WAVE6]
    .filter(e => !unlocked.includes(e));
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="grip" />
        <div className="shead"><h2>{t("acc.pickEmoji")}</h2><button className="x" onClick={onClose}>✕</button></div>
        <div className="sbody">
          <div className="emoji-info-card">
            <div className="emoji-info-stats">
              <div><span className="emoji-info-num">{unlocked.length}</span> <span className="emoji-info-lbl">/ {next ? next.total : unlocked.length} {LANG==="en"?"unlocked":"freigeschaltet"}</span></div>
            </div>
            {next && (
              <div className="emoji-info-next">
                {LANG==="en"?<>Next <b>{next.count}</b> at <b>{next.at} Skillpoints</b> · you have {Math.round(achScore)} · {Math.max(0, next.at - Math.round(achScore))} to go</>:<>Nächste <b>{next.count}</b> bei <b>{next.at} Skillpoints</b> · du hast {Math.round(achScore)} · noch {Math.max(0, next.at - Math.round(achScore))} fehlen</>}
              </div>
            )}
            {!next && <div className="emoji-info-next" style={{ color: "#b8ff00" }}>{LANG==="en"?"🏆 All emojis unlocked!":"🏆 Alle Emojis freigeschaltet!"}</div>}
          </div>
          <div className="emojipick big">
            {unlocked.map((e, i) => (
              <button key={i} className={"epick" + (me.emoji === e ? " on" : "")} onClick={() => onPick(e)}>{e}</button>
            ))}
          </div>
          {locked.length > 0 && (<>
            <div className="emojisep">🔒 Noch gesperrt ({locked.length})</div>
            <div className="emojipick big locked">
              {locked.slice(0, 30).map((e, i) => <span key={i} className="epick locked">{e}</span>)}
              {locked.length > 30 && <span className="epick locked" style={{ fontSize: 11, width: "auto", padding: "0 8px" }}>+{locked.length - 30} mehr</span>}
            </div>
          </>)}
        </div>
      </div>
    </div>
  );
}
function ScoringSheet({ step, flash, onClose, onSave }) {
  const [s, setS] = useState(String(step));
  const [f, setF] = useState(String(flash));
  const sv = parseFloat(s), fv = parseFloat(f);
  const valid = !isNaN(sv) && !isNaN(fv) && sv > 0 && fv >= 0;
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="grip" />
        <div className="shead"><h2>⚙️ Punktesystem bearbeiten</h2><button className="x" onClick={onClose}>✕</button></div>
        <div className="sbody">
          <div className="note" style={{ marginBottom: 14 }}>Punkte pro Route = Grad × Top-Faktor. Flash-Bonus kommt zusätzlich dazu.</div>
          <div className="field"><label>Top-Faktor (Punkte pro Grad)</label>
            <input type="number" step="0.05" min="0.05" value={s} onChange={e => setS(e.target.value)} />
            <div className="phint">Standard: 0.25 → Grad 6 Top = 1.50 Punkte</div>
          </div>
          <div className="field"><label>Flash-Bonus</label>
            <input type="number" step="0.05" min="0" value={f} onChange={e => setF(e.target.value)} />
            <div className="phint">Standard: 0.25 → Grad 6 Flash = 1.75 Punkte</div>
          </div>
          <div className="ptbl" style={{ marginTop: 12 }}>
            <span className="ph">Grad</span><span className="ph">Top</span><span className="ph">Flash</span>
            {GRADES.map(g => [
              <span key={g+"n"} className="pg" style={{ color: GRADE_COLOR[g] }}>{g}er</span>,
              <span key={g+"t"} className="pv">{valid ? fmtPts(g * sv) : "—"}</span>,
              <span key={g+"f"} className="pv">{valid ? fmtPts(g * sv + fv) : "—"}</span>
            ])}
          </div>
          <button className={"save" + (valid ? "" : " disabled")} style={{ marginTop: 16 }} onClick={() => valid && onSave(sv, fv)}>Speichern</button>
        </div>
      </div>
    </div>
  );
}
function ChangePinSheet({ me, onClose, onSave }) {
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [err, setErr] = useState("");
  function save() {
    if (pin.length < 4) return setErr("Mindestens 4 Zeichen.");
    if (pin !== pin2) return setErr("Die Eingaben stimmen nicht überein.");
    onSave(pin);
  }
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="grip" />
        <div className="shead"><h2>Passwort ändern</h2><button className="x" onClick={onClose}>✕</button></div>
        <div className="sbody">
          <div className="note">Neues Passwort für <b style={{ color: "var(--chalk)" }}>{me.name}</b>{me.staff ? " (Haupt-Admin)" : ""}.</div>
          <div className="field"><label>Neues Passwort</label><input type="password" value={pin} onChange={e => { setPin(e.target.value); setErr(""); }} placeholder="mind. 4 Zeichen" autoFocus /></div>
          <div className="field"><label>Wiederholen</label><input type="password" value={pin2} onChange={e => { setPin2(e.target.value); setErr(""); }} placeholder="nochmal eingeben" /></div>
          {err && <div className="err">{err}</div>}
          <button className="save" onClick={save}>Speichern</button>
        </div>
      </div>
    </div>
  );
}

/* ============================ Gruppen-Dialoge ============================ */
function NewGroupSheet({ onClose, onCreate, achScore, isAdmin }) {
  const [isPrivate, setIsPrivate] = useState(false);
  const [name, setName] = useState(() => genGroupName(LANG));
  const unlocked = getUnlockedEmojis(achScore || 0, isAdmin);
  const [emoji, setEmoji] = useState(unlocked[0]);
  const next = getNextEmojiUnlock(achScore || 0);
  const valid = name.trim().length > 0;
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="grip" />
        <div className="shead"><h2>{t("grp.create")}</h2><button className="x" onClick={onClose}>✕</button></div>
        <div className="sbody">
          <div className="field">
            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>{t("grp.name")} <button type="button" className="reroll" onClick={() => setName(genGroupName(LANG))}>{t("grp.roll")}</button></label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} />
            <div className="phint">{t("grp.nameHint")}</div>
          </div>
          <div className="field"><label style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>{t("grp.symbol")} <span className="bigpick" style={{ fontSize: 22 }}>{emoji}</span></label>
            {next && <div className="emoji-info-next" style={{ marginBottom: 8 }}>Nächste <b>{next.count}</b> bei <b>{next.at} Skillpoints</b></div>}
            <div className="emojipick big">{unlocked.map((e, i) => <button key={i} className={"epick" + (emoji === e ? " on" : "")} onClick={() => setEmoji(e)}>{e}</button>)}</div>
          </div>
          <button type="button" className="privtoggle" style={{ marginTop: 4, marginBottom: 12 }} onClick={() => setIsPrivate(p => !p)}>
            <span className={"switch" + (isPrivate ? " on" : "")}><span className="knob" /></span>
            <span className="privtext"><b>{LANG === "en" ? "Private group" : "Private Gruppe"}</b><span>{LANG === "en" ? "Hidden from the community ranking — only members can see it." : "Nicht im Community-Ranking sichtbar — nur Mitglieder sehen sie."}</span></span>
          </button>
          <button className={"save" + (valid ? "" : " disabled")} onClick={() => valid && onCreate(name.trim(), emoji, isPrivate)}>{t("grp.create")}</button>
        </div>
      </div>
    </div>
  );
}
function GroupSheet({ group, me, accById, boardMode, isMember, isCreator, requested, full, meHasGroup, inviteables, onClose, onRequest, onCancelReq, onAccept, onDecline, onInvite, onLeave, onDelete }) {
  const [showInvite, setShowInvite] = useState(false);
  const reqs = (group.requests || []).map(id => accById[id]).filter(Boolean);
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="grip" />
        <div className="shead"><h2>{group.emoji} {group.name}</h2><button className="x" onClick={onClose}>✕</button></div>
        <div className="sbody">
          <div className="gtot">
            <div><div className="gtv">{fmtPts(group.aktuell)}</div><div className="gtu">aktuell</div></div>
            <div><div className="gtv">{fmtPts(group.gesamt)}</div><div className="gtu">gesamt</div></div>
            <div><div className="gtv">{(group.members || []).length}/10</div><div className="gtu">Mitglieder</div></div>
          </div>

          <div className="field" style={{ marginTop: 4 }}><label>Mitglieder ({boardMode === "aktuell" ? "aktuell" : boardMode === "erfolge" ? "Erfolge" : "gesamt"})</label>
            {group.mem.map((m, i) => (
              <div className="memrow" key={m.acc.id}>
                <span className="mr">{medal(i) || (i + 1)}</span>
                <Avatar name={m.acc.name} size={26} />
                <span className="mn">{m.acc.name}{m.acc.id === me.id ? " · Du" : ""}{group.createdBy === m.acc.id ? " 👑" : ""}</span>
                <span className="mp">{boardMode === "erfolge" ? Math.round(m.pts[boardMode] || 0) : fmtPts(m.pts[boardMode] || 0)}</span>
              </div>
            ))}
          </div>

          {isCreator && reqs.length > 0 && (
            <div className="field"><label>Beitritts-Anfragen</label>
              {reqs.map(a => (
                <div className="prow" key={a.id}>
                  <div className="pinfo"><Avatar name={a.name} size={30} /><div className="pn">{a.name}</div></div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="joinbtn" onClick={() => onAccept(a.id)} disabled={full} style={full ? { opacity: .4 } : {}}>Annehmen</button>
                    <button className="removex danger" onClick={() => onDecline(a.id)}>✕</button>
                  </div>
                </div>
              ))}
              {full && <div className="phint">Gruppe ist voll (10/10).</div>}
            </div>
          )}

          {isCreator && (
            <div className="field">
              <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>Mitglieder einladen <button type="button" className="reroll" onClick={() => setShowInvite(s => !s)}>{showInvite ? "schließen" : "auswählen"}</button></label>
              {showInvite && (inviteables.length === 0 ? <div className="phint">Niemand verfügbar (alle sind schon in einer Gruppe).</div> :
                <div className="invlist">{inviteables.map(a => (
                  <div className="prow" key={a.id}>
                    <div className="pinfo"><Avatar name={a.name} size={30} /><div className="pn">{a.name}</div></div>
                    <button className="joinbtn" onClick={() => onInvite(a.id)} disabled={full} style={full ? { opacity: .4 } : {}}>Einladen</button>
                  </div>
                ))}</div>)}
            </div>
          )}

          {!isMember && (meHasGroup
            ? <div className="note" style={{ textAlign: "center" }}>Du bist schon in einer Gruppe. Verlasse sie zuerst, um hier beizutreten.</div>
            : requested ? <button className="leavebtn" style={{ width: "100%", padding: 13 }} onClick={onCancelReq}>Anfrage zurückziehen</button>
              : full ? <div className="note" style={{ textAlign: "center" }}>Diese Gruppe ist voll (10/10).</div>
                : <button className="save" onClick={onRequest}>Beitritt anfragen</button>)}

          {isMember && <button className="leavebtn" style={{ width: "100%", padding: 13 }} onClick={onLeave}>Gruppe verlassen</button>}
          {isCreator && <button className="del" onClick={onDelete}>Gruppe löschen</button>}
        </div>
      </div>
    </div>
  );
}

class RouteSheetBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  componentDidCatch(e, info) { console.error("RouteSheet crash:", e, info); }
  render() {
    if (this.state.error) return (
      <div className="scrim" onClick={this.props.onClose}>
        <div className="sheet" onClick={e => e.stopPropagation()} style={{padding:24}}>
          <div className="shead"><h2>{LANG==="en"?"Error":"Fehler"}</h2><button className="x" onClick={this.props.onClose}>✕</button></div>
          <div className="sbody">
            <div className="note" style={{color:"#e98b7d"}}>{LANG==="en"?"Could not load route: ":"Route konnte nicht geladen werden: "}{this.state.error.message}</div>
            <button className="miniaction" style={{marginTop:16}} onClick={this.props.onClose}>{LANG==="en"?"Close":"Schließen"}</button>
          </div>
        </div>
      </div>
    );
    return this.props.children;
  }
}

function RouteSheet({ route, me, gyms, isAdmin, canSetRoutes, onClose, onSave, onDelete, screwDates }) {
  const FLASH_BONUS = _FLASH_BONUS; // use synced global
  const isNew = !route;
  const [wall, setWall] = useState(route ? (wallOf(route.gym) ? wallCanon(route.gym) : (gyms?.[0] || null)) : null);
  const defaultDate = isNew ? (wall && screwDates?.[wall] ? screwDates[wall] : todayISO()) : (route?.date || todayISO());
  const [date, setDate] = useState(defaultDate);
  // Update date when wall changes (only for new routes)
  function changeWall(w) { setWall(w); if (isNew && screwDates?.[w]) setDate(screwDates[w]); }
  const [grade, setGrade] = useState(route?.grade || 5);
  const [name, setName] = useState(route?.name || "");
  const [nick, setNick] = useState((route?.nick && route.nick.trim()) ? route.nick : genName((route?.id || "new") + "|" + (route?.name || ""), route?.grade || 5));
  const [note, setNote] = useState(route?.note || "");
  const [archived, setArchived] = useState(route?.archived || false);
  const [results, setResults] = useState(route?.results ? { ...route.results } : {});
  const [resultDates, setResultDates] = useState(route?.resultDates ? { ...route.resultDates } : {});
  const [photos, setPhotos] = useState([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileRef = useRef(null);
  const origPhotoIds = route?.photos || [];
  const valid = !!wall && nick.trim().length > 0;
  const myStatus = results[me.name] || null;

  useEffect(() => { let on = true; (async () => { try { if (!route?.photos?.length) return; const out = []; for (const id of route.photos) { if (!id) continue; if (typeof id === "string" && id.startsWith("data:")) { out.push({ id, dataUrl: id }); } else { try { const b = await loadPhotoBlob(id); if (b) out.push({ id, dataUrl: b }); } catch(_){} } } if (on) setPhotos(out); } catch(e) { console.error("photo load error", e); } })(); return () => { on = false; }; }, []);
  async function onPickFiles(e) { const files = Array.from(e.target.files || []); e.target.value = ""; if (!files.length) return; setPhotoBusy(true); const add = []; for (const f of files) { try { add.push({ id: uid(), dataUrl: await downscale(f) }); } catch (_) {} } setPhotos(p => [...p, ...add]); setPhotoBusy(false); }
  function removePhoto(id) { setPhotos(p => p.filter(x => x.id !== id)); }
  function setMine(s) {
    const next = results[me.name] === s ? null : s;
    setResults(r => ({ ...r, [me.name]: next }));
    setResultDates(d => { const nd = { ...d }; if (next === null) delete nd[me.name]; else nd[me.name] = todayISO(); return nd; });
  }
  async function commit() {
    if (!valid) return;
    const keepIds = photos.map(p => p.id);
    for (const ph of photos) if (!String(ph.id).startsWith("data:")) await savePhotoBlob(ph.id, ph.dataUrl);
    for (const oid of origPhotoIds) if (!keepIds.includes(oid) && !String(oid).startsWith("data:")) await deletePhotoBlob(oid);
    onSave({ id: route?.id || uid(), date, gym: wall, grade, name: name.trim(), nick: nick.trim(), note: note.trim(), archived, results, resultDates, photos: keepIds, tips: route?.tips || [] });
  }

  return (
    <div className={"scrim" + (isNew && !wall ? " full" : "")} onClick={onClose}>
      <div className={"sheet" + (isNew && !wall ? " planmode" : "")} onClick={e => e.stopPropagation()}>
        <div className="grip" />
        <div className="shead"><h2>{isNew ? (LANG==="en"?"Add route":"Route anlegen") : (LANG==="en"?"Edit route":"Route bearbeiten")}</h2><button className="x" onClick={onClose} aria-label="Schließen"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 2l10 10M12 2L2 12"/></svg></button></div>
        <div className="sbody">
          {(!wall && isNew) ? (
            <div className="planpick">
              <div className="planpick-ttl">{LANG==="en"?"Where is the route?":"Wo hängt die Route?"}</div>
              <div className="planpick-sub">{LANG==="en"?"Tap the area on the gym map":"Tippe auf den Bereich im Hallenplan"}</div>
              <div className="planpick-wrap"><FloorPlan value={wall} onChange={changeWall} /></div>
            </div>
          ) : (<>
          <div className="wallbar">
            <span className="wallbar-ic"><WallIcon code={wall} size={20} /></span>
            <span className="wb-name">{wallName(wall)}</span>
            {isNew && <button className="wb-change" onClick={() => setWall(null)}>{LANG==="en"?"Map ▾":"Plan ▾"}</button>}
          </div>

          <div className="field"><label>Grad</label>
            <div className="gradepick">{GRADES.map(g => <button key={g} className={grade === g ? "on" : ""} style={grade === g ? { background: "#b8ff00", borderColor: "#b8ff00", color:"#13141a" } : {}} onClick={() => setGrade(g)}>{g}</button>)}</div>
            <div className="ghint">Punkte: <b>{fmtPts(topPts(grade))}</b> für Top · <b>{fmtPts(topPts(grade) + FLASH_BONUS)}</b> für Flash</div>
          </div>

          <div className="field"><label>Farbe der Griffe</label>
            <div className="colpicker">
              {[["lila","#7B3FC8"],["pink","#D4287A"],["blau","#1A6FD4"],["rot","#D93025"],["grün","#1E9E48"],["gelb","#F5C800"],["holz","#9A5020"],["schwarz","#181C22"],["weiß","#EEEEE4"]].map(([cname, hex]) => {
                const active = (name || "").toLowerCase().trim() === cname;
                const isLight = cname === "gelb" || cname === "weiß";
                return (
                  <button key={cname} type="button" className={"colbtn" + (active ? " on" : "")} style={{ background: hex, color: isLight ? "#111" : "#fff", border: cname === "weiß" || cname === "gelb" ? "1.5px solid rgba(0,0,0,.2)" : "none" }} onClick={() => setName(cname)} title={cname}>
                    {active && <span className="colcheck">✓</span>}
                  </button>
                );
              })}
            </div>
            {name && <div className="phint" style={{ marginTop: 6 }}>Ausgewählt: <b>{name}</b></div>}
          </div>

          <div className="field">
            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>Routenname <button type="button" className="reroll" onClick={() => setNick(genName(uid(), grade))}>🎲 neu würfeln</button></label>
            <input type="text" value={nick} onChange={e => setNick(e.target.value)} placeholder="Name der Route" autoFocus={isNew} />
            <div className="phint">Wird automatisch aus Farbe & Grad gewürfelt — kannst du frei ändern.</div>
          </div>

          <div className="field"><label>{t("route.note")}</label>
            <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder={t("route.notePh")} maxLength={60} />
            <div className="phint">{t("route.noteHint")}</div>
          </div>

          <div className="field"><label>Fotos {photos.length ? `(${photos.length})` : ""}</label>
            <div className="photos">
              {photos.map(ph => <div className="thumb" key={ph.id}><img src={ph.dataUrl} alt="" /><button className="thx" onClick={() => removePhoto(ph.id)}>✕</button></div>)}
              <button className="addphoto" onClick={() => fileRef.current?.click()}>{photoBusy ? "…" : <><span style={{ fontSize: 22, lineHeight: 1 }}>＋</span><span>Foto</span></>}</button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple style={{ display: "none" }} onChange={onPickFiles} />
            <div className="phint">Kamera oder Galerie. Bilder werden verkleinert gespeichert.</div>
          </div>

          <div className="field"><label>Dein Ergebnis</label>
            <div className="bigtri">
              <button onClick={() => { setResults(r => ({ ...r, [me.name]: null })); setResultDates(d => { const nd = { ...d }; delete nd[me.name]; return nd; }); }} className={!myStatus ? "a" : ""}>—<span className="sp">offen</span></button>
              <button className={myStatus === "top" ? "a" : ""} onClick={() => setMine("top")}>Top<span className="sp">{fmtPts(topPts(grade))}</span></button>
              <button className={myStatus === "flash" ? "f" : ""} onClick={() => setMine("flash")}>Flash<span className="sp">{fmtPts(topPts(grade) + FLASH_BONUS)}</span></button>
            </div>
          </div>

          {!isNew && canSetRoutes && (
            <div className="field"><label>Status</label>
              <div className="statusseg">
                <button className={!archived ? "on" : ""} style={!archived ? { background: "var(--chalk)", color: "var(--bg)", borderColor: "var(--chalk)", fontSize: 14 } : { fontSize: 14 }} onClick={() => setArchived(false)}>Aktuell</button>
                <button className={archived ? "on" : ""} style={archived ? { background: "var(--chalk)", color: "var(--bg)", borderColor: "var(--chalk)", fontSize: 14 } : { fontSize: 14 }} onClick={() => setArchived(true)}>Archiv</button>
              </div>
              {!isAdmin && <div className="phint" style={{ marginTop: 6 }}>Archivierte Routen bleiben gespeichert — nur ein Admin kann sie endgültig löschen.</div>}
            </div>
          )}

          <button className={"save" + (valid ? "" : " disabled")} onClick={commit}>{isNew ? (LANG==="en"?"Add route":"Route anlegen") : (LANG==="en"?"Save":"Speichern")}</button>
          {!isNew && isAdmin && <button className="del" onClick={() => { if (confirm(LANG==="en"?"Really delete this route? All results and photos will be lost.":"Diese Route wirklich löschen? Alle Ergebnisse und Fotos gehen verloren.")) onDelete(route.id); }}>🗑 {LANG==="en"?"Delete route":"Route löschen"}</button>}
          {!isNew && !isAdmin && !canSetRoutes && <div className="phint" style={{ textAlign: "center", marginTop: 12 }}>{LANG==="en"?"Only Route Creators and Admins can archive or delete.":"Archivieren und Löschen können nur Route Creator und Admins."}</div>}
          </>)}
        </div>
      </div>
    </div>
  );
}
