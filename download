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
  { code: "v", name: "Block vorne", short: "V", aliases: ["bv"] },
  { code: "h", name: "Block hinten", short: "H", aliases: ["bh"] },
  { code: "tb", name: "Training & Bug", short: "TB", aliases: [] },
  { code: "pl", name: "Platte", short: "PL", aliases: ["pt", "pp"] },
  { code: "wkw", name: "Wettkampfwand", short: "WKW", aliases: ["ww", "bw"] },
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
function roleLabel(r) { return r === "admin" ? "Admin" : r === "schrauber" ? "Route Creator" : r === "archived" ? "Archived" : "Climber"; }
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
    "ach.unlocked": "Erfolge freigeschaltet", "ach.points": "Erfolgspunkte", "ach.done": "Geschafft", "ach.next": "Als Nächstes", "ach.cats": "Kategorien", "ach.view.ach": "Erfolge", "ach.view.grade": "Grade",
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
    "lock.comments": "Kommentare werden ab 100 Erfolgspunkten freigeschaltet (du hast {n}).", "lock.group": "Gruppen erstellen wird ab 1000 Erfolgspunkten freigeschaltet (du hast {n}).", "lock.creator": "Route Creator kannst du ab 10000 Erfolgspunkten anfragen (du hast {n}).",
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
    "ach.unlocked": "Achievements unlocked", "ach.points": "Achievement points", "ach.done": "Unlocked", "ach.next": "Up next",
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

