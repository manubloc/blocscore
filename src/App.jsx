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

import React, { useState, useEffect, useMemo, useRef } from "react";
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
    "ach.unlocked": "Achievements unlocked", "ach.points": "Points", "ach.done": "Unlocked", "ach.next": "Up next",
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
function buildAchievements(lang) {
  const en = lang === "en";
  const A = []; let id = 0;
  const push = (cat, icon, name, desc, target, key, p) => A.push({ id: "a"+(id++), cat, icon, name, desc, target, key, pts: p });
  const COLORS = ["blau","grün","rot","gelb","lila","schwarz","weiß","pink","orange","holz","violett","braun","türkis"];
  const CEN = {blau:"blue",grün:"green",rot:"red",gelb:"yellow",lila:"purple",schwarz:"black",weiß:"white",pink:"pink",orange:"orange",holz:"wood",violett:"violet",braun:"brown",türkis:"turquoise"};
  const cap = s => s.charAt(0).toUpperCase()+s.slice(1);
  const cName = c => en ? cap(CEN[c]||c) : cap(c);
  const tier = (arr, i, f) => arr[i] || `${f} ${i+1}`;
  // Scaling: log-based, capped, calibrated to profiles
  const pts = n => Math.min(150, Math.max(5, Math.round(Math.log2(n+1)*9+3)));
  const L = {Gesamt:en?"Total":"Gesamt",Flash:"Flash",Punkte:en?"Points":"Punkte",Kombi:en?"Combo":"Kombi",Tagesform:en?"Day form":"Tagesform",Spezial:en?"Special":"Spezial",Treue:en?"Loyalty":"Treue",Straßen:en?"Straights":"Straßen",Mehrling:en?"Multiples":"Mehrling",Ausdauer:en?"Endurance":"Ausdauer"};

  // GESAMT TOPS — Anfänger 14/sess→~1000 nach 70 sess; Gut 19/sess; Pro 32/sess
  const TOPS=[1,3,5,10,20,35,50,75,100,150,200,300,500,750,1000,2000,3000,5000];
  const TNAMES_DE=["Erster Zug","Handflächen warm","Dabei","Stammgast","Fleißig","Ehrgeizig","Halbhundert","Hartnäckig","Hundert!","Obsessiv","Zweihundert","Dreihundert","Fünfhundert","Dreiviertel-Tausend","Tausendsassa","Zweitausend","Dreitausend","Boulder-Gott"];
  const TNAMES_EN=["First Move","Palms Warm","On Board","Regular","Diligent","Ambitious","Half Century","Persistent","Hundred!","Obsessed","Two Hundred","Three Hundred","Five Hundred","Three-Quarter K","Jack of All","Two Thousand","Three Thousand","Boulder God"];
  TOPS.forEach((n,i)=>push(L.Gesamt,"🧗",tier(en?TNAMES_EN:TNAMES_DE,i,""),en?`Climb ${n} routes total`:`Schaffe ${n} Routen insgesamt`,n,"tops",pts(n)+Math.floor(n/10)));

  // FLASH — harder, Anfänger flasst selten, Pro flasht ~6/sess
  const FLASHES=[1,3,5,10,25,50,100,250,500,1000];
  const FDE=["Erster Flash","Flash-Trio","Flash-Fünf","Flash-Zehn","Flash-Profi","Flash-Meister","Flash-Legende","Flash-Elite","Flash-Gott","Flash-Mythos"];
  const FEN=["First Flash","Flash Trio","Flash Five","Flash Ten","Flash Pro","Flash Master","Flash Legend","Flash Elite","Flash God","Flash Myth"];
  FLASHES.forEach((n,i)=>push("Flash","⚡",tier(en?FEN:FDE,i,""),en?`Flash ${n} routes`:`Flashe ${n} Routen`,n,"flashes",Math.round(pts(n)*2.2)));

  // PUNKTE — Anfänger: 7pts/sess→100pts nach 14 sess; Gut: 22.5; Pro: 51.5
  const PTS_V=[5,15,30,75,150,300,600,1000,2000,3500,5000];
  const PDE=["Erste Punkte","Guter Start","Dreißig","Dreistellig","Gut","Sehr gut","Sechshundert","Tausend","Elite","Hochleistung","Punktegott"];
  const PEN=["First Points","Good Start","Thirty","Triple Digits","Good","Very Good","Six Hundred","Thousand","Elite","High Performance","Point God"];
  PTS_V.forEach((n,i)=>push(L.Punkte,"💎",tier(en?PEN:PDE,i,""),en?`Earn ${n} total points`:`Erreiche ${n} Spielpunkte`,n,"points",pts(n)+5));

  // GRADE — kalibriert: 1er/2er/3er Anfänger, 4er/5er Gut, 6er/7er Fortgeschritten, 8er Pro
  const gScale=[0,1,1.2,1.5,2,3,5,8,15];
  GRADES.forEach(g=>{
    const tC=g<=2?[1,3,5,10,25,50,100]:g<=4?[1,3,5,10,25,50,100,200]:g<=6?[1,3,5,10,25,50,100]:g===7?[1,3,5,10,25,50]:[1,3,5,10,20];
    tC.forEach((n)=>push(`${g}`,"🪨",en?`${n}× Grade ${g}`:`${n}× ${g}er`,en?`Climb ${n} grade-${g} routes`:`Klettere ${n} ${g}er-Routen`,n,`grade:${g}:t`,Math.round(pts(n)*gScale[g])));
    const fC=g<=3?[1,3,5]:g<=5?[1,3,5,10,25]:g<=7?[1,3,5,10,20]:[1,3,5,10];
    fC.forEach((n)=>push(`${g}`,"⚡",en?`Flash ${n}× Grade ${g}`:`Flash ${n}× ${g}er`,en?`Flash ${n} grade-${g} routes`:`Flashe ${n} ${g}er-Routen`,n,`grade:${g}:f`,Math.round(pts(n)*gScale[g]*2)));
  });

  // FARBE
  COLORS.forEach(c=>{
    [1,5,10,25,50,100].forEach(n=>push(cName(c),"🎨",en?`${n}× ${cName(c)}`:`${n}× ${cName(c)}`,en?`Climb ${n} ${cName(c)} routes`:`Klettere ${n} ${cName(c)}-Routen`,n,`color:${c}:t`,pts(n)+2));
    [1,3,5,10,25].forEach(n=>push(cName(c),"⚡",en?`Flash ${n}× ${cName(c)}`:`Flash ${n}× ${cName(c)}`,en?`Flash ${n} ${cName(c)} routes`:`Flashe ${n} ${cName(c)}-Routen`,n,`color:${c}:f`,pts(n)+7));
  });

  // TAGESFORM — Anfänger max ~14, Gut ~19, Pro ~32+
  [3,5,8,10,15,20,25,35].forEach(n=>push(L.Tagesform,"🔥",en?`${n} in one day`:`${n} an einem Tag`,en?`Climb ${n} routes in one day`:`Schaffe ${n} Routen an einem Tag`,n,"maxDayTops",pts(n)*2));
  [1,2,3,5,8,12,15].forEach(n=>push(L.Tagesform,"⚡",en?`Flash ${n} in one day`:`${n} Flashes an einem Tag`,en?`Flash ${n} routes in one day`:`Flashe ${n} Routen an einem Tag`,n,"maxDayFlashes",pts(n)*3));

  // KOMBI / SPEZIAL
  [1,3,5,10,25].forEach((n,i)=>push(L.Spezial,"🌈",tier(en?["Rainbow","Double Rainbow","Rainbow Collector","Rainbow Pro","Rainbow Legend"]:["Regenbogen","Doppel-Regenbogen","Regenbogen-Sammler","Regenbogen-Profi","Regenbogen-Legende"],i,""),en?`On ${n} day(s) climb blue+green+red+yellow+purple`:`An ${n} Tag(en) blau+grün+rot+gelb+lila`,n,"rainbowDays",40+i*18));
  [1,2,3,5].forEach((n,i)=>push(L.Spezial,"📊",en?`All grades in one day (${n}×)`:`Alle Grade an einem Tag (${n}×)`,en?`On ${n} day(s) climb all grades 1–8`:`An ${n} Tag(en) alle Grade 1–8`,n,"allGradeDays",60+i*25));

  // STRASSEN
  [[4,50],[5,70],[6,100],[7,135],[8,175]].forEach(([k,p])=>push(L.Straßen,"🛤️",en?`Grades 1–${k} in one day`:`Grade 1–${k} an einem Tag`,en?`Climb grades 1–${k} in one day`:`Schaffe Grade 1–${k} an einem Tag`,k,"maxFrom1",p));
  [[4,45],[5,65],[6,90],[7,120]].forEach(([k,p])=>push(L.Straßen,"🛤️",en?`${k} consecutive grades`:`${k} aufein­ander­folgende Grade`,en?`Climb ${k} consecutive grades in one day`:`Schaffe ${k} aufeinanderfolgende Grade`,k,"maxRun",p));

  // MEHRLING
  [[3,30],[4,50],[5,75],[6,105],[7,145],[8,200]].forEach(([k,p])=>push(L.Mehrling,"🎲",en?`${k} of a kind`:`${k}er-Ling`,en?`Climb ${k} routes of same grade in one day`:`Schaffe ${k} Routen im selben Grad an einem Tag`,k,"maxOfAKind",p));

  // TREUE — Anfänger: 50 Tage nach ~50 Sessions, Pro viel schneller
  [[1,8],[3,14],[5,20],[10,30],[20,42],[35,55],[50,68],[75,85],[100,105],[150,135],[200,168],[300,220],[365,300]].forEach(([n,p])=>push(L.Treue,"📅",en?`${n} climbing day${n>1?"s":""}`:`${n} Klettertag${n>1?"e":""}`,en?`Climb on ${n} different days`:`Klettere an ${n} verschiedenen Tagen`,n,"distinctDays",p));

  // AUSDAUER
  [1,2,3,4,5,6,8,10,12,16,20,26,52].forEach(n=>push(L.Ausdauer,"⏳",en?`${n} weeks in a row`:`${n} Wochen in Folge`,en?`At least 1×/week for ${n} weeks`:`Mindestens 1×/Woche für ${n} Wochen`,n,"weekStreak1",pts(n*3)+6));
  [2,3,4,6,8,12,16,26].forEach(n=>push(L.Ausdauer,"⏳",en?`2×/week · ${n} weeks`:`2×/Woche · ${n} Wochen`,en?`At least 2×/week for ${n} weeks`:`Mindestens 2×/Woche für ${n} Wochen`,n,"weekStreak2",pts(n*5)+10));
  [10,20,30,50,75,100].forEach(n=>push(L.Ausdauer,"📆",en?`${n} days in 100`:`${n} Tage in 100`,en?`Climb on ${n} days within 100 days`:`An ${n} Tagen innerhalb von 100 Tagen`,n,"daysIn100",pts(n*3)+6));
  [20,50,75,100,150,200,250,300].forEach(n=>push(L.Ausdauer,"📆",en?`${n} days/year`:`${n} Tage/Jahr`,en?`Climb on ${n} days within a year`:`An ${n} Tagen innerhalb eines Jahres`,n,"daysIn365",pts(n*2)+6));

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
  ].forEach(([n,name,desc,p])=>push("Berge","🏔",name,desc,n,"totalRoutes",p));

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
    // Everest Speed Record: Pemba Dorje Sherpa 8h 10min — symbolically: flash 8 routes in a day
    [8,en?"Everest Speed Record (8 routes in 1 day) ⏱":"Everest Speedrekord (8 Routen an 1 Tag) ⏱",
      en?"Climb 8 routes in one day — like Pemba's 8h10m Everest record":"8 Routen an einem Tag — wie Pemdas 8h10m Everest-Rekord",55],
    // Alex Honnold El Cap Free Solo 3h 56min — 12 routes in a day
    [12,en?"El Cap Free Solo (12 in 1 day) 🎬":"El Cap Free Solo (12 an 1 Tag) 🎬",
      en?"12 routes in one day — like Alex Honnold's 3h56m free solo":"12 an einem Tag — wie Alex Honnolds 3h56m Free Solo",90],
    // Ueli Steck Eiger Nordwand 2h47m — 15 routes
    [15,en?"Ueli Steck – Eiger (15 in 1 day) 💨":"Ueli Steck – Eiger (15 an 1 Tag) 💨",
      en?"15 routes in one day — like Ueli Steck's 2h47m Eiger record":"15 an einem Tag — wie Ueli Stecks 2h47m Eiger-Rekord",120],
    // Tommy Caldwell & Jorgeson 19 days on Dawn Wall — 20 routes
    [20,en?"Dawn Wall (20 in 1 day) 🌅":"Dawn Wall (20 an 1 Tag) 🌅",
      en?"20 routes in one day — legendary like Caldwell & Jorgeson's Dawn Wall":"20 an einem Tag — legendär wie Caldwell & Jorgesons Dawn Wall",170],
    // Deep Water Solo record — 25 routes
    [25,en?"Deep Water Solo Mode (25 in 1 day) 🌊":"Deep Water Solo Modus (25 an 1 Tag) 🌊",
      en?"25 routes in one day — no rope, no fear, just sending":"25 an einem Tag — kein Seil, keine Angst, nur Klettern",230],
    // Pure madness — 35 routes (Pro level max)
    [35,en?"Project Moonboard (35 in 1 day) 🌙":"Project Moonboard (35 an 1 Tag) 🌙",
      en?"35 routes in one day — you are on another level entirely":"35 an einem Tag — du bist auf einem völlig anderen Level",350],
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

