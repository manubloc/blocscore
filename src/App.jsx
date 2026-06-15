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

const LOGO_IMG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAlgAAAGQCAYAAAByNR6YAAEAAElEQVR42uz9eZxt11UdCo+x9jlVdavq9o1aW5Yty5I7SZZtuQELd3LfgW0MAQK8NOSRAI+88AF5D9KQBIgDBMgjoQm9jRtsgxvcggmYOCE0Nu4tbKxeV/fq3urr1Nl7ze+Ptdacc+26JPm+l7zna9b8IXOlW3XOPnvvs9dYY445BtCqVatWrVq1atWqVatWrVq1atWqVatWrVq1atWqVatWrVq1atWqVatWrVq1atWqVatWrVq1atWqVatWrVq1atWqVatWrVq1atWqVatWrVq1atWqVatWrVq1atWqVatWrVq1atWqVatWrVq1atWqVatWrVq1atWqVatWrVq1atWqVatWrVq1atWqVatWrVq1atWqVatWrVq1atWqVatWrVq1atWqVatWrVq1atWqVatWrVq1atWqVatWrVq1atWqVatWrVq1atWqVatWrVq1atWqVatWrVq1atWqVatWrVq1atWqVatWrVq1atWqVatWrVq1atWqVatWrVq1atWqVatWrVq1atWqVatWrVq1atWqVatWrVq1atWqVatWrVq1atWqVatWrVq1atWqVatWrVq1atWqVatWrVq1atWqVatWrVq1atWqVatWrVq1atWqVatWrVq1atWqVatWrVq1atWqVatWrVq1atWqVatWrVq1atWqVatWrVq1atWqVatWrVq1atWqVatWrVq1atWqVatWrVq1atWqVatWrVq1atWqVatWrVq1atWqVatWrVq1atWqVatWrVq1atWqVatWrVq1atWqVatWrVq1atWqVatWrVq1atWqVatWrVq1atWqVatWrVq1atWqVatWrVq1atWqVatWrVq1atWqVatWrVq1atWqVatWrVq1atWqVatWrVq1atWqVatWrVq1atWqVau/SsV2Clq1+r/1vWH7HrX6Eiv5S/5/q1atGsBq1ep/6HeEAEL+9wggkkyrjsi+L5P8175YTD8gf8mXUP47v6Qyej/9Wf5Xfojuh/nfOmr573xMjF+4PVouWjwl46vIfGkFADp3of0/rVq1agCrVav/rgr5H3nVq16FN73pTQNZ4ajyM1MAi9OVlYfIEA71u/MFYPdAAmCLBPoADBFAP0IxXQZpY0QT8r/3NRSr/sz/BuPgfzYAGNzryn8FTcUL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";
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
.topbar { padding:4px 14px; display:flex; align-items:center; justify-content:space-between; gap:10px; position:relative; background-size:cover; background-position:center 40%; height:65px; min-height:65px; max-height:65px; border-bottom:1px solid rgba(255,255,255,.08); background-color:#252830; }
.topbar-overlay { position:absolute; inset:0; background:linear-gradient(90deg, rgba(14,17,20,.82) 0%, rgba(14,17,20,.55) 60%, rgba(14,17,20,.75) 100%); pointer-events:none; }
.brand { display:flex; align-items:center; position:relative; z-index:1; padding-left:10px; }
.brand-logo { height:60px; width:auto; object-fit:contain; display:block; }
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
.tab { flex:1; display:flex; flex-direction:column; align-items:center; gap:2px; padding:5px 2px 4px; border-radius:8px; color:var(--muted); border:none; font-size:9px; text-transform:uppercase; font-family:'Figtree',sans-serif; }
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
.login-logo { width:min(260px, 68vw); height:auto; object-fit:contain; margin-top:32px; }
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