function getUnlockedEmojis(achScore, isAdmin = false) {
  if (isAdmin) {
    // Admin bekommt immer alles
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
  const waves = [
    { at: 50,  label: "Wave 1", hint: "~6–12 Sessions" },
    { at: 150, label: "Wave 2", hint: "~20–45 Sessions" },
    { at: 300, label: "Wave 3", hint: "~35–90 Sessions" },
    { at: 500, label: "Wave 4", hint: "~50–135 Sessions" },
    { at: 700, label: "Wave 5", hint: "~70–180 Sessions" },
    { at: 900, label: "Wave 6", hint: "~85–225 Sessions" },
  ];
  return waves.find(w => achScore < w.at) || null;
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
.topbar-overlay { position:absolute; inset:0; background:linear-gradient(90deg, #13141a 0%, #13141a 80px, rgba(19,20,26,.7) 160px, rgba(19,20,26,.3) 100%); pointer-events:none; }
.brand { display:flex; align-items:center; position:relative; z-index:2; padding-left:16px; }
.brand-logo { height:48px; width:auto; object-fit:contain; display:block; }
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
.edit { color:var(--muted); padding:2px 4px; font-size:16px; flex:none; }
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
.rschip { font-size:10px; font-weight:700; padding:2px 6px; border-radius:4px; white-space:nowrap; letter-spacing:.04em; }
.rschip.top { background:rgba(184,255,0,.08); color:#b8ff00; border:1px solid rgba(184,255,0,.25); }
.rschip.flash { background:rgba(184,255,0,.08); color:#b8ff00; border:1px solid rgba(184,255,0,.25); }

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
.wadone { font-family:'Barlow Condensed'; font-weight:700; font-size:12px; color:#5cc97e; }
.wacount { font-family:'Barlow Condensed'; font-weight:700; font-size:12px; color:var(--muted); }
.waflash { font-family:'Barlow Condensed'; font-weight:700; font-size:12px; color:#b8ff00; }
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
.colbtn { width:100%; aspect-ratio:1; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:0; border:1.5px solid rgba(255,255,255,.15); transition:all .12s; background:transparent !important; }
.colbtn:active { transform:scale(.9); }
.colbtn.on { border:2.5px solid #b8ff00; box-shadow:none; }
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
.login-logo { width:min(220px, 56vw); height:min(220px, 56vw); object-fit:contain; margin-top:20px; border-radius:22px; }
.lwordmark { font-family:'Barlow Condensed',sans-serif; font-weight:300; font-size:56px; letter-spacing:.04em; line-height:.9; margin:20px 0 0; color:#fff; text-shadow:0 2px 22px rgba(0,0,0,.55); }
.lwordmark span { color:var(--amber); }
.ltagline { font-family:'Figtree',sans-serif; font-weight:300; font-size:13px; letter-spacing:.36em; text-transform:uppercase; color:rgba(255,255,255,.84); margin-top:13px; padding-left:.36em; text-shadow:0 1px 12px rgba(0,0,0,.7); }
.logincard { background:rgba(22,26,32,.65); backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px); border:1.5px solid rgba(255,255,255,.12); border-radius:18px; margin:16px 18px 0; padding:18px; max-width:440px; width:calc(100% - 36px); align-self:center; }
.authtabs { display:flex; background:var(--bg); border:1px solid var(--line); border-radius:11px; padding:3px; margin-bottom:18px; }
.authtabs button { flex:1; padding:10px; border-radius:8px; font-weight:700; font-size:14px; color:var(--muted); }
.authtabs button.on { background:var(--panel2); color:var(--chalk); }
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
  const [hallTab, setHallTab] = useState("halle"); // halle | meine | creator
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
  const players = useMemo(() => accounts.filter(a => !archivedSet.has(a.name)).map(a => a.name), [accounts, archivedSet]);
  const me = accounts.find(a => a.id === session?.accountId) || null;
  const isAdmin = me?.role === "admin";
  const canSetRoutes = me?.role === "admin" || me?.role === "schrauber";
  useEffect(() => { if (!canSetRoutes && filterScope === "archiv") setFilterScope("aktuell"); }, [canSetRoutes]);
  const visName = useMemo(() => new Set(accounts.filter(a => !a.staff && !archivedSet.has(a.name) && (!a.private || a.id === me?.id)).map(a => a.name)), [accounts, me, archivedSet]);

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
    const creators = accounts.filter(a => a.role === "schrauber" || a.role === "admin");
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
          {me.role !== "community" && <span className="adminpill">{me.role === "admin" ? "Admin" : "Route Creator"}</span>}
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
                  {(() => { const flN = s.items.filter(r => r.results?.[me.name] === "flash").length; return flN > 0 ? <span className="waflash">⚡{flN}</span> : null; })()}
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
                          {(hallStats.topSendsId === r.id || hallStats.topFlashId2 === r.id) && (
                            <div className="routebadge">
                              {hallStats.topSendsId === r.id && <span className="rbadge hot" title="Beliebteste Route">🔥</span>}
                              {hallStats.topFlashId2 === r.id && <span className="rbadge zap" title="Meiste Flashes">⚡</span>}
                            </div>
                          )}
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
                                <span className="rschip top"><svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{display:"inline-block",verticalAlign:"middle",marginRight:2,marginTop:-1}}><polyline points="1.5,5.5 4,8 8.5,2"/></svg>{topN}</span>
                                <span className="rschip flash"><svg width="8" height="9" viewBox="0 0 10 12" fill="currentColor" style={{display:"inline-block",verticalAlign:"middle",marginRight:2,marginTop:-1}}><path d="M7 1L1 7h4l-2 4 6-6H5z"/></svg>{flashN}</span>
                              </div>
                              {canSetRoutes && <button className="edit" onClick={() => setEditing(r)}>✎</button>}
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
              <button className={hallTab === "halle" ? "on" : ""} onClick={() => setHallTab("halle")}>{t("hall.activity")}</button>
              <button className={hallTab === "meine" ? "on" : ""} onClick={() => setHallTab("meine")}>👤 {LANG==="en"?"My Stats":"Meine Stats"}</button>
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
                <div className="hkpi"><div className="hkv">{accounts.filter(a => !a.staff).length}</div><div className="hku">{t("acc.members")}</div></div>
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
                    <span className="rschip top"><svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{display:"inline-block",verticalAlign:"middle",marginRight:2,marginTop:-1}}><polyline points="1.5,5.5 4,8 8.5,2"/></svg>{r.sendCount - Object.values(r.results || {}).filter(s => s === "flash").length}</span>
                    <span className="rschip flash"><svg width="8" height="9" viewBox="0 0 10 12" fill="currentColor" style={{display:"inline-block",verticalAlign:"middle",marginRight:2,marginTop:-1}}><path d="M7 1L1 7h4l-2 4 6-6H5z"/></svg>{Object.values(r.results || {}).filter(s => s === "flash").length}</span>
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
                    <span className="hwf">⚡{rs.filter(r=>r.results[me.name]==="flash").length}</span>
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
                      <span className="hwn">{done?"✅":"🔒"} {mn.name}</span>
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
            <h3><span>{isAdmin ? t("acc.users") : t("acc.members")}</span><span className="r">{accounts.filter(a => a.role !== "admin").length}</span></h3>
            {accounts.filter(a => a.role !== "admin").map(a => { const arch = isArchivedAcc(a, routes, today); return (
              <div className="prow" key={a.id}>
                <div className="pinfo"><Avatar name={a.name} emoji={a.emoji} size={34} /><div style={{ minWidth: 0 }}><div className="pn">{a.name}{a.id === me.id ? " · Du" : ""}{a.private ? " · 🔒" : ""}</div><div className="prole">{arch ? <span className="archbadge">{t("acc.archived")}</span> : roleLabel(a.role)}{a.roleRequest === "schrauber" && !arch ? <span className="reqbadge">🔔 {t("acc.wantsCreator")}</span> : null}{a.reactivateRequest ? <span className="reqbadge">🔔 {t("acc.reqReactivate")}</span> : null}</div></div></div>
                {isAdmin && a.id !== me.id && (
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    {arch && <button className="miniaction" style={{ marginTop: 0 }} onClick={() => reactivateAccount(a.id)}>{t("acc.reactivate")}</button>}
                    <select className="roledd" value={a.role || "community"} onChange={e => setAccRole(a.id, e.target.value)}>
                      <option value="community">Climber</option>
                      <option value="schrauber">Route Creator</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button className="removex danger" onClick={() => { if (confirm(`${a.name} entfernen? Eingetragene Ergebnisse bleiben erhalten.`)) removeAccount(a.id); }}>✕</button>
                  </div>
                )}
              </div>
            ); })}
            {isAdmin && <div className="phint" style={{ marginTop: 4 }}>Route Creator & Admins dürfen Routen anlegen und bearbeiten. Climber tragen nur eigene Ergebnisse ein und bilden Gruppen. Konten ohne Aktivität über 1 Jahr werden automatisch archiviert.</div>}
          </div>
          {isAdmin && (
            <div className="stcard"><h3><span>Verwaltung</span></h3>
              <div className="note">Vorsicht: setzt das Board auf die importierten Original-Daten zurück.</div>
              <button className="miniaction danger" onClick={() => { const pw = prompt("Sicherheitspasswort eingeben:"); if (pw === "1234567890") { if (confirm("Board wirklich zurücksetzen? Alle Daten gehen verloren.")) setCommunity(SEED_COMMUNITY); } else if (pw !== null) alert("Falsches Passwort."); }}>Board zurücksetzen</button>
            </div>
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
        const inviteables = accounts.filter(a => !groupOf(a.id) && a.id !== me.id);
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
          {next && (
            <div className="emojiunlock-hint">
              🔒 {next.count} weitere bei <b>{next.at} Ach-Pts</b> · du hast {Math.round(achScore)} · noch {Math.max(0, next.at - Math.round(achScore))} fehlen
            </div>
          )}
          {!next && <div className="emojiunlock-hint" style={{ color: "var(--amber)" }}>🏆 Alle Emojis freigeschaltet!</div>}
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
            {next && <div className="emojiunlock-hint" style={{ marginBottom: 8 }}>🔒 +50 bei {next.at} Ach-Pts</div>}
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
  const [wall, setWall] = useState(route ? (wallCanon(route.gym) || route.gym || null) : null);
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
    <div className="scrim" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="grip" />
        <div className="shead"><h2>{isNew ? "Route anlegen" : "Route bearbeiten"}</h2><button className="x" onClick={onClose}>✕</button></div>
        <div className="sbody">
          {!wall ? (
            <div className="field">
              <div className="fpttl">Auf welchem Bereich hängt die Route? Tippe ihn auf dem Hallenplan an.</div>
              <div className="fpwrap"><FloorPlan value={wall} onChange={changeWall} /></div>
            </div>
          ) : (<>
          <div className="wallbar">
            <span className="wallbar-ic"><WallIcon code={wall} size={20} /></span>
            <span className="wb-name">{wallName(wall)}</span>
            <button className="wb-change" onClick={() => setWall(null)}>Plan ▾</button>
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
                  <button key={cname} type="button" className={"colbtn" + (active ? " on" : "")} style={{ background: hex, color: isLight ? "#111" : "#fff", outline: active ? "2px solid var(--chalk)" : "none", outlineOffset: "2px" }} onClick={() => setName(cname)} title={cname}>
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
