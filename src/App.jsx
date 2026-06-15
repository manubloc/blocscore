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
.btn { width:100%; background:#b8ff00; color:#0d0e0f; font-weight:700; font-size:16px; padding:14px; border-radius:12px; margin-top:12px; border:1px solid rgba(255,255,255,.18); }
.btn.ghost { background:var(--panel2); color:var(--chalk); border:1px solid var(--line); }
.err { color:#dd5468; font-size:13px; margin-top:10px; }
.linkbtn { color:var(--amber); font-weight:600; font-size:14px; padding:14px 4px; display:block; width:100%; text-align:center; margin-top:6px; }
.hint { font-size:12px; color:var(--muted); line-height:1.5; background:var(--panel); border:1px solid var(--line); border-radius:11px; padding:11px 12px; margin-top:18px; }
.roleseg { display:flex; gap:8px; margin-top:8px; }
.roleseg button { flex:1; padding:11px; border-radius:10px; background:var(--panel2); border:1px solid var(--line); color:var(--muted); font-weight:600; font-size:13.5px; }
.roleseg button.on { background:var(--chalk); color:var(--bg); border-color:var(--chalk); }

/* top bar */
.topbar { padding:6px 16px; display:flex; align-items:center; justify-content:space-between; gap:10px; position:relative; background-size:cover; background-position:center 40%; height:72px; min-height:72px; max-height:72px; border-bottom:1px solid rgba(255,255,255,.08); background-color:#252830; }
.topbar-overlay { position:absolute; inset:0; background:linear-gradient(90deg, rgba(14,17,20,.82) 0%, rgba(14,17,20,.55) 60%, rgba(14,17,20,.75) 100%); pointer-events:none; }
.brand { display:flex; align-items:center; position:relative; z-index:1; padding-left:10px; }
.brand-logo { height:48px; width:auto; object-fit:contain; display:block; }
.brand h1 { font-family:'Barlow Condensed'; font-weight:300; font-size:27px; margin:0; line-height:1; letter-spacing:.05em; color:var(--chalk); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.uchip { display:flex; align-items:center; gap:8px; background:rgba(255,255,255,.1); border:1px solid rgba(255,255,255,.18); backdrop-filter:blur(8px); border-radius:22px; padding:4px 5px 4px 10px; flex:none; position:relative; z-index:1; }
.uchip .un { font-size:12.5px; font-weight:600; max-width:74px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.adminpill { font-size:8px; letter-spacing:.1em; text-transform:uppercase; color:var(--amber); border:1px solid rgba(184,255,0,.3); background:rgba(184,255,0,.08); padding:2px 6px; border-radius:4px; font-weight:700; }
.seg { display:flex; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08); border-radius:8px; padding:3px; width:fit-content; }
.seg button { font-size:12px; font-weight:600; padding:6px 11px; border-radius:6px; color:var(--muted); white-space:nowrap; background:none; border:1px solid transparent !important; }
.seg button.on { background:rgba(255,255,255,.09); color:var(--chalk); border:1px solid rgba(184,255,0,.35) !important; color:#b8ff00; }
.segwrap { padding:0 16px 4px; display:flex; align-items:center; gap:10px; }
.seg.full, .segwrap .seg { width:fit-content; }
.addtop-tb { flex:none; height:34px; padding:0 14px 0 10px; border-radius:9px; background:var(--amber); border:1px solid rgba(255,255,255,.18); color:#13161a; font-weight:700; font-size:13px; display:flex; align-items:center; gap:5px; position:relative; z-index:1; }
.addtop-tb .plus { font-size:17px; font-weight:300; line-height:1; }


/* leaderboard */
.lb { padding:4px 14px 96px; }
.lbrow { display:flex; align-items:center; gap:13px; padding:13px 12px; border-radius:13px; margin-bottom:8px; background:var(--panel); border:1px solid var(--line); }
.lbrow.lead { background:linear-gradient(100deg,#2a2f25,#1f242c); border-color:#3f4733; }
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
.chip { font-size:12px; font-weight:600; padding:6px 11px; border-radius:20px; white-space:nowrap; background:var(--panel); border:1px solid var(--line); color:var(--muted); display:inline-flex; align-items:center; gap:5px; }
.chip.on { background:var(--chalk); color:var(--bg); border-color:var(--chalk); }
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
.pill { display:inline-flex; align-items:center; gap:5px; padding:8px 11px; border-radius:10px; background:#242c3a; border:1px solid rgba(255,255,255,.22); color:var(--chalk); font-weight:600; font-size:13px; flex:none; }
.pill.has { color:var(--chalk); }

/* route stats */
.rc { position:relative; }



/* unified color+grade chip */
.gcol { width:36px; height:36px; border-radius:7px; flex:none; display:flex; align-items:center; justify-content:center; border:2px solid var(--gcol-color, #b8ff00); background:transparent; }
.gcol .ggrade { font-family:'Barlow Condensed'; font-weight:800; font-size:20px; line-height:1; text-align:center; color:var(--gcol-color, #b8ff00); }
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
.removex { color:#e98b7d; font-size:16px; padding:4px 9px; background:rgba(233,139,125,.12); border-radius:8px; border:1px solid rgba(233,139,125,.3); font-weight:700; }
.danger { color:#dd5468 !important; }
.miniaction { width:100%; text-align:center; background:#242c3a; border:1px solid rgba(255,255,255,.22); border-radius:10px; padding:11px 12px; font-size:13.5px; font-weight:700; margin-top:8px; color:var(--chalk); display:inline-flex; align-items:center; justify-content:center; gap:7px; transition:background .12s; }
.miniaction:hover { background:#2e3848; }
.miniaction:active { background:#262d37; }
.miniaction.primary { background:var(--amber); border:1px solid rgba(255,255,255,.18); color:#13161a; }
.miniaction.primary:hover { background:#f5c25c; border-color:#f5c25c; }
.miniaction.danger { color:#e98b7d; border-color:#5a2f2a; background:#2a1c1a; }
.miniaction.danger:hover { background:#3a221f; }
.miniaction.locked { opacity:.6; cursor:not-allowed; }
.miniaction .mi-ic { font-size:15px; line-height:1; }

/* tabbar / fab */
.tabbar { display:flex; background:#1e2028; border-top:1px solid rgba(255,255,255,.09); padding:4px 2px calc(4px + env(safe-area-inset-bottom)); gap:1px; height:55px; box-sizing:border-box; }
.tab { flex:1; display:flex; flex-direction:column; align-items:center; gap:2px; padding:5px 2px 4px; border-radius:8px; color:var(--muted); border:none; font-size:9px; text-transform:uppercase; font-family:'Figtree',sans-serif; font-weight:600; }
.tab span { font-size:9px; }
.tab svg { width:26px; height:26px; stroke-width:1.6; }
.tab.on { color:#b8ff00; }
.tab.on svg { color:#b8ff00; }
.tab.on svg { stroke-width:2; color:#b8ff00; }
.tab .ic { font-size:18px; line-height:1; }
.tab .tl { font-size:10px; font-weight:600; }
.fab { position:fixed; right:18px; bottom:84px; height:52px; padding:0 22px 0 18px; border-radius:26px; background:#b8ff00; color:#0d0e0f; font-size:15px; font-weight:700; display:flex; align-items:center; gap:7px; border:1px solid rgba(255,255,255,.18); z-index:60; }
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
.primaryaction { width:100%; background:#b8ff00; color:#0d0e0f; font-weight:700; font-size:15px; border-radius:11px; padding:13px; margin-bottom:16px; border:1px solid rgba(255,255,255,.18); }

.primaryaction.locked { opacity:.6; cursor:not-allowed; background:var(--panel2); color:var(--muted); box-shadow:none; border:1px solid var(--line); }
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
.colbtn { width:100%; aspect-ratio:1; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:0; border:1px solid rgba(255,255,255,.15); transition:transform .1s; }
.colbtn:active { transform:scale(.9); }
.colbtn.on { border:1px solid var(--chalk); box-shadow:0 0 0 1px var(--chalk); }
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
.login-logo { width:min(320px, 80vw); height:auto; object-fit:contain; margin-top:24px; }
.lwordmark { font-family:'Barlow Condensed',sans-serif; font-weight:300; font-size:56px; letter-spacing:.04em; line-height:.9; margin:20px 0 0; color:#fff; text-shadow:0 2px 22px rgba(0,0,0,.55); }
.lwordmark span { color:var(--amber); }
.ltagline { font-family:'Figtree',sans-serif; font-weight:300; font-size:13px; letter-spacing:.36em; text-transform:uppercase; color:rgba(255,255,255,.84); margin-top:13px; padding-left:.36em; text-shadow:0 1px 12px rgba(0,0,0,.7); }
.logincard { background:rgba(22,26,32,.72); backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px); border:1px solid rgba(255,255,255,.10); border-radius:20px; margin:16px 18px 0; padding:18px; max-width:440px; width:calc(100% - 36px); align-self:center; box-shadow:0 20px 54px rgba(0,0,0,.55); }
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
.ovcard { background:linear-gradient(150deg,#222834,#1b2029); border:1px solid var(--line); border-radius:16px; padding:14px; margin-bottom:14px; }
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
.roledd { background:var(--panel2); border:1px solid var(--amber); color:var(--chalk); border-radius:8px; padding:7px 10px; font-size:12.5px; font-weight:700; outline:none; cursor:pointer; }
.roledd:focus { border-color:var(--amber); }

/* achievements */
.achhero { display:flex; align-items:center; gap:16px; background:linear-gradient(150deg,rgba(184,255,0,.06),#1c1f27); border:1px solid var(--line); border-radius:18px; padding:18px; margin-bottom:16px; }
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
.achbadge { flex:none; width:120px; background:linear-gradient(155deg,#3a2f12,#241f12); border:1px solid rgba(184,255,0,.3); border-radius:13px; padding:11px; display:flex; flex-direction:column; gap:5px; }
.achbadge .abic { font-size:22px; }
.achbadge .abn { font-size:12px; font-weight:700; color:#f6e8c8; line-height:1.2; }
.achbadge .abp { font-family:'Barlow Condensed'; font-weight:700; font-size:13px; color:var(--amber); }
.achrow, .catrow { display:flex; align-items:center; gap:12px; background:var(--panel); border:1px solid var(--line); border-radius:13px; padding:11px 12px; margin-bottom:8px; width:100%; text-align:left; }
.achrow.done { background:linear-gradient(150deg,#23291f,#1b1f27); border-color:#33502f; }
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
.cmt.mine .cmttext { background:linear-gradient(160deg,#3a2f12,#2c2614); border-color:rgba(184,255,0,.3); color:#f6e8c8; border-radius:13px 3px 13px 13px; }
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
        <img src={LOGO_IMG} alt="blocscore" className="login-logo" />
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
  const NEED_COMMENT = 100, NEED_GROUP = 200, NEED_CREATOR = 10000;
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
                  {colorOf(r.name) && <span className="hrswatch" style={{ borderColor: colorOf(r.name), background: colorOf(r.name) === "#181C22" ? "rgba(255,255,255,.15)" : colorOf(r.name) + "22" }} />}
                  <div className="hrname">
                    <div className="t1">{routeTitle(r)}</div>
                    <div className="t2">{r.grade}er · {wallName(r.gym)} · 🛠 {fmtDate(r.date)}</div>
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