const LOGO_IMG = "data:image/png;base64,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";
const LOGIN_LOGO = "data:image/png;base64,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";
const BG_LOGIN_WALL = "data:image/jpeg;base64,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";
const HEADER_BG = "data:image/jpeg;base64,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";

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
    { id: "acc-admin", name: "admin", role: "admin", pin: "12345", staff: true },
    { id: "acc-superadmin", name: "superadmin", role: "superadmin", pin: "einsalamibrotbitte", staff: true },
  ],
  routes: SEED.routes.map(r => ({ ...r, results: {} })),
  groups: [],
  screwDates: { v: "2026-06-04", tb: "2026-06-11", h: "2026-06-18", pl: "2026-06-25", wkw: "2026-05-28" },
};

function RoutePhoto({ photoId, className, style, onClick }) {
  const inline = typeof photoId === "string" && photoId.startsWith("data:");
  const [src, setSrc] = useState(inline ? photoId : null);
  useEffect(() => { if (inline) return; let on = true; (async () => { const b = await loadPhotoBlob(photoId); if (on) setSrc(b); })(); return () => { on = false; }; }, [photoId]);
  if (!src) return null;
  return <img className={className} style={{ ...style, cursor: "zoom-in" }} src={src} alt="" onClick={onClick} />;
}
function PhotoLightbox({ src, onClose }) {
  useEffect(() => {
    const fn = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, []);
  return (
    <div className="lightbox" onClick={onClose}>
      <button className="lb-close" onClick={onClose}>✕</button>
      <img src={src} alt="" className="lb-img" onClick={e => e.stopPropagation()} />
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
.topbar { padding:6px 16px; display:flex; align-items:center; justify-content:space-between; gap:10px; position:relative; background-size:cover; background-position:center 40%; height:72px; min-height:72px; max-height:72px; border-bottom:1px solid rgba(255,255,255,.08); background-color:#252830; }
.topbar-overlay { position:absolute; inset:0; background:linear-gradient(90deg, #13141a 0%, #13141a 33%, rgba(19,20,26,.6) 55%, rgba(19,20,26,0) 90%); pointer-events:none; }
.brand { display:flex; align-items:center; position:relative; z-index:2; padding-left:0; }
.brand-logo { height:50px; width:auto; object-fit:contain; display:block; }
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
.rbanner { width:100%; height:150px; object-fit:cover; display:block; background:var(--panel2); }
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
.tabbar { display:flex; background:#1e2028; border-top:1px solid rgba(255,255,255,.09); padding:4px 2px calc(4px + env(safe-area-inset-bottom)); gap:1px; height:55px; box-sizing:border-box; }
.tab { flex:1; display:flex; flex-direction:column; align-items:center; gap:2px; padding:5px 2px 4px; border-radius:8px; color:var(--muted); border:none; font-size:11px; text-transform:uppercase; font-family:'Figtree',sans-serif; font-weight:700; }
.tab span { font-size:9px; }
.tab svg { width:26px; height:26px; stroke-width:1.6; }
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
.lightbox { position:fixed; inset:0; background:rgba(0,0,0,.92); z-index:200; display:flex; align-items:center; justify-content:center; padding:16px; animation:fadeIn .15s ease; }
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

  function doLogin() {
    const acc = accounts.find(a => a.name.toLowerCase() === name.trim().toLowerCase());
    if (!acc) return setErr(t("login.errNoAcc"));
    if ((acc.pin || "") && pin !== acc.pin) return setErr(t("login.errPin"));
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
  const [lang, setLang] = useState("de");
  setLangG(lang);
  function changeLang(l) { setLang(l); setLangG(l); try { window.storage.set("blocscore:lang", l, false); } catch (e) {} }
  function jumpToRoute(id) { setFlashId(id); setTimeout(() => { const el = document.getElementById("r-" + id); if (el) el.scrollIntoView({ behavior: "smooth", block: "center" }); }, 30); setTimeout(() => setFlashId(null), 1700); }
  const firstSave = useRef(false);

  useEffect(() => { (async () => { const c = await loadCommunity(); setCommunity(c && c.accounts ? c : SEED_COMMUNITY); setSession(await loadSession()); try { const lr = await window.storage.get("blocscore:lang", false); if (lr && lr.value) { setLang(lr.value); setLangG(lr.value); } } catch (e) {} setReady(true); })(); }, []);
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
  const myGroups = groupStats.filter(g => (g.members || []).includes(me?.id));
  const otherGroups = groupStats.filter(g => !(g.members || []).includes(me?.id));

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
    setCommunity(c => ({ ...c, routes: c.routes.map(r => { if (r.id !== routeId) return r; const cur = r.results?.[me.name] || null; const next = cur === null ? "top" : cur === "top" ? "flash" : null; return { ...r, results: { ...r.results, [me.name]: next } }; }) }));
  }
  function upsertRoute(route) { setCommunity(c => { const ex = c.routes.some(r => r.id === route.id); return { ...c, routes: ex ? c.routes.map(r => r.id === route.id ? route : r) : [route, ...c.routes] }; }); }
  function deleteRoute(id) { setCommunity(c => ({ ...c, routes: c.routes.filter(r => r.id !== id) })); }
  const MAX_MEMBERS = 10;
  const myGroup = useMemo(() => groups.find(g => (g.members || []).includes(me?.id)) || null, [groups, me]);
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
  const canComment = isAdmin || canSetRoutes || achScore >= NEED_COMMENT;
  const canCreateGroup = isAdmin || canSetRoutes || achScore >= NEED_GROUP;
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
  function createGroup(name, emoji) { if (myGroup) return; const g = { id: uid(), name, emoji, members: [me.id], requests: [], createdBy: me.id }; setCommunity(c => ({ ...c, groups: [...(c.groups || []), g] })); }
  function requestJoin(id) {
    if (myGroup) return;
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
  function setMyPin(p) { setCommunity(c => ({ ...c, accounts: c.accounts.map(a => a.id === me.id ? { ...a, pin: p } : a) })); }
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
  function handleLogin(id) { const s = { accountId: id }; setSession(s); saveSession(s); setCommunity(c => ({ ...c, accounts: c.accounts.map(a => a.id === id ? { ...a, lastSeen: todayISO() } : a) })); }
  function handleSignup({ name, pin, role, private: priv, emoji }) { const acc = { id: uid(), name, pin, role, private: !!priv, emoji: emoji || "", lastSeen: todayISO() }; setCommunity(c => ({ ...c, accounts: [...c.accounts, acc] })); handleLogin(acc.id); }
  function logout() { setSession(null); saveSession(null); setTab("routes"); }

  if (!ready) return <div className="bld"><style>{CSS}</style><div className="empty" style={{ margin: "auto" }}>Lädt…</div></div>;
  if (!me) return <LoginScreen accounts={accounts} onLogin={handleLogin} onSignup={handleSignup} lang={lang} onLang={changeLang} />;

  const tipsRoute = routes.find(r => r.id === tipsRouteId) || null;

  return (
    <div className="bld">
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

          {boardScope === "gruppen" && groupsRanked.length === 0 && (
            <div className="empty"><div className="big">👥</div>{t("board.noGroups")}</div>
          )}
          {boardScope === "gruppen" && (() => { const gmax = Math.max(1, ...groupStats.map(g => g[boardMode] || 0)); return groupsRanked.map((g, i) => { const v = g[boardMode] || 0; const mine = (g.members || []).includes(me.id); return (
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
                              {canSetRoutes && <button className="edit" onClick={(e) => { e.stopPropagation(); setEditing(r); }} title="Route bearbeiten"><svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17l3.5-1L17 5.5 14.5 3 4 13.5 3 17z"/></svg></button>}
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
              <div className="achintro-ttl">Wie funktionieren Erfolge?</div>
              <div className="achintro-txt">Jede Route bringt dir Skillpoints. Zusätzliche Skillpoints sammelst du durch Erfolge — Meilensteine wie z.B. erste 10 Tops, 25 Flashes oder alle Farben einer Wand. Mit deinen <b>Skillpoints</b> schaltest du weitere App-Features frei:</div>
              <div className="achintro-unlocks">
                <div className="achunl"><span className="achunl-num">5</span> Skillpoints &rarr; 5 neue Profil-Emojis</div>
                <div className="achunl"><span className="achunl-num">100</span> Skillpoints &rarr; Kommentare zu Routen</div>
                <div className="achunl"><span className="achunl-num">200</span> Skillpoints &rarr; Eigene Gruppe erstellen</div>
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
                <div className="achprog">{a.cur}/{a.target}</div>
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
            // We use route date as proxy for send date
            const rByDate = (from) => routes.filter(r => r.date >= from && r.results?.[me.name]);
            const todayR = routes.filter(r => r.date === today && r.results?.[me.name]);
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
                  <div className="hkpi"><div className="hkv">{myRoutes.length}</div><div className="hku">Begehungen</div></div>
                  <div className="hkpi"><div className="hkv">{myFlashes}</div><div className="hku">Flashes ⚡</div></div>
                  <div className="hkpi"><div className="hkv">{Math.round(myMeters)} m</div><div className="hku">Höhenmeter 🏔</div></div>
                  <div className="hkpi"><div className="hkv">{fmtPts(myPts)}</div><div className="hku">Punkte</div></div>
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
                <h3><span>🏔 Erklommene Berge</span></h3>
                <div className="phint" style={{marginBottom:10}}>Jede Route = {WALL_HEIGHT} Höhenmeter · Gesamt: {Math.round(myMeters)} m</div>
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
                {nextMtn && <div className="note" style={{marginTop:10}}>Noch {Math.ceil(nextMtn.m - myMeters)} m bis zum <b>{nextMtn.name}</b> ({nextMtn.m} m)</div>}
                {!nextMtn && <div className="note" style={{marginTop:10,color:"var(--amber)"}}>🏆 Du hast alle Berge erklommen — sogar den Mount Everest!</div>}
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

      <div className="tabbar">
        {/* Routes */}
        <button className={"tab" + (tab === "routes" ? " on" : "")} onClick={() => setTab("routes")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17l4-8 4 4 3-6 4 10"/><circle cx="19" cy="5" r="2"/></svg>
          <span>{t("nav.routes")}</span>
        </button>
        {/* Achievements */}
        <button className={"tab" + (tab === "stats" ? " on" : "")} onClick={() => setTab("stats")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="5"/><path d="M9 21h6M12 13v8M7.5 16.5l-2 2M16.5 16.5l2 2"/></svg>
          <span>{t("nav.ach")}</span>
        </button>
        {/* Groups */}
        <button className={"tab" + (tab === "gruppen" ? " on" : "")} onClick={() => setTab("gruppen")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="7" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M2 20c0-3.3 3.1-6 7-6s7 2.7 7 6"/><path d="M22 20c0-2.2-2-4-4.5-4"/></svg>
          <span>{t("nav.groups")}</span>
        </button>
        {/* Board */}
        <button className={"tab" + (tab === "board" ? " on" : "")} onClick={() => setTab("board")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><path d="M6 20V10M12 20V4M18 20v-6"/></svg>
          <span>{t("nav.board")}</span>
        </button>
        {/* Stats */}
        <button className={"tab" + (tab === "hall" ? " on" : "")} onClick={() => setTab("hall")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 17h7M17.5 14v7"/></svg>
          <span>{t("nav.hall")}</span>
        </button>
      </div>

      {editing && (
        <RouteSheet route={editing === "new" ? null : editing} me={me} gyms={wallsPresent.map(w => w.code)} isAdmin={isAdmin} screwDates={screwDates}
          onClose={() => setEditing(null)} onSave={(r) => { upsertRoute(r); setEditing(null); }} onDelete={(id) => { deleteRoute(id); setEditing(null); }} />
      )}
      {tipsRoute && (
        <TipsSheet route={tipsRoute} me={me} isAdmin={isAdmin} onClose={() => setTipsRouteId(null)} onAdd={(t) => addTip(tipsRoute.id, t)} onDelete={(id) => delTip(tipsRoute.id, id)} />
      )}
      {newGroupOpen && <NewGroupSheet onClose={() => setNewGroupOpen(false)} achScore={achScore} isAdmin={isAdmin} onCreate={(n, e) => { createGroup(n, e); setNewGroupOpen(false); }} />}
      {changePinOpen && <ChangePinSheet me={me} onClose={() => setChangePinOpen(false)} onSave={(p) => { setMyPin(p); setChangePinOpen(false); }} />}
      {scoringOpen && <ScoringSheet step={STEP} flash={FLASH_BONUS} onClose={() => setScoringOpen(false)} onSave={(s,f) => { setScoring(s,f); setScoringOpen(false); }} />}
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
function getFpSegs() {
  const en = LANG === "en";
  return [
    { code: "wkw", d: "M4,10 L36,10 L27,26 L36,40 L26,54 L36,68 L22,82 L4,82 Z",  tx: 16,  ty: 43, rot: -90, label: en ? "COMP\nWALL" : "WETTKAMPF\nWAND" },
    { code: "h",   d: "M43,13 L60,13 L62,27 L57,43 L46,46 L40,42 L39,27 Z",         tx: 50,  ty: 30, label: en ? "BACK\nBLOCK" : "BLOCK\nHINTEN" },
    { code: "v",   d: "M46,50 L58,50 L64,66 L59,86 L44,87 L38,70 L41,57 Z",         tx: 51,  ty: 69, label: en ? "FRONT\nBLOCK" : "BLOCK\nVORNE" },
    { code: "pl",  d: "M67,20 L79,19 L81,87 L68,88 Z",                               tx: 74,  ty: 54, rot: -90, label: en ? "SLAB &\nBUG" : "PLATTE &\nBUG" },
    { code: "tb",  d: "M84,11 L104,11 L104,32 L112,32 L112,56 L92,56 L84,37 Z",     tx: 96,  ty: 34, rot: -90, label: en ? "TRAINING" : "TRAINING" },
  ];
}
function FpLabel({ s, on }) {
  const fill = on ? "#0d0e0f" : "#d0d4cc";
  const t2 = s.rot ? `rotate(${s.rot} ${s.tx} ${s.ty})` : undefined;
  if (s.label.includes("\n")) {
    const [a, b] = s.label.split("\n");
    const fs = Math.max(a.length, b.length) > 8 ? 2.8 : 3.4;
    return (
      <text transform={t2} textAnchor="middle" fontFamily="'Barlow Condensed'" fontWeight="700" fontSize={fs} fill={fill}>
        <tspan x={s.tx} y={s.ty - 2.2}>{a}</tspan>
        <tspan x={s.tx} dy="4">{b}</tspan>
      </text>
    );
  }
  const fs = s.label.length > 12 ? 2.7 : 3.4;
  return <text x={s.tx} y={s.ty} transform={t2} textAnchor="middle" dominantBaseline="middle" fontFamily="'Barlow Condensed'" fontWeight="700" fontSize={fs} fill={fill} letterSpacing="0.3">{s.label}</text>;
}
function FloorPlan({ value, onChange, counts, newest }) {
  return (
    <svg className="fp" viewBox="0 0 118 100">
      <rect x="1" y="1" width="116" height="98" rx="4" fill="#d8d8d2" stroke="#b4b4ac" strokeWidth="0.8" />
      <text x="60" y="7.5" textAnchor="middle" fontSize="3.2" fontWeight="700" fill="#3f444b" letterSpacing="0.6">{LANG==="en"?"GARDEN":"GARTEN"}</text>
      <text x="46" y="96" textAnchor="middle" fontSize="3.2" fontWeight="700" fill="#3f444b" letterSpacing="0.6">{LANG==="en"?"ENTRANCE":"EINGANG"}</text>
      <rect x="84" y="62" width="20" height="20" rx="2" fill="#bdbdb6" stroke="#9c9c93" strokeWidth="0.6" />
      <text x="94" y="71" textAnchor="middle" fontSize="2.4" fontWeight="600" fill="#42474e"><tspan x="94" dy="0">{LANG==="en"?"KIDS":"KINDER-"}</tspan><tspan x="94" dy="3.2">{LANG==="en"?"AREA":"BEREICH"}</tspan></text>
      {getFpSegs().map(s => { const on = value === s.code; const fresh = newest === s.code; return (
        <g key={s.code} onClick={() => onChange(s.code)} style={{ cursor: "pointer" }}>
          <path d={s.d} fill={on ? "var(--amber)" : fresh ? "#3a4150" : "#2c3037"} stroke={on ? "#8a9520" : fresh ? "#9fe6a0" : "rgba(184,255,0,.5)"} strokeWidth={on || fresh ? 1.5 : 1.0} strokeLinejoin="round" />
          <FpLabel s={s} on={on} />
        </g>
      ); })}
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
              <div className="achprog">{a.cur}/{a.target}<div className="achpts">+{a.pts}</div></div>
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
              <div><span className="emoji-info-num">{unlocked.length}</span> <span className="emoji-info-lbl">/ {next ? next.total : unlocked.length} freigeschaltet</span></div>
            </div>
            {next && (
              <div className="emoji-info-next">
                Nächste <b>{next.count}</b> bei <b>{next.at} Skillpoints</b> · du hast {Math.round(achScore)} · noch {Math.max(0, next.at - Math.round(achScore))} fehlen
              </div>
            )}
            {!next && <div className="emoji-info-next" style={{ color: "#b8ff00" }}>🏆 Alle Emojis freigeschaltet!</div>}
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
          <button className={"save" + (valid ? "" : " disabled")} onClick={() => valid && onCreate(name.trim(), emoji)}>{t("grp.create")}</button>
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
function RouteSheet({ route, me, gyms, isAdmin, onClose, onSave, onDelete, screwDates }) {
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
  const [photos, setPhotos] = useState([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileRef = useRef(null);
  const origPhotoIds = route?.photos || [];
  const valid = !!wall && nick.trim().length > 0;
  const myStatus = results[me.name] || null;

  useEffect(() => { let on = true; (async () => { if (!route?.photos?.length) return; const out = []; for (const id of route.photos) { if (typeof id === "string" && id.startsWith("data:")) { out.push({ id, dataUrl: id }); } else { const b = await loadPhotoBlob(id); if (b) out.push({ id, dataUrl: b }); } } if (on) setPhotos(out); })(); return () => { on = false; }; }, []);
  async function onPickFiles(e) { const files = Array.from(e.target.files || []); e.target.value = ""; if (!files.length) return; setPhotoBusy(true); const add = []; for (const f of files) { try { add.push({ id: uid(), dataUrl: await downscale(f) }); } catch (_) {} } setPhotos(p => [...p, ...add]); setPhotoBusy(false); }
  function removePhoto(id) { setPhotos(p => p.filter(x => x.id !== id)); }
  function setMine(s) { setResults(r => ({ ...r, [me.name]: r[me.name] === s ? null : s })); }
  async function commit() {
    if (!valid) return;
    const keepIds = photos.map(p => p.id);
    for (const ph of photos) if (!String(ph.id).startsWith("data:")) await savePhotoBlob(ph.id, ph.dataUrl);
    for (const oid of origPhotoIds) if (!keepIds.includes(oid) && !String(oid).startsWith("data:")) await deletePhotoBlob(oid);
    onSave({ id: route?.id || uid(), date, gym: wall, grade, name: name.trim(), nick: nick.trim(), note: note.trim(), archived, results, photos: keepIds, tips: route?.tips || [] });
  }

  return (
    <div className={"scrim" + (isNew && !wall ? " full" : "")} onClick={onClose}>
      <div className={"sheet" + (isNew && !wall ? " planmode" : "")} onClick={e => e.stopPropagation()}>
        <div className="grip" />
        <div className="shead"><h2>{isNew ? "Route anlegen" : "Route bearbeiten"}</h2><button className="x" onClick={onClose} aria-label="Schließen"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 2l10 10M12 2L2 12"/></svg></button></div>
        <div className="sbody">
          {!wall ? (
            isNew ? (
            <div className="planpick">
              <div className="planpick-ttl">Wo hängt die Route?</div>
              <div className="planpick-sub">Tippe auf den Bereich im Hallenplan</div>
              <div className="planpick-wrap"><FloorPlan value={wall} onChange={changeWall} /></div>
            </div>
            ) : (
            <div style={{padding:"16px"}}>
              <div style={{fontSize:13,color:"rgba(255,255,255,.7)",marginBottom:10}}>Welche Wand?</div>
              <div className="fpwrap"><FloorPlan value={wall} onChange={changeWall} /></div>
            </div>
            )
          ) : (<>
          <div className="wallbar">
            <span className="wallbar-ic"><WallIcon code={wall} size={20} /></span>
            <span className="wb-name">{wallName(wall)}</span>
            {isNew && <button className="wb-change" onClick={() => setWall(null)}>Plan ▾</button>}
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
              <button onClick={() => setResults(r => ({ ...r, [me.name]: null }))} className={!myStatus ? "a" : ""}>—<span className="sp">offen</span></button>
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

          <button className={"save" + (valid ? "" : " disabled")} onClick={commit}>{isNew ? "Route anlegen" : "Speichern"}</button>
          {!isNew && isAdmin && <button className="del" onClick={() => { if (confirm("Diese Route wirklich löschen? Alle Ergebnisse und Fotos gehen verloren.")) onDelete(route.id); }}>🗑 Route löschen</button>}
          {!isNew && !isAdmin && !canSetRoutes && <div className="phint" style={{ textAlign: "center", marginTop: 12 }}>Archivieren und Löschen können nur Route Creator und Admins.</div>}
          </>)}
        </div>
      </div>
    </div>
  );
}
