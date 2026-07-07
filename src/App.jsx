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
// Bockstar-Routen: keine feste Schwierigkeit ("BS"). Werden für Punkte wie ein 5er behandelt
// (mittlerer Grad, damit sie nicht komplett wertlos sind), aber im UI mit "BS" statt Zahl angezeigt.
const BOCKSTAR_GRADE_VALUE = 5;
function isBockstar(r) { return r && (r.grade === "BS" || r.grade === "bs"); }
function gradeLabel(r) { return isBockstar(r) ? "BS" : String(r.grade); }
function gradeValue(r) { return isBockstar(r) ? BOCKSTAR_GRADE_VALUE : (Number(r.grade) || 0); }
const GRADE_COLOR = { 1: "#b8ff00", 2: "#b8ff00", 3: "#b8ff00", 4: "#b8ff00", 5: "#b8ff00", 6: "#b8ff00", 7: "#b8ff00", 8: "#b8ff00" };
function topPts(g) { return g * _STEP; }
function pointsFor(grade, status) { if (!status) return 0; return grade * _STEP + (status === "flash" ? _FLASH_BONUS : 0); }
/* ============================ Wände ============================ */
const WALLS = [
  { code: "v", name: "Block vorne", short: "V", aliases: ["bv", "block vorne", "block_vorne"] },
  { code: "h", name: "Block hinten", short: "H", aliases: ["bh", "block hinten", "block_hinten"] },
  { code: "tb", name: "Trainingsbereich", short: "TB", aliases: ["training & bug", "training und bug", "trainingsbereich", "training", "tb"] },
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
  orange: "#D46A10", braun: "#6E3C18", "türkis": "#0E8A80", grau: "#8C939D",
};
const COLOR_FG = {
  rot: "#fff", gelb: "#111", "weiß": "#111", weiss: "#111",
  blau: "#fff", "grün": "#111", gruen: "#111", lila: "#fff",
  violett: "#fff", pink: "#fff", schwarz: "#fff", holz: "#fff",
  orange: "#111", braun: "#fff", "türkis": "#111", grau: "#111",
};
function colorFgOf(name) { const t = (name || "").toLowerCase(); for (const k of Object.keys(COLOR_FG)) if (t.includes(k)) return COLOR_FG[k]; return "#fff"; }
function colorOf(name) { const t = (name || "").toLowerCase(); for (const k of Object.keys(COLOR_DOT)) if (t.includes(k)) return COLOR_DOT[k]; return null; }
function initials(n) { const p = (n || "?").trim().split(/\s+/); return (p[0][0] + (p[1] ? p[1][0] : "")).toUpperCase(); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function fmtDate(iso) { if (!iso) return "—"; const [y, m, d] = iso.split("-"); return `${d}.${m}.${y}`; }
function fmtDateTime(ts) { if (!ts) return ""; const d = new Date(ts); const p = n => String(n).padStart(2, "0"); return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`; }
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
  { g: "f", n: "Wand" }, { g: "f", n: "Platte & Bug" }, { g: "f", n: "Wucht" }, { g: "f", n: "Granate" },
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
    "login.signin": "Anmelden", "login.signup": "Registrieren", "login.name": "Name", "login.pin": "Passwort",
    "login.namePh": "Dein Name", "login.pinPh": "Passwort", "login.pinSet": "Passwort festlegen (mind. 4 Zeichen)",
    "login.suggest": "🎲 Vorschlag", "login.create": "Konto erstellen",
    "login.privTitle": "Privater Modus", "login.privDesc": "Du trackst alles, erscheinst aber für niemanden in Ranglisten — nur du siehst deine Platzierung.",
    "login.demoShow": "Demo-Konten anzeigen", "login.demoHide": "Demo-Konten ausblenden",
    "login.demoHint": "Beispiel-Konten · PIN für alle: 1234 · Admin: Login admin, Passwort admin",
    "login.foot": "Lokaler Prototyp · Daten bleiben in diesem Browser",
    "login.errNoAcc": "Kein Konto mit diesem Namen.", "login.errPin": "PIN stimmt nicht.",
    "login.errName": "Bitte einen Namen eingeben.", "login.errTaken": "Name ist schon vergeben.", "login.errShort": "Passwort braucht mindestens 4 Zeichen.",
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
    "login.signin": "Sign in", "login.signup": "Sign up", "login.name": "Name", "login.pin": "Password",
    "login.namePh": "Your name", "login.pinPh": "Password", "login.pinSet": "Set a password (min. 4 characters)",
    "login.suggest": "🎲 Suggest", "login.create": "Create account",
    "login.privTitle": "Private mode", "login.privDesc": "You track everything but won't appear in anyone's leaderboards — only you see your rank.",
    "login.demoShow": "Show demo accounts", "login.demoHide": "Hide demo accounts",
    "login.demoHint": "Example accounts · PIN for all: 1234 · Admin: login admin, password admin",
    "login.foot": "Local prototype · Data stays in this browser",
    "login.errNoAcc": "No account with this name.", "login.errPin": "Wrong PIN.", "login.errName": "Please enter a name.",
    "login.errTaken": "Name is already taken.", "login.errShort": "Password needs at least 4 characters.",
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
function routeTitle(r) { return (r.nick && r.nick.trim()) ? r.nick : genName((r.id || "") + "|" + (r.name || ""), gradeValue(r)); }
// Erzeugt einen Namen, der in `existing` (Set aus kleingeschriebenen Namen) noch nicht vorkommt.
// Jeder Aufruf nutzt einen frischen Zufalls-Seed — keine deterministischen Wiederholungen mehr.
function genUniqueName(grade, existing) {
  const seen = existing || new Set();
  for (let i = 0; i < 80; i++) {
    const n = genName(uid() + "|" + i + "|" + Math.random(), grade);
    if (!seen.has(n.toLowerCase().trim())) return n;
  }
  return genName(uid() + "|" + Math.random(), grade) + " " + (Math.floor(Math.random() * 90) + 10);
}
function colorWord(name) { const t = (name || "").toLowerCase(); for (const k of Object.keys(COLOR_DOT)) if (t.includes(k)) return k.charAt(0).toUpperCase() + k.slice(1); return null; }

/* ── Teilen: Route-Info+Foto sowie generierte Stats-Bildkarte ──────────────── */
function dataUrlToFile(dataUrl, filename) {
  try {
    const [head, b64] = dataUrl.split(",");
    const mime = (head.match(/data:(.*?)[;,]/) || [])[1] || "image/jpeg";
    const bin = atob(b64); const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new File([arr], filename, { type: mime });
  } catch (e) { return null; }
}
// Teilt eine Route (Farbe, Grad, Schraubdatum) inkl. Foto, wo möglich. Rückgabe: true | "copied" | false
async function shareRouteInfo(r, photoDataUrl) {
  const col = colorWord(r.name);
  const info = LANG === "en"
    ? [col, isBockstar(r) ? "grade Bockstar" : ("grade " + r.grade), "set " + fmtDate(r.date)].filter(Boolean).join(" · ")
    : [col, isBockstar(r) ? "Bockstar" : (r.grade + "er"), "Schraubdatum " + fmtDate(r.date)].filter(Boolean).join(" · ");
  const text = "🧗 " + routeTitle(r) + "\n" + info + "\n→ blocscore.de";
  let files = [];
  if (photoDataUrl) { const f = dataUrlToFile(photoDataUrl, "route.jpg"); if (f && navigator.canShare && navigator.canShare({ files: [f] })) files = [f]; }
  try {
    if (navigator.share) { await navigator.share(files.length ? { title: "blocscore", text, files } : { title: "blocscore", text, url: "https://blocscore.de" }); return true; }
  } catch (e) { if (e && e.name === "AbortError") return false; }
  try { await navigator.clipboard.writeText(text); return "copied"; } catch (e) {}
  return false;
}
function _rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
// Erzeugt eine schöne Stats-Bildkarte (1080×1350) und teilt/lädt sie. d = {name,emoji,levelNum,levelName,periodLabel,sends,flashes,meters,pts}
async function shareStatsCard(d) {
  const W = 1080, M = 70;
  const SANS = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
  const rows = (d.todayRoutes || []).slice(0, 10);
  const hasList = rows.length > 0;
  // dynamische Höhe je nach Listenlänge
  const kpiBottom = 745;
  const listTop = kpiBottom + 50;
  const rowH = 52;
  const HEAD_GAP = 112, BOT_PAD = 30; // Abstand Überschrift→1. Zeile, unteres Padding wie KPI-Kacheln
  const panelH = hasList ? (HEAD_GAP + (rows.length - 1) * rowH + BOT_PAD) : 0;
  const footerY = listTop + panelH + (hasList ? 34 : 6);
  const H = Math.round(footerY + 120);
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d");
  async function loadImg(src) { try { const im = new Image(); im.src = src; await im.decode(); return im; } catch (e) { return null; } }
  const [logo, bg] = await Promise.all([loadImg("/logo.png"), loadImg("/login-bg-portrait.jpg")]);
  // Hintergrundbild (cover) + Abdunkelung
  ctx.fillStyle = "#13141a"; ctx.fillRect(0, 0, W, H);
  if (bg) { try { const s = Math.max(W / bg.width, H / bg.height); const dw = bg.width * s, dh = bg.height * s; ctx.drawImage(bg, (W - dw) / 2, (H - dh) / 2, dw, dh); } catch (e) {} }
  const ov = ctx.createLinearGradient(0, 0, 0, H);
  ov.addColorStop(0, "rgba(15,16,20,.84)"); ov.addColorStop(0.5, "rgba(15,16,20,.74)"); ov.addColorStop(1, "rgba(15,16,20,.9)");
  ctx.fillStyle = ov; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#b8ff00"; ctx.fillRect(0, 0, W, 9);
  ctx.textBaseline = "alphabetic";
  // Logo
  if (logo) { try { ctx.drawImage(logo, M, 46, 104, 104); } catch (e) {} }
  // Avatar + Name + Level (kompakt)
  const ay = 232;
  ctx.fillStyle = "#1d222a"; ctx.beginPath(); ctx.arc(M + 42, ay, 42, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#b8ff00"; ctx.lineWidth = 3; ctx.stroke();
  ctx.textAlign = "center"; ctx.font = "46px " + SANS; ctx.fillStyle = "#edeee8";
  if (d.emoji) ctx.fillText(d.emoji, M + 42, ay + 15); else { ctx.fillStyle = "#b8ff00"; ctx.font = "700 40px " + SANS; ctx.fillText((d.name || "?").charAt(0).toUpperCase(), M + 42, ay + 14); }
  ctx.textAlign = "left"; ctx.fillStyle = "#edeee8"; ctx.font = "800 50px " + SANS; ctx.fillText(d.name || "", M + 108, ay - 4);
  ctx.fillStyle = "#b8ff00"; ctx.font = "700 30px " + SANS; ctx.fillText("LEVEL " + d.levelNum + " · " + d.levelName, M + 108, ay + 36);
  // KPI-Kacheln 2×2 (kompakt) mit Lime-Rand
  const gap = 24, cw = (W - 2 * M - gap) / 2, ch = 200, ky = 315;
  const kpis = [
    [String(d.sends), LANG === "en" ? "SENDS" : "BEGEHUNGEN"],
    [String(d.flashes) + " ⚡", "FLASHES"],
    [Math.round(d.meters) + " m", LANG === "en" ? "ELEVATION" : "HÖHENMETER"],
    [d.ptsLabel, LANG === "en" ? "POINTS" : "PUNKTE"],
  ];
  kpis.forEach((k, i) => {
    const x = M + (i % 2) * (cw + gap), y = ky + Math.floor(i / 2) * (ch + gap);
    ctx.fillStyle = "rgba(18,21,27,.8)"; _rrect(ctx, x, y, cw, ch, 24); ctx.fill();
    ctx.strokeStyle = "rgba(184,255,0,.65)"; ctx.lineWidth = 3; ctx.stroke();
    ctx.textAlign = "center"; ctx.fillStyle = "#edeee8"; ctx.font = "800 74px " + SANS;
    ctx.fillText(k[0], x + cw / 2, y + ch / 2 + 8);
    ctx.fillStyle = "#9aa6b2"; ctx.font = "700 25px " + SANS; ctx.fillText(k[1], x + cw / 2, y + ch - 30);
  });
  // Liste: heute geschafft (Top 10 der schwersten)
  if (hasList) {
    const pw = W - 2 * M;
    ctx.fillStyle = "rgba(18,21,27,.8)"; _rrect(ctx, M, listTop, pw, panelH, 24); ctx.fill();
    ctx.strokeStyle = "rgba(184,255,0,.65)"; ctx.lineWidth = 3; ctx.stroke();
    ctx.textAlign = "left"; ctx.fillStyle = "#b8ff00"; ctx.font = "800 26px " + SANS;
    ctx.fillText(LANG === "en" ? "TODAY · MY HIGHLIGHTS" : "HEUTE · MEINE HIGHLIGHTS", M + 28, listTop + 52);
    // feste rechte Spalten: Segment + Flash sauber untereinander (rechtsbündig)
    const flashX = W - M - 28, segRightX = W - M - 72;
    ctx.font = "400 24px " + SANS;
    let maxSegW = 0; rows.forEach(r => { if (r.wall) maxSegW = Math.max(maxSegW, ctx.measureText(r.wall).width); });
    const nameMaxRight = segRightX - maxSegW - 22;
    rows.forEach((r, i) => {
      const ry = listTop + HEAD_GAP + i * rowH;
      const col = r.color;
      const isBlack = col === "#181C22";
      const boxCol = col || "#b8ff00";
      // Grad-Kachel: dünne Outline, dünne Zahl (wie auf den Route-Karten)
      const bs = 44, bx = M + 18, by = ry - 33;
      _rrect(ctx, bx, by, bs, bs, 9);
      if (isBlack) { ctx.fillStyle = "rgba(255,255,255,.88)"; ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,.5)"; }
      else { ctx.strokeStyle = boxCol; }
      ctx.lineWidth = 2; ctx.stroke();
      ctx.textAlign = "center"; ctx.fillStyle = isBlack ? "#181C22" : boxCol; ctx.font = "300 30px " + SANS;
      ctx.fillText(String(r.grade), bx + bs / 2, by + bs / 2 + 11);
      // Segment (rechtsbündige Spalte)
      ctx.textAlign = "right"; ctx.fillStyle = "#8b95a1"; ctx.font = "400 24px " + SANS;
      if (r.wall) ctx.fillText(r.wall, segRightX, ry);
      // Flash (eigene rechtsbündige Spalte)
      if (r.flash) { ctx.fillStyle = "#b8ff00"; ctx.font = "700 26px " + SANS; ctx.fillText("⚡", flashX, ry); }
      // Name (links, nicht fett, gekürzt)
      ctx.textAlign = "left"; ctx.fillStyle = "#dbe1e8"; ctx.font = "400 28px " + SANS;
      const nameX = M + 80;
      let title = r.title || "";
      const maxW = nameMaxRight - nameX;
      if (maxW > 40 && ctx.measureText(title).width > maxW) { while (title.length > 3 && ctx.measureText(title + "…").width > maxW) title = title.slice(0, -1); title = title.trim() + "…"; }
      ctx.fillText(title, nameX, ry);
    });
  }
  // Fuß: Datum + Adresse (klein, nicht fett)
  ctx.textAlign = "center";
  ctx.fillStyle = "#c9d2dc"; ctx.font = "400 26px " + SANS; ctx.fillText(fmtDate(todayISO()), W / 2, H - 96);
  ctx.fillStyle = "#b8ff00"; ctx.font = "400 30px " + SANS; ctx.fillText("www.blocscore.de", W / 2, H - 52);
  const blob = await new Promise(res => cv.toBlob(res, "image/png"));
  if (!blob) return false;
  const file = new File([blob], "blocscore-stats.png", { type: "image/png" });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: "blocscore", text: LANG === "en" ? "My bouldering stats" : "Meine Boulder-Stats" }); return true; }
  } catch (e) { if (e && e.name === "AbortError") return false; }
  const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "blocscore-stats.png"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500); return true;
}

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

// Wave 7: +72 witzigere ab ~960 Ach-Pts — Grimassen, Affen, Hände, Spaß-Essen, Kletter-Gadgets
const EMOJI_WAVE7 = [
  // Grimassen & Gesichter (endlich welche!)
  "🤪","😎","🤓","🥳","😤","😮‍💨","🫠","🥵","🥶","😵‍💫",
  "🤯","🤠","🥸","🧐","🙃","😬","🤤","😈","🤡","💩",
  "👽","👹","🥹","🤩",
  // Affen = Kletterer & lustige Tiere
  "🦍","🦧","🐒","🙈","🙉","🙊","🐸","🦫","🦨","🦡",
  "🐹","🐰","🐢","🐾",
  // Hände & Gesten (Shaka, Rock, Pinch, Crimp…)
  "🤙","🤘","🖖","🫰","🤌","🤏","🫳","🫴","🙌","🤞",
  "🤟","🫵",
  // Spaß-Essen & Feierabend
  "🥨","🥖","🧀","🥓","🌭","🥪","🍟","🍺","🍻","🍷",
  "🥂","🧉","🍿","🍪",
  // Kletter-Gadgets & Spaß
  "🪜","🪝","🩹","🧘","🤹","🚵","🎈","🪀",
];

// Gesamter Emoji-Pool (deduplicated)
const EMOJI_POOL_ALL = [...new Set([
  ...EMOJI_STARTER, ...EMOJI_WAVE1, ...EMOJI_WAVE2,
  ...EMOJI_WAVE3, ...EMOJI_WAVE4, ...EMOJI_WAVE5, ...EMOJI_WAVE6, ...EMOJI_WAVE7,
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
    return [...new Set([...EMOJI_STARTER,...EMOJI_WAVE1,...EMOJI_WAVE2,...EMOJI_WAVE3,...EMOJI_WAVE4,...EMOJI_WAVE5,...EMOJI_WAVE6,...EMOJI_WAVE7])];
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
    <div className="scrim intro-scrim" onClick={onClose}>
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


// ── Level-Up Popup mit Konfetti ───────────────────────
const _CONFETTI = Array.from({ length: 44 }, (_, i) => {
  const ang = (i / 44) * Math.PI * 2 + Math.random() * 0.5;
  const dist = 70 + Math.random() * 150;
  const cols = ["#b8ff00", "#d4ff70", "#ffffff", "#9ac81f", "#eaffc2", "#b8ff00"];
  return {
    tx: Math.cos(ang) * dist,
    ty: Math.sin(ang) * dist - 30,
    r: Math.round(Math.random() * 720 - 360),
    c: cols[i % cols.length],
    s: 6 + Math.round(Math.random() * 8),
    dl: (Math.random() * 0.12).toFixed(2),
    d: (0.9 + Math.random() * 0.7).toFixed(2),
    round: Math.random() > 0.55,
  };
});
function LevelUpModal({ level, name, story, onClose }) {
  const en = LANG === "en";
  return (
    <div className="scrim lvlup-scrim" onClick={onClose}>
      <div className="lvlup-card" onClick={e => e.stopPropagation()}>
        <div className="lvlup-confetti" aria-hidden="true">
          {_CONFETTI.map((p, i) => (
            <span key={i} className="lvlup-piece" style={{
              "--tx": p.tx + "px", "--ty": p.ty + "px", "--r": p.r + "deg",
              "--s": p.s + "px", "--c": p.c, "--dl": p.dl + "s", "--d": p.d + "s",
              borderRadius: p.round ? "50%" : "2px",
            }} />
          ))}
        </div>
        <div className="lvlup-kicker">{en ? "LEVEL UP" : "LEVEL UP"}</div>
        <div className="lvlup-num">{level}<span>/100</span></div>
        <div className="lvlup-title">{name}</div>
        <div className="lvlup-story">{story}</div>
        <button className="lvlup-btn" onClick={onClose}>{en ? "Let's go! 🚀" : "Weiter geht's! 🚀"}</button>
      </div>
    </div>
  );
}

/* Erfolg freigeschaltet: kleines Feier-Modal + Boulder-Wissen als Belohnung */
function AchUnlockModal({ items, extra, fact, onClose }) {
  const en = LANG === "en";
  return (
    <div className="scrim lvlup-scrim" onClick={onClose}>
      <div className="achup-card" onClick={e => e.stopPropagation()}>
        <div className="achup-kicker">{items.length + (extra || 0) > 1 ? (en ? `${items.length + extra} ACHIEVEMENTS UNLOCKED` : `${items.length + extra} ERFOLGE FREIGESCHALTET`) : (en ? "ACHIEVEMENT UNLOCKED" : "ERFOLG FREIGESCHALTET")}</div>
        <div className="achup-list">
          {items.map(a => (
            <div className="achup-item" key={a.id}><span className="achup-ic">{a.icon}</span><div className="achup-txt"><div className="achup-name">{a.name}</div><div className="achup-desc">{a.desc}</div></div></div>
          ))}
          {extra > 0 && <div className="achup-more">+{extra} {en ? "more" : "weitere"}</div>}
        </div>
        <div className="achup-fact">
          <div className="achup-fact-head">🧗 {en ? "Boulder knowledge" : "Boulder-Wissen"} <span className="achup-fact-no">#{fact.no}/{fact.total}</span></div>
          <div className="achup-fact-text">{fact.text}</div>
        </div>
        <button className="lvlup-btn" onClick={onClose}>{en ? "Nice!" : "Stark!"}</button>
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
  const todayPts = todayRoutes.reduce((s,r) => s + pointsFor(gradeValue(r), r.results[me.name]), 0);
  const todayMeters = todayRoutes.length * WALL_HEIGHT;
  const gradeMap = {};
  todayRoutes.forEach(r => { gradeMap[r.grade] = (gradeMap[r.grade]||0)+1; });
  const bestGrade = todayRoutes.length ? Math.max(...todayRoutes.map(r=>r.grade)) : 0;
  const en = LANG === "en";

  const COLOR_MAP = {
    blau:"#4a90d9",gelb:"#f5c800",rot:"#d93025",grün:"#2ecc6a",
    lila:"#9b59b6",schwarz:"#555566",weiß:"#dddddd",pink:"#e5477d",grau:"#8c939d",holz:"#9a5020"
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
  const COLORS = ["blau","grün","rot","gelb","lila","pink","holz","schwarz","weiß","grau"];
  const CEN = {blau:"blue",grün:"green",rot:"red",gelb:"yellow",lila:"purple",pink:"pink",holz:"wood",schwarz:"black",weiß:"white",grau:"gray"};
  const cap = s => s.charAt(0).toUpperCase()+s.slice(1);
  const cName = c => en ? cap(CEN[c]||c) : cap(c);
  const tier = (arr, i, f) => arr[i] || `${f} ${i+1}`;
  // Scaling: log-based, capped, calibrated to profiles
  const pts = n => Math.min(150, Math.max(5, Math.round(Math.log2(n+1)*9+3)));
  const L = {Gesamt:en?"Total":"Gesamt",Flash:"Flash",Punkte:en?"Points":"Punkte",Kombi:en?"Combo":"Kombi",Tagesform:en?"Day form":"Tagesform",Spezial:en?"Special":"Spezial",Treue:en?"Loyalty":"Treue",Straßen:en?"Straights":"Straßen",Mehrling:en?"Multiples":"Mehrling",Ausdauer:en?"Endurance":"Ausdauer"};

  // GESAMT TOPS — Anfänger 14/sess→~1000 nach 70 sess; Gut 19/sess; Pro 32/sess
  const TOPS=[40,90,180,350,650,1050,1700,2600,4000,6500,10000,15000,22000,32000,45000,60000,80000,110000,150000,200000];
  const TNAMES_DE=["Erster Zug","Handflächen warm","Dabei","Stammgast","Fleißig","Ehrgeizig","Halbhundert","Hartnäckig","Hundert!","Obsessiv","Zweihundert","Dreihundert","Fünfhundert","Dreiviertel-Tausend","Tausendsassa","Zweitausend","Dreitausend","Boulder-Gott","Boulder-Titan","Unaufhaltbar"];
  const TNAMES_EN=["First Move","Palms Warm","On Board","Regular","Diligent","Ambitious","Half Century","Persistent","Hundred!","Obsessed","Two Hundred","Three Hundred","Five Hundred","Three-Quarter K","Jack of All","Two Thousand","Three Thousand","Boulder God","Boulder Titan","Unstoppable"];
  TOPS.forEach((n,i)=>push(L.Gesamt,"🧗",tier(en?TNAMES_EN:TNAMES_DE,i,""),en?`Climb ${n} routes total`:`Schaffe ${n} Routen insgesamt`,n,"tops",pts(n)+Math.floor(n/10)));

  // FLASH — harder, Anfänger flasst selten, Pro flasht ~6/sess
  const FLASHES=[25,65,140,280,520,950,1900,3500,5500,8500,13000,20000];
  const FDE=["Erster Flash","Flash-Trio","Flash-Fünf","Flash-Zehn","Flash-Profi","Flash-Meister","Flash-Legende","Flash-Elite","Flash-Gott","Flash-Mythos","Flash-Titan","Flash-Unsterblich"];
  const FEN=["First Flash","Flash Trio","Flash Five","Flash Ten","Flash Pro","Flash Master","Flash Legend","Flash Elite","Flash God","Flash Myth","Flash Titan","Flash Immortal"];
  FLASHES.forEach((n,i)=>push("Flash","⚡",tier(en?FEN:FDE,i,""),en?`Flash ${n} routes`:`Flashe ${n} Routen`,n,"flashes",Math.round(pts(n)*2.2)));

  // PUNKTE — Anfänger: 7pts/sess→100pts nach 14 sess; Gut: 22.5; Pro: 51.5
  const PTS_V=[300,750,1600,3500,7500,15000,30000,65000,130000,260000,420000,650000,950000];
  const PDE=["Erste Punkte","Guter Start","Dreißig","Dreistellig","Gut","Sehr gut","Sechshundert","Tausend","Elite","Hochleistung","Punktegott","Punkte-Titan","Punkte-Universum"];
  const PEN=["First Points","Good Start","Thirty","Triple Digits","Good","Very Good","Six Hundred","Thousand","Elite","High Performance","Point God","Point Titan","Point Universe"];
  PTS_V.forEach((n,i)=>push(L.Punkte,"💎",tier(en?PEN:PDE,i,""),en?`Earn ${n} total points`:`Erreiche ${n} Spielpunkte`,n,"points",pts(n)+5));

  // GRADE — kalibriert: 1er/2er/3er Anfänger, 4er/5er Gut, 6er/7er Fortgeschritten, 8er Pro
  const gScale=[0,1,1.2,1.5,2,3,5,8,15];
  GRADES.forEach(g=>{
    const tC=g<=2?[80,200,450,900,1800,3500,6500,10000]:g<=4?[50,130,300,650,1300,2600,5000,8000]:g<=6?[5,20,50,120,250,500,1000,2000]:g===7?[2,10,30,75,150,350,700]:[1,5,20,50,100,250,500];
    tC.forEach((n)=>push(`${g}`,"🪨",en?`${n}× Grade ${g}`:`${n}× ${g}er`,en?`Climb ${n} grade-${g} routes`:`Klettere ${n} ${g}er-Routen`,n,`grade:${g}:t`,Math.round(pts(n)*gScale[g])));
    const fC=g<=3?[60,160,350,700]:g<=5?[30,90,200,400,800,1500]:g<=7?[5,25,60,150,300,600]:[2,12,40,100,250];
    fC.forEach((n)=>push(`${g}`,"⚡",en?`Flash ${n}× Grade ${g}`:`Flash ${n}× ${g}er`,en?`Flash ${n} grade-${g} routes`:`Flashe ${n} ${g}er-Routen`,n,`grade:${g}:f`,Math.round(pts(n)*gScale[g]*2)));
  });

  // FARBE
  COLORS.forEach(c=>{
    [35,90,200,450,900,1800,3600,6500,10000].forEach(n=>push(cName(c),"🎨",en?`${n}× ${cName(c)}`:`${n}× ${cName(c)}`,en?`Climb ${n} ${cName(c)} routes`:`Klettere ${n} ${cName(c)}-Routen`,n,`color:${c}:t`,pts(n)+2));
    [45,120,280,600,1200,2400].forEach(n=>push(cName(c),"⚡",en?`Flash ${n}× ${cName(c)}`:`Flash ${n}× ${cName(c)}`,en?`Flash ${n} ${cName(c)} routes`:`Flashe ${n} ${cName(c)}-Routen`,n,`color:${c}:f`,pts(n)+7));
  });

  // TAGESFORM — Anfänger max ~14, Gut ~19, Pro ~32+
  // Tagesform — Tag (realistisch: ~60 Routen in der Halle, max ~50 Tops/Tag)
  [20,28,38,50].forEach(n=>push(L.Tagesform,"🔥",en?`${n} in one day`:`${n} an einem Tag`,en?`Climb ${n} routes in one day`:`Schaffe ${n} Routen an einem Tag`,n,"maxDayTops",pts(n)*2));
  // Tagesform — Woche (7 Tage gleitendes Fenster)
  [60,100,160,250,380,550].forEach(n=>push(L.Tagesform,"🗓",en?`${n} in a week`:`${n} in einer Woche`,en?`Climb ${n} routes in any 7-day window`:`Schaffe ${n} Routen in 7 Tagen`,n,"maxWeekTops",pts(n)*2+20));
  // Tagesform — Monat (30 Tage gleitendes Fenster)
  [200,400,700,1100,1700].forEach(n=>push(L.Tagesform,"📆",en?`${n} in a month`:`${n} in einem Monat`,en?`Climb ${n} routes in any 30-day window`:`Schaffe ${n} Routen in 30 Tagen`,n,"maxMonthTops",pts(n)*2+40));
  // Flash — Tag
  [10,15,22,30].forEach(n=>push(L.Tagesform,"⚡",en?`Flash ${n} in one day`:`${n} Flashes an einem Tag`,en?`Flash ${n} routes in one day`:`Flashe ${n} Routen an einem Tag`,n,"maxDayFlashes",pts(n)*3));
  // Flash — Woche
  [40,65,100,160].forEach(n=>push(L.Tagesform,"⚡",en?`Flash ${n} in a week`:`${n} Flashes in einer Woche`,en?`Flash ${n} routes in any 7 days`:`Flashe ${n} Routen in 7 Tagen`,n,"maxWeekFlashes",pts(n)*3+20));
  // Flash — Monat
  [80,160,300,500].forEach(n=>push(L.Tagesform,"⚡",en?`Flash ${n} in a month`:`${n} Flashes in einem Monat`,en?`Flash ${n} routes in any 30 days`:`Flashe ${n} Routen in 30 Tagen`,n,"maxMonthFlashes",pts(n)*3+40));

  // KOMBI / SPEZIAL
  [1,3,5,10,25].forEach((n,i)=>push(L.Spezial,"🌈",tier(en?["Rainbow","Double Rainbow","Rainbow Collector","Rainbow Pro","Rainbow Legend"]:["Regenbogen","Doppel-Regenbogen","Regenbogen-Sammler","Regenbogen-Profi","Regenbogen-Legende"],i,""),en?`On ${n} day(s) climb blue+green+red+yellow+purple`:`An ${n} Tag(en) blau+grün+rot+gelb+lila`,n,"rainbowDays",40+i*18));
  [1,2,3,5].forEach((n,i)=>push(L.Spezial,"📊",en?`All grades in one day (${n}×)`:`Alle Grade an einem Tag (${n}×)`,en?`On ${n} day(s) climb all grades 1–8`:`An ${n} Tag(en) alle Grade 1–8`,n,"allGradeDays",60+i*25));

  // STRASSEN
  [[4,50],[5,70],[6,100],[7,135],[8,175]].forEach(([k,p])=>push(L.Straßen,"🛤️",en?`Grades 1–${k} in one day`:`Grade 1–${k} an einem Tag`,en?`Climb grades 1–${k} in one day`:`Schaffe Grade 1–${k} an einem Tag`,k,"maxFrom1",p));
  [[4,45],[5,65],[6,90],[7,120]].forEach(([k,p])=>push(L.Straßen,"🛤️",en?`${k} consecutive grades`:`${k} aufein­ander­folgende Grade`,en?`Climb ${k} consecutive grades in one day`:`Schaffe ${k} aufeinanderfolgende Grade`,k,"maxRun",p));

  // MEHRLING
  // Mehrling — Tag (realistisch: selten mehr als 15-18 gleicher Grad in einer Halle)
  [[6,50],[9,90],[13,130],[18,175]].forEach(([k,p])=>push(L.Mehrling,"🎲",en?`${k} of a kind (day)`:`${k}er-Ling (Tag)`,en?`Climb ${k} same-grade routes in one day`:`Schaffe ${k} Routen im selben Grad an einem Tag`,k,"maxOfAKind",p));
  // Mehrling — Woche
  [[25,260],[45,320],[75,390],[120,480],[200,600],[320,750]].forEach(([k,p])=>push(L.Mehrling,"🎲",en?`${k} of a kind (week)`:`${k}er-Ling (Woche)`,en?`Climb ${k} same-grade routes in any 7 days`:`Schaffe ${k} gleicher Grad in 7 Tagen`,k,"maxWeekOfAKind",p));
  // Mehrling — Monat
  [[60,340],[130,440],[250,560],[450,700],[750,900]].forEach(([k,p])=>push(L.Mehrling,"🎲",en?`${k} of a kind (month)`:`${k}er-Ling (Monat)`,en?`Climb ${k} same-grade routes in any 30 days`:`Schaffe ${k} gleicher Grad in 30 Tagen`,k,"maxMonthOfAKind",p));

  // TREUE — Anfänger: 50 Tage nach ~50 Sessions, Pro viel schneller
  [[5,8],[10,14],[20,20],[40,30],[65,42],[95,55],[130,68],[175,85],[230,105],[300,135],[380,168],[480,220],[600,300],[800,360],[1100,430],[1500,520],[2000,640],[2700,800]].forEach(([n,p])=>push(L.Treue,"📅",en?`${n} climbing day${n>1?"s":""}`:`${n} Klettertag${n>1?"e":""}`,en?`Climb on ${n} different days`:`Klettere an ${n} verschiedenen Tagen`,n,"distinctDays",p));

  // AUSDAUER
  [2,3,5,7,10,13,17,22,28,36,44,52,78,104,156,208].forEach(n=>push(L.Ausdauer,"⏳",en?`${n} weeks in a row`:`${n} Wochen in Folge`,en?`At least 1×/week for ${n} weeks`:`Mindestens 1×/Woche für ${n} Wochen`,n,"weekStreak1",pts(n*3)+6));
  [3,5,8,12,16,22,32,52,78,104].forEach(n=>push(L.Ausdauer,"⏳",en?`2×/week · ${n} weeks`:`2×/Woche · ${n} Wochen`,en?`At least 2×/week for ${n} weeks`:`Mindestens 2×/Woche für ${n} Wochen`,n,"weekStreak2",pts(n*5)+10));
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
    [25,en?"Speed Rookie (25 in 1 day) ⏱":"Speed Rookie (25 an 1 Tag) ⏱",
      en?"25 routes in one day — solid session!":"25 Routen an einem Tag — starke Session!",80],
    [35,en?"El Cap Free Solo (35 in 1 day) 🎬":"El Cap Free Solo (35 an 1 Tag) 🎬",
      en?"35 routes in one day — like Alex Honnold's free solo pace":"35 an einem Tag — wie Alex Honnolds Free Solo Tempo",130],
    [48,en?"Ueli Steck – Eiger (48 in 1 day) 💨":"Ueli Steck – Eiger (48 an 1 Tag) 💨",
      en?"48 routes in one day — like Ueli Steck's Eiger record pace":"48 an einem Tag — wie Ueli Stecks Eiger-Rekord Tempo",190],
    [62,en?"Dawn Wall (62 in 1 day) 🌅":"Dawn Wall (62 an 1 Tag) 🌅",
      en?"62 routes in one day — legendary like the Dawn Wall":"62 an einem Tag — legendär wie die Dawn Wall",260],
    [80,en?"Deep Water Solo Mode (80 in 1 day) 🌊":"Deep Water Solo Modus (80 an 1 Tag) 🌊",
      en?"80 routes in one day — no mercy":"80 an einem Tag — gnadenlos",360],
    [100,en?"Project Moonboard (100 in 1 day) 🌙":"Project Moonboard (100 an 1 Tag) 🌙",
      en?"100 routes in one day — you are on another level":"100 an einem Tag — du bist auf einem anderen Level",500],
  ].forEach(([n,name,desc,p])=>push(ZEIT,"⏱",name,desc,n,"maxDayTops",p));

  // SEKTOREN — auf verschiedenen Sektoren/Wänden klettern
  const SEK = en?"Sectors":"Sektoren";
  [[2,en?"Sector Curious":"Sektor-Neugier"],[3,en?"Sector Tour":"Sektor-Tour"],[4,en?"Sector Connoisseur":"Sektor-Kenner"],[5,en?"All Sectors":"Alle Sektoren"]]
    .forEach(([k,nm])=>push(SEK,"🧭",nm,en?`Climb on ${k} different sectors`:`Klettere an ${k} verschiedenen Sektoren`,k,"distinctWalls",30+(k-2)*35));
  // Sektor-Ausdauer: unique (Sektor × Tag) Kombinationen — wächst unbegrenzt
  [[10,en?"Sector Regular":"Sektor-Gast",60],[25,en?"Sector Dweller":"Sektor-Stammgast",90],[60,en?"Sector Devotee":"Sektor-Liebhaber",130],[130,en?"Sector Veteran":"Sektor-Veteran",180],[280,en?"Sector Obsessed":"Sektor-Besessen",240],[550,en?"Sector Legend":"Sektor-Legende",320],[1000,en?"Sector Immortal":"Sektor-Unsterblich",420]]
    .forEach(([k,nm,p])=>push(SEK,"🧭",nm,en?`${k} sector×day combos`:`${k} Sektor-Tage`,k,"totalWallDays",p));

  // GRAD-ENTDECKER — verschiedene Schwierigkeitsgrade insgesamt
  const GE = en?"Grade Explorer":"Grad-Entdecker";
  [[3,en?"3 Grades":"3 Grade"],[5,en?"5 Grades":"5 Grade"],[7,en?"7 Grades":"7 Grade"],[8,en?"All Grades 1–8":"Alle Grade 1–8"]]
    .forEach(([k,nm])=>push(GE,"🪜",nm,en?`Climb ${k} different grades overall`:`Klettere ${k} verschiedene Grade insgesamt`,k,"distinctGrades",35+(k-3)*30));

  // SERIE — Klettertage in Folge (echte Kalendertage)
  const SER = en?"Streak":"Serie";
  [[2,en?"2-Day Streak":"2 Tage in Folge",40],[3,en?"3-Day Streak":"3 Tage in Folge",70],[5,en?"5-Day Streak":"5 Tage in Folge",120],[7,en?"7-Day Streak":"7 Tage in Folge",180],[10,en?"10-Day Streak":"10 Tage in Folge",280],[14,en?"14-Day Streak":"14 Tage in Folge",400],[21,en?"21-Day Streak":"21 Tage in Folge",560]]
    .forEach(([k,nm,p])=>push(SER,"🔂",nm,en?`Climb ${k} calendar days in a row`:`Klettere an ${k} Kalendertagen in Folge`,k,"maxConsecutiveDays",p));

  // PERFEKTER TAG — alle Begehungen eines Tages waren Flashes
  const PT = en?"Flawless":"Makellos";
  [[5,en?"Flawless 5":"Makellos 5"],[8,en?"Flawless 8":"Makellos 8"],[12,en?"Flawless 12":"Makellos 12"],[18,en?"Flawless 18":"Makellos 18"],[25,en?"Flawless 25":"Makellos 25"],[35,en?"Flawless 35":"Makellos 35"]]
    .forEach(([k,nm],i)=>push(PT,"💯",nm,en?`A day where all ${k}+ sends were flashes`:`Ein Tag, an dem alle ${k}+ Begehungen Flashes waren`,k,"bestAllFlashDay",70+i*45));

  // WOCHENEND-KRIEGER — an Wochenend-Tagen klettern
  const WE = en?"Weekend Warrior":"Wochenend-Krieger";
  [[5,en?"Weekend Warrior 5":"Wochenend-Krieger 5"],[15,en?"Weekend Warrior 15":"Wochenend-Krieger 15"],[40,en?"Weekend Warrior 40":"Wochenend-Krieger 40"],[90,en?"Weekend Warrior 90":"Wochenend-Krieger 90"],[150,en?"Weekend Warrior 150":"Wochenend-Krieger 150"],[250,en?"Weekend Warrior 250":"Wochenend-Krieger 250"]]
    .forEach(([k,nm])=>push(WE,"📅",nm,en?`Climb on ${k} weekend days`:`Klettere an ${k} Wochenend-Tagen`,k,"weekendDays",pts(k*4)+20));

  // MACHER — eigene Beiträge zur Community (bewusst KLEINE Punkte: minimaler Level-Einfluss)
  const MK = en?"Contributor":"Community";
  [[1,en?"First Route Set":"Erste Route geschraubt",8],[5,en?"Route Setter":"Routenbauer",10],[15,en?"Active Setter":"Aktiver Schrauber",14],[40,en?"Prolific Setter":"Vielschrauber",18],[80,en?"Master Setter":"Schraub-Meister",24],[150,en?"Route Architect":"Routen-Architekt",30],[300,en?"Setting Legend":"Schraub-Legende",40],[600,en?"Setting Deity":"Schraub-Gottheit",55]]
    .forEach(([k,nm,p])=>push(MK,"🔧",nm,en?`Set ${k} route${k>1?"s":""} for the community`:`Lege ${k} Route${k>1?"n":""} für die Community an`,k,"createdRoutes",p));
  [[5,en?"Photographer":"Fotograf",8],[20,en?"Photo Reporter":"Foto-Reporter",12],[50,en?"Photo Archivist":"Foto-Archivar",18],[120,en?"Photo Legend":"Foto-Legende",28],[250,en?"Photo Deity":"Foto-Gottheit",42]]
    .forEach(([k,nm,p])=>push(MK,"📸",nm,en?`Add ${k} route photos`:`Füge ${k} Routenfotos hinzu`,k,"photosAdded",p));
  [[3,en?"Commentator":"Kommentator",6],[15,en?"Beta Sprayer":"Beta-Geber",10],[40,en?"Tip Master":"Tipp-Meister",16],[100,en?"Beta Legend":"Beta-Legende",26],[220,en?"Beta Deity":"Beta-Gottheit",40]]
    .forEach(([k,nm,p])=>push(MK,"💬",nm,en?`Write ${k} comments`:`Schreibe ${k} Kommentare`,k,"commentsAdded",p));

  return A;
}

const ACH_DE = buildAchievements("de");
const ACH_EN = buildAchievements("en");
function ACHS() { return LANG === "en" ? ACH_EN : ACH_DE; }

/* ── LEVEL-SYSTEM ─────────────────────────────────────────────────────────────
 * 100 kletter-thematische Level. Man steigt auf, indem man Skillpoints (Summe der
 * pts freigeschalteter Achievements) sammelt. Level 100 = quasi alles freigeschaltet.
 * Voll datengetrieben & erweiterbar: Namen in LEVEL_NAMES anpassen/ergänzen,
 * Kurve über LEVEL_CURVE_POWER / LEVEL_TOP_FRACTION justieren.
 */
const LEVEL_NAMES = [
  // 1–10 · Erste Berührungen
  "Chalk Virgin","Gym Tourist","Crash-Pad Napper","Hold Hugger","Tape Reader",
  "Mat Warmer","Slab Stumbler","Jug Tourist","Velcro Climber","Boulder-Curious",
  // 11–20 · Vom Bazillus gepackt
  "Crimp Rookie","Sloper Skeptic","Beta Borrower","Flailing Flapper","Heel-Hook Hopeful",
  "Send Seeker","Pump Apprentice","Gripped Greenhorn","Dyno Dreamer","Mantle Trainee",
  // 21–30 · Stammgast
  "Crux Curious","Flash Hopeful","Topout Trainee","Smear Student","Gaston Greenhorn",
  "Campus Cadet","Volume Voyager","Kneebar Novice","Flagging Freshman","Project Picker",
  // 31–40 · Kann was
  "Crimp Cadet","Sloper Steady","Beta Brewer","Send Striver","Pinch Practitioner",
  "Toe-Hook Tactician","Dyno Doer","Overhang Operator","Pump Pusher","Boulder Believer",
  // 41–50 · Solide
  "Crux Crusher","Flash Finder","Topout Tactician","Compression Climber","Beta Breaker",
  "Heel-Hook Hero","Slab Specialist","Dyno Disciple","Grip Gladiator","Halfway Hardman",
  // 51–60 · Stark
  "Crimp Connoisseur","Sloper Sorcerer","Send Machine","Pinch Professor","Mantle Master",
  "Beta Architect","Overhang Overlord","Flash Fiend","Power Pincher","Project Slayer",
  // 61–70 · Fortgeschritten
  "Crux Conqueror","Dyno Dynamo","Pocket Prodigy","Compression King","Heel-Hook Highness",
  "Beta Whisperer","Sloper Whisperer","Topout Titan","Grip Guru","Boulder Boss",
  // 71–80 · Elite
  "Crimp Crusader","Send Sovereign","Flash Phantom","Dyno Daredevil","Pinch Paragon",
  "Overhang Oracle","Power Prophet","Beta Sage","Project Pharaoh","Crux Czar",
  // 81–90 · Meister
  "Crimp Colossus","Sloper Sage","Send Sensei","Airtime Aristocrat","Mantle Monarch",
  "Flash Phenom","Gravity Negotiator","Friction Wizard","Boulder Baron","Crux Conductor",
  // 91–100 · Legende
  "Send Lord","Crimp Sovereign","Dyno Demigod","Beta Overmind","Gravity Defier",
  "Friction Deity","Boulder Legend","Crux Immortal","The Sender of Senders","Boulder Deity",
];
const TOTAL_SKILLPOINTS = ACH_DE.reduce((s, a) => s + a.pts, 0);
const ACH_COUNT = ACH_DE.length;
/* ── LEVEL-KURVE ──────────────────────────────────────────────────────────────
 * Level = KARRIERE-PUNKTE (Summe ALLER je erkletterten Routen-Punkte, schwierigkeits-
 * gewichtet: jede Route gibt grade*0.25, Flash +Bonus). Warum nicht "Anzahl Erfolge"?
 * Erfolge häufen sich in den ersten 1-2 Sessions (viele leichte Erste-Male: erster
 * Flash, 10 an einem Tag, Mehrling, Sektoren ...) -> ein Anfänger wäre sofort hoch.
 * Punkte wachsen dagegen mit echtem Klettervolumen: gleichmäßig, nicht sprunghaft.
 *   need[2]  = LEVEL_L2_POINTS  (per Konstruktion -> ~1-2 Sessions = Level 2)
 *   need[100]= LEVEL_MAX_POINTS (Level 100 = Meisterschaft, viele Jahre)
 * WACHSENDE Abstände (LEVEL_POWER > 1): jedes Level kostet mehr Punkte als das vorige.
 * Justierbar: LEVEL_L2_POINTS (Start sanfter/härter) · LEVEL_MAX_POINTS (Decke). */
const LEVEL_MAX_POINTS = 60000; // Punkte für Level 100
const LEVEL_L2_POINTS = 35;     // Punkte für Level 2 (~1-2 Sessions)
const LEVEL_POWER = Math.log(LEVEL_MAX_POINTS / LEVEL_L2_POINTS) / Math.log(99); // >1 => wachsende Abstände
function buildLevels() {
  const out = [];
  for (let i = 1; i <= 100; i++) {
    const need = i === 1 ? 0 : Math.round(LEVEL_MAX_POINTS * Math.pow((i - 1) / 99, LEVEL_POWER));
    out.push({ level: i, name: LEVEL_NAMES[i - 1] || ("Level " + i), need });
  }
  return out;
}
const LEVELS = buildLevels();
const LEVEL_MAX_XP = LEVELS[LEVELS.length - 1].need;
// Liefert das aktuelle Level + das nächste (oder null bei Max) für eine Erfolge-Anzahl
function levelFor(xp) {
  const x = xp || 0;
  let cur = LEVELS[0];
  for (const l of LEVELS) { if (x >= l.need) cur = l; else break; }
  const next = LEVELS.find(l => l.need > x) || null;
  return { ...cur, next, max: LEVEL_MAX_XP };
}

// Witziger, motivierender Einzeiler pro Level (passend zum Titel)
// Witziger, ironischer Einzeiler pro Level (Stammtisch-Stil, mit echten Kletterfakten)
const LEVEL_STORIES_DE = [
  "Erstes Magnesia, erste Sucht. Fun Fact: Chalk kommt eigentlich vom Turnen — John Gill schmuggelte es in den 50ern an den Fels. Du bist jetzt offiziell Teil des Problems.",
  "Noch guckst du wie ein Tourist in Fontainebleau — nur ohne Baguette. Keine Sorge: Auch die Pros standen mal ratlos vor ihrem ersten Block.",
  "Das Crashpad ist zum Fallen da, nicht zum Pennen. Aber gut — Pausen sind laut jedem Trainingsplan 'aktive Regeneration'. Reden wir's uns schön.",
  "Du umarmst jeden Griff, als wär's der letzte Henkel auf Erden. Lockerer! Verkrampfen kostet mehr Kraft als der ganze Boulder.",
  "Du liest die Farben wie die Bierkarte am Stammtisch — gründlich. Jetzt noch bestellen, äh, hochklettern.",
  "Du wärmst fleißig die Matte vor. Andere nennen's 'zwischen Versuchen liegen und Beta diskutieren' — auch eine Kunstform.",
  "Auf der Platte gibt's keine Henkel, nur Vertrauen — und du vertraust deinen Füßen noch so weit, wie du sie werfen kannst. Wird besser, versprochen.",
  "Henkel-Sightseeing! Genieß es, solange die Griffe noch nach Griffen aussehen — das ändert sich schneller, als dir lieb ist.",
  "Du klebst an der Wand wie Klett — leider auch mitten in der Bewegung. Aus Festkleben wird bald Fließen.",
  "Neugier geweckt. Warnung vom Stammtisch: Bouldern ist die einzige Sucht, für die dich alle loben, während dein Konto für Schuhe und Tape blutet.",
  "Erste Leisten! Profitipp, den du ignorieren wirst: Sehnen wachsen langsamer als dein Ego — sonst grüßt das A2-Ringband. Trotzdem: oho!",
  "'Da ist doch GAR nichts zum Halten!' Doch — Reibung. Physik schlägt Skepsis, sobald die Hände kühl und der Kopf ruhig sind.",
  "Du leihst dir noch jede Beta aus. Fun Fact: Das Wort 'Beta' kommt angeblich von alten Betamax-Videos. Bald drehst du deine eigenen.",
  "Noch zappelst du wie ein Fisch im Überhang. Eleganz ist nur Gezappel mit besserem Timing — du arbeitest dran.",
  "Erster Hakeneinsatz! Sieht aus wie Yoga im Streit mit der Wand, fühlt sich aber an wie ein Cheatcode.",
  "Du jagst den ersten sauberen Top. 'Send' kommt von 'ascend' — und das Hochgefühl danach kommt von ganz allein. Süchtig machend, das Ding.",
  "Deine Unterarme sind prall wie nach Tag eins im Gym — das ist der berühmte 'Pump'. Tut weh, heißt aber: Es passiert was.",
  "Noch bist du 'gripped' — Klettersprech für 'die Höhe macht mir die Hosen voll'. Mut ist eine Bewegung, die man üben kann. Atme.",
  "Du träumst vom großen Sprung. Im modernen Wettkampf sind 'Coordination Dynos' fast Parkour an der Wand — fang klein an, träum groß.",
  "Der Aufzug auf den Block — der Moment, in dem jeder kurz aussieht wie ein Seehund, der aufs Boot robbt. Würde kommt mit Übung.",
  "Der 'Crux', die Schlüsselstelle, reizt dich. Genau da trennt sich Henkel von Held — und genau da macht's am meisten Spaß.",
  "Du willst den Flash: erster Versuch, aber mit Beta im Kopf. (Ohne Beta heißt's Onsight — eine andere Liga.) Plan schmieden, durchziehen!",
  "Oben drüberklettern statt abspringen — das echte Bouldern. Kinn hoch, Hintern hoch, Stolz noch höher.",
  "Du lernst Smearing: dem Schuh auf glattem Fels vertrauen, obwohl da kein Tritt ist. Reibung ist Glaube — und Vibram-Gummi hilft auch.",
  "Erster Gaston — der Griff, der nach außen drückt und sich falsch anfühlt. Benannt nach Bergsteiger Gaston Rébuffat. Falsch fühlt sich oft goldrichtig an.",
  "Campus-Board-Fieber. Fun Fact: Wolfgang Güllich erfand das Ding für 'Action Directe' (erste 9a, im Frankenjura!). Aber Achtung, Padawan — deine Sehnen sind noch keine Stahlseile.",
  "Du entdeckst die dicken Volumen. Riesig, rund, rutschig — wie Stammtisch-Geschichten, nur zum Draufstehen.",
  "Erstes Knie eingeklemmt — und plötzlich hast du eine Hand frei für, sagen wir, eine dramatische Geste. Der Kneebar: der Liegestuhl unter den Klettertricks.",
  "Du lernst Flaggen: ein Bein als Gegengewicht raushängen. Sieht elegant aus und verhindert das peinliche Wegdrehen von der Wand. Win-win.",
  "Erstes echtes Projekt gewählt! Ein 'Projekt' ist ein Boulder, der dich über Wochen zur Verzweiflung treibt — und den du trotzdem liebst. Klingt toxisch, ist Klettern.",
  "Leisten sind nicht mehr der Feind. Kleine Griffe, große Egos — pass nur weiter auf die Ringbänder auf.",
  "Sloper machen dich nicht mehr zum Affen. Geheimtipp: kühle Halle, trockene Hände — 'gute Bedingungen' sind keine Ausrede, sondern Physik.",
  "Du braust deine eigene Beta. Bald gibst du am Stammtisch ungefragt Tipps — willkommen im Klub der 'Beta-Sprayer'.",
  "Jeder Top sitzt sauberer. Du bist im 'Send-Train' — der Zug, der nur eine Richtung kennt: nach oben.",
  "Zangengriffe? Kein Drama mehr. Deine Hände sind langsam mehr Schraubstock als Hand.",
  "Der Zehenhaken wird Taktik. Wer hätte gedacht, dass man mit dem Fuß ziehen kann wie mit der Hand? Bouldern ist Schach mit Muskelkater.",
  "Aus dem Traum wurde der Sprung — du fliegst und fängst dich. Kurz fühlst du dich wie im Finale. Genieß den Applaus in deinem Kopf.",
  "Das Dach jagt dir keine Angst mehr ein. Überhang ist jetzt Spielplatz — Schwerkraft, wir müssen reden.",
  "Du kletterst durch den Pump, statt vorher abzusteigen. Mentale Stärke heißt: dem brennenden Unterarm 'gleich, gleich' zuflüstern und weitermachen.",
  "Du glaubst an dich an der Wand. Und der Glaube versetzt — nun ja — Boulder. (Berge macht das Seilklettern.)",
  "Schlüsselstellen knackst du jetzt mit Köpfchen statt Kraft. Der Crux hat angefangen, dich zu fürchten.",
  "Du flasht, was andere dreimal angucken müssen. Auge, Mut, Ausführung — fast schon unfair.",
  "Topouts sind Routine. Oben grinst du in die Halle wie jemand, der gerade vergessen hat, wie's unten aussah.",
  "Kompression — den Boulder regelrecht zusammenquetschen, bis er nachgibt. Kraft trifft Körperspannung trifft Sturheit.",
  "Du brichst die Standard-Beta und findest deinen eigenen Weg. Am Stammtisch heißt das 'Rebell', der Routenbauer nennt es 'nicht so gemeint'.",
  "Deine Hacke rettet jede verzweifelte Lage. Held der hässlichen, aber effektiven Züge — Stil ist überbewertet, Tops zählen.",
  "Auf der Platte tanzt du Ballett. Fun Fact: Genau die Wand ohne Griffe macht dem stärksten Kraftkletterer weiche Knie. Dir nicht mehr.",
  "Sprünge sind deine Religion. Schwerkraft? Nur ein Vorschlag, den du höflich ablehnst.",
  "Deine Griffkraft ist gefürchtet. In der Arena der Wand hörst du innerlich schon das Kolosseum jubeln.",
  "Halbzeit, harter Hund! Die Hälfte des Bergs liegt hinter dir. Wie Messner sagen würde: Der Gipfel ist optional, das Weitermachen nicht. (Hat er nie gesagt, klingt aber gut.)",
  "Du genießt Leisten wie ein Sommelier den Wein: kurz prüfen, andächtig zugreifen, nicht verschütten. Feinste Fingerarbeit.",
  "Sloper gehorchen dir wie verzaubert. Dabei ist's nur Reibung, Hautkontakt und eiserne Nerven — aber 'Magier' klingt besser.",
  "Top um Top, du läufst wie geölt. Ueli Steck hieß 'Swiss Machine' — du bist die Hallenversion. Respekt.",
  "Du dozierst über Zangengriffe, während du sie hältst. Lehrstuhl für angewandte Fingerkraft — verdient.",
  "Jeder Aufzug sitzt. Kein Seehund-Gerobbe mehr — du gleitest über die Kante wie über deine eigene Türschwelle.",
  "Du baust Beta wie ein Architekt Kathedralen: jede Bewegung tragend, nichts überflüssig. Andere stehen ratlos, du hast schon den Bauplan.",
  "Im Überhang herrschst du wie ein Fürst. Das Dach ist dein Thronsaal, die Schwerkraft dein murrender Untertan.",
  "Du flasht wie besessen. Adam Ondra flasht 9a, du flasht den halben Plan der Halle — Maßstäbe sind relativ, der Spaß ist absolut.",
  "Deine Zangenkraft sprengt Skalen. In deiner Hand sieht selbst ein Sloper aus wie ein Henkel.",
  "Projekte fallen reihenweise. Was dich letzte Woche zur Weißglut trieb, machst du heute zum Aufwärmen. Frechheit siegt.",
  "Keine Schlüsselstelle hält dich auf. Du eroberst, wo andere 'das geht eh nicht' murmeln und zum nächsten Boulder schleichen.",
  "Du explodierst an die Griffe wie ein gut gelaunter Flummi. Energie ohne Ende — Dynamo eben.",
  "Löcher und Taschen sind dein Spielzeug. Güllichs 'Action Directe' lebt von Einfinger-Löchern — du nickst wissend und steckst zwei Finger rein, du Angeber.",
  "Du regierst die Kompression. Pressen, halten, hochziehen — der Boulder ergibt sich, bevor du überhaupt schwitzt.",
  "Deine Hacke ist von königlicher Eleganz. Eine Verbeugung — aber vorsichtig, sonst rutscht die Krone.",
  "Du flüsterst der Wand ihre Geheimnisse ab. Sie verrät dir alles — andere stehen daneben und hören nur Schweigen.",
  "Sloper flüstern dir zu, wie man sie hält. Reibung und du — eine Freundschaft, die kein Anfänger versteht.",
  "Kein Ausstieg ist dir zu wild, kein Highball zu hoch. Titan über allen Blöcken — der Boden ist nur eine Empfehlung.",
  "Andere pilgern zu dir, um Griffkraft zu lernen. Guru der Finger — dein Händedruck allein ist schon eine Drohung.",
  "Du führst die Halle an. Wo du kletterst, schaut man hin — und tut so, als hätte man nicht geschaut. Boss.",
  "Auf deinem Kreuzzug fällt jede Leiste. Nichts ist zu klein — du würdest auf einer Briefmarke stehen, wenn man dich ließe.",
  "Tops sind dein Königreich. Du herrschst über jeden Boulder, und die Skala verbeugt sich.",
  "Du flasht so lautlos und sicher, dass es fast unheimlich ist. Phantom der Wand — kurz da, oben weg, niemand weiß wie.",
  "Wahnwitzige Sprünge sind dein Markenzeichen. Mut wie ein Stuntman — Honnolds Angstzentrum soll ja kaum anspringen; deins hat wohl auch frei.",
  "Du bist das Vorbild für Zangenkraft schlechthin. Hände aus Stahl, Unterarme aus Schiffstau.",
  "Du liest Überhänge wie ein Orakel die Zukunft. Jeden Zug vorausgesehen — der Boulder hat keine Geheimnisse mehr, nur noch Termine.",
  "Du verkündest die Macht der rohen Kraft — und lebst sie vor. Prophet der Power, dem selbst die Skala glaubt.",
  "Deine Bewegungsweisheit ist legendär. Du erkennst einen 'Sandbag' (untertrieben bewerteter Boulder), bevor du ihn anfasst. Weiser der Wand.",
  "Selbst pyramidenschwere Projekte beugen sich dir. Pharao der Boulder — die Halle baut dir im Geiste schon ein Denkmal.",
  "Du herrschst über jede Schlüsselstelle mit eiserner Hand. Zar des Crux — Widerworte werden nicht geduldet, schon gar nicht von der Wand.",
  "Auf winzigsten Leisten stehst du wie ein Koloss. Die Physik schaut zu und macht sich Notizen.",
  "Du hast die Kunst der Sloper vollendet. Wo andere abrutschen, klebst du — nicht mit Magie, mit Meisterschaft (okay, ein bisschen Magie).",
  "Du lehrst das Senden wie ein Sensei das Schwert. Schüler verbeugen sich, Boulder ergeben sich.",
  "In der Luft bist du von edler Eleganz. Während andere springen, schwebst du — Adel der Flugphase.",
  "Über jeden Block krönst du dich selbst. Monarch des Aufzugs — der Topout ist deine Krönungszeremonie, jedes Mal.",
  "Dein Flash-Talent ist ein Phänomen. Janja Garnbret fällt im Wettkampf fast nie — du gehörst zur selben seltenen Spezies, nur mit Feierabendbier.",
  "Du verhandelst mit der Schwerkraft — und gewinnst meistens. Diplomat der Lüfte; selbst Newton würde nervös.",
  "Reibung gehorcht deinem Zauberstab. Du weißt: 5 Grad kälter = ein Grad leichter. Wo nichts hält, hältst du.",
  "Dein Revier ist die ganze Halle. Baron mit Krone aus Chalk — selbst die Routenbauer fragen dich (heimlich) um Rat.",
  "Du dirigierst Schlüsselstellen wie ein Orchester. Jeder Zug ein Satz, der Topout das Finale — Standing Ovations inklusive.",
  "Tops verbeugen sich vor dir. Lord über alle Boulder — die Skala fragt höflich, ob's noch eine Nummer höher sein darf.",
  "Selbst Rasierklingen-Leisten sind dein Untertan. Souverän der Fingerkraft — Haut ist Verhandlungssache.",
  "Deine Sprünge trotzen der Physik. Irgendwo da oben warten die V17er — und sie ahnen, dass du kommst.",
  "Du durchschaust jede Bewegung, bevor sie passiert. Übergeist der Wand — der Boulder ist gelöst, kaum dass er gebaut ist.",
  "Die Schwerkraft hat aufgegeben, dich aufzuhalten. Honnold soloierte den El Cap ohne Seil — du soloierst die Skala ohne Limit.",
  "Reibung betet dich an. Gottheit auf glattem Fels — wo Physik passt, gehst du einfach drüber.",
  "Dein Name fällt in jeder Hallen-Legende, von Fontainebleau bis Frankenjura. Lebende Legende — Geschichten über dich brauchen keine Beweise mehr.",
  "Keine Schlüsselstelle besiegt dich je wieder. Unsterblich — der Crux hat resigniert und bietet dir einen Kaffee an.",
  "Du sendest, was andere für unmöglich halten. Der Sender aller Sender — selbst die V17er flüstern deinen Namen.",
  "Gipfel erreicht: Boulder-Gottheit. Von John Gills erstem Chalk bis 'Burden of Dreams' (dem ersten V17!) — die ganze Geschichte des Boulderns gipfelt in dir. Nichts mehr zu beweisen, nur noch zu genießen. Respekt!",
];
const LEVEL_STORIES_EN = [
  "First chalk on the fingers. Fun fact: the stuff comes from gymnastics — John Gill smuggled it onto rock in the '50s. You're officially part of the problem now.",
  "Still gawking like a tourist in Fontainebleau — minus the baguette. Relax: the pros once stood clueless at their first block too.",
  "The crash pad is for falling, not napping. But hey — every training plan calls lying around 'active recovery.' Let's go with that.",
  "You hug every hold like it's the last jug on Earth. Loosen up! Over-gripping burns more juice than the whole boulder.",
  "You read the holds like the beer menu at the pub — thoroughly. Now order one. I mean, climb it.",
  "You're diligently warming the mat. Others call it 'lying between attempts debating beta' — also an art form.",
  "On the slab there are no jugs, only trust — and you trust your feet about as far as you can throw them. It gets better, promise.",
  "Jug sightseeing! Enjoy it while the holds still look like holds — that changes faster than you'd like.",
  "You stick to the wall like Velcro — sadly mid-move too. Sticking becomes flowing soon enough.",
  "Curiosity sparked. Warning from the pub table: bouldering is the only addiction everyone praises you for, while your bank account bleeds for shoes and tape.",
  "First crimps! Pro tip you'll ignore: tendons grow slower than your ego — or the A2 pulley says hi. Still: nice one.",
  "'There's NOTHING to hold!' There is — friction. Physics beats skepticism the moment your hands are cool and your head is calm.",
  "You still borrow every beta. Fun fact: the word 'beta' supposedly comes from old Betamax tapes. Soon you'll film your own.",
  "You still flail like a fish in the overhang. Elegance is just flailing with better timing — you're working on it.",
  "First heel hook! Looks like yoga arguing with the wall, feels like a cheat code.",
  "You're chasing your first clean send. 'Send' comes from 'ascend' — and the high afterward comes all by itself. Addictive little thing.",
  "Your forearms are swollen like after day one — that's the famous 'pump.' Hurts, but it means something's happening.",
  "You're still 'gripped' — climber-speak for 'the height is scaring the pants off me.' Courage is a move you can practice. Breathe.",
  "You dream of the big leap. In modern comps, coordination dynos are basically parkour on the wall — start small, dream big.",
  "The mantle onto the block — the moment everyone briefly looks like a seal flopping onto a boat. Dignity comes with practice.",
  "The crux, the key move, intrigues you. That's where jugs separate from heroes — and where the fun peaks.",
  "You want the flash: first try, but with beta in your head. (Without beta it's an onsight — another league.) Make a plan, send it!",
  "Climbing over the top instead of jumping off — real bouldering. Chin up, hips up, pride even higher.",
  "You're learning to smear: trusting the shoe on blank rock with no foothold. Friction is faith — and Vibram rubber helps too.",
  "First gaston — the hold you push outward that feels all wrong. Named after alpinist Gaston Rébuffat. Wrong often feels exactly right.",
  "Campus board fever. Fun fact: Wolfgang Güllich invented it for 'Action Directe' (first 9a, in Germany's Frankenjura!). But careful, padawan — your tendons aren't steel cables yet.",
  "You're discovering the big volumes. Huge, round, slippery — like pub-table stories, only you can stand on these.",
  "First knee bar locked in — suddenly a free hand for, say, a dramatic gesture. The kneebar: the deck chair of climbing tricks.",
  "You're learning to flag: hanging a leg out as counterweight. Looks elegant, prevents the embarrassing spin off the wall. Win-win.",
  "First real project picked! A 'project' is a boulder that drives you mad for weeks — and you love it anyway. Sounds toxic, it's just climbing.",
  "Crimps aren't the enemy anymore. Small holds, big egos — just keep minding those pulleys.",
  "Slopers no longer make a monkey of you. Insider tip: cool gym, dry hands — 'good conditions' aren't an excuse, they're physics.",
  "You brew your own beta. Soon you'll give unsolicited tips at the pub — welcome to the club of 'beta sprayers.'",
  "Every send lands cleaner. You're on the 'send train' — the one that only goes one way: up.",
  "Pinches? No drama anymore. Your hands are slowly more vise than hand.",
  "The toe hook becomes tactics. Who knew you could pull with a foot like a hand? Bouldering is chess with a side of muscle ache.",
  "The dream became the leap — you fly and you stick it. For a second you feel like the comp finals. Enjoy the applause in your head.",
  "The roof doesn't scare you anymore. Overhang is your playground now — gravity, we need to talk.",
  "You climb through the pump instead of bailing first. Mental strength means whispering 'almost, almost' to a burning forearm and carrying on.",
  "You believe in yourself on the wall. And belief moves — well — boulders. (Mountains are the rope climbers' department.)",
  "You crack cruxes with your head, not just muscle. The crux has started to fear you.",
  "You flash what others have to study three times. Eye, nerve, execution — almost unfair.",
  "Topouts are routine. Up top you grin across the gym like someone who just forgot what 'down there' looked like.",
  "Compression — literally squeezing the boulder until it gives. Power meets body tension meets stubbornness.",
  "You break the standard beta and find your own way. The pub calls it 'rebel'; the setter calls it 'not what I intended.'",
  "Your heel saves every desperate position. Hero of the ugly-but-effective moves — style's overrated, tops count.",
  "On the slab you dance ballet. Fun fact: the gripless wall is exactly what gives the strongest power-climbers weak knees. Not you anymore.",
  "Dynos are your religion. Gravity? Just a suggestion you politely decline.",
  "Your grip strength is feared. In the arena of the wall you can already hear the Colosseum roar.",
  "Halfway, hard one! Half the mountain's behind you. As Messner might say: the summit is optional, the not-quitting isn't. (He never said it, but it sounds good.)",
  "You savor crimps like a sommelier savors wine: inspect briefly, grip reverently, don't spill. Finest fingerwork.",
  "Slopers obey you as if enchanted. It's only friction, skin contact and iron nerves — but 'wizard' sounds better.",
  "Send after send, you run like clockwork. Ueli Steck was the 'Swiss Machine' — you're the gym edition. Respect.",
  "You lecture on pinches while holding them. A professorship in applied finger strength — earned.",
  "Every mantle lands. No more seal-flopping — you glide over the lip like your own doorstep.",
  "You build beta like an architect builds cathedrals: every move load-bearing, nothing wasted. Others stand clueless; you've got the blueprint.",
  "In the overhang you reign like a lord. The roof is your throne room, gravity your grumbling subject.",
  "You flash like you're possessed. Adam Ondra flashes 9a, you flash half the setting in the gym — scales are relative, the fun is absolute.",
  "Your pinch strength breaks the scale. In your hand even a sloper looks like a jug.",
  "Projects fall in rows. What drove you mad last week is today's warm-up. Cheek wins.",
  "No crux stops you. You conquer where others mutter 'that's impossible anyway' and sneak to the next boulder.",
  "You explode onto the holds like a cheerful bouncy ball. Endless energy — a dynamo indeed.",
  "Pockets are your toys. Güllich's 'Action Directe' runs on one-finger monos — you nod knowingly and stuff in two, show-off.",
  "You rule compression. Squeeze, hold, pull — the boulder surrenders before you even sweat.",
  "Your heel hook has royal elegance. A bow — but carefully, or the crown slips.",
  "You whisper the wall's secrets out of it. It tells you everything — others stand by hearing only silence.",
  "Slopers whisper how to hold them. Friction and you — a friendship no beginner understands.",
  "No topout too wild, no highball too tall. Titan above all blocks — the ground is merely a suggestion.",
  "Others pilgrimage to you to learn grip. Guru of fingers — your handshake alone is a threat.",
  "You lead the gym. Where you climb, all eyes follow — and pretend they didn't. Boss.",
  "On your crusade every crimp falls. Nothing's too small — you'd stand on a postage stamp if they let you.",
  "Tops are your kingdom. You reign over every boulder, and the scale bows.",
  "You flash so silently and surely it's almost eerie. Phantom of the wall — there for a blink, gone at the top, nobody knows how.",
  "Insane leaps are your trademark. Nerve like a stuntman — Honnold's fear center barely fires; yours seems to have the day off too.",
  "You're the very model of pinch strength. Hands of steel, forearms of ship's rope.",
  "You read overhangs like an oracle reads the future. Every move foreseen — the boulder has no secrets left, only appointments.",
  "You preach the power of raw strength — and live it. Prophet of power, believed even by the scale.",
  "Your movement wisdom is legendary. You spot a sandbag (an under-graded boulder) before you even touch it. Sage of the wall.",
  "Even pyramid-heavy projects bow to you. Pharaoh of boulders — the gym is already building you a monument in its mind.",
  "You rule every crux with an iron hand. Czar of the crux — backtalk is not tolerated, least of all from the wall.",
  "On the tiniest crimps you stand like a colossus. Physics watches and takes notes.",
  "You've perfected the art of slopers. Where others slide off, you stick — not by magic, by mastery (okay, a little magic).",
  "You teach sending like a sensei teaches the sword. Students bow, boulders surrender.",
  "In the air you're of noble elegance. While others jump, you float — aristocrat of the flight phase.",
  "Over every block you crown yourself. Monarch of the mantle — the topout is your coronation, every single time.",
  "Your flash talent is a phenomenon. Janja Garnbret almost never falls in comps — you're the same rare species, just with an after-work beer.",
  "You negotiate with gravity — and usually win. Diplomat of the air; even Newton would get nervous.",
  "Friction obeys your wand. You know: 5 degrees cooler equals one grade easier. Where nothing holds, you hold.",
  "Your domain is the whole gym. Baron with a crown of chalk — even the setters (secretly) ask your advice.",
  "You conduct cruxes like an orchestra. Every move a movement, the topout the finale — standing ovations included.",
  "Tops bow to you. Lord over all boulders — the scale politely asks if you'd like one number harder.",
  "Even razor-blade crimps are your subjects. Sovereign of finger strength — skin is negotiable.",
  "Your dynos defy physics. Somewhere up there the V17s are waiting — and they sense you're coming.",
  "You see through every move before it happens. Overmind of the wall — the boulder is solved the moment it's set.",
  "Gravity has given up stopping you. Honnold soloed El Cap with no rope — you solo the scale with no limit.",
  "Friction worships you. Deity on blank rock — where physics gives, you simply walk over.",
  "Your name is in every gym legend, from Fontainebleau to Frankenjura. Living legend — stories about you no longer need proof.",
  "No crux ever beats you again. Immortal — the crux has resigned and offers you a coffee.",
  "You send what others call impossible. The sender of senders — even the V17s whisper your name.",
  "Summit reached: Boulder Deity. From John Gill's first chalk to 'Burden of Dreams' (the first V17!) — the whole history of bouldering peaks in you. Nothing left to prove, only to enjoy. Respect!",
];
function levelStory(level) {
  const arr = LANG === "en" ? LEVEL_STORIES_EN : LEVEL_STORIES_DE;
  return arr[level - 1] || (LANG === "en" ? "New level reached — keep crushing!" : "Neues Level erreicht — weiter so!");
}

// ── Boulder-Wissen: kleine Belohnung beim Freischalten von Erfolgen ─────────
const CLIMB_FACTS_DE = [
  "Der Name „Bouldern“ kommt vom englischen „boulder“ (Felsblock). Die Wiege des Sports liegt in Fontainebleau bei Paris — dort trainieren Kletterer schon seit über 120 Jahren an den Sandsteinblöcken.",
  "Chalk ist Magnesiumcarbonat und wurde in den 1950ern vom US-Turner John Gill ins Klettern gebracht — er gilt als Vater des modernen Boulderns.",
  "„Beta“ (Infos zur Lösung eines Boulders) kommt von Betamax-Videokassetten: Kletterer Jack Mileski filmte in den 80ern Routen und teilte die Aufnahmen.",
  "Ein „Flash“ ist eine Begehung im ersten Versuch MIT Vorwissen. Kletterst du eine Route im ersten Versuch ganz ohne Infos, heißt das „Onsight“.",
  "Boulderprobleme heißen „Probleme“, weil sie wie Rätsel gelöst werden — oft ist der Kopf wichtiger als die Kraft.",
  "Die V-Skala für Bouldergrade ist nach John „Vermin“ Sherman benannt, der in Hueco Tanks (Texas) hunderte Boulder erschloss.",
  "Crashpads sind erst seit den 1990ern verbreitet. Davor boulderte man über Grasbüscheln, Sand — oder gar nichts.",
  "Wolfgang Güllich erfand für „Action Directe“ (1991, erste 9a der Welt) das Campusboard-Training. Das Original-Board hing im „Campus Centre“ in Nürnberg.",
  "Der Rekord im Speedklettern liegt unter 5 Sekunden — für eine 15 Meter hohe, weltweit genormte Route. Das sind über 3 Meter pro Sekunde, senkrecht!",
  "Adam Ondras „Silence“ in der Flatanger-Höhle (Norwegen) war 2017 die erste 9c der Welt — bis heute eine der schwersten Routen überhaupt.",
  "Lynn Hill kletterte 1993 als erster Mensch die legendäre „Nose“ am El Capitan frei — und sagte danach: „It goes, boys!“",
  "Alex Honnold kletterte 2017 den fast 1000 Meter hohen El Capitan komplett ohne Seil. Der Film darüber, „Free Solo“, gewann einen Oscar.",
  "„Freiklettern“ heißt NICHT ohne Seil: Es bedeutet nur, dass das Seil ausschließlich zur Sicherung dient — nicht zum Fortbewegen. Ohne Seil heißt „Free Solo“.",
  "Kalter Fels bedeutet mehr Reibung: Deshalb sprechen Kletterer von „guten Bedingungen“ oder „Sending Temps“, wenn es kühl und trocken ist.",
  "Sandstein saugt Wasser wie ein Schwamm: Nach Regen ist er brüchig — deshalb gilt: mindestens 24–48 Stunden warten, sonst brechen Griffe ab.",
  "Im Elbsandsteingebirge wird seit über 150 Jahren geklettert — mit strengen Regeln: Chalk und Metallsicherungen sind dort teils bis heute verboten.",
  "Der „Mantle“ (Aufstemmen auf einen Absatz) ist nach dem englischen Wort für Kaminsims benannt — die Bewegung ähnelt dem Hochdrücken auf einen Sims.",
  "Ein „Dyno“ ist ein Sprungzug, bei dem du kurz komplett in der Luft bist. Der Moment ohne Kontakt heißt „Deadpoint“ — dort ist dein Körper schwerelos.",
  "Griffarten im Überblick: Leiste (crimp), Sloper (abgerundet), Zange (pinch), Loch (pocket) und Henkel (jug) — jeder fordert andere Muskeln.",
  "Der „Pump“ in den Unterarmen entsteht, wenn die Muskeln mehr Blut brauchen, als durchfließen kann — kurzes Ausschütteln hilft mehr als Weiterkrallen.",
  "Sehnen und Bänder passen sich viel langsamer an als Muskeln — deshalb sind Aufwärmen und Geduld der beste Schutz vor Fingerverletzungen.",
  "Die Ringbänder (z.B. A2) halten deine Beugesehnen am Fingerknochen. Das „Plopp“ bei Überlastung kennt jeder Kletterer vom Hörensagen — aufwärmen!",
  "Antagonistentraining (Liegestütze, Schulterübungen) beugt Verletzungen vor: Klettern trainiert fast nur die Zugmuskulatur.",
  "Kletterschuhe sind absichtlich eng und vorgespannt („downturned“), damit die Zehenkraft direkt auf kleinste Tritte übertragen wird.",
  "Der moderne Reibungsgummi wurde 1979 mit dem Boreal Firé eingeführt — davor kletterte man auf harten Sohlen mit einem Bruchteil des Grips.",
  "„Sandbagging“ nennt man es, wenn eine Route deutlich schwerer ist als angegeben. Jede Halle hat mindestens einen berüchtigten Sandbag …",
  "Hautpflege ist Training: Profis feilen ihre Schwielen glatt und cremen abends — rissige Haut kostet Reibung und damit Grade.",
  "Das MoonBoard (von Ben Moon) war das erste weltweit genormte Trainingsboard: Gleiche Griffe, gleiche Winkel — deine Benchmark gilt überall.",
  "Ben Moons „Hubble“ (1990) gilt rückblickend als womöglich erste 9a der Geschichte — damals noch als 8c+ eingestuft.",
  "Klettern war 2021 in Tokio erstmals olympisch. Janja Garnbret holte Gold — und verteidigte es 2024 in Paris.",
  "Ashima Shiraishi kletterte mit 14 Jahren als jüngste Person einen Boulder im Grad V15 — viele Profis erreichen den nie.",
  "Angela Eiter kletterte 2017 als erste Frau eine 9b („La Planta de Shiva“) — die Österreicherin begann als Wettkampfkletterin.",
  "Nalle Hukkataivals „Burden of Dreams“ (2016, Finnland) war der erste Boulder mit Grad 9A (V17) — 5 Züge, jahrelange Arbeit.",
  "„Highballs“ sind Boulder ab etwa 5 Metern Höhe — die Grenze zum Free Solo ist fließend, Fallen verboten.",
  "Auf Platten (senkrecht oder flacher) zählt fast nur Fußtechnik und Reibung — Kraft hilft dort erstaunlich wenig.",
  "Granit bietet Reibung und Risse, Kalkstein Löcher und Sinter, Sandstein Sloper und Dachkanten — jedes Gestein klettert sich anders.",
  "Die Boulderhallen-Welle: Seit den 2010ern boomen seillose Hallen weltweit — Bouldern ist der am schnellsten wachsende Klettersport.",
  "Beim „Toprope“ hängt das Seil schon oben — ideal zum Lernen. Im „Vorstieg“ clippst du selbst, Stürze werden dadurch länger (und lehrreicher).",
  "Der Begriff „Crux“ bezeichnet die Schlüsselstelle einer Route — den schwersten Einzelabschnitt. Manche Routen haben auch zwei …",
  "„Send“ kommt vom US-Slang „to send it“ — eine Route erfolgreich und sturzfrei durchsteigen. Danach: „Sent!“",
  "Kletterer „lesen“ Routen vor dem Einstieg: Wer die Zugfolge visualisiert, spart Kraft und Versuche — Profis üben das wie eine eigene Disziplin.",
  "Ruhetage machen stärker: Muskeln, Sehnen und Haut wachsen in der Pause, nicht beim Training. Zwei Boulder-Tage hintereinander? Gern. Fünf? Autsch.",
  "Fontainebleau bewertet mit Farben und Zahlen (die Fb-Skala) — deine Hallen-Grade 1–8 sind an genau diese Tradition angelehnt.",
  "Der höchste künstliche Kletterturm der Welt ist über 30 m hoch — aber die meisten Weltklasse-Boulder sind unter 5 m. Schwer heißt nicht hoch.",
  "Der Speed-Weltrekord der Männer liegt bei 4,64 Sekunden — aufgestellt von Sam Watson (USA) beim Weltcup 2025 auf Bali. Bei den Frauen hält Aleksandra Mirosław 6,06 s aus Paris 2024.",
  "Aleksandra Mirosław brach den Speed-Weltrekord am 28. April 2023 viermal — an einem einzigen Tag.",
  "Die Speed-Wand ist seit 2007 weltweit exakt gleich: 15 Meter, 5 Grad überhängend, 20 Handgriffe, 11 Tritte. Die Route selbst ist nur etwa 6b — Alex Honnold brauchte 22,3 Sekunden, Profis unter 5.",
  "Wie beim 100-Meter-Sprint gilt im Speedklettern: Wer schneller als 0,1 Sekunden nach dem Startsignal loszieht, hat einen Fehlstart — schnellere Reaktionen gelten als menschlich unmöglich.",
  "In Paris 2024 gab es erstmals zwei Kletter-Goldmedaillen pro Geschlecht: Boulder&Lead und Speed getrennt. Die Boulder&Lead-Golds holten Toby Roberts und Janja Garnbret.",
  "„Burden of Dreams“ ist nur 4 Meter hoch und hat 8 Züge — Nalle Hukkataival brauchte trotzdem rund 4.000 Versuche über vier Jahre für die Erstbegehung.",
  "Will Bosi trainierte für „Burden of Dreams“ an 3D-gedruckten Kopien der Original-Griffe in England — die Wiederholung am echten Fels dauerte dann 52 Sekunden.",
  "Wäre die 45-Grad-Wand von „Burden of Dreams“ senkrecht, läge der Boulder schätzungsweise nur noch bei Grad 5+ — Steilheit ist ein gewaltiger Schwierigkeitsfaktor.",
  "2025 war das Rekordjahr des Boulderns: 16 Begehungen im Grad 9A (V17) — und im November schlug Elias Iagnemma mit „Exodia“ in Italien den ersten 9A+ (V18) der Geschichte vor.",
  "Jakob Schubert (Österreich) ist der erste Mensch, der sowohl einen 9A-Boulder als auch eine 9c-Route geklettert ist.",
  "Der Begriff „Rotpunkt“ stammt von Kurt Albert: In den 1970ern malte er im Frankenjura rote Punkte an frei geklettere Routen — daraus wurde das internationale „Redpoint“.",
  "Das Frankenjura in Bayern hat eine der höchsten Dichten an schweren Sportkletterrouten weltweit — und ist Heimat von „Action Directe“.",
  "Der „Gaston“-Griff (mit dem Daumen nach unten vom Körper wegdrücken) ist nach dem französischen Bergführer Gaston Rébuffat benannt.",
  "Eindrehen spart Kraft: Hüfte zur Wand und Knie nach innen bringt die Schulter näher an den Griff — plötzlich erreichst du Züge, die frontal unmöglich wirken.",
  "Ein „Heel Hook“ macht deine Ferse zur dritten Hand — richtig eingesetzt entlastet er die Arme mehr als jeder Muskel.",
  "„Campusen“ heißt Klettern ganz ohne Füße — als Training extrem effektiv, für die Finger aber nur mit viel Erfahrung zu empfehlen.",
  "Ein „Kneebar“ (verklemmtes Knie) kann komplette Ruhepositionen ohne Hände schaffen — Profis planen ganze Routen um solche Rests herum.",
  "Der „Sit-Start“ (assis) macht einen Boulder oft ein bis zwei Grade schwerer — „Return of the Sleepwalker“ (V17) ist nichts anderes als der Sitzstart von „Sleepwalker“ (V16).",
  "„Morpho“ nennt man Züge, die stark von der Körpergröße abhängen — derselbe Boulder kann für zwei Menschen völlig verschieden schwer sein.",
  "Ein „Beta-Break“ ist die Entdeckung einer leichteren Lösung — er kann den Grad einer etablierten Route über Nacht senken.",
  "„Dab“: Berührst du beim Bouldern Matte, Spotter oder Nachbarfels, zählt der Versuch streng genommen nicht — die Community nimmt das erstaunlich ernst.",
  "Beim Outdoor-Bouldern fängt der Spotter den Fallenden nicht — er lenkt ihn nur so, dass er sicher auf der Matte landet.",
  "Die ersten Kletterschuhe mit Gummisohle entwickelte Pierre Allain in den 1940ern — für die Boulder von Fontainebleau. Seine „PA“-Schuhe waren jahrzehntelang Standard.",
  "In Fontainebleau führten schon in den 1940ern farbige Pfeil-Circuits durch die Wälder — nummerierte Boulderrunden mit bis zu 50 Problemen am Stück.",
  "In Fontainebleau wurde traditionell „Pof“ benutzt — Kolophonium-Säckchen statt Chalk. Heute ist es verpönt, weil es die Griffe glasig poliert.",
  "Griffe bürsten ist Kletter-Etikette: Chalk-Schichten füllen die Struktur und kosten Reibung — eine saubere Leiste greift sich einen halben Grad leichter.",
  "Boulderhallen waschen ihre Griffe regelmäßig in Spülmaschinen oder mit Hochdruck — Chalk und Schuhgummi verstopfen sonst jede Struktur.",
  "Moderne Griffe bestehen meist aus Polyurethan oder Polyester, Volumes aus beschichtetem Holz — und die Menschen, die sie schrauben, heißen Routesetter.",
  "Im Boulder-Weltcup gibt es pro Boulder zwei Wertungen: die „Zone“ (Zwischengriff) und das „Top“ (beide Hände am Schlussgriff, Kontrolle).",
  "Für Los Angeles 2028 ist Klettern wieder olympisch — geplant sind erstmals drei getrennte Wettbewerbe: Bouldern, Lead und Speed.",
  "Alex Megos onsightete 2013 als erster Mensch eine 9a („Estado Critico“, Spanien) — im ersten Versuch, ohne jede Vorab-Info.",
  "Adam Ondra ist berühmt für seine Schreie beim Klettern — viele Athleten nutzen lautes Ausatmen gezielt zur Aktivierung bei Maximalzügen.",
  "Top-Kletterer hängen einarmig an 20-Millimeter-Leisten — teils mit Zusatzgewicht. Fingerkraft gilt als der messbarste Einzelfaktor fürs Leistungsklettern.",
  "Jugendliche Wachstumsfugen an den Fingern sind verletzungsanfällig — deshalb raten Verbände offiziell von intensivem Campusboard-Training vor dem Erwachsenenalter ab.",
  "Viele leichte Boulder („Mileage“) verbessern deine Technik oft mehr als ständiges Limit-Bouldern — Bewegungsqualität schlägt Ego.",
  "10 bis 15 Minuten Aufwärmen an leichten Bouldern senken das Risiko von Fingerverletzungen deutlich — die Ringbänder brauchen Vorlauf.",
  "Bouldern trainiert Maximalkraft, Seilklettern Ausdauer — wer beides mischt, wird an der Wand am komplettesten.",
  "Die meisten Boulder-Verletzungen passieren nicht an der Wand, sondern beim Abspringen — kontrolliert abklettern schont die Sprunggelenke.",
  "„Skin Management“ ist bei Profis eine eigene Disziplin: Versuche werden nach Hautlage geplant, denn frische Haut greift messbar besser als polierte.",
  "Standardisierte Trainingsboards wie MoonBoard, Kilter Board und Tension Board haben LED-beleuchtete Griffe und Apps — dein Benchmark-Ergebnis ist weltweit vergleichbar.",
  "Ein „Benchmark“ ist ein Standard-Boulder auf solchen Boards, an dem sich Kletterer rund um den Globus mit exakt demselben Problem messen.",
  "„Lock-off“: einen Griff mit gebeugtem Arm statisch halten, während die andere Hand weiterzieht — eine der wertvollsten Grundfähigkeiten am Fels.",
  "Der Unterschied zwischen „Toprope“, Vorstieg und Bouldern steckt im Kopf: Gleiche Züge fühlen sich je nach Sturzhöhe komplett anders an — Mentaltraining ist Klettertraining.",
  "Kletterer zählen Grade gern in „Soft“ und „Hard“: Eine weiche 6 fühlt sich wie eine 5 an, eine harte wie eine 7 — am Ende zählt, dass DU oben warst.",
];
const CLIMB_FACTS_EN = [
  "The name 'bouldering' comes from climbing boulders. The sport's cradle is Fontainebleau near Paris — climbers have trained on its sandstone blocks for over 120 years.",
  "Chalk is magnesium carbonate, introduced to climbing in the 1950s by US gymnast John Gill — the father of modern bouldering.",
  "'Beta' (info about how to solve a boulder) comes from Betamax tapes: climber Jack Mileski filmed routes in the 80s and shared the footage.",
  "A 'flash' is a first-try ascent WITH prior knowledge. Climb a route first try without any info and it's called an 'onsight'.",
  "Boulder problems are called 'problems' because they're solved like puzzles — often the head matters more than the muscles.",
  "The V-scale for boulder grades is named after John 'Vermin' Sherman, who established hundreds of problems at Hueco Tanks, Texas.",
  "Crash pads only became common in the 1990s. Before that, people bouldered above grass tufts, sand — or nothing at all.",
  "Wolfgang Güllich invented campus board training for 'Action Directe' (1991, the world's first 9a). The original board hung in Nuremberg's 'Campus Centre'.",
  "The speed climbing world record is under 5 seconds — on a standardized 15-meter route. That's over 3 meters per second, straight up!",
  "Adam Ondra's 'Silence' in Norway's Flatanger cave became the world's first 9c in 2017 — still one of the hardest routes ever.",
  "Lynn Hill made the first free ascent of El Capitan's legendary 'Nose' in 1993 — then famously said: 'It goes, boys!'",
  "Alex Honnold climbed the nearly 1000-meter El Capitan without a rope in 2017. The documentary 'Free Solo' won an Oscar.",
  "'Free climbing' does NOT mean without a rope: it means the rope is only for protection, not progress. Without a rope it's 'free solo'.",
  "Cold rock means more friction: that's why climbers talk about 'good conditions' or 'sending temps' when it's cool and dry.",
  "Sandstone soaks up water like a sponge: after rain it gets brittle — wait 24–48 hours or holds will snap off.",
  "People have climbed in Saxony's Elbsandstein for over 150 years — with strict ethics: chalk and metal protection are partly banned to this day.",
  "The 'mantle' is named after the mantelpiece — the move resembles pressing yourself up onto a ledge.",
  "A 'dyno' is a jump move where you're briefly fully airborne. The weightless moment is called the 'deadpoint'.",
  "Grip types: crimp, sloper, pinch, pocket and jug — each one loads your muscles differently.",
  "Forearm 'pump' happens when muscles need more blood than can flow through — shaking out helps more than gripping on.",
  "Tendons and ligaments adapt much slower than muscles — warming up and patience are the best protection against finger injuries.",
  "Your pulleys (like the A2) hold the flexor tendons to the finger bone. Every climber has heard about 'the pop' — warm up!",
  "Antagonist training (push-ups, shoulder work) prevents injury: climbing trains almost only your pulling muscles.",
  "Climbing shoes are deliberately tight and downturned so toe power transfers directly onto the smallest footholds.",
  "Modern sticky rubber arrived in 1979 with the Boreal Firé — before that, climbers used hard soles with a fraction of the grip.",
  "'Sandbagging' is when a route is much harder than its grade claims. Every gym has at least one notorious sandbag …",
  "Skin care is training: pros file their calluses smooth and moisturize at night — cracked skin costs friction, and friction costs grades.",
  "The MoonBoard (by Ben Moon) was the first globally standardized training board: same holds, same angle — your benchmark counts everywhere.",
  "Ben Moon's 'Hubble' (1990) is retrospectively considered possibly the first 9a in history — originally graded 8c+.",
  "Climbing debuted at the Tokyo Olympics in 2021. Janja Garnbret took gold — and defended it in Paris 2024.",
  "Ashima Shiraishi climbed a V15 boulder at age 14 — a grade many pros never reach.",
  "Angela Eiter became the first woman to climb 9b ('La Planta de Shiva') in 2017 — the Austrian started as a competition climber.",
  "Nalle Hukkataival's 'Burden of Dreams' (2016, Finland) was the first V17 (9A) boulder — 5 moves, years of work.",
  "'Highballs' are boulders from about 5 meters up — the line to free soloing gets blurry, falling not recommended.",
  "On slabs (vertical or less) it's almost all footwork and friction — strength helps surprisingly little there.",
  "Granite offers friction and cracks, limestone pockets and tufas, sandstone slopers and roof lips — every rock climbs differently.",
  "The bouldering gym wave: rope-free gyms have boomed worldwide since the 2010s — bouldering is climbing's fastest-growing discipline.",
  "In 'toprope' the rope already hangs above you — ideal for learning. On 'lead' you clip as you go, and falls get longer (and more educational).",
  "The 'crux' is a route's key passage — its hardest single section. Some routes have two …",
  "'Send' comes from the US slang 'to send it' — climbing a route cleanly without falling. Afterwards: 'Sent!'",
  "Climbers 'read' routes before pulling on: visualizing the sequence saves energy and attempts — pros practice it like a discipline of its own.",
  "Rest days make you stronger: muscles, tendons and skin grow during the break, not the session. Two boulder days in a row? Sure. Five? Ouch.",
  "Fontainebleau grades with colors and numbers (the Fb scale) — your gym grades 1–8 follow exactly this tradition.",
  "The world's tallest artificial climbing tower is over 30 m high — but most world-class boulders are under 5 m. Hard doesn't mean high.",
  "The men's speed world record stands at 4.64 seconds — set by Sam Watson (USA) at the 2025 World Cup in Bali. On the women's side, Aleksandra Mirosław holds 6.06 s from Paris 2024.",
  "Aleksandra Mirosław broke the speed climbing world record four times on April 28, 2023 — all in a single day.",
  "The speed wall has been identical worldwide since 2007: 15 meters, 5 degrees overhanging, 20 handholds, 11 footholds. The route itself is only about 6b — Alex Honnold needed 22.3 seconds, pros go under 5.",
  "Just like the 100-meter sprint: reacting faster than 0.1 seconds after the start signal counts as a false start — quicker reactions are considered humanly impossible.",
  "Paris 2024 had two climbing golds per gender for the first time: Boulder&Lead and Speed separately. Toby Roberts and Janja Garnbret took the Boulder&Lead titles.",
  "'Burden of Dreams' is only 4 meters tall with 8 moves — yet Nalle Hukkataival needed around 4,000 attempts over four years for the first ascent.",
  "Will Bosi trained for 'Burden of Dreams' on 3D-printed replicas of the original holds in England — the repeat on real rock then took 52 seconds.",
  "If the 45-degree wall of 'Burden of Dreams' were vertical, the boulder would drop to roughly grade 5+ — steepness is a massive difficulty factor.",
  "2025 was bouldering's record year: 16 ascents at grade 9A (V17) — and in November, Elias Iagnemma proposed history's first 9A+ (V18) with 'Exodia' in Italy.",
  "Jakob Schubert (Austria) is the first person to have climbed both a 9A boulder and a 9c route.",
  "The term 'redpoint' comes from Kurt Albert: in the 1970s he painted red dots on free-climbed routes in the Frankenjura — the word went international.",
  "Bavaria's Frankenjura has one of the world's highest densities of hard sport routes — and is home to 'Action Directe'.",
  "The 'gaston' grip (pushing away from your body, thumb down) is named after French mountain guide Gaston Rébuffat.",
  "Turning your hip to the wall with the knee dropped in brings your shoulder closer to the hold — suddenly moves that felt impossible square-on become reachable.",
  "A 'heel hook' turns your heel into a third hand — used well, it unloads your arms more than any muscle could.",
  "'Campusing' means climbing without feet — extremely effective training, but only recommended for experienced fingers.",
  "A 'kneebar' (jammed knee) can create full no-hands rests — pros plan entire routes around them.",
  "A 'sit start' (assis) often makes a boulder one or two grades harder — 'Return of the Sleepwalker' (V17) is simply the sit start of 'Sleepwalker' (V16).",
  "'Morpho' describes moves that depend heavily on body size — the same boulder can be a completely different grade for two people.",
  "A 'beta break' is the discovery of an easier solution — it can lower an established route's grade overnight.",
  "'Dab': touch the pad, your spotter or a neighboring rock mid-attempt and strictly speaking the try doesn't count — the community takes this surprisingly seriously.",
  "In outdoor bouldering the spotter doesn't catch the falling climber — they only guide them so they land safely on the pad.",
  "The first climbing shoes with rubber soles were developed by Pierre Allain in the 1940s — for the boulders of Fontainebleau. His 'PA' shoes were the standard for decades.",
  "As early as the 1940s, colored arrow circuits led through the forests of Fontainebleau — numbered boulder loops with up to 50 problems in a row.",
  "Fontainebleau traditionally used 'pof' — rosin bags instead of chalk. Today it's frowned upon because it polishes holds glassy.",
  "Brushing holds is climbing etiquette: chalk layers fill the texture and cost friction — a clean crimp grips half a grade easier.",
  "Bouldering gyms regularly wash their holds in dishwashers or with pressure washers — chalk and shoe rubber clog every bit of texture.",
  "Modern holds are mostly polyurethane or polyester, volumes are coated wood — and the people who set them are called routesetters.",
  "In Boulder World Cups each problem has two scores: the 'zone' (an intermediate hold) and the 'top' (both hands on the final hold, in control).",
  "Climbing returns for Los Angeles 2028 — with three separate events planned for the first time: Boulder, Lead and Speed.",
  "In 2013 Alex Megos became the first person to onsight 9a ('Estado Critico', Spain) — first try, with zero prior information.",
  "Adam Ondra is famous for screaming while climbing — many athletes deliberately use loud exhales to activate for maximum moves.",
  "Top climbers hang one-armed from 20-millimeter edges — sometimes with added weight. Finger strength is considered the most measurable single factor in performance climbing.",
  "Growth plates in young fingers are injury-prone — which is why federations officially advise against intensive campus board training before adulthood.",
  "Lots of easy boulders ('mileage') often improve your technique more than constant limit bouldering — movement quality beats ego.",
  "10–15 minutes of warming up on easy boulders significantly lowers the risk of finger injuries — your pulleys need a head start.",
  "Bouldering builds maximum strength, rope climbing builds endurance — mixing both makes the most complete climber.",
  "Most bouldering injuries don't happen on the wall but when jumping off — climbing down in control saves your ankles.",
  "'Skin management' is its own discipline among pros: attempts are scheduled around skin condition, because fresh skin measurably grips better than glassy skin.",
  "Standardized training boards like the MoonBoard, Kilter Board and Tension Board have LED-lit holds and apps — your benchmark result is comparable worldwide.",
  "A 'benchmark' is a standard problem on such boards where climbers around the globe test themselves on exactly the same moves.",
  "'Lock-off': holding a hold statically with a bent arm while the other hand moves on — one of the most valuable basic skills on rock.",
  "The difference between toprope, lead and bouldering is in your head: the same moves feel completely different depending on fall height — mental training is climbing training.",
  "Climbers love calling grades 'soft' and 'hard': a soft 6 feels like a 5, a hard one like a 7 — in the end what counts is that YOU topped out.",
];
function climbFact(n) {
  const arr = LANG === "en" ? CLIMB_FACTS_EN : CLIMB_FACTS_DE;
  const idx = ((n % arr.length) + arr.length) % arr.length;
  return { text: arr[idx], no: idx + 1, total: arr.length };
}

function catIcon(c) { const a = ACHS().find(x => x.cat === c); return a ? a.icon : "🏅"; }

const RAINBOW = ["blau", "grün", "rot", "gelb", "lila"];
function normColor(c) { return c === "gruen" ? "grün" : c === "weiss" ? "weiß" : c === "violett" ? "lila" : c; }
function computeAgg(routes, name) {
  const agg = { tops: 0, flashes: 0, points: 0, grade: {}, color: {}, wall: {}, gradeColor: {}, days: {} };
  const wallDaySet = new Set();
  routes.forEach(r => {
    const st = r.results?.[name]; if (!st) return;
    const g = gradeValue(r), w = wallCanon(r.gym), isF = st === "flash";
    const cw = colorWord(r.name); const c = cw ? normColor(cw.toLowerCase()) : null;
  agg.tops++; if (isF) agg.flashes++; agg.points += pointsFor(g, st); agg.totalRoutes = (agg.totalRoutes || 0) + 1;
    (agg.grade[g] = agg.grade[g] || { t: 0, f: 0 }).t++; if (isF) agg.grade[g].f++;
    (agg.wall[w] = agg.wall[w] || { t: 0, f: 0 }).t++; if (isF) agg.wall[w].f++;
    if (c) { (agg.color[c] = agg.color[c] || { t: 0, f: 0 }).t++; if (isF) agg.color[c].f++; const k = g + "|" + c; (agg.gradeColor[k] = agg.gradeColor[k] || { t: 0, f: 0 }).t++; if (isF) agg.gradeColor[k].f++; }
    const day = (r.resultDates && r.resultDates[name]) || r.date || "?"; const D = agg.days[day] = agg.days[day] || { t: 0, f: 0, colors: new Set(), grades: new Set(), cc: {}, gc: {} };
    D.t++; if (isF) D.f++; D.grades.add(g); D.gc[g] = (D.gc[g] || 0) + 1; if (c) { D.colors.add(c); D.cc[c] = (D.cc[c] || 0) + 1; }
    if (w && day && day !== "?") wallDaySet.add(w + ":" + day);
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
  // Neue Metriken
  agg.distinctWalls = Object.keys(agg.wall).length;
  agg.totalWallDays = wallDaySet.size;
  agg.distinctGrades = Object.keys(agg.grade).length;
  let bestAllFlashDay = 0;
  Object.values(agg.days).forEach(D => { if (D.t > 0 && D.f === D.t) bestAllFlashDay = Math.max(bestAllFlashDay, D.t); });
  agg.bestAllFlashDay = bestAllFlashDay;
  let maxConsec = dayNums.length ? 1 : 0, runC = dayNums.length ? 1 : 0;
  for (let i = 1; i < dayNums.length; i++) { if (dayNums[i] === dayNums[i - 1] + 1) { runC++; if (runC > maxConsec) maxConsec = runC; } else { runC = 1; } }
  agg.maxConsecutiveDays = maxConsec;
  let weekendDays = 0;
  Object.keys(agg.days).forEach(d => { if (d && d !== "?") { const wd = new Date(d).getUTCDay(); if (wd === 0 || wd === 6) weekendDays++; } });
  agg.weekendDays = weekendDays;
  // Gleitfenster Tops/Flashes/Mehrling für Wochen- und Monats-Erfolge
  const dayTF = Object.entries(agg.days)
    .filter(([d]) => d && d !== "?")
    .map(([d, D]) => ({ n: Math.floor(Date.parse(d) / 86400000), t: D.t, f: D.f, gc: D.gc }))
    .filter(x => !isNaN(x.n))
    .sort((a, b) => a.n - b.n);
  const slideWin = span => {
    let bT = 0, bF = 0, sT = 0, sF = 0, l = 0;
    for (let r = 0; r < dayTF.length; r++) {
      sT += dayTF[r].t; sF += dayTF[r].f;
      while (dayTF[r].n - dayTF[l].n >= span) { sT -= dayTF[l].t; sF -= dayTF[l].f; l++; }
      bT = Math.max(bT, sT); bF = Math.max(bF, sF);
    }
    return { tops: bT, flashes: bF };
  };
  const w7 = slideWin(7); agg.maxWeekTops = w7.tops; agg.maxWeekFlashes = w7.flashes;
  const w30 = slideWin(30); agg.maxMonthTops = w30.tops; agg.maxMonthFlashes = w30.flashes;
  const gradeNums = {};
  dayTF.forEach(({ n, gc }) => { Object.entries(gc).forEach(([g, cnt]) => { (gradeNums[g] = gradeNums[g] || []).push([n, cnt]); }); });
  const slideGrade = span => {
    let best = 0;
    Object.values(gradeNums).forEach(arr => {
      arr.sort((a, b) => a[0] - b[0]);
      let sum = 0, l = 0;
      for (let r = 0; r < arr.length; r++) {
        sum += arr[r][1];
        while (arr[r][0] - arr[l][0] >= span) { sum -= arr[l][1]; l++; }
        best = Math.max(best, sum);
      }
    });
    return best;
  };
  agg.maxWeekOfAKind = slideGrade(7);
  agg.maxMonthOfAKind = slideGrade(30);
  // Macher-Metriken: eigene Beiträge zur Community
  let createdRoutes = 0, photosAdded = 0, commentsAdded = 0;
  routes.forEach(r => {
    if (r.createdBy === name) { createdRoutes++; photosAdded += (r.photos || []).length; }
    (r.tips || []).forEach(t => { if (t.by === name) commentsAdded++; });
  });
  agg.createdRoutes = createdRoutes;
  agg.photosAdded = photosAdded;
  agg.commentsAdded = commentsAdded;
  return agg;
}
function achValue(agg, key) {
  if (key === "tops") return agg.tops;
  if (key === "flashes") return agg.flashes;
  if (key === "points") return Math.floor(agg.points);
  if (key === "maxDayTops") return agg.maxDayTops;
  if (key === "maxDayFlashes") return agg.maxDayFlashes;
  if (key === "maxWeekTops") return agg.maxWeekTops || 0;
  if (key === "maxWeekFlashes") return agg.maxWeekFlashes || 0;
  if (key === "maxMonthTops") return agg.maxMonthTops || 0;
  if (key === "maxMonthFlashes") return agg.maxMonthFlashes || 0;
  if (key === "rainbowDays") return agg.rainbowDays;
  if (key === "allGradeDays") return agg.allGradeDays;
  if (key === "maxFrom1") return agg.maxFrom1;
  if (key === "maxRun") return agg.maxRun;
  if (key === "maxOfAKind") return agg.maxOfAKind;
  if (key === "maxWeekOfAKind") return agg.maxWeekOfAKind || 0;
  if (key === "maxMonthOfAKind") return agg.maxMonthOfAKind || 0;
  if (key === "totalRoutes") return agg.totalRoutes || 0;
  if (key === "weekStreak1") return agg.weekStreak1 || 0;
  if (key === "weekStreak2") return agg.weekStreak2 || 0;
  if (key === "daysIn100") return agg.daysIn100 || 0;
  if (key === "daysIn365") return agg.daysIn365 || 0;
  if (key === "distinctWalls") return agg.distinctWalls || 0;
  if (key === "totalWallDays") return agg.totalWallDays || 0;
  if (key === "distinctGrades") return agg.distinctGrades || 0;
  if (key === "maxConsecutiveDays") return agg.maxConsecutiveDays || 0;
  if (key === "bestAllFlashDay") return agg.bestAllFlashDay || 0;
  if (key === "weekendDays") return agg.weekendDays || 0;
  if (key === "createdRoutes") return agg.createdRoutes || 0;
  if (key === "photosAdded") return agg.photosAdded || 0;
  if (key === "commentsAdded") return agg.commentsAdded || 0;
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
// Strikte Variante für den Erst-Load: WIRFT bei Verbindungs-/Parse-Fehler (statt still null),
// damit wir NIEMALS Seed-Daten über möglicherweise vorhandene echte Daten schreiben.
//   -> { empty:true }  wirklich leere DB (Erststart, Seed erlaubt)
//   -> { data }        vorhandene Daten
//   -> wirft           Fehler (Aufrufer muss abbrechen, NICHT überschreiben)
async function loadCommunityStrict() {
  const r = await window.storage.get(KEY_COMMUNITY, true);
  if (r && r.value) return { data: JSON.parse(r.value) };
  return { empty: true };
}
async function saveCommunity(d) { try { await window.storage.set(KEY_COMMUNITY, JSON.stringify(d), true); } catch (e) {} }

// ── Automatische rollende Backups ───────────────────────────────────────────
// Bei jedem Speichern wird (gedrosselt) ein Snapshot in einen Ring aus SNAP_SLOTS
// Slots geschrieben. So lässt sich der Stand jederzeit wiederherstellen — selbst
// wenn der Hauptdatensatz überschrieben/geleert wurde. Snapshots leerer Stände
// werden übersprungen, damit ein Datenverlust die Sicherungen nicht verdrängt.
const KEY_SNAP_META = "boulder:community:snapmeta";
const KEY_SNAP_PREFIX = "boulder:community:snap:";
const SNAP_SLOTS = 20;
const SNAP_MIN_INTERVAL_MS = 12 * 60 * 1000; // höchstens alle 12 Min ein Auto-Snapshot
async function loadSnapMeta() { try { const r = await window.storage.get(KEY_SNAP_META, true); if (r && r.value) return JSON.parse(r.value); } catch (e) {} return { idx: 0, list: [] }; }
async function writeSnapshot(communityObj, force) {
  try {
    if (!communityObj || !(communityObj.accounts || []).length) return; // keine leeren Stände sichern
    const meta = await loadSnapMeta();
    const last = meta.list.length ? meta.list[meta.list.length - 1] : null;
    const now = Date.now();
    if (!force && last && now - last.ts < SNAP_MIN_INTERVAL_MS) return; // Drosselung
    const slot = meta.idx % SNAP_SLOTS;
    const accounts = (communityObj.accounts || []).length;
    const routes = (communityObj.routes || []).length;
    await window.storage.set(KEY_SNAP_PREFIX + slot, JSON.stringify({ ts: now, accounts, routes, data: communityObj }), true);
    meta.idx = meta.idx + 1;
    meta.list.push({ slot, ts: now, accounts, routes });
    if (meta.list.length > SNAP_SLOTS) meta.list = meta.list.slice(-SNAP_SLOTS);
    await window.storage.set(KEY_SNAP_META, JSON.stringify(meta), true);
  } catch (e) {}
}
async function listSnapshots() { const meta = await loadSnapMeta(); return [...meta.list].sort((a, b) => b.ts - a.ts); }
async function loadSnapshot(slot) { try { const r = await window.storage.get(KEY_SNAP_PREFIX + slot, true); if (r && r.value) return JSON.parse(r.value); } catch (e) {} return null; }
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
      // Garantierte Kompression: JEDES Bild wird neu als JPEG kodiert (max. 1080px).
      // Drei Qualitätsstufen, bis die Zielgröße erreicht ist.
      try {
        let data = c.toDataURL("image/jpeg", 0.72);
        let kb = Math.round(data.length * 3 / 4 / 1024);
        if (kb > targetKB * 1.4) { data = c.toDataURL("image/jpeg", 0.52); kb = Math.round(data.length * 3 / 4 / 1024); }
        if (kb > targetKB * 2.2) { data = c.toDataURL("image/jpeg", 0.38); }
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
function PhotoLightbox({ src, images, startIndex = 0, onClose }) {
  const imgs = (images && images.length) ? images : (src ? [src] : []);
  const [idx, setIdx] = useState(Math.min(startIndex, Math.max(0, imgs.length - 1)));
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const lastTouchDist = useRef(null);
  const swipeStart = useRef(null);
  const imgRef = useRef(null);
  const cur = imgs[idx];
  const multi = imgs.length > 1;
  const reset = () => { setScale(1); setPos({ x: 0, y: 0 }); };
  const go = d => { setIdx(i => { const n = (i + d + imgs.length) % imgs.length; return n; }); reset(); };

  useEffect(() => {
    const fn = e => { if (e.key === "Escape") onClose(); else if (e.key === "ArrowRight" && multi) go(1); else if (e.key === "ArrowLeft" && multi) go(-1); };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [multi, imgs.length]);

  function onWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.85 : 1.18;
    setScale(s => Math.min(6, Math.max(1, s * delta)));
  }

  const lastTap = useRef(0);
  function onImgClick(e) {
    e.stopPropagation();
    const now = Date.now();
    if (now - lastTap.current < 300) {
      setScale(s => s > 1.5 ? 1 : 2.5);
      setPos({ x: 0, y: 0 });
    }
    lastTap.current = now;
  }

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

  function onTouchStart(e) {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastTouchDist.current = Math.sqrt(dx*dx + dy*dy);
      swipeStart.current = null;
    } else if (e.touches.length === 1 && scale > 1) {
      setDragging(true);
      setDragStart({ x: e.touches[0].clientX - pos.x, y: e.touches[0].clientY - pos.y });
      swipeStart.current = null;
    } else if (e.touches.length === 1) {
      // potenzielle Swipe-Geste (nur bei scale==1)
      swipeStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }
  function onTouchMove(e) {
    if (e.touches.length === 2 && lastTouchDist.current) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const ratio = dist / lastTouchDist.current;
      setScale(s => Math.min(6, Math.max(1, s * ratio)));
      lastTouchDist.current = dist;
    } else if (e.touches.length === 1 && dragging && dragStart) {
      e.preventDefault();
      setPos({ x: e.touches[0].clientX - dragStart.x, y: e.touches[0].clientY - dragStart.y });
    }
  }
  function onTouchEnd(e) {
    lastTouchDist.current = null;
    setDragging(false);
    // Swipe auswerten (nur wenn nicht gezoomt)
    if (swipeStart.current && scale <= 1 && multi) {
      const t = e.changedTouches && e.changedTouches[0];
      if (t) {
        const dx = t.clientX - swipeStart.current.x;
        const dy = t.clientY - swipeStart.current.y;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) { go(dx < 0 ? 1 : -1); }
      }
    }
    swipeStart.current = null;
  }

  if (!cur) return null;
  return (
    <div className="lightbox"
      onClick={scale <= 1 ? onClose : undefined}
      onWheel={onWheel}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <button className="lb-close" onClick={onClose} style={{zIndex:202}}>✕</button>
      {multi && <div className="lb-count" onClick={e => e.stopPropagation()}>{idx + 1} / {imgs.length}</div>}
      {multi && <button className="lb-nav lb-prev" onClick={e => { e.stopPropagation(); go(-1); }} aria-label="Vorheriges"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 19l-7-7 7-7"/></svg></button>}
      {multi && <button className="lb-nav lb-next" onClick={e => { e.stopPropagation(); go(1); }} aria-label="Nächstes"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7"/></svg></button>}
      {scale > 1 && <div className="lb-hint">{LANG==="en"?"Double-tap to reset":"Doppeltippen zum Zurücksetzen"}</div>}
      <img
        ref={imgRef}
        src={cur}
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
      {multi && (
        <div className="lb-dots" onClick={e => e.stopPropagation()}>
          {imgs.map((_, i) => <span key={i} className={"lb-dot" + (i === idx ? " on" : "")} onClick={() => { setIdx(i); reset(); }} />)}
        </div>
      )}
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
  .brand-logo { height:50px !important; max-height:50px !important; }
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
.brand-logo { height:50px; width:auto; object-fit:contain; display:block; max-height:50px; }
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
.installhint { position:absolute; top:64px; right:10px; z-index:60; display:flex; align-items:center; gap:5px; animation:ihIn .35s cubic-bezier(.2,1,.4,1); }
.installprofilebtn { width:100%; margin:10px 0 4px; height:42px; border-radius:10px; background:rgba(184,255,0,.13); border:1.5px solid rgba(184,255,0,.6); color:#b8ff00; display:flex; align-items:center; justify-content:center; gap:8px; cursor:pointer; font-family:'Barlow Condensed'; font-weight:700; font-size:15px; letter-spacing:.04em; }
.installprofilebtn:active { background:rgba(184,255,0,.24); }
@keyframes ihIn { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }
.installhint-bubble { position:relative; display:flex; align-items:center; gap:7px; padding:9px 13px; background:#1c2129; border:1.4px solid rgba(184,255,0,.65); border-radius:11px; color:#b8ff00; font-size:13.5px; font-weight:800; cursor:pointer; box-shadow:0 8px 24px rgba(0,0,0,.42), 0 0 18px rgba(184,255,0,.12); }
.installhint-bubble:active { background:#222833; }
.installhint-bubble::before { content:""; position:absolute; top:-6px; right:20px; width:11px; height:11px; background:#1c2129; border-left:1.4px solid rgba(184,255,0,.65); border-top:1.4px solid rgba(184,255,0,.65); transform:rotate(45deg); }
.installhint-close { flex:none; width:26px; height:26px; border-radius:50%; background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.16); color:var(--chalk); display:flex; align-items:center; justify-content:center; cursor:pointer; padding:0; }
.installhint-close:active { background:rgba(255,255,255,.16); }
.autoarchive-toast { position:fixed; bottom:80px; left:50%; transform:translateX(-50%); z-index:200; background:#1c2129; border:1.4px solid rgba(184,255,0,.6); border-radius:11px; color:#b8ff00; font-size:13px; font-weight:700; padding:10px 16px; white-space:nowrap; box-shadow:0 6px 20px rgba(0,0,0,.4); pointer-events:none; animation:ihIn .3s cubic-bezier(.2,1,.4,1); }
.edit.infobtn { opacity:0.65; }
.ri-date-chip { margin-left:auto; display:flex; align-items:center; gap:5px; font-size:12px; color:var(--muted); background:var(--panel2); border-radius:7px; padding:4px 8px; }
.ri-grade-row { display:flex; align-items:center; gap:12px; padding:14px 0 10px; border-bottom:1px solid var(--line); margin-bottom:12px; }
.ri-names { flex:1; min-width:0; }
.ri-nick { font-size:19px; font-weight:800; color:var(--chalk); line-height:1.2; }
.ri-color { font-size:13px; color:var(--muted); margin-top:2px; }
.ri-note { font-size:14px; color:var(--muted); padding:9px 12px; background:var(--panel2); border-radius:9px; margin-bottom:12px; }
.carebadge { flex:none; display:inline-flex; align-items:center; gap:3px; font-size:10.5px; font-weight:800; padding:2px 7px; border-radius:6px; background:rgba(255,170,40,.16); border:1px solid rgba(255,170,40,.5); color:#ffaa28; letter-spacing:.02em; }
.archwallbtn { display:flex; align-items:center; justify-content:center; gap:6px; width:100%; margin-bottom:10px; padding:10px; border-radius:11px; background:rgba(255,170,40,.1); color:#ffaa28; font-weight:800; font-size:13.5px; border:1.3px solid rgba(255,170,40,.45); cursor:pointer; }
.archwallbtn:active { background:rgba(255,170,40,.2); }
.carebox { background:linear-gradient(150deg,rgba(255,170,40,.12),var(--panel2)); border:1.4px solid rgba(255,170,40,.45); border-radius:12px; padding:13px 15px; margin-bottom:12px; }
.carebox-ttl { font-family:'Barlow Condensed'; font-weight:700; font-size:16px; color:#ffaa28; letter-spacing:.02em; margin-bottom:5px; }
.carebox-txt { font-size:13px; color:var(--chalk); line-height:1.5; opacity:.9; }
.metabox { background:var(--panel2); border:1px solid var(--line); border-radius:11px; padding:11px 13px; margin:6px 0 12px; }
.metabox-row { display:flex; justify-content:space-between; align-items:center; gap:10px; }
.metabox-k { font-size:12px; color:var(--muted); font-weight:600; }
.metabox-v { font-size:14px; color:var(--chalk); font-weight:800; }
.metahist { margin-top:9px; padding-top:9px; border-top:1px solid var(--line); }
.metahist-ttl { font-size:11px; color:var(--muted); font-weight:700; text-transform:uppercase; letter-spacing:.05em; margin-bottom:6px; }
.metahist-row { display:flex; align-items:center; gap:7px; font-size:12.5px; padding:2px 0; }
.metahist-act { flex:none; font-weight:700; color:#b8ff00; min-width:62px; }
.metahist-by { flex:1; color:var(--chalk); font-weight:600; }
.metahist-ts { flex:none; color:var(--muted); font-size:11px; }
.delwarn { font-size:14px; color:var(--chalk); line-height:1.55; padding:12px 14px; background:rgba(233,139,125,.1); border:1.3px solid rgba(233,139,125,.4); border-radius:11px; }
.creatorinfo { display:flex; gap:11px; align-items:flex-start; padding:12px 14px; margin-bottom:12px; background:linear-gradient(150deg,rgba(184,255,0,.1),var(--panel2)); border:1.3px solid rgba(184,255,0,.4); border-radius:12px; }
.creatorinfo-ic { flex:none; font-size:22px; line-height:1.2; }
.creatorinfo-txt { font-size:13px; color:var(--chalk); line-height:1.5; opacity:.92; }
.creatortag { font-size:12px; margin-left:6px; opacity:.85; }
.tabbadge { position:absolute; top:2px; right:calc(50% - 22px); min-width:17px; height:17px; padding:0 4px; border-radius:9px; background:#b8ff00; color:#11151a; font-size:11px; font-weight:800; display:flex; align-items:center; justify-content:center; box-shadow:0 0 0 2px #1e2028; }
.claimtag { font-size:11px; font-weight:800; margin-left:6px; color:#11151a; background:#b8ff00; border-radius:8px; padding:1px 6px; }
.achrow.claimable { border-color:rgba(184,255,0,.55); background:linear-gradient(150deg, rgba(184,255,0,.10), var(--panel)); }
.claimbtn { flex:none; font-size:12.5px; font-weight:800; color:#11151a; background:#b8ff00; border:none; border-radius:8px; padding:8px 11px; cursor:pointer; }
.claimbtn:active { filter:brightness(.9); }
.claimall { display:flex; align-items:center; justify-content:center; gap:6px; width:100%; margin-bottom:12px; padding:11px; border-radius:11px; background:#b8ff00; color:#11151a; font-weight:800; font-size:14px; border:none; cursor:pointer; }
.claimall:active { filter:brightness(.9); }
.rerollbtn { flex:none; width:46px; border-radius:10px; background:var(--panel2); border:1.3px solid var(--line); font-size:20px; cursor:pointer; }
.rerollbtn:active { background:var(--panel); }
.gradepick .bs-btn { font-size:13px; font-weight:800; letter-spacing:.04em; min-width:44px; }
.meta .ptssub { color:var(--muted); opacity:.75; font-size:11px; }
.lhplan { color:#ffaa28; font-weight:700; }
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
.gcol { width:36px; height:36px; border-radius:9px; flex:none; display:flex; align-items:center; justify-content:center; border:2px solid var(--gcol-color, #b8ff00); background:transparent; }
.gcol .ggrade { font-family:'Barlow Condensed'; font-weight:300; font-size:23px; line-height:1; text-align:center; color:var(--gcol-color, #b8ff00); letter-spacing:.02em; }
.gcol.black-grade .ggrade { color:#13141a; }
.gcol .ggrade.ggrade-bs { font-size:15px; font-weight:800; letter-spacing:.06em; }
.gcol:has(.ggrade-bs) { background:linear-gradient(140deg, rgba(255,170,40,.28), rgba(255,80,120,.28)) !important; }
.gcol:has(.ggrade-bs) .ggrade { color:#fff !important; }
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
.shareIcon { margin-left:auto; align-self:center; flex:none; width:32px; height:32px; border-radius:8px; display:flex; align-items:center; justify-content:center; background:rgba(184,255,0,.12); border:1px solid rgba(184,255,0,.4); color:#b8ff00; cursor:pointer; padding:0; }
.shareIcon:active { background:rgba(184,255,0,.24); }
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
.grp-leave { width:100%; padding:13px; border-radius:11px; background:transparent; border:1px solid var(--line); color:var(--muted); font-weight:600; font-size:14px; margin-top:8px; }
.grp-leave:active { background:var(--panel2); }
.grp-delete { width:100%; padding:13px; border-radius:11px; background:transparent; border:1px solid rgba(221,84,104,.35); color:#dd5468; font-weight:600; font-size:14px; margin-top:8px; }
.grp-delete:active { background:rgba(221,84,104,.08); }
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
.lb-count { position:absolute; top:24px; left:50%; transform:translateX(-50%); font-size:13px; font-weight:700; color:#fff; background:rgba(0,0,0,.45); padding:5px 13px; border-radius:20px; z-index:202; backdrop-filter:blur(6px); }
.lb-nav { position:absolute; top:50%; transform:translateY(-50%); width:46px; height:46px; border-radius:50%; background:rgba(255,255,255,.13); color:#fff; display:flex; align-items:center; justify-content:center; border:1px solid rgba(255,255,255,.2); backdrop-filter:blur(6px); z-index:202; cursor:pointer; }
.lb-nav:active { background:rgba(255,255,255,.28); }
.lb-prev { left:14px; }
.lb-next { right:14px; }
.lb-dots { position:absolute; bottom:22px; left:50%; transform:translateX(-50%); display:flex; gap:8px; z-index:202; }
.lb-dot { width:8px; height:8px; border-radius:50%; background:rgba(255,255,255,.35); cursor:pointer; transition:all .15s; }
.lb-dot.on { background:#b8ff00; transform:scale(1.25); }
.thumb-click { cursor:pointer; }
.lockbox { font-size:13px; color:var(--muted); line-height:1.5; padding:11px 13px; background:var(--panel2); border:1px dashed var(--line); border-radius:11px; }
.lockbox b { color:var(--chalk); }
.snaprow { display:flex; align-items:center; gap:10px; width:100%; text-align:left; background:var(--panel); border:1px solid var(--line); border-radius:11px; padding:11px 13px; margin-bottom:8px; cursor:pointer; }
.snaprow:active { background:var(--panel2); }
.snapmain { flex:1; min-width:0; }
.snapdate { font-weight:700; font-size:14.5px; color:var(--chalk); }
.snapmeta { font-size:12px; color:var(--muted); margin-top:2px; }
.snaprestore { flex:none; font-size:12px; font-weight:700; color:#b8ff00; border:1px solid rgba(184,255,0,.4); border-radius:7px; padding:5px 9px; }
.pwforgot { display:block; width:100%; margin-top:12px; background:none; border:none; color:var(--muted); font-size:13px; font-weight:600; text-align:center; cursor:pointer; text-decoration:underline; text-underline-offset:3px; }
.pwforgot:active { color:var(--chalk); }
.emailrow { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-top:10px; }
.emailrow-l { display:flex; flex-direction:column; gap:2px; min-width:0; }
.emailval { font-size:13.5px; font-weight:700; color:var(--chalk); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
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
.intro-scrim { z-index:200; align-items:center; justify-content:center; padding:20px 16px; background:rgba(10,11,15,.82); backdrop-filter:blur(6px); }
.intro-modal { background:var(--panel); border-radius:20px; border:1.5px solid rgba(255,255,255,.12); width:100%; max-width:420px; max-height:90vh; overflow-y:auto; overflow-x:hidden; animation:up .22s ease; }
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
.lvlcard { background:linear-gradient(150deg, rgba(184,255,0,.10), rgba(184,255,0,.02)); border:1.5px solid rgba(184,255,0,.45); border-radius:16px; padding:16px 18px; margin-bottom:16px; }
.lvlhead { display:flex; align-items:center; gap:14px; }
.lvlnum { font-size:40px; font-weight:900; line-height:1; color:#b8ff00; flex:none; letter-spacing:-1px; }
.lvlnum span { font-size:15px; font-weight:700; color:rgba(184,255,0,.5); margin-left:1px; }
.lvlname { min-width:0; }
.lvltitle { font-size:19px; font-weight:800; color:var(--chalk); line-height:1.15; }
.lvlsub { font-size:12px; font-weight:600; color:var(--muted); margin-top:2px; }
.lvlbar { height:8px; border-radius:5px; background:rgba(255,255,255,.08); overflow:hidden; margin:13px 0 8px; }
.lvlbar i { display:block; height:100%; border-radius:5px; background:linear-gradient(90deg,#7da600,#b8ff00); box-shadow:0 0 10px rgba(184,255,0,.5); transition:width .5s ease; }
.lvlnext { font-size:12.5px; color:var(--muted); line-height:1.4; }
.lvlnext b { color:#b8ff00; font-weight:800; }
.lvlup-scrim { z-index:300; align-items:center; justify-content:center; padding:24px; background:rgba(8,9,12,.86); backdrop-filter:blur(7px); animation:fadeIn .2s ease; }
.lvlup-card { position:relative; width:100%; max-width:360px; background:linear-gradient(160deg, #181d22, #11151a); border:1.5px solid rgba(184,255,0,.5); border-radius:22px; padding:30px 26px 24px; text-align:center; box-shadow:0 20px 60px rgba(0,0,0,.55), 0 0 50px rgba(184,255,0,.12); animation:lvlup-pop .4s cubic-bezier(.18,1.1,.4,1); overflow:hidden; }
@keyframes lvlup-pop { 0%{ transform:scale(.8); opacity:0; } 100%{ transform:scale(1); opacity:1; } }
.lvlup-confetti { position:absolute; inset:0; pointer-events:none; overflow:visible; z-index:0; }
.lvlup-piece { position:absolute; left:50%; top:34%; width:var(--s); height:var(--s); background:var(--c); opacity:0; transform:translate(-50%,-50%) scale(.2); animation:lvlup-burst var(--d) cubic-bezier(.12,.6,.25,1) var(--dl) forwards; }
@keyframes lvlup-burst { 0%{ transform:translate(-50%,-50%) scale(.2) rotate(0deg); opacity:1; } 65%{ opacity:1; } 100%{ transform:translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(1) rotate(var(--r)); opacity:0; } }
.lvlup-kicker { position:relative; z-index:1; font-size:13px; font-weight:800; letter-spacing:.22em; color:#b8ff00; margin-bottom:2px; }
.lvlup-num { position:relative; z-index:1; font-family:'Barlow Condensed',sans-serif; font-size:74px; font-weight:900; line-height:1; color:#b8ff00; letter-spacing:-2px; text-shadow:0 0 24px rgba(184,255,0,.45); }
.lvlup-num span { font-size:22px; font-weight:700; color:rgba(184,255,0,.45); margin-left:2px; letter-spacing:0; }
.lvlup-title { position:relative; z-index:1; font-family:'Barlow Condensed',sans-serif; font-size:27px; font-weight:800; color:#fff; margin-top:6px; line-height:1.1; }
.lvlup-story { position:relative; z-index:1; font-size:14px; line-height:1.5; color:rgba(255,255,255,.72); margin-top:12px; }
.lvlup-btn { position:relative; z-index:1; width:100%; margin-top:22px; padding:13px; border-radius:11px; background:#b8ff00; color:#11151a; font-weight:800; font-size:15px; border:none; cursor:pointer; transition:filter .12s; }
.achup-card { position:relative; width:min(420px, calc(100vw - 36px)); background:linear-gradient(165deg, #1b2027, #12161c); border:1.4px solid rgba(242,180,65,.5); border-radius:20px; padding:24px 22px 20px; box-shadow:0 24px 70px rgba(0,0,0,.55), 0 0 40px rgba(242,180,65,.08); animation:lvlupIn .42s cubic-bezier(.18,1.1,.35,1); max-height:86vh; overflow:auto; }
.achup-kicker { text-align:center; font-size:12px; font-weight:800; letter-spacing:.16em; color:#f2b441; margin-bottom:14px; }
.achup-list { display:flex; flex-direction:column; gap:8px; }
.achup-item { display:flex; align-items:center; gap:11px; background:rgba(255,255,255,.045); border:1px solid var(--line); border-radius:12px; padding:10px 12px; }
.achup-ic { flex:none; font-size:24px; line-height:1; }
.achup-txt { min-width:0; }
.achup-name { font-weight:800; font-size:14.5px; color:var(--chalk); }
.achup-desc { font-size:12px; color:var(--muted); margin-top:1px; }
.achup-more { text-align:center; font-size:12.5px; font-weight:700; color:var(--muted); padding:2px 0; }
.achup-fact { margin-top:14px; padding:13px 14px; background:linear-gradient(150deg, rgba(184,255,0,.08), rgba(184,255,0,.02)); border:1.3px solid rgba(184,255,0,.35); border-radius:13px; }
.achup-fact-head { font-size:12.5px; font-weight:800; color:#b8ff00; letter-spacing:.04em; display:flex; align-items:center; gap:6px; }
.achup-fact-no { color:var(--muted); font-weight:700; }
.achup-fact-text { margin-top:7px; font-size:13.5px; line-height:1.55; color:var(--chalk); }
.lvlup-btn:active { filter:brightness(.92); }
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
.catrow-done { border-color:rgba(184,255,0,.55); background:linear-gradient(150deg, rgba(184,255,0,.10), var(--panel)); }
.catprog-done { flex:none; display:flex; align-items:center; justify-content:center; width:30px; height:30px; }
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
function LoginScreen({ accounts, onLogin, onSignup, onResetPin, lang, onLang }) {
  const [mode, setMode] = useState("login"); // login | signup | reset
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [role, setRole] = useState("community");
  const [priv, setPriv] = useState(false);
  const [err, setErr] = useState("");
  const [rEmail, setREmail] = useState("");
  const [rPin2, setRPin2] = useState("");
  const [rOk, setROk] = useState(false);
  const en = lang === "en";

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
  async function doReset() {
    setErr("");
    const nm = name.trim();
    if (!nm) return setErr(t("login.errName"));
    if (!rEmail.trim()) return setErr(en ? "Please enter your linked email." : "Bitte deine verknüpfte E-Mail eingeben.");
    if (pin.length < 4) return setErr(t("login.errShort"));
    if (pin !== rPin2) return setErr(en ? "Passwords don't match." : "Passwörter stimmen nicht überein.");
    const res = await onResetPin({ name: nm, email: rEmail, newPin: pin });
    if (!res.ok) {
      if (res.err === "noacc") return setErr(t("login.errNoAcc"));
      if (res.err === "noemail") return setErr(en ? "No email is linked to this account. Please contact an admin." : "Für dieses Konto ist keine E-Mail hinterlegt. Bitte wende dich an einen Admin.");
      return setErr(en ? "Name and email don't match." : "Name und E-Mail passen nicht zusammen.");
    }
    setROk(true);
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
        {mode === "reset" ? (
          rOk ? (
            <div style={{ textAlign: "center", padding: "8px 0" }}>
              <div style={{ fontSize: 34 }}>✅</div>
              <div style={{ fontWeight: 800, fontSize: 17, margin: "8px 0 6px" }}>{en ? "Password changed" : "Passwort geändert"}</div>
              <div className="phint" style={{ marginBottom: 14 }}>{en ? "You can now sign in with your new password." : "Du kannst dich jetzt mit deinem neuen Passwort anmelden."}</div>
              <button className="btn" onClick={() => { setMode("login"); setROk(false); setPin(""); setRPin2(""); setREmail(""); setErr(""); }}>{t("login.signin")}</button>
            </div>
          ) : (<>
            <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 4 }}>{en ? "Reset password" : "Passwort zurücksetzen"}</div>
            <div className="phint" style={{ marginBottom: 12 }}>{en ? "Works only if you linked an email to your account (under Profile). Otherwise ask an admin." : "Geht nur, wenn du in deinem Konto eine E-Mail verknüpft hast (unter Profil). Sonst hilft dir ein Admin."}</div>
            <label className="flbl">{t("login.name")}</label>
            <input className="inp" type="text" value={name} placeholder={t("login.namePh")} onChange={e => { setName(e.target.value); setErr(""); }} />
            <label className="flbl" style={{ marginTop: 12 }}>{en ? "Linked email" : "Verknüpfte E-Mail"}</label>
            <input className="inp" type="email" inputMode="email" autoCapitalize="none" value={rEmail} placeholder="name@mail.de" onChange={e => { setREmail(e.target.value); setErr(""); }} />
            <label className="flbl" style={{ marginTop: 12 }}>{en ? "New password" : "Neues Passwort"}</label>
            <input className="inp" type="password" value={pin} placeholder={en ? "min. 4 characters" : "mind. 4 Zeichen"} onChange={e => { setPin(e.target.value); setErr(""); }} />
            <label className="flbl" style={{ marginTop: 12 }}>{en ? "Repeat" : "Wiederholen"}</label>
            <input className="inp" type="password" value={rPin2} placeholder={en ? "repeat password" : "nochmal eingeben"} onChange={e => { setRPin2(e.target.value); setErr(""); }} onKeyDown={e => { if (e.key === "Enter") doReset(); }} />
            {err && <div className="err">{err}</div>}
            <button className="btn" onClick={doReset}>{en ? "Set new password" : "Neues Passwort setzen"}</button>
            <button type="button" className="pwforgot" onClick={() => { setMode("login"); setErr(""); setPin(""); }}>{en ? "← Back to sign in" : "← Zurück zur Anmeldung"}</button>
          </>)
        ) : (<>
        <div className="authtabs">
          <button className={mode === "login" ? "on" : ""} onClick={() => { setMode("login"); setName(""); setErr(""); }}>{t("login.signin")}</button>
          <button className={mode === "signup" ? "on" : ""} onClick={() => { setMode("signup"); setName(genTag(lang)); setErr(""); }}>{t("login.signup")}</button>
        </div>

        <label className="flbl" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>{t("login.name")} {mode === "signup" && <button type="button" className="reroll" onClick={() => setName(genTag(lang))}>{t("login.suggest")}</button>}</label>
        <input className="inp" type="text" value={name} placeholder={t("login.namePh")} onChange={e => { setName(e.target.value); setErr(""); }} />

        <label className="flbl" style={{ marginTop: 12 }}>{t("login.pin")}</label>
        <input className="inp" type="password" value={pin} placeholder={mode === "login" ? t("login.pinPh") : t("login.pinSet")} onChange={e => { setPin(e.target.value); setErr(""); }} onKeyDown={e => { if (e.key === "Enter") (mode === "login" ? doLogin() : doSignup()); }} />

        {mode === "signup" && (<>
          <button className="privtoggle" onClick={() => setPriv(!priv)}>
            <span className={"switch" + (priv ? " on" : "")}><span className="knob" /></span>
            <span className="privtext"><b>{t("login.privTitle")}</b><span>{t("login.privDesc")}</span></span>
          </button>
        </>)}

        {err && <div className="err">{err}</div>}
        <button className="btn" onClick={mode === "login" ? doLogin : doSignup}>{mode === "login" ? t("login.signin") : t("login.create")}</button>
        {mode === "login" && <button type="button" className="pwforgot" onClick={() => { setMode("reset"); setErr(""); setPin(""); setRPin2(""); setROk(false); }}>{en ? "Forgot password?" : "Passwort vergessen?"}</button>}
        </>)}
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
  const [myPeriod, setMyPeriod] = useState("all"); // Meine Stats: day | week | month | year | all
  const [myMetric, setMyMetric] = useState("tops"); // Meine Stats: Grad-Verteilung tops | flashes | pts
  const [shared, setShared] = useState(false); // Teilen-Feedback
  const [lang, setLang] = useState("de");
  setLangG(lang);
  function changeLang(l) { setLang(l); setLangG(l); try { window.storage.set("blocscore:lang", l, false); } catch (e) {} }
  function jumpToRoute(id) { setFlashId(id); setTimeout(() => { const el = document.getElementById("r-" + id); if (el) el.scrollIntoView({ behavior: "smooth", block: "center" }); }, 30); setTimeout(() => setFlashId(null), 1700); }
  const firstSave = useRef(false);

  // PWA-Installation: beforeinstallprompt einfangen (nur Chromium-Browser feuern das Event).
  // Alle anderen Browser (Firefox, Safari, iOS) bekommen den Button trotzdem — mit Anleitung.
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
  const _ua = typeof navigator !== "undefined" ? (navigator.userAgent || "") : "";
  const isIOS = /iphone|ipad|ipod/i.test(_ua) || (/macintosh/i.test(_ua) && typeof navigator !== "undefined" && navigator.maxTouchPoints > 1); // iPadOS meldet sich als Mac
  const isAndroid = /android/i.test(_ua);
  const isFirefox = /firefox|fxios/i.test(_ua);
  const isSafariDesktop = !isIOS && !isAndroid && /safari/i.test(_ua) && !/chrome|chromium|crios|edg/i.test(_ua);
  const canInstall = !!installEvt;
  const showInstall = !isStandalone; // Button in JEDEM Browser zeigen — Fallback ist die Anleitung
  async function doInstall() {
    if (installEvt) { installEvt.prompt(); try { await installEvt.userChoice; } catch (e) {} setInstallEvt(null); }
    else { setIosInstallOpen(true); } // Anleitung für iOS / Firefox / Safari / Rest
  }
  const [installHintDismissed, setInstallHintDismissed] = useState(true);
  useEffect(() => { (async () => { try { const r = await window.storage.get("blocscore:installhint", false); setInstallHintDismissed(!!(r && r.value === "1")); } catch (e) { setInstallHintDismissed(false); } })(); }, []);
  async function dismissInstallHint() { setInstallHintDismissed(true); try { await window.storage.set("blocscore:installhint", "1", false); } catch (e) {} }
  const [loadError, setLoadError] = useState(false);
  useEffect(() => { (async () => {
    let res;
    try {
      res = await loadCommunityStrict();
    } catch (e) {
      // Verbindungs-/Parse-Fehler: NICHT mit Seed überschreiben — sonst gehen alle Nutzer/Daten verloren!
      console.error("loadCommunity failed", e);
      setLoadError(true);
      return; // ready bleibt false; KEIN setCommunity, KEIN Save
    }
    let c, haveReal;
    if (res.empty) {
      // Wirklich leere DB (Erststart) -> Seed ist ok
      c = SEED_COMMUNITY; haveReal = false;
    } else if (res.data && res.data.accounts) {
      c = res.data; haveReal = true;
    } else {
      // Wert vorhanden, aber kein accounts-Feld -> anormal. Lieber Fehler zeigen als überschreiben.
      console.error("community payload without accounts — refusing to overwrite");
      setLoadError(true);
      return;
    }
    if (c.groups) c = { ...c, groups: c.groups.filter(g => (g.members || []).length > 0) };
    const mig = await migrateAccountPins(c);
    setCommunity(mig);
    // Nur speichern, wenn echte Daten geladen wurden (nie Seed automatisch über die DB schreiben)
    if (haveReal && mig !== c) { try { await saveCommunity(mig); } catch (e) {} }
    setSession(await loadSession());
    try { const lr = await window.storage.get("blocscore:lang", false); if (lr && lr.value) { setLang(lr.value); setLangG(lr.value); } } catch (e) {}
    setReady(true);
  })(); }, []);
  useEffect(() => { if (!ready || !community) return; if (!firstSave.current) { firstSave.current = true; return; } saveCommunity(community); writeSnapshot(community); }, [community, ready]);

  // Auto-Archivierung: wenn heute ein Umschraubdatum ist, alle Routen dieser Wand archivieren
  const [autoArchiveMsg, setAutoArchiveMsg] = useState("");
  const didAutoArchiveRef = useRef(false);
  useEffect(() => {
    if (!ready || !community || didAutoArchiveRef.current) return;
    didAutoArchiveRef.current = true;
    const tod = todayISO();
    const wallsToArchive = Object.entries(community.screwDates || {})
      .filter(([w, d]) => d === tod && (community.autoArchived || {})[w] !== tod)
      .map(([w]) => w);
    if (!wallsToArchive.length) return;
    const wallSet = new Set(wallsToArchive);
    const toArchiveIds = new Set((community.routes || []).filter(r => !r.archived && wallSet.has(wallCanon(r.gym))).map(r => r.id));
    if (!toArchiveIds.size) return;
    const newAutoArchived = { ...(community.autoArchived || {}) };
    wallsToArchive.forEach(w => { newAutoArchived[w] = tod; });
    setCommunity(c => ({ ...c, routes: c.routes.map(r => toArchiveIds.has(r.id) ? { ...r, archived: true } : r), autoArchived: newAutoArchived }));
    const names = wallsToArchive.map(w => wallName(w)).join(", ");
    setAutoArchiveMsg(`🗃 ${toArchiveIds.size} Route${toArchiveIds.size !== 1 ? "n" : ""} automatisch archiviert (${names})`);
  }, [ready]);
  useEffect(() => { if (autoArchiveMsg) { const t = setTimeout(() => setAutoArchiveMsg(""), 7000); return () => clearTimeout(t); } }, [autoArchiveMsg]);

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
      const s = r.results?.[p]; if (!s) return; const pts = pointsFor(gradeValue(r), s);
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
  // Pflege-Bedarf: Umschraubdatum erreicht/überschritten, aber keine aktuellen (nicht-archivierten) Routen mehr
  const needsCare = useMemo(() => {
    const m = {};
    Object.entries(screwDates).forEach(([w, d]) => {
      if (d && d <= today) {
        const activeN = routes.filter(r => !r.archived && wallCanon(r.gym) === w).length;
        if (activeN === 0) m[w] = d;
      }
    });
    return m;
  }, [screwDates, routes, today]);
  const groupStats = useMemo(() => groups.filter(g => (g.members || []).length > 0).map(g => {
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
    arr.forEach(s => s.items.sort((a, b) => {
      const aBs = a.grade === "BS" || a.grade === "bs" ? 1 : 0;
      const bBs = b.grade === "BS" || b.grade === "bs" ? 1 : 0;
      if (aBs !== bBs) return aBs - bBs;                     // BS immer ans Ende
      if (aBs) return (a.date || "").localeCompare(b.date || "");
      return (Number(a.grade) || 0) - (Number(b.grade) || 0) || (a.date || "").localeCompare(b.date || "");
    }));
    // Pflegebedürftige Wände (Datum erreicht, keine aktuellen Routen) als leere Sektion zeigen
    if (scope === "aktuell" && !fGrade && !q) {
      Object.keys(needsCare).forEach(w => {
        if ((fWall === "alle" || fWall === w) && !arr.some(s => s.wall === w)) {
          arr.push({ wall: w, items: [], careOnly: true });
        }
      });
      // in WALLS-Reihenfolge sortieren
      const ord = WALLS.map(x => x.code);
      arr.sort((a, b) => ord.indexOf(a.wall) - ord.indexOf(b.wall));
    }
    return arr;
  }, [routes, filterScope, fWall, fGrade, q, canSetRoutes, needsCare]);

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
  function upsertRoute(route) {
    setCommunity(c => {
      const ex = c.routes.find(r => r.id === route.id);
      const now = Date.now();
      const meName = me?.name || "?";
      if (!ex) {
        // Neu angelegt
        const withMeta = { ...route, createdBy: route.createdBy || meName, createdAt: route.createdAt || now, history: [{ by: meName, ts: now, action: "create" }] };
        return { ...c, routes: [withMeta, ...c.routes] };
      }
      // Änderung: Historie fortschreiben (letzte 3 behalten)
      const changed = ex.grade !== route.grade || (ex.name || "") !== (route.name || "") || (ex.nick || "") !== (route.nick || "") || !!ex.archived !== !!route.archived || (ex.note || "") !== (route.note || "") || (ex.photos || []).length !== (route.photos || []).length;
      const prevHist = ex.history || (ex.createdBy ? [{ by: ex.createdBy, ts: ex.createdAt || now, action: "create" }] : []);
      const newHist = changed ? [{ by: meName, ts: now, action: "edit" }, ...prevHist].slice(0, 3) : prevHist;
      const merged = { ...route, createdBy: ex.createdBy || meName, createdAt: ex.createdAt || now, history: newHist };
      return { ...c, routes: c.routes.map(r => r.id === route.id ? merged : r) };
    });
  }
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
  // Level = Karriere-Punkte (alle je erkletterten Routen-Punkte, schwierigkeitsgewichtet)
  const levelXp = myAgg.points || 0;
  const myLevelInfo = levelFor(levelXp);
  const [levelUp, setLevelUp] = useState(null);
  const lvlBaseRef = useRef({ uid: null, level: null });
  useEffect(() => {
    if (!ready || !me) return;
    const b = lvlBaseRef.current;
    if (b.uid !== me.id) { lvlBaseRef.current = { uid: me.id, level: myLevelInfo.level }; return; }
    if (myLevelInfo.level > b.level) {
      setLevelUp({ level: myLevelInfo.level, name: myLevelInfo.name, story: levelStory(myLevelInfo.level) });
      lvlBaseRef.current = { uid: me.id, level: myLevelInfo.level };
    }
  }, [myLevelInfo.level, ready, me]);
  // ── Erfolge einfordern statt Auto-Popup ────────────────────────────────────
  // Abgeschlossene Erfolge werden nicht mehr automatisch angezeigt, sondern als
  // "einforderbar" markiert (Badge am Erfolge-Tab). Die Belohnung (Boulder-Wissen)
  // kommt erst beim Einfordern. Eingeforderte IDs liegen am Account (synct überall).
  const [achUnlock, setAchUnlock] = useState(null);
  const claimedSet = useMemo(() => new Set(me?.claimedAch || []), [me?.claimedAch]);
  const unclaimedAch = useMemo(() => (ready && me) ? achState.evald.filter(a => a.done && !claimedSet.has(a.id)) : [], [achState, claimedSet, ready, me]);
  const unclaimedByCat = useMemo(() => { const m = {}; for (const a of unclaimedAch) m[a.cat] = (m[a.cat] || 0) + 1; return m; }, [unclaimedAch]);
  // Migration: Bestandsnutzer starten mit leerem Badge (alles bisher Erreichte gilt als eingefordert)
  useEffect(() => {
    if (!ready || !me || me.claimedAch !== undefined) return;
    const doneIds = achState.evald.filter(a => a.done).map(a => a.id);
    setCommunity(c => ({ ...c, accounts: c.accounts.map(a => a.id === me.id ? { ...a, claimedAch: doneIds } : a) }));
  }, [ready, me?.id, me?.claimedAch]);
  function claimAch(ids) {
    if (!ids.length) return;
    const items = unclaimedAch.filter(a => ids.includes(a.id));
    setCommunity(c => ({ ...c, accounts: c.accounts.map(a => a.id === me.id ? { ...a, claimedAch: [...new Set([...(a.claimedAch || []), ...ids])] } : a) }));
    let cur = 0;
    try { cur = parseInt(localStorage.getItem("blocscore:factseq:" + me.id) || "0", 10) || 0; } catch (e) {}
    setAchUnlock({ items: items.slice(0, 3), extra: Math.max(0, items.length - 3), fact: climbFact(cur) });
    try { localStorage.setItem("blocscore:factseq:" + me.id, String(cur + 1)); } catch (e) {}
  }
  const NEED_COMMENT = 100, NEED_PHOTO = 300, NEED_GROUP = 200, NEED_CREATOR = 0;
  // Max groups: 1 ab 200 Pts, 2 ab 500 Pts, 3 ab 1500 Pts
  const maxGroupsAllowed = isAdmin ? 3 : achScore >= 1500 ? 3 : achScore >= 500 ? 2 : achScore >= 200 ? 1 : 0;
  const myGroupIds = groups.filter(g => (g.members||[]).includes(me?.id)).map(g => g.id);
  const canComment = isAdmin || canSetRoutes || achScore >= NEED_COMMENT;
  const canPhoto = isAdmin || canSetRoutes || achScore >= NEED_PHOTO;
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
  async function shareApp() {
    const url = "https://blocscore.de";
    const data = { title: "blocscore", text: LANG === "en" ? "Track your boulders on blocscore" : "Tracke deine Boulder auf blocscore", url };
    try { if (navigator.share) { await navigator.share(data); return; } } catch (e) { if (e && e.name === "AbortError") return; }
    try { await navigator.clipboard.writeText(url); setShared(true); setTimeout(() => setShared(false), 2000); } catch (e) {}
  }

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
      // Sicherheitsnetz: aktuellen Stand VOR dem Import als Snapshot sichern
      try { await writeSnapshot(community, true); pushSyncLog("🛟 Sicherungs-Snapshot des aktuellen Stands angelegt"); } catch (e) {}

      // Sektor-Mapping sendly → blocscore
      const SECTOR_MAP = { BH: "h", BV: "v", PL: "pl", TB: "tb", WK: "wkw", "Block Hinten": "h", "Block Vorne": "v", "Platte": "pl", "Platte & Bug": "pl", "Training & Bug": "tb", "Wettkampfwand": "wkw", Trainingsbereich: "tb" };
      const COLOR_MAP = { Pink: "pink", Gelb: "gelb", Blau: "blau", Weiss: "weiß", Weiß: "weiß", Rot: "rot", Grün: "grün", Gruen: "grün", Orange: "orange", Lila: "lila", Violett: "lila", Schwarz: "schwarz", Türkis: "türkis", Tuerkis: "türkis", Mint: "mint", Braun: "braun", Grau: "grau" };

      // Normalisiere eingehende Routen
      const normalized = incoming.map((r, idx) => ({
        _idx: idx,
        color: COLOR_MAP[r.color] || (r.color || "").toLowerCase().trim(),
        grade: (r.grade === "BS" || r.grade === "bs" || r.isBockstar) ? "BS" : (Number(r.grade) || 0),
        sector: SECTOR_MAP[r.sector] || SECTOR_MAP[r.gym] || r.sector || r.gym,
        date: r.date || todayISO(),
        imageUrl: r.imageUrl || r.image || null,
        sourceName: r.name || null,
      })).filter(r => r.color && r.grade && r.sector);

      pushSyncLog(`🔍 ${normalized.length} valide Routen (Farbe + Grade + Sektor vorhanden)`);

      let matched = 0, created = 0, archived = 0;
      const today = todayISO();

      // ── Bilder VORAB als separate Blobs speichern — NIEMALS base64 in die Community!
      //    (Sonst wird der Community-Datensatz riesig (~8 MB) und das Speichern schlägt fehl.)
      let imgOk = 0, imgFail = 0;
      // Vorab bestimmen, welche eingehenden Routen ihr Bild überhaupt brauchen:
      // gematchte Routen, die schon ein Foto haben, brauchen keinen neuen Blob (spart DB-Platz).
      const skipImg = new Set();
      if (!fullReset) {
        const usedPre = new Set();
        for (const inc of normalized) {
          const m = (community?.routes || []).find(r => !r.archived && r.name === inc.color && r.grade === inc.grade && r.gym === inc.sector && !usedPre.has(r.id));
          if (m) { usedPre.add(m.id); if (m.photos && m.photos.length) skipImg.add(inc._idx); }
        }
      }
      const totalImg = normalized.filter(n => n.imageUrl && !skipImg.has(n._idx)).length;
      if (totalImg) pushSyncLog(`⏳ Speichere ${totalImg} Bilder…`);
      let imgDone = 0;
      for (const inc of normalized) {
        if (!inc.imageUrl || skipImg.has(inc._idx)) continue;
        try {
          let dataUrl = inc.imageUrl;
          const isData = typeof dataUrl === "string" && dataUrl.startsWith("data:");
          if (!isData) {
            // http(s)-URL → laden + verkleinern
            const resp = await fetch(dataUrl, { mode: "cors" });
            const blob = await resp.blob();
            dataUrl = await downscale(new File([blob], "img.jpg", { type: blob.type }));
          } else if (dataUrl.length > 200000) {
            // großes eingebettetes Bild (> ~150 KB) → verkleinern
            const blob = await (await fetch(dataUrl)).blob();
            dataUrl = await downscale(new File([blob], "img.jpg", { type: blob.type }));
          }
          const pid = uid();
          await savePhotoBlob(pid, dataUrl);
          inc._photoId = pid;
          imgOk++;
        } catch (e) { imgFail++; }
        imgDone++;
        if (imgDone % 15 === 0) pushSyncLog(`   …${imgDone}/${totalImg}`);
      }
      if (totalImg) pushSyncLog(`📸 ${imgOk} Bilder gespeichert` + (imgFail ? ` (${imgFail} fehlgeschlagen)` : ""), imgFail ? "warn" : "");

      // Abgleich VOR dem State-Update berechnen (React kann den Reducer im Strict-Mode
      // doppelt aufrufen — deshalb muss der Reducer pur sein und darf nicht mitzählen).
      const originalRoutes = [...(community?.routes || [])];
      const usedIds = new Set();
      let newRoutes = fullReset ? [] : [...originalRoutes];
      if (fullReset) archived = originalRoutes.filter(r => !r.archived).length;
      const nickSeen = new Set(originalRoutes.map(r => (r.nick || "").toLowerCase().trim()).filter(Boolean));

      for (const inc of normalized) {
        let matchIdx = -1;
        if (!fullReset) {
          // Match: Farbe + Grad + Sektor (Datum wird auf Sendly-Stand angeglichen).
          // Hintergrund: An einer Wand hängt immer nur EIN Umschraub-Datum-Set gleichzeitig.
          matchIdx = originalRoutes.findIndex(r => !r.archived && r.name === inc.color && r.grade === inc.grade && r.gym === inc.sector && !usedIds.has(r.id));
        }
        if (matchIdx >= 0) {
          const mr = originalRoutes[matchIdx];
          usedIds.add(mr.id);
          matched++;
          const ni = newRoutes.findIndex(r => r.id === mr.id);
          if (ni >= 0) {
            const patch = { ...newRoutes[ni] };
            // Datum an Sendly angleichen, damit die Wand einheitlich datiert ist
            if (inc.date && patch.date !== inc.date) patch.date = inc.date;
            // Bild ergänzen, falls noch keins da ist
            if (inc._photoId && (!patch.photos || patch.photos.length === 0)) patch.photos = [inc._photoId];
            newRoutes[ni] = patch;
          }
        } else {
          const nick = genUniqueName(inc.grade, nickSeen);
          nickSeen.add(nick.toLowerCase().trim());
          const newId = uid();
          newRoutes.push({
            id: newId, date: inc.date || today, gym: inc.sector, grade: inc.grade,
            name: inc.color, nick, note: "", archived: false, results: {},
            photos: inc._photoId ? [inc._photoId] : [], tips: [],
          });
          usedIds.add(newId); // WICHTIG: sonst archiviert die Schleife unten die gerade neu angelegte Route sofort wieder
          created++;
        }
      }

      if (!fullReset) {
        const sectorsInSync = new Set(normalized.map(n => n.sector));
        newRoutes = newRoutes.map(r => {
          if (!r.archived && sectorsInSync.has(r.gym) && !usedIds.has(r.id)) { archived++; return { ...r, archived: true }; }
          return r;
        });
      }

      // Reducer ist jetzt eine reine Zuweisung — im Strict-Mode ungefährlich.
      setCommunity(c => ({ ...c, routes: newRoutes }));

      pushSyncLog(`✓ ${matched} bestehende Routen aktualisiert`);
      pushSyncLog(`✓ ${created} neue Routen angelegt`);
      if (archived > 0) pushSyncLog(`⏸ ${archived} alte Routen ${fullReset ? "entfernt" : "archiviert"}`, "warn");
      pushSyncLog("✅ Sync abgeschlossen.", "ok");

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

  // ── Backup / Wiederherstellung ──────────────────────────────────────────────
  const [backupBusy, setBackupBusy] = useState(false);
  async function exportCommunity() {
    if (backupBusy) return;
    setBackupBusy(true);
    try {
      // Foto-Blobs einsammeln, damit das Backup WIRKLICH vollständig ist
      // (Routen speichern nur Foto-IDs; die Bilder liegen als separate Blobs in der DB)
      const ids = new Set();
      for (const r of (community.routes || [])) for (const pid of (r.photos || [])) {
        if (typeof pid === "string" && !pid.startsWith("data:") && !pid.startsWith("/")) ids.add(pid);
      }
      const photoBlobs = {};
      for (const pid of ids) { const b = await loadPhotoBlob(pid); if (b) photoBlobs[pid] = b; }
      const payload = { ...community, _backupVersion: 2, _exportedAt: new Date().toISOString(), _photoBlobs: photoBlobs };
      const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      a.href = url; a.download = `blocscore-backup-${stamp}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) { alert("Export fehlgeschlagen."); }
    setBackupBusy(false);
  }
  async function importCommunityFile(file) {
    if (!file) return;
    let data;
    try { data = JSON.parse(await file.text()); } catch (e) { alert("Datei ist kein gültiges JSON."); return; }
    if (!data || !Array.isArray(data.accounts) || !Array.isArray(data.routes)) { alert("Datei enthält keine gültigen blocscore-Daten (accounts/routes fehlen)."); return; }
    const nPhotos = data._photoBlobs ? Object.keys(data._photoBlobs).length : 0;
    if (!confirm(`Backup wiederherstellen?\n\n${data.accounts.length} Nutzer · ${data.routes.length} Routen${nPhotos ? ` · ${nPhotos} Bilder` : ""}\n\nDas ersetzt die aktuellen Daten. Der jetzige Stand wird vorher als Snapshot gesichert.`)) return;
    await writeSnapshot(community, true);
    if (data._photoBlobs) {
      for (const [pid, b] of Object.entries(data._photoBlobs)) { try { await savePhotoBlob(pid, b); } catch (e) {} }
    }
    const { _photoBlobs, _backupVersion, _exportedAt, ...clean } = data;
    setCommunity(clean);
    alert("Wiederhergestellt." + (nPhotos ? ` (${nPhotos} Bilder)` : ""));
  }
  const [snapOpen, setSnapOpen] = useState(false);
  const [snaps, setSnaps] = useState(null);
  async function openSnapshots() { setSnapOpen(true); setSnaps(null); try { setSnaps(await listSnapshots()); } catch (e) { setSnaps([]); } }
  async function restoreSnapshot(slot) {
    const snap = await loadSnapshot(slot);
    if (!snap || !snap.data) { alert("Snapshot nicht lesbar."); return; }
    if (!confirm(`Snapshot von ${fmtDateTime(snap.ts)} wiederherstellen?\n\n${snap.accounts} Nutzer · ${snap.routes} Routen\n\nDer jetzige Stand wird vorher gesichert.`)) return;
    await writeSnapshot(community, true);
    setCommunity(snap.data);
    setSnapOpen(false);
    alert("Snapshot wiederhergestellt.");
  }
  const [delConfirm, setDelConfirm] = useState(false);
  // Ganzen Bereich archivieren (Route Creator): z.B. wenn ein Sektor neu gepflegt werden soll
  function archiveWall(wall) {
    const act = (community.routes || []).filter(r => !r.archived && r.gym === wall);
    if (!act.length) return;
    if (!confirm((LANG === "en"
      ? `Archive all ${act.length} active routes in "${wallName(wall)}"?\n\nResults are kept. A safety snapshot is taken first.`
      : `Alle ${act.length} aktiven Routen in „${wallName(wall)}" archivieren?\n\nErgebnisse bleiben erhalten. Der aktuelle Stand wird vorher als Snapshot gesichert.`))) return;
    writeSnapshot(community, true);
    const ids = new Set(act.map(r => r.id));
    setCommunity(c => ({ ...c, routes: c.routes.map(r => ids.has(r.id) ? { ...r, archived: true } : r) }));
  }
  const [emailOpen, setEmailOpen] = useState(false);
  async function saveMyEmail(email, pw) {
    const hasPin = !!(me?.pinHash || me?.pin);
    if (hasPin && !(await verifyPin(pw, me))) return { ok: false, err: "pw" };
    const em = (email || "").trim().toLowerCase();
    if (em && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) return { ok: false, err: "format" };
    setCommunity(c => ({ ...c, accounts: c.accounts.map(a => a.id === me.id ? { ...a, email: em } : a) }));
    setEmailOpen(false);
    return { ok: true };
  }
  async function confirmDeleteMyAccount(pin) {
    const ok = await verifyPin(pin, me);
    if (!ok) return false;
    setDelConfirm(false);
    removeAccount(me.id);
    logout();
    return true;
  }
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
  // Passwort-Reset über verknüpfte E-Mail (Name + hinterlegte E-Mail müssen zusammenpassen)
  async function handlePinReset({ name, email, newPin }) {
    const acc = accounts.find(a => a.name.toLowerCase() === name.trim().toLowerCase());
    if (!acc) return { ok: false, err: "noacc" };
    if (!acc.email) return { ok: false, err: "noemail" };
    if (acc.email.toLowerCase() !== email.trim().toLowerCase()) return { ok: false, err: "mismatch" };
    const f = await makePinFields(newPin);
    setCommunity(c => ({ ...c, accounts: c.accounts.map(a => { if (a.id !== acc.id) return a; const { pin: _legacy, ...rest } = a; return { ...rest, ...f }; }) }));
    return { ok: true };
  }
  function logout() { setSession(null); saveSession(null); setTab("routes"); }
  function dismissIntro() {
    setShowIntro(false);
    if (me) setCommunity(c => ({ ...c, accounts: c.accounts.map(a => a.id === me.id ? { ...a, skipIntro: true } : a) }));
  }

  if (loadError) return <div className="bld"><style>{CSS}</style><div className="empty" style={{ margin: "auto", textAlign: "center", padding: 22, maxWidth: 360 }}>
    <div className="big">⚠️</div>
    <div style={{ fontWeight: 800, fontSize: 19, margin: "6px 0 8px" }}>Daten konnten nicht geladen werden</div>
    <div style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.55 }}>Die Verbindung zur Datenbank hat nicht geklappt. Aus Sicherheitsgründen wurde <b>nichts überschrieben</b> — deine Daten sind nicht verloren. Bitte Internetverbindung prüfen und neu laden.</div>
    <button className="save" style={{ marginTop: 18 }} onClick={() => location.reload()}>Neu laden</button>
  </div></div>;
  if (!ready) return <div className="bld"><style>{CSS}</style><div className="empty" style={{ margin: "auto" }}>Lädt…</div></div>;
  if (!me) return <LoginScreen accounts={accounts} onLogin={handleLogin} onSignup={handleSignup} onResetPin={handlePinReset} lang={lang} onLang={changeLang} />;
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
        <button className="uchip" onClick={() => setTab("account")}>
          {me.role !== "community" && me.role !== "superadmin" && <span className="adminpill">{me.role === "admin" ? "Admin" : "Route Creator"}</span>}
          <span className="un">{me.name}</span>
          <Avatar name={me.name} size={28} emoji={me.emoji} />
        </button>
      </div>

      {showInstall && !installHintDismissed && (        <div className="installhint">
          <div className="installhint-bubble" onClick={doInstall} role="button" tabIndex={0}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v11" /><path d="M8 11l4 4 4-4" /><path d="M5 20h14" /></svg>
            <span>{LANG === "en" ? "Install App" : "App installieren"}</span>
          </div>
          <button className="installhint-close" onClick={dismissInstallHint} aria-label={LANG === "en" ? "Dismiss" : "Ausblenden"}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
      )}

      {autoArchiveMsg && <div className="autoarchive-toast">{autoArchiveMsg}</div>}

      {/* BOARD */}
      {tab === "board" && (<>
        <div className="segwrap" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <div className="seg">
            <button className={boardScope === "einzel" ? "on" : ""} onClick={() => setBoardScope("einzel")}>{t("board.einzel")}</button>
            <button className={boardScope === "gruppen" ? "on" : ""} onClick={() => setBoardScope("gruppen")}>{t("board.gruppen")}</button>
          </div>
          <div className="seg">
            <button className={boardMode === "aktuell" ? "on" : ""} title={LANG === "en" ? "Points from routes currently on the wall" : "Punkte aus Routen, die aktuell an der Wand hängen"} onClick={() => setBoardMode("aktuell")}>{t("board.aktuell")}</button>
            <button className={boardMode === "gesamt" ? "on" : ""} title={LANG === "en" ? "All-time points, incl. archived routes" : "Alle je erkletterten Punkte, inkl. archivierter Routen"} onClick={() => setBoardMode("gesamt")}>{t("board.gesamt")}</button>
            <button className={boardMode === "erfolge" ? "on" : ""} title={LANG === "en" ? "Skillpoints from unlocked achievements" : "Skillpoints aus freigeschalteten Erfolgen"} onClick={() => setBoardMode("erfolge")}>{t("board.erfolge")}</button>
          </div>
        </div>
        <div className="scroll"><div className="lb">
          {boardScope === "einzel" && ranked.map((p, i) => { const tot = totals[p] || {}; const v = tot[boardMode] || 0; const isMe = p === me.name; const isErf = boardMode === "erfolge"; return (
            <div key={p} className={"lbrow" + (i === 0 && v > 0 ? " lead" : "") + (isMe ? " meRow" : "")}>
              <div className="rank">{medal(i) || (i + 1)}</div>
              <div className="who">
                <div className="nm">{p}{isMe && <span className="youtag">DU</span>}</div>
                <div className="meta"><span><b>{tot.flashes || 0}</b> Flashes</span><span>{tot.sends || 0} Tops</span>{boardMode === "aktuell" && (tot.gesamt || 0) > (tot.aktuell || 0) && <span className="ptssub">{LANG === "en" ? "all time" : "gesamt"} {fmtPts(tot.gesamt)}</span>}</div>
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
                <button className={"chip chip-bs" + (fGrade === "BS" ? " on" : "")} style={fGrade === "BS" ? { borderColor: "#ffaa28", color: "#ffaa28", background: "linear-gradient(140deg,rgba(255,170,40,.18),rgba(229,71,125,.18))" } : {}} onClick={() => setFGrade(fGrade === "BS" ? 0 : "BS")} title="Bockstar">BS</button>
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
                  {needsCare[s.wall] && <span className="carebadge">🔧 {LANG==="en"?"needs setting":"braucht Pflege"}</span>}
                  {myWallDone[s.wall] > 0 && <span className="wadone"><svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{display:"inline-block",verticalAlign:"middle",marginRight:2,marginTop:-1}}><polyline points="1.5,5.5 4,8 8.5,2"/></svg>{myWallDone[s.wall]}</span>}
                  {(() => { const flN = s.items.filter(r => r.results?.[me.name] === "flash").length; return flN > 0 ? <span className="waflash"><svg width="8" height="9" viewBox="0 0 10 12" fill="currentColor" style={{display:"inline-block",verticalAlign:"middle",marginRight:2,marginTop:-1}}><path d="M7 1L1 7h4l-2 4 6-6H5z"/></svg>{flN}</span> : null; })()}
                  <span className="wacount">{s.items.length} Routen</span>
                  <span className="wachevron">{isOpen ? "▲" : "▼"}</span>
                </button>
                {isOpen && (
                  <div className="wallbody">
                    {canSetRoutes && filterScope === "aktuell" && s.items.length > 0 && (
                      <button className="archwallbtn" onClick={() => archiveWall(s.wall)}>⏸ {LANG === "en" ? `Archive entire sector (${s.items.length} routes)` : `Ganzen Bereich archivieren (${s.items.length} Routen)`}</button>
                    )}
                    {needsCare[s.wall] && (
                      <div className="carebox">
                        <div className="carebox-ttl">🔧 {LANG==="en"?"This sector needs setting":"Dieser Bereich muss neu geschraubt werden"}</div>
                        <div className="carebox-txt">
                          {LANG==="en"
                            ? <>The rescrew date ({fmtDate(needsCare[s.wall])}) has passed and the old routes were archived. Routes still need to be set here.</>
                            : <>Das Umschraubdatum ({fmtDate(needsCare[s.wall])}) ist erreicht und die alten Routen wurden archiviert. Hier müssen noch Routen geschraubt werden.</>}
                        </div>
                        <div className="carebox-txt" style={{ marginTop: 6 }}>
                          {canSetRoutes
                            ? (LANG==="en" ? "You can set routes here — tap the “+ Add route” button." : "Du kannst hier Routen anlegen — tippe oben auf den Plus-Button.")
                            : (LANG==="en" ? "Want to help? Anyone from the community can set routes — just request the Route Creator role under Profile from an admin." : "Du willst helfen? Jeder aus der Community kann mithelfen — frage dafür einfach beim Admin die Route-Creator-Rolle an (unter Profil).")}
                        </div>
                      </div>
                    )}
                    {!s.careOnly && (() => {
                      const ds = [...new Set(s.items.map(r => r.date).filter(Boolean))].sort();
                      const planned = screwDates[s.wall];
                      const tod = todayISO();
                      if (!ds.length && !planned) return null;
                      return (
                        <div className="lhsub">
                          {ds.length > 0 && <>🔩 {LANG === "en" ? "Routes on the wall from" : "Routen an der Wand vom"} {ds.map(d => fmtDate(d)).join(" + ")}</>}
                          {planned && planned > tod && <span className="lhplan">{ds.length > 0 ? " · " : ""}🗓 {LANG === "en" ? "re-set planned" : "Umschrauben geplant"}: {fmtDate(planned)}</span>}
                        </div>
                      );
                    })()}
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
                          {hasPhoto && <RoutePhoto photoId={r.photos[0]} className="rbanner" onClick={async () => { const all = []; for (const pid of (r.photos || [])) { const inline = typeof pid === "string" && pid.startsWith("data:"); const s = inline ? pid : await loadPhotoBlob(pid); if (s) all.push(s); } if (all.length) setLightbox({ images: all, startIndex: 0 }); }} />}
                          <div className="rbody">
                            <div className="rchead">
                              <div className={"gcol" + (col === "#181C22" ? " black-grade" : "")} style={col ? { "--gcol-color": col === "#181C22" ? "#181C22" : col, background: col === "#181C22" ? "rgba(255,255,255,0.9)" : "transparent" } : { "--gcol-color": "#b8ff00" }}>
                                <span className={"ggrade" + (isBockstar(r) ? " ggrade-bs" : "")}>{gradeLabel(r)}</span>
                              </div>
                              <div className="rname">
                                <div className="t1"><span className="txt">{routeTitle(r)}</span>{r.archived && <span className="archtag">Archiv</span>}</div>
                                {r.note ? <div className="rnote">{r.note}</div> : null}
                                <div className="t2">{colorWord(r.name) ? colorWord(r.name) + " · " : ""}{isBockstar(r) ? "Bockstar" : isBockstar(r) ? "Bockstar" : (r.grade + "er")} · {wallName(r.gym)}{r.date ? " · 🔩 " + fmtDate(r.date) : ""}</div>
                              </div>
                              <div className="rpills">
                                <span className={"rschip top" + (topN > 0 ? " has" : "")}><svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{display:"inline-block",verticalAlign:"middle",marginRight:2,marginTop:-1}}><polyline points="1.5,5.5 4,8 8.5,2"/></svg>{topN}</span>
                                <span className={"rschip flash" + (flashN > 0 ? " has" : "")}><svg width="8" height="9" viewBox="0 0 10 12" fill="currentColor" style={{display:"inline-block",verticalAlign:"middle",marginRight:2,marginTop:-1}}><path d="M7 1L1 7h4l-2 4 6-6H5z"/></svg>{flashN}</span>
                              </div>
                              <button className={"edit" + (canSetRoutes ? "" : " infobtn")} onClick={(e) => { e.stopPropagation(); setEditing(r); }} title={canSetRoutes ? (LANG==="en"?"Edit route":"Route bearbeiten") : (LANG==="en"?"Route info":"Route Info")}>
                                {canSetRoutes
                                  ? <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17l3.5-1L17 5.5 14.5 3 4 13.5 3 17z"/></svg>
                                  : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="8.5" strokeWidth="2.8"/><line x1="12" y1="11" x2="12" y2="17"/></svg>
                                }
                              </button>
                            </div>
                            <div className="rfoot">
                              <button className={"du " + (myStatus || "")} onClick={() => cycleMine(r.id)}>
                                {myStatus === "flash" ? <><svg width="11" height="13" viewBox="0 0 10 12" fill="currentColor"><path d="M7 1L1 7h4l-2 4 6-6H5z"/></svg>Flash <span className="dpts">+{fmtPts(pointsFor(gradeValue(r), "flash"))}</span></>
                                  : myStatus === "top" ? <><svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1.5,5.5 4,8 8.5,2"/></svg>Top <span className="dpts">+{fmtPts(pointsFor(gradeValue(r), "top"))}</span></>
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
            {canSetRoutes && <div className="phint" style={{ marginTop: 8 }}>Datum ändern → neue Routen dieser Wand erben automatisch das Schraubdatum. <b>Achtung:</b> Steht ein Termin auf dem heutigen Datum, archiviert die App die alten Routen dieser Wand automatisch (einmalig). Zukünftige Termine ändern an den bestehenden Routen nichts.</div>}
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

            {(() => {
              const lv = levelFor(levelXp);
              const into = levelXp - lv.need;
              const span = lv.next ? (lv.next.need - lv.need) : 1;
              const pct = lv.next ? Math.max(2, Math.min(100, (into / span) * 100)) : 100;
              return (
                <div className="lvlcard">
                  <div className="lvlhead">
                    <div className="lvlnum">{lv.level}<span>/100</span></div>
                    <div className="lvlname">
                      <div className="lvltitle">{lv.name}</div>
                      <div className="lvlsub">{fmtPts(levelXp)} {LANG === "en" ? "career points" : "Karriere-Punkte"}</div>
                    </div>
                  </div>
                  <div className="lvlbar"><i style={{ width: pct + "%" }} /></div>
                  <div className="lvlnext">
                    {lv.next
                      ? (LANG === "en"
                          ? <><b>{fmtPts(Math.ceil(lv.next.need - levelXp))}</b> more points to Level {lv.next.level} · {lv.next.name}</>
                          : <>noch <b>{fmtPts(Math.ceil(lv.next.need - levelXp))}</b> Punkte bis Level {lv.next.level} · {lv.next.name}</>)
                      : <>🏔 {LANG === "en" ? "Max level reached — you are a legend!" : "Maximales Level erreicht — du bist eine Legende!"}</>}
                  </div>
                </div>
              );
            })()}

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
            {achState.catList.map(c => { const full = c.total > 0 && c.done === c.total; const isContrib = c.cat === "Community" || c.cat === "Contributor"; const uc = unclaimedByCat[c.cat] || 0; return (
              <button key={c.cat} className={"catrow" + (full ? " catrow-done" : "")} onClick={() => setAchCat(c.cat)}>
                <span className="achic">{c.icon}</span>
                <div className="achinfo"><div className="achn">{c.cat}{isContrib && <span className="creatortag" title={LANG==="en"?"Some need Route Creator":"Teils Route-Creator nötig"}>🛠</span>}{uc > 0 && <span className="claimtag">{uc} 🎁</span>}</div><div className="achbar"><i style={{ width: `${(c.done / c.total) * 100}%` }} /></div></div>
                {full
                  ? <div className="catprog-done"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#b8ff00" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg></div>
                  : <div className="achprog">{c.done}/{c.total}</div>}
              </button>
            ); })}
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
                  <div className={"gcol" + (colorOf(r.name) === "#181C22" ? " black-grade" : "")} style={colorOf(r.name) ? { "--gcol-color": colorOf(r.name) === "#181C22" ? "#181C22" : colorOf(r.name), background: colorOf(r.name) === "#181C22" ? "rgba(255,255,255,0.9)" : "transparent" } : { "--gcol-color": "#b8ff00" }}>
                    <span className={"ggrade" + (isBockstar(r) ? " ggrade-bs" : "")}>{gradeLabel(r)}</span>
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
            const members = (grp.members || []).map(id => accounts.find(a => a.id === id)).filter(a => a && a.role !== "superadmin");

            const memberStats = members.map(m => {
              const mRoutes = routes.filter(r => r.results?.[m.name]);
              const mFlashes = mRoutes.filter(r => r.results[m.name] === "flash").length;
              const mPts = mRoutes.reduce((sum,r) => sum + pointsFor(gradeValue(r), r.results[m.name]), 0);
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
                      <div className="t2">{isBockstar(r) ? "Bockstar" : isBockstar(r) ? "Bockstar" : (r.grade + "er")} · {wallName(r.gym)}</div>
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
                          <span className="srn">{routeTitle(r)} <span className="sgrade">{isBockstar(r) ? "BS" : isBockstar(r) ? "Bockstar" : (r.grade + "er")}</span></span>
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
            const ascentDate = r => (r.resultDates && r.resultDates[me.name]) || r.date;
            const now = new Date(today);
            const from = {
              day: today,
              week: new Date(now - 7*86400000).toISOString().slice(0,10),
              month: new Date(now - 30*86400000).toISOString().slice(0,10),
              year: new Date(now - 365*86400000).toISOString().slice(0,10),
            };
            const periods = [
              { key:"day", label: LANG==="en"?"Day":"Tag" },
              { key:"week", label: LANG==="en"?"Week":"Woche" },
              { key:"month", label: LANG==="en"?"Month":"Monat" },
              { key:"year", label: LANG==="en"?"Year":"Jahr" },
              { key:"all", label: LANG==="en"?"All time":"Gesamt" },
            ];
            const periodLabel = (periods.find(p => p.key === myPeriod) || periods[4]).label;
            const inPeriod = r => {
              if (!r.results?.[me.name]) return false;
              if (myPeriod === "all") return true;
              if (myPeriod === "day") return ascentDate(r) === today;
              return ascentDate(r) >= from[myPeriod];
            };
            const myRoutes = routes.filter(inPeriod);
            const myFlashes = myRoutes.filter(r => r.results[me.name] === "flash").length;
            const myPts = myRoutes.reduce((s,r) => s + pointsFor(gradeValue(r), r.results[me.name]), 0);
            const myMeters = myRoutes.length * WALL_HEIGHT;
            // Grad-Verteilung (Vergleichsbalken analog Gruppen) für den gewählten Zeitraum
            const gmetrics = [
              { key:"tops", label: LANG==="en"?"Sends":"Begehungen", val: g => g.tops, fmt: v => v },
              { key:"flashes", label:"Flashes", val: g => g.flashes, fmt: v => v },
              { key:"pts", label: LANG==="en"?"Points":"Punkte", val: g => g.pts, fmt: v => fmtPts(v) },
            ];
            const curM = gmetrics.find(m => m.key === myMetric) || gmetrics[0];
            const byGrade = GRADES.map(g => {
              const rs = myRoutes.filter(r => r.grade === g);
              return { grade:g, tops: rs.length, flashes: rs.filter(r=>r.results[me.name]==="flash").length, pts: rs.reduce((s,r)=>s+pointsFor(gradeValue(r),r.results[me.name]),0) };
            });
            const maxG = Math.max(1, ...byGrade.map(curM.val));
            // Berge (immer kumulativ / Gesamt)
            const allMyRoutes = routes.filter(r => r.results?.[me.name]);
            const totalMeters = allMyRoutes.length * WALL_HEIGHT;
            const MOUNTAINS = [
              {name:"Feldberg (DE)",m:1493},{name:"Zugspitze (DE)",m:2962},{name:"Großglockner (AT)",m:3798},
              {name:"Matterhorn",m:4478},{name:"Mont Blanc",m:4806},{name:"Elbrus",m:5642},
              {name:"Kilimanjaro",m:5895},{name:"Denali",m:6190},{name:"Aconcagua",m:6961},
              {name:"Mount Everest",m:8849},
            ];
            const nextMtn = MOUNTAINS.find(mn => totalMeters < mn.m);
            return (<>
              {/* Übersicht mit Zeitraum-Filter */}
              <div className="stcard">
                <h3><span>{me.emoji ? me.emoji+" " : "🧗 "}{LANG==="en"?"My Stats":"Meine Stats"}</span><button className="shareIcon" title={LANG==="en"?"Share my stats":"Meine Stats teilen"} onClick={() => { const lv = levelFor(levelXp); const todayTop = routes.filter(r => r.results?.[me.name] && ascentDate(r) === today).sort((a,b)=>b.grade-a.grade).slice(0,10).map(r => ({ grade:r.grade, title:routeTitle(r), color:colorOf(r.name), flash:r.results[me.name]==="flash", wall:wallName(r.gym) })); shareStatsCard({ name: me.name, emoji: me.emoji, levelNum: lv.level, levelName: lv.name, periodLabel, sends: myRoutes.length, flashes: myFlashes, meters: myMeters, pts: myPts, ptsLabel: fmtPts(myPts), todayRoutes: todayTop }); }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><path d="M12 3v13"/><path d="M7 8l5-5 5 5"/></svg></button></h3>
                <div className="seg" style={{ marginBottom:14 }}>
                  {periods.map(p => <button key={p.key} className={myPeriod===p.key?"on":""} onClick={()=>setMyPeriod(p.key)}>{p.label}</button>)}
                </div>
                <div className="hkpi-grid" style={{ gridTemplateColumns:"repeat(2,1fr)" }}>
                  <div className="hkpi"><div className="hkv">{myRoutes.length}</div><div className="hku">{LANG==="en"?"Sends":"Begehungen"}</div></div>
                  <div className="hkpi"><div className="hkv">{myFlashes}</div><div className="hku">Flashes ⚡</div></div>
                  <div className="hkpi"><div className="hkv">{Math.round(myMeters)} m</div><div className="hku">{LANG==="en"?"Elevation 🏔":"Höhenmeter 🏔"}</div></div>
                  <div className="hkpi"><div className="hkv">{fmtPts(myPts)}</div><div className="hku">{LANG==="en"?"Points":"Punkte"}</div></div>
                </div>
              </div>

              {/* Grad-Verteilung (Vergleich, mit Metrik-Toggle) */}
              <div className="stcard">
                <h3><span>{LANG==="en"?"By grade":"Nach Grad"}</span><span className="r">{periodLabel}</span></h3>
                <div className="seg" style={{ marginBottom:14 }}>
                  {gmetrics.map(m => <button key={m.key} className={myMetric===m.key?"on":""} onClick={()=>setMyMetric(m.key)}>{m.label}</button>)}
                </div>
                {myRoutes.length === 0
                  ? <div className="note">{LANG==="en"?"No sends in this period yet.":"Noch keine Begehungen in diesem Zeitraum."}</div>
                  : byGrade.map(g => {
                      const v = curM.val(g);
                      const pct = Math.round((v / maxG) * 100);
                      return (
                        <div key={g.grade} style={{ marginBottom:12 }}>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", fontSize:12, marginBottom:5 }}>
                            <span style={{ color: GRADE_COLOR[g.grade], fontWeight:700 }}>{g.grade}er</span>
                            <span style={{ color:"var(--muted)" }}>{curM.fmt(v)}</span>
                          </div>
                          <div style={{ height:8, background:"var(--panel2)", borderRadius:4, overflow:"hidden" }}>
                            <div style={{ height:"100%", width:`${pct}%`, background:"#b8ff00", borderRadius:4, transition:"width .5s" }}/>
                          </div>
                        </div>
                      );
                    })}
              </div>

              {/* Aktivität (Verlauf) */}
              <div className="stcard">
                <h3><span>{LANG==="en"?"Activity":"Aktivität"}</span></h3>
                <ActivityChart results={allMyRoutes.map(rt => ({ date: ascentDate(rt), status: rt.results[me.name], grade: rt.grade }))} />
              </div>

              {/* Höhenmeter / Berge (Gesamt) */}
              <div className="stcard">
                <h3><span>{LANG==="en"?"Peaks Climbed":"Erklommene Berge"}</span></h3>
                <div className="phint" style={{marginBottom:10}}>{LANG==="en"?`Each route = ${WALL_HEIGHT}m · Total: ${Math.round(totalMeters)}m`:`Jede Route = ${WALL_HEIGHT} Höhenmeter · Gesamt: ${Math.round(totalMeters)} m`}</div>
                {MOUNTAINS.map(mn => {
                  const done = totalMeters >= mn.m;
                  const pct = Math.min(100, (totalMeters/mn.m)*100);
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
                {nextMtn && <div className="note" style={{marginTop:10}}>{LANG==="en"?<>{Math.ceil(nextMtn.m - totalMeters)}m to go until <b>{nextMtn.name}</b> ({nextMtn.m}m)</>:<>Noch {Math.ceil(nextMtn.m - totalMeters)} m bis zum <b>{nextMtn.name}</b> ({nextMtn.m} m)</>}</div>}
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
            {showInstall && (
              <button className="installprofilebtn" onClick={doInstall}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v11"/><path d="M8 11l4 4 4-4"/><path d="M5 20h14"/></svg>
                {LANG === "en" ? "Install App" : "App installieren"}
              </button>
            )}
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
            <div className="emailrow">
              <div className="emailrow-l">
                <span className="langlbl">E-Mail</span>
                <span className="emailval">{me.email || (LANG === "en" ? "not linked" : "nicht verknüpft")}</span>
              </div>
              <button className="miniaction" style={{ marginTop: 0 }} onClick={() => setEmailOpen(true)}><span className="mi-ic">🔗</span>{me.email ? (LANG === "en" ? "Change" : "Ändern") : (LANG === "en" ? "Link email" : "Verknüpfen")}</button>
            </div>
            {!me.email && <div className="lockhint" style={{ marginTop: 4 }}>{LANG === "en" ? "With a linked email you can reset a forgotten password yourself." : "Mit verknüpfter E-Mail kannst du ein vergessenes Passwort selbst zurücksetzen."}</div>}
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
            {!isAdmin && <button className="miniaction" style={{ marginTop: 8, color: "#e98b7d", borderColor: "rgba(233,139,125,.3)", background: "rgba(233,139,125,.08)" }} onClick={() => setDelConfirm(true)}><span className="mi-ic">🗑</span>Konto löschen</button>}
          </div>
          <div className="stcard">
            <h3><span>🔗 {LANG==="en"?"Share blocscore":"blocscore teilen"}</span></h3>
            <div className="note" style={{ marginBottom: 10 }}>{LANG==="en"?"Invite friends to the gym scoreboard.":"Lade Freunde zum Hallen-Scoreboard ein."}</div>
            <button className="miniaction primary" style={{ marginTop: 0 }} onClick={shareApp}>
              <span className="mi-ic">{shared ? "✓" : "📤"}</span>{shared ? (LANG==="en"?"Link copied!":"Link kopiert!") : (LANG==="en"?"Share app · blocscore.de":"App teilen · blocscore.de")}
            </button>
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
              <div className="stcard"><h3><span>💾 Datensicherung</span></h3>
                <div className="note">Lade regelmäßig ein Backup herunter — es enthält Nutzer, Routen, Ergebnisse <b>und alle Bilder</b>. Automatische Snapshots werden zusätzlich im Hintergrund angelegt.</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                  <button className="miniaction" style={{ marginTop: 0, opacity: backupBusy ? .6 : 1 }} disabled={backupBusy} onClick={exportCommunity}><span className="mi-ic">⬇️</span>{backupBusy ? "Sammle Bilder ein…" : "Backup herunterladen (JSON, inkl. Bilder)"}</button>
                  <label className="miniaction" style={{ marginTop: 0, cursor: "pointer" }}>
                    <input type="file" accept="application/json" style={{ display: "none" }} onChange={(e) => { importCommunityFile(e.target.files?.[0]); e.target.value = ""; }} />
                    <span className="mi-ic">⬆️</span>Aus Backup-Datei wiederherstellen
                  </label>
                  <button className="miniaction" style={{ marginTop: 0 }} onClick={openSnapshots}><span className="mi-ic">🕘</span>Automatische Snapshots…</button>
                </div>
              </div>
              <div className="stcard"><h3><span>⚠️ Hard Reset</span></h3>
                <div className="note">Setzt das Board auf die Original-Seed-Daten zurück — <b>alle</b> Nutzer, Routen und Ergebnisse gehen verloren. {isSuperAdmin ? "Lade vorher ein Backup herunter." : "Nur der Superadmin kann das Board zurücksetzen."}</div>
                {isSuperAdmin && <button className="miniaction danger" onClick={() => {
                  const phrase = prompt("Zum Zurücksetzen exakt eintippen:  BOARD ZURUECKSETZEN");
                  if (phrase === null) return;
                  if (phrase.trim() !== "BOARD ZURUECKSETZEN") { alert("Falsche Eingabe — abgebrochen."); return; }
                  if (!confirm("Wirklich ALLES auf Seed zurücksetzen? Der jetzige Stand wird vorher als Snapshot gesichert.")) return;
                  writeSnapshot(community, true);
                  setCommunity(SEED_COMMUNITY);
                }}>Board zurücksetzen</button>}
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
        <button className={"tab" + (tab === "stats" ? " on" : "")} onClick={() => setTab("stats")} style={{ position: "relative" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="5"/><path d="M9 21h6M12 13v8M7.5 16.5l-2 2M16.5 16.5l2 2"/></svg>
          <span>{t("nav.ach")}</span>
          {unclaimedAch.length > 0 && <span className="tabbadge">{unclaimedAch.length > 9 ? "9+" : unclaimedAch.length}</span>}
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
        <RouteSheet route={editing === "new" ? null : editing} me={me} gyms={wallsPresent.map(w => w.code)} isAdmin={isAdmin} canSetRoutes={canSetRoutes} readOnly={!canSetRoutes && editing && editing !== "new"} canSeeMeta={canSetRoutes} canPhoto={canPhoto} achScore={achScore} existingNicks={new Set((community?.routes || []).filter(r => !(editing && editing !== "new" && r.id === editing.id)).map(r => (r.nick || "").toLowerCase().trim()).filter(Boolean))} screwDates={screwDates}
          onClose={() => setEditing(null)} onSave={(r) => { upsertRoute(r); setEditing(null); }} onDelete={(id) => { deleteRoute(id); setEditing(null); }} />
        </RouteSheetBoundary>
      )}
      {tipsRoute && (
        <TipsSheet route={tipsRoute} me={me} isAdmin={isAdmin} onClose={() => setTipsRouteId(null)} onAdd={(t) => addTip(tipsRoute.id, t)} onDelete={(id) => delTip(tipsRoute.id, id)} />
      )}
      {newGroupOpen && <NewGroupSheet onClose={() => setNewGroupOpen(false)} achScore={achScore} isAdmin={isAdmin} onCreate={(n, e, isPriv) => { createGroup(n, e, isPriv); setNewGroupOpen(false); }} />}
      {changePinOpen && <ChangePinSheet me={me} onClose={() => setChangePinOpen(false)} onSave={(p) => { setMyPin(p); setChangePinOpen(false); }} />}
      {scoringOpen && <ScoringSheet step={STEP} flash={FLASH_BONUS} onClose={() => setScoringOpen(false)} onSave={(s,f) => { setScoring(s,f); setScoringOpen(false); }} />}
      {levelUp && <LevelUpModal level={levelUp.level} name={levelUp.name} story={levelUp.story} onClose={() => setLevelUp(null)} />}
      {achUnlock && !levelUp && <AchUnlockModal items={achUnlock.items} extra={achUnlock.extra} fact={achUnlock.fact} onClose={() => setAchUnlock(null)} />}
      {iosInstallOpen && (
        <div className="scrim" onClick={() => setIosInstallOpen(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="grip" />
            <div className="shead"><h2>{LANG === "en" ? "Install blocscore" : "blocscore installieren"}</h2><button className="x" onClick={() => setIosInstallOpen(false)}>✕</button></div>
            <div className="sbody">
              {isIOS ? (<>
                <div className="note" style={{ marginBottom: 14 }}>{LANG === "en" ? "On iPhone/iPad, add the app to your home screen via Safari:" : "Auf iPhone/iPad fügst du die App über Safari zum Home-Bildschirm hinzu:"}</div>
                <div className="iosstep"><span className="iosnum">1</span><span>{LANG === "en" ? <>Tap the <b>Share</b> icon <span style={{whiteSpace:"nowrap"}}>( ⬆️ )</span> in the Safari toolbar.</> : <>Tippe in der Safari-Leiste auf das <b>Teilen</b>-Symbol <span style={{whiteSpace:"nowrap"}}>( ⬆️ )</span>.</>}</span></div>
                <div className="iosstep"><span className="iosnum">2</span><span>{LANG === "en" ? <>Scroll down and tap <b>“Add to Home Screen”</b>.</> : <>Scrolle nach unten und tippe auf <b>„Zum Home-Bildschirm"</b>.</>}</span></div>
                <div className="iosstep"><span className="iosnum">3</span><span>{LANG === "en" ? <>Tap <b>“Add”</b> — done!</> : <>Tippe oben rechts auf <b>„Hinzufügen"</b> — fertig!</>}</span></div>
              </>) : isFirefox && isAndroid ? (<>
                <div className="note" style={{ marginBottom: 14 }}>{LANG === "en" ? "In Firefox on Android:" : "In Firefox auf Android:"}</div>
                <div className="iosstep"><span className="iosnum">1</span><span>{LANG === "en" ? <>Tap the <b>menu</b> (⋮) at the top right.</> : <>Tippe oben rechts auf das <b>Menü</b> (⋮).</>}</span></div>
                <div className="iosstep"><span className="iosnum">2</span><span>{LANG === "en" ? <>Tap <b>“Install”</b> or <b>“Add to Home screen”</b>.</> : <>Tippe auf <b>„Installieren"</b> bzw. <b>„Zum Startbildschirm hinzufügen"</b>.</>}</span></div>
                <div className="iosstep"><span className="iosnum">3</span><span>{LANG === "en" ? <>Confirm — done!</> : <>Bestätige — fertig!</>}</span></div>
              </>) : isFirefox ? (<>
                <div className="note" style={{ marginBottom: 14 }}>{LANG === "en" ? "Firefox on desktop doesn't support installing web apps. To install blocscore as an app, open it once in Chrome or Edge — or simply bookmark this page (Ctrl+D)." : "Firefox am Desktop unterstützt das Installieren von Web-Apps leider nicht. Um blocscore als App zu installieren, öffne die Seite einmal in Chrome oder Edge — oder setz dir einfach ein Lesezeichen (Strg+D)."}</div>
              </>) : isSafariDesktop ? (<>
                <div className="note" style={{ marginBottom: 14 }}>{LANG === "en" ? "In Safari on Mac:" : "In Safari am Mac:"}</div>
                <div className="iosstep"><span className="iosnum">1</span><span>{LANG === "en" ? <>Click the <b>Share</b> icon in the toolbar (or File menu).</> : <>Klicke auf das <b>Teilen</b>-Symbol in der Symbolleiste (oder Menü „Ablage").</>}</span></div>
                <div className="iosstep"><span className="iosnum">2</span><span>{LANG === "en" ? <>Choose <b>“Add to Dock”</b>.</> : <>Wähle <b>„Zum Dock hinzufügen"</b>.</>}</span></div>
                <div className="iosstep"><span className="iosnum">3</span><span>{LANG === "en" ? <>Confirm — done!</> : <>Bestätige — fertig!</>}</span></div>
              </>) : (<>
                <div className="note" style={{ marginBottom: 14 }}>{LANG === "en" ? "In your browser menu look for “Install app” or “Add to Home screen”:" : "Suche im Browser-Menü nach „App installieren“ oder „Zum Startbildschirm hinzufügen“:"}</div>
                <div className="iosstep"><span className="iosnum">1</span><span>{LANG === "en" ? <>Open the <b>browser menu</b> (usually ⋮ or ≡).</> : <>Öffne das <b>Browser-Menü</b> (meist ⋮ oder ≡).</>}</span></div>
                <div className="iosstep"><span className="iosnum">2</span><span>{LANG === "en" ? <>Tap <b>“Install app”</b> / <b>“Add to Home screen”</b>.</> : <>Tippe auf <b>„App installieren"</b> / <b>„Zum Startbildschirm hinzufügen"</b>.</>}</span></div>
              </>)}
              <button className="save" style={{ marginTop: 16 }} onClick={() => setIosInstallOpen(false)}>{LANG === "en" ? "Got it" : "Verstanden"}</button>
            </div>
          </div>
        </div>
      )}
      {lightbox && <PhotoLightbox src={typeof lightbox === "string" ? lightbox : undefined} images={typeof lightbox === "object" ? lightbox.images : undefined} startIndex={typeof lightbox === "object" ? (lightbox.startIndex || 0) : 0} onClose={() => setLightbox(null)} />}
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
      {achCat && <CategorySheet cat={achCat} items={achState.evald.filter(a => a.cat === achCat)} claimedSet={claimedSet} onClaim={claimAch} onClose={() => setAchCat(null)} />}
      {delConfirm && <DeleteAccountSheet me={me} onClose={() => setDelConfirm(false)} onConfirm={confirmDeleteMyAccount} />}
      {emailOpen && <EmailLinkSheet me={me} onClose={() => setEmailOpen(false)} onSave={saveMyEmail} />}
      {snapOpen && (
        <div className="scrim" onClick={() => setSnapOpen(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="grip" />
            <div className="shead"><h2>🕘 Automatische Snapshots</h2><button className="x" onClick={() => setSnapOpen(false)}>✕</button></div>
            <div className="sbody">
              <div className="note" style={{ marginBottom: 12 }}>Im Hintergrund gesicherte Stände (max. {SNAP_SLOTS}). Tippe einen an, um ihn wiederherzustellen — der aktuelle Stand wird vorher gesichert.</div>
              {snaps === null && <div className="empty" style={{ padding: 20 }}>Lädt…</div>}
              {snaps && snaps.length === 0 && <div className="empty" style={{ padding: 20, textAlign: "center" }}>Noch keine Snapshots vorhanden.</div>}
              {snaps && snaps.map((s, i) => (
                <button key={i} className="snaprow" onClick={() => restoreSnapshot(s.slot)}>
                  <div className="snapmain"><div className="snapdate">{fmtDateTime(s.ts)}</div><div className="snapmeta">{s.accounts} Nutzer · {s.routes} Routen</div></div>
                  <span className="snaprestore">Wiederherstellen</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {openGroupId && (() => {
        const g = groupStats.find(x => x.id === openGroupId); if (!g) return null;
        const isMember = (g.members || []).includes(me.id);
        const isCreator = g.createdBy === me.id;
        const isLastMember = (g.members || []).length === 1 && isMember;
        const canDelete = isCreator || isLastMember || isAdmin;
        const requested = (g.requests || []).includes(me.id);
        const full = (g.members || []).length >= MAX_MEMBERS;
        const inviteables = accounts.filter(a => !groupOf(a.id) && a.id !== me.id && a.role !== "superadmin");
        return (
          <GroupSheet group={g} me={me} accById={accById} boardMode={boardMode}
            isMember={isMember} isCreator={isCreator} canDelete={canDelete} requested={requested} full={full} meHasGroup={!!myGroup} inviteables={inviteables}
            onClose={() => setOpenGroupId(null)}
            onRequest={() => requestJoin(g.id)} onCancelReq={() => cancelRequest(g.id)}
            onAccept={(aid) => acceptRequest(g.id, aid)} onDecline={(aid) => declineRequest(g.id, aid)} onInvite={(aid) => inviteMember(g.id, aid)}
            onLeave={() => { leaveGroup(g.id); setOpenGroupId(null); }}
            onDelete={() => { if (confirm(LANG === "en" ? "Really delete this group?" : "Gruppe wirklich löschen?")) { deleteGroup(g.id); setOpenGroupId(null); } }} />
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
    { code: "pl",  pts: "84,22 98,24 99,46 98,64 95,82 85,83 83,62 82,44", orient: "v", lx: 90.5, ly: 53, fs: 4.7, ls: 0.2, label: en ? "SLAB" : "PLATTE & BUG" },
    { code: "tb",  pts: "100,30 102,16 117,20 117,74 110,82 102,76 100,55", orient: "v", lx: 108.5, ly: 49, fs: 4.6, ls: 0.2, label: en ? "TRAINING AREA" : "TRAININGSBEREICH" },
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
              <polygon points={w.pts} fill="none" stroke="#b8ff00" strokeWidth={fresh ? 0.9 : 0.65} strokeLinejoin="round" filter={`url(#g${rid})`} />
            </>)}
            {w.orient === "v" ? (
              <text x={w.lx} y={w.ly} transform={`rotate(-90 ${w.lx} ${w.ly})`} textAnchor="middle" dominantBaseline="middle" fontFamily="'Barlow Condensed'" fontWeight="700" fontSize={w.fs} letterSpacing={w.ls != null ? w.ls : 0.5} fill={tcol}>{w.label}</text>
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
function CategorySheet({ cat, items, claimedSet, onClaim, onClose }) {
  const cs = claimedSet || new Set();
  const isClaimable = a => a.done && !cs.has(a.id);
  const claimable = items.filter(isClaimable);
  // Einforderbare zuerst, dann Erledigte, dann nach Ziel
  const sorted = [...items].sort((a, b) => (isClaimable(b) - isClaimable(a)) || (b.done - a.done) || (a.target - b.target));
  const shown = sorted.slice(0, 150);
  const done = items.filter(a => a.done).length;
  const headIcon = items[0]?.icon || "🏅";
  const isContributor = cat === "Community" || cat === "Contributor";
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="grip" />
        <div className="shead"><h2>{headIcon} {cat}</h2><button className="x" onClick={onClose}>✕</button></div>
        <div className="sbody">
          {isContributor && (
            <div className="creatorinfo">
              <div className="creatorinfo-ic">🛠</div>
              <div className="creatorinfo-txt">
                {LANG === "en"
                  ? <>Setting routes requires the <b>Route Creator</b> role. Comments unlock at <b>100</b> skillpoints, adding photos at <b>300</b>. Want to set routes? Request the role under <b>Profile</b> from an admin.</>
                  : <>Routen anlegen erfordert die <b>Route-Creator</b>-Rolle. Kommentare werden ab <b>100</b> Skillpoints freigeschaltet, Fotos ab <b>300</b>. Du willst Routen schrauben? Frag die Rolle unter <b>Profil</b> beim Admin an.</>}
              </div>
            </div>
          )}
          {claimable.length > 1 && (
            <button className="claimall" onClick={() => onClaim(claimable.map(a => a.id))}>🎁 {LANG === "en" ? `Claim all (${claimable.length})` : `Alle einfordern (${claimable.length})`}</button>
          )}
          <div className="note" style={{ marginBottom: 12 }}>{done} / {items.length} {t("ach.unlocked")}</div>
          {shown.map(a => { const cl = isClaimable(a); return (
            <div key={a.id} className={"achrow" + (a.done ? " done" : "") + (cl ? " claimable" : "")}>
              <span className="achic">{a.done ? (cl ? "🎁" : "🏅") : a.icon}</span>
              <div className="achinfo"><div className="achn">{a.name}{a.done && !cl && <span className="achchk">✓</span>}</div><div className="achd">{a.desc}</div>{!a.done && <div className="achbar"><i style={{ width: `${a.ratio * 100}%` }} /></div>}</div>
              {cl
                ? <button className="claimbtn" onClick={() => onClaim([a.id])}>{LANG === "en" ? "Claim" : "Einfordern"}</button>
                : <div className="achprog">{Math.min(a.cur, a.target)}/{a.target}<div className="achpts">+{a.pts}</div></div>}
            </div>
          ); })}
          {items.length > 150 && <div className="note" style={{ textAlign: "center", marginTop: 10 }}>… +{items.length - 150}</div>}
        </div>
      </div>
    </div>
  );
}

/* ============================ Konto: Passwort ändern ============================ */
function EmailLinkSheet({ me, onClose, onSave }) {
  const [email, setEmail] = useState(me?.email || "");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const en = LANG === "en";
  const hasPin = !!(me?.pinHash || me?.pin);
  async function go(clear) {
    setBusy(true); setErr("");
    const res = await onSave(clear ? "" : email, pw);
    setBusy(false);
    if (!res.ok) setErr(res.err === "pw" ? (en ? "Wrong password." : "Falsches Passwort.") : (en ? "Please enter a valid email address." : "Bitte eine gültige E-Mail-Adresse eingeben."));
  }
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="grip" />
        <div className="shead"><h2>🔗 {en ? "Link email" : "E-Mail verknüpfen"}</h2><button className="x" onClick={onClose}>✕</button></div>
        <div className="sbody">
          <div className="note" style={{ marginBottom: 12 }}>{en
            ? "With a linked email you can reset a forgotten password on the login screen (name + email must match). The address is only stored for this — no emails are sent."
            : "Mit verknüpfter E-Mail kannst du auf dem Login-Bildschirm ein vergessenes Passwort zurücksetzen (Name + E-Mail müssen zusammenpassen). Die Adresse wird nur dafür gespeichert — es werden keine Mails verschickt."}</div>
          <div className="field"><label>{en ? "Email address" : "E-Mail-Adresse"}</label>
            <input type="email" inputMode="email" autoCapitalize="none" value={email} autoFocus placeholder="name@mail.de" onChange={e => { setEmail(e.target.value); setErr(""); }} />
          </div>
          {hasPin && (
            <div className="field" style={{ marginTop: 12 }}><label>{en ? "Confirm with your password" : "Mit deinem Passwort bestätigen"}</label>
              <input type="password" value={pw} placeholder={en ? "Password" : "Passwort"} onChange={e => { setPw(e.target.value); setErr(""); }} onKeyDown={e => { if (e.key === "Enter" && email) go(false); }} />
            </div>
          )}
          {err && <div className="phint" style={{ color: "#e98b7d", marginTop: 8 }}>{err}</div>}
          <button className="save" style={{ marginTop: 14, opacity: (busy || !email || (hasPin && !pw)) ? .5 : 1 }} disabled={busy || !email || (hasPin && !pw)} onClick={() => go(false)}>{busy ? "…" : (en ? "Save" : "Speichern")}</button>
          {me?.email && <button className="miniaction" style={{ marginTop: 8, width: "100%", justifyContent: "center", color: "#e98b7d" }} disabled={busy || (hasPin && !pw)} onClick={() => go(true)}>{en ? "Remove linked email" : "Verknüpfung entfernen"}</button>}
        </div>
      </div>
    </div>
  );
}
function DeleteAccountSheet({ me, onClose, onConfirm }) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const hasPin = !!(me?.pinHash || me?.pin);
  async function go() {
    setBusy(true); setErr("");
    const ok = await onConfirm(pin);
    setBusy(false);
    if (!ok) setErr(LANG === "en" ? "Wrong password." : "Falsches Passwort.");
  }
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="grip" />
        <div className="shead"><h2>🗑 {LANG === "en" ? "Delete account" : "Konto löschen"}</h2><button className="x" onClick={onClose} aria-label="Schließen"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 2l10 10M12 2L2 12"/></svg></button></div>
        <div className="sbody">
          <div className="delwarn">
            {LANG === "en"
              ? <>This deletes your account <b>{me?.name}</b>. Your logged results stay on the board, but you can no longer log in. This cannot be undone.</>
              : <>Damit wird dein Konto <b>{me?.name}</b> gelöscht. Deine eingetragenen Ergebnisse bleiben auf dem Board, aber du kannst dich nicht mehr einloggen. Das lässt sich nicht rückgängig machen.</>}
          </div>
          {hasPin ? (
            <div className="field" style={{ marginTop: 14 }}>
              <label>{LANG === "en" ? "Enter your password to confirm" : "Zur Bestätigung dein Passwort eingeben"}</label>
              <input type="password" value={pin} autoFocus onChange={e => { setPin(e.target.value); setErr(""); }} onKeyDown={e => { if (e.key === "Enter" && pin) go(); }} placeholder={LANG === "en" ? "Password" : "Passwort"} />
              {err && <div className="phint" style={{ color: "#e98b7d", marginTop: 6 }}>{err}</div>}
            </div>
          ) : (
            <div className="phint" style={{ marginTop: 10 }}>{LANG === "en" ? "Your account has no password set." : "Für dein Konto ist kein Passwort gesetzt."}</div>
          )}
          <button className="del" style={{ marginTop: 16, opacity: (busy || (hasPin && !pin)) ? .5 : 1 }} disabled={busy || (hasPin && !pin)} onClick={go}>
            {busy ? "…" : <>🗑 {LANG === "en" ? "Delete permanently" : "Endgültig löschen"}</>}
          </button>
          <button className="miniaction" style={{ marginTop: 8, width: "100%", justifyContent: "center" }} onClick={onClose}>{LANG === "en" ? "Cancel" : "Abbrechen"}</button>
        </div>
      </div>
    </div>
  );
}
function ProfileEmojiSheet({ me, achScore, isAdmin, onClose, onPick }) {
  const unlocked = getUnlockedEmojis(achScore, isAdmin);
  const next = getNextEmojiUnlock(achScore);
  const locked = [...EMOJI_WAVE1,...EMOJI_WAVE2,...EMOJI_WAVE3,...EMOJI_WAVE4,...EMOJI_WAVE5,...EMOJI_WAVE6,...EMOJI_WAVE7]
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
function GroupSheet({ group, me, accById, boardMode, isMember, isCreator, canDelete, requested, full, meHasGroup, inviteables, onClose, onRequest, onCancelReq, onAccept, onDecline, onInvite, onLeave, onDelete }) {
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

          {isMember && <button className="grp-leave" onClick={onLeave}>{LANG === "en" ? "Leave group" : "Gruppe verlassen"}</button>}
          {canDelete && <button className="grp-delete" onClick={onDelete}>{LANG === "en" ? "Delete group" : "Gruppe löschen"}</button>}
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

function RouteSheet({ route, me, gyms, isAdmin, canSetRoutes, readOnly, canSeeMeta, canPhoto, achScore, existingNicks, onClose, onSave, onDelete, screwDates }) {
  const MAX_PHOTOS = 3;
  const [sheetLb, setSheetLb] = useState(null);
  const FLASH_BONUS = _FLASH_BONUS; // use synced global
  const isNew = !route;
  const [wall, setWall] = useState(route ? (wallOf(route.gym) ? wallCanon(route.gym) : (gyms?.[0] || null)) : null);
  const defaultDate = isNew ? (wall && screwDates?.[wall] ? screwDates[wall] : todayISO()) : (route?.date || todayISO());
  const [date, setDate] = useState(defaultDate);
  // Update date when wall changes (only for new routes)
  function changeWall(w) { setWall(w); if (isNew && screwDates?.[w]) setDate(screwDates[w]); }
  const [grade, setGrade] = useState(route?.grade || 5);
  const [name, setName] = useState(route?.name || "");
  const [nick, setNick] = useState((route?.nick && route.nick.trim()) ? route.nick : genUniqueName(route?.grade || 5, existingNicks));
  const [note, setNote] = useState(route?.note || "");
  const [archived, setArchived] = useState(route?.archived || false);
  const [results, setResults] = useState(route?.results ? { ...route.results } : {});
  const [resultDates, setResultDates] = useState(route?.resultDates ? { ...route.resultDates } : {});
  const [photos, setPhotos] = useState([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileRef = useRef(null);
  const galRef = useRef(null);
  const origPhotoIds = route?.photos || [];
  const valid = !!wall && nick.trim().length > 0;
  const myStatus = results[me.name] || null;

  useEffect(() => { let on = true; (async () => { try { if (!route?.photos?.length) return; const out = []; for (const id of route.photos) { if (!id) continue; if (typeof id === "string" && id.startsWith("data:")) { out.push({ id, dataUrl: id }); } else { try { const b = await loadPhotoBlob(id); if (b) out.push({ id, dataUrl: b }); } catch(_){} } } if (on) setPhotos(out); } catch(e) { console.error("photo load error", e); } })(); return () => { on = false; }; }, []);
  async function onPickFiles(e) { const files = Array.from(e.target.files || []); e.target.value = ""; if (!files.length) return; setPhotoBusy(true); const add = []; const room = MAX_PHOTOS - photos.length; for (const f of files.slice(0, Math.max(0, room))) { try { add.push({ id: uid(), dataUrl: await downscale(f) }); } catch (_) {} } setPhotos(p => [...p, ...add].slice(0, MAX_PHOTOS)); setPhotoBusy(false); }
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

  const [shareMsg, setShareMsg] = useState("");
  async function doShareRoute() {
    const r = route || { name, grade, date };
    const res = await shareRouteInfo(r, photos[0]?.dataUrl);
    if (res === "copied") { setShareMsg("✓"); setTimeout(() => setShareMsg(""), 1800); }
  }

  // Macher-Info + Änderungshistorie (nur Route Creator / Admin)
  const histList = (route?.history && route.history.length)
    ? route.history
    : (route?.createdBy ? [{ by: route.createdBy, ts: route.createdAt, action: "create" }] : []);
  const metaBlock = (!isNew && canSeeMeta && route) ? (
    <div className="metabox">
      <div className="metabox-row"><span className="metabox-k">{LANG==="en"?"Set by":"Angelegt von"}</span><span className="metabox-v">{route.createdBy || (LANG==="en"?"unknown":"unbekannt")}</span></div>
      {histList.length > 0 && (
        <div className="metahist">
          <div className="metahist-ttl">{LANG==="en"?"Last changes":"Letzte Änderungen"}</div>
          {histList.slice(0, 3).map((h, i) => (
            <div className="metahist-row" key={i}>
              <span className="metahist-act">{h.action === "create" ? (LANG==="en"?"created":"angelegt") : (LANG==="en"?"edited":"bearbeitet")}</span>
              <span className="metahist-by">{h.by}</span>
              <span className="metahist-ts">{h.ts ? fmtDateTime(h.ts) : ""}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  ) : null;

  return (
    <div className={"scrim" + (isNew && !wall ? " full" : "")} onClick={onClose}>
      <div className={"sheet" + (isNew && !wall ? " planmode" : "")} onClick={e => e.stopPropagation()}>
        <div className="grip" />
        <div className="shead">
          <h2>{readOnly ? (LANG==="en"?"Route Info":"Route Info") : isNew ? (LANG==="en"?"Add route":"Route anlegen") : (LANG==="en"?"Edit route":"Route bearbeiten")}</h2>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {!isNew && <button className="shareIcon" onClick={doShareRoute} title={LANG==="en"?"Share route":"Route teilen"}>{shareMsg ? shareMsg : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>}</button>}
            <button className="x" onClick={onClose} aria-label="Schließen"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 2l10 10M12 2L2 12"/></svg></button>
          </div>
        </div>
        <div className="sbody">
          {readOnly ? (
            // ── Info-Ansicht für Climber (kein Bearbeiten) ────────────────
            <>
              <div className="wallbar">
                <span className="wallbar-ic"><WallIcon code={wall} size={20} /></span>
                <span className="wb-name">{wallName(wall)}</span>
                <span className="ri-date-chip"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>{fmtDate(date)}</span>
              </div>
              <div className="ri-grade-row">
                <div className="gcol" style={{ "--gcol-color": colorOf(route.name) || "#b8ff00", background: colorOf(route.name) === "#181C22" ? "rgba(255,255,255,0.9)" : "transparent", width: 42, height: 42 }}>
                  <span className="ggrade" style={{ fontSize: 17 }}>{grade}</span>
                </div>
                <div className="ri-names">
                  <div className="ri-nick">{nick}</div>
                  {route.name && <div className="ri-color">{route.name}</div>}
                </div>
              </div>
              {note && <div className="ri-note">{note}</div>}
              {photos.length > 0 && (
                <div className="photos" style={{ marginBottom: 12 }}>
                  {photos.map((ph, i) => <div className="thumb thumb-click" key={ph.id} onClick={() => setSheetLb({ images: photos.map(p => p.dataUrl), startIndex: i })}><img src={ph.dataUrl} alt="" /></div>)}
                </div>
              )}
              {metaBlock}
              <div className="field"><label>{LANG==="en"?"My result":"Mein Ergebnis"}</label>
                <div className="bigtri">
                  <button onClick={() => { setResults(r => ({ ...r, [me.name]: null })); setResultDates(d => { const nd = { ...d }; delete nd[me.name]; return nd; }); }} className={!myStatus ? "a" : ""}>—<span className="sp">offen</span></button>
                  <button className={myStatus === "top" ? "a" : ""} onClick={() => setMine("top")}>Top<span className="sp">{fmtPts(topPts(grade))}</span></button>
                  <button className={myStatus === "flash" ? "f" : ""} onClick={() => setMine("flash")}>Flash<span className="sp">{fmtPts(topPts(grade) + FLASH_BONUS)}</span></button>
                </div>
              </div>
              <button className="save" onClick={commit}>{LANG==="en"?"Save":"Speichern"}</button>
            </>
          ) : (
            // ── Edit-Ansicht für Schrauber / Admin ────────────────────────
            (!wall && isNew) ? (
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
            <div className="gradepick">
              {GRADES.map(g => <button key={g} className={grade === g ? "on" : ""} style={grade === g ? { background: "#b8ff00", borderColor: "#b8ff00", color:"#13141a" } : {}} onClick={() => setGrade(g)}>{g}</button>)}
              <button className={grade === "BS" ? "on bs-btn" : "bs-btn"} style={grade === "BS" ? { background: "linear-gradient(140deg,#ffaa28,#e5477d)", borderColor: "#ffaa28", color: "#fff" } : {}} onClick={() => setGrade("BS")} title="Bockstar — Boulder ohne festen Grad">BS</button>
            </div>
            <div className="ghint">{grade === "BS"
              ? <>Bockstar — kein fester Grad. Punkte: <b>{fmtPts(topPts(BOCKSTAR_GRADE_VALUE))}</b> für Top · <b>{fmtPts(topPts(BOCKSTAR_GRADE_VALUE) + FLASH_BONUS)}</b> für Flash (wie 5er)</>
              : <>Punkte: <b>{fmtPts(topPts(grade))}</b> für Top · <b>{fmtPts(topPts(grade) + FLASH_BONUS)}</b> für Flash</>}
            </div>
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
            <div style={{ display: "flex", gap: 8 }}>
              <input type="text" value={nick} onChange={e => setNick(e.target.value)} placeholder="Name der Route" autoFocus={isNew} style={{ flex: 1 }} />
              <button type="button" className="rerollbtn" title={LANG === "en" ? "New random name" : "Neuen Namen würfeln"} onClick={() => setNick(genUniqueName(grade, existingNicks))}>🎲</button>
            </div>
            <div className="phint">{LANG === "en" ? "Auto-generated and unique — feel free to change it." : "Automatisch gewürfelt und einzigartig — kannst du frei ändern."}</div>
          </div>
          {isAdmin && (
            <div className="field"><label>{LANG === "en" ? "Set date (screw date)" : "Schraubdatum"}</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} />
              <div className="phint">{LANG === "en" ? "Inherited from the sector's screw date — fix it here if it was set wrong. Note: the Sendly sync matches routes by this date." : "Wird vom Umschraubtermin des Sektors geerbt — hier kannst du es nachträglich korrigieren. Achtung: Der Sendly-Sync ordnet Routen über dieses Datum zu."}</div>
            </div>
          )}

          <div className="field"><label>{t("route.note")}</label>
            <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder={t("route.notePh")} maxLength={60} />
            <div className="phint">{t("route.noteHint")}</div>
          </div>

          <div className="field"><label>Fotos {photos.length ? `(${photos.length}/${MAX_PHOTOS})` : `(max. ${MAX_PHOTOS})`}</label>
            {!canPhoto && photos.length === 0 ? (
              <div className="lockbox">🔒 {LANG==="en"
                ? <>Adding photos unlocks at <b>{NEED_PHOTO} skillpoints</b> (you have {Math.round(achScore||0)}).</>
                : <>Fotos hinzufügen wird ab <b>{NEED_PHOTO} Skillpoints</b> freigeschaltet (du hast {Math.round(achScore||0)}).</>}
              </div>
            ) : (
              <>
                <div className="photos">
                  {photos.map(ph => <div className="thumb" key={ph.id}><img src={ph.dataUrl} alt="" /><button className="thx" onClick={() => removePhoto(ph.id)}>✕</button></div>)}
                  {canPhoto && photos.length < MAX_PHOTOS && <>
                    <button className="addphoto" onClick={() => fileRef.current?.click()}>{photoBusy ? "…" : <><span style={{ fontSize: 20, lineHeight: 1 }}>📷</span><span>Kamera</span></>}</button>
                    <button className="addphoto" onClick={() => galRef.current?.click()}>{photoBusy ? "…" : <><span style={{ fontSize: 20, lineHeight: 1 }}>🖼</span><span>Galerie</span></>}</button>
                  </>}
                </div>
                <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={onPickFiles} />
                <input ref={galRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={onPickFiles} />
                <div className="phint">{photos.length >= MAX_PHOTOS ? (LANG==="en"?`Maximum of ${MAX_PHOTOS} photos reached.`:`Maximal ${MAX_PHOTOS} Fotos erreicht.`) : (LANG==="en"?"Camera or gallery — every image is automatically compressed.":"Kamera oder Galerie — jedes Bild wird automatisch verkleinert und komprimiert.")}</div>
              </>
            )}
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

          {!isNew && metaBlock}

          <button className={"save" + (valid ? "" : " disabled")} onClick={commit}>{isNew ? (LANG==="en"?"Add route":"Route anlegen") : (LANG==="en"?"Save":"Speichern")}</button>
          {!isNew && isAdmin && <button className="del" onClick={() => { if (confirm(LANG==="en"?"Really delete this route? All results and photos will be lost.":"Diese Route wirklich löschen? Alle Ergebnisse und Fotos gehen verloren.")) onDelete(route.id); }}>🗑 {LANG==="en"?"Delete route":"Route löschen"}</button>}
          {!isNew && !isAdmin && !canSetRoutes && <div className="phint" style={{ textAlign: "center", marginTop: 12 }}>{LANG==="en"?"Only Route Creators and Admins can archive or delete.":"Archivieren und Löschen können nur Route Creator und Admins."}</div>}
          </>)
          )} {/* end readOnly ternary */}
        </div>
      </div>
      {sheetLb && <PhotoLightbox images={sheetLb.images} startIndex={sheetLb.startIndex || 0} onClose={() => setSheetLb(null)} />}
    </div>
  );
}
