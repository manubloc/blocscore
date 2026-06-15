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
const GRADE_COLOR = { 1: "#4fbf7a", 2: "#7cc267", 3: "#aec353", 4: "#d8c044", 5: "#e69f3e", 6: "#e47f3f", 7: "#e16245", 8: "#dd4f5f" };
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
    tC.forEach((n)=>push(`${g}er`,"🪨",en?`${n}× Grade ${g}`:`${n}× ${g}er`,en?`Climb ${n} grade-${g} routes`:`Klettere ${n} ${g}er-Routen`,n,`grade:${g}:t`,Math.round(pts(n)*gScale[g])));
    const fC=g<=3?[1,3,5]:g<=5?[1,3,5,10,25]:g<=7?[1,3,5,10,20]:[1,3,5,10];
    fC.forEach((n)=>push(`${g}er`,"⚡",en?`Flash ${n}× Grade ${g}`:`Flash ${n}× ${g}er`,en?`Flash ${n} grade-${g} routes`:`Flashe ${n} ${g}er-Routen`,n,`grade:${g}:f`,Math.round(pts(n)*gScale[g]*2)));
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

const LOGO_IMG = "data:image/png;base64,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9/X1sXLlSi644AIuuugiVq5cyaRJk5BSmpBzEAREUUQulzP/V0qZaFNnVEeDgud5BpCEENRqNR577DFuvfVW7r33XlavXk2j0aBarbZNPtu2sSzreVMaoO/lxRdfzE9/+lOiKKJQKLTdP8uy+Iu/+As+//nPj6pyn9gmAOd5sWU1XzqtgrEsHE1ynnHGGZx99tmcf/75LFmyhOOOO64tFJ0libU1oi0iDVyWZVGr1cjn822JfVnLx/d9Nm7cyOrVq7nzzju588472bBhw8HB03G++u/ny8qv73E2dL569WqWLVtGPp+n2WySy+WoVquUSiUefPBBzj//fHzfn7BwJgDn+bll3SidFKeLGHXE57jjjuOiiy7i8ssv55RTTjEWjLZQNDjookSlFI1GA8dx2qQ5tQWl81WyFpQGmu3bt3Pvvffy8MMP8/Of/5zNmzcbN0JbXhqgOl2hbJLdWK7Sc9md9TwP3/d561vfyhe/+EWTLa3vn5SSIAi49NJLeeCBByasmwnAef66UTrsm83oXbFiBVdccQUXXXQRJ598MpCGqjXXot0k13WNGxTH8ahJ38ll6KxiXTawa9cuHn30Ue677z7uuece1qxZw969e9s+b1kWruvi+/4o1yl77OeTddO56XB/uVxm7dq1TJ48uS2VIAgCcrkcN9xwA3/6p386kWk8ATjPzy07cM8880x+//d/n5e85CUcf/zxbYSw5hO0ZZIFn6zGSxYAPM+j2WxiWZb53M6dO7n//vt54IEHWLVqFVu2bGHr1q2jgEKT1Hol75QC1QJXvw33Xls6GmBuuukmXve615l7XK/X8TwPy7LYsWMHixYtMuT7xPbMt4lw3W84E3jlypXqS1/6ktq3b5/JxM3mxWS3kZERkwnr+76pvK7X6215MDqXZt++feqee+5Rn/70p9Ull1yient7TYg5G7YWQijbtk24uDPcPFZIWue0jFWR/nyoqNZZzdk8JSGEeulLX6pGRkZMHk62al0ppa699toxc4Em9ok8nOf07rqu+tCHPqT27t3bllwXx7GqVqtt4OH7fluJQKVSMaCS/Wy1WlX33Xef+upXv6quueYatWTJklHAkc150XkuhzrPLBCN9Xc2Z4ZDlBrwHC//0Al9juOoxx9/XCml2pL/NNDfcccdE+N3AnCem7tOFNP1SlJKlc/n1cKFC9Vtt91m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";
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
.bld, .login { --bg:#181c24; --panel:#1d222a; --panel2:#262d37; --line:#323a46; --chalk:#edeee8; --muted:#909caa; --amber:#c8d42e; --topfill:#aeb9c4; --topbg:#33414e; --topbd:#46586a; }
.bld { position:fixed; inset:0; background:var(--bg); color:var(--chalk); font-family:'Inter',system-ui,sans-serif; -webkit-font-smoothing:antialiased; display:flex; flex-direction:column; overflow:hidden; }
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
.login { position:fixed; inset:0; display:flex; flex-direction:column; overflow-y:auto; color:var(--chalk); font-family:'Inter',sans-serif; background:#14171c; }
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
.btn { width:100%; background:var(--amber); color:#13161a; font-weight:700; font-size:16px; padding:14px; border-radius:12px; margin-top:12px; border:1px solid rgba(255,255,255,.18); }
.btn.ghost { background:var(--panel2); color:var(--chalk); border:1px solid var(--line); }
.err { color:#dd5468; font-size:13px; margin-top:10px; }
.linkbtn { color:var(--amber); font-weight:600; font-size:14px; padding:14px 4px; display:block; width:100%; text-align:center; margin-top:6px; }
.hint { font-size:12px; color:var(--muted); line-height:1.5; background:var(--panel); border:1px solid var(--line); border-radius:11px; padding:11px 12px; margin-top:18px; }
.roleseg { display:flex; gap:8px; margin-top:8px; }
.roleseg button { flex:1; padding:11px; border-radius:10px; background:var(--panel2); border:1px solid var(--line); color:var(--muted); font-weight:600; font-size:13.5px; }
.roleseg button.on { background:var(--chalk); color:var(--bg); border-color:var(--chalk); }

/* top bar */
.topbar { padding:14px 16px 12px; display:flex; align-items:center; justify-content:space-between; gap:10px; position:relative; background-size:cover; background-position:center 40%; min-height:64px; border-bottom:1px solid rgba(255,255,255,.08); }
.topbar-overlay { position:absolute; inset:0; background:linear-gradient(90deg, rgba(14,17,20,.82) 0%, rgba(14,17,20,.55) 60%, rgba(14,17,20,.75) 100%); pointer-events:none; }
.brand { display:flex; align-items:center; position:relative; z-index:1; }
.brand-logo { height:44px; width:auto; object-fit:contain; filter:drop-shadow(0 1px 4px rgba(0,0,0,.5)); }
.brand h1 { font-family:'Barlow Condensed'; font-weight:300; font-size:27px; margin:0; line-height:1; letter-spacing:.05em; color:var(--chalk); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.uchip { display:flex; align-items:center; gap:8px; background:rgba(255,255,255,.1); border:1px solid rgba(255,255,255,.18); backdrop-filter:blur(8px); border-radius:22px; padding:4px 5px 4px 10px; flex:none; position:relative; z-index:1; }
.uchip .un { font-size:12.5px; font-weight:600; max-width:74px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.adminpill { font-size:8.5px; letter-spacing:.1em; text-transform:uppercase; color:var(--amber); border:1px solid #5a4715; background:#332a12; padding:1px 5px; border-radius:5px; font-weight:700; }
.seg { display:flex; background:var(--panel); border:1px solid rgba(255,255,255,.1); border-radius:9px; padding:3px; width:fit-content; }
.seg button { font-size:12px; font-weight:600; padding:6px 11px; border-radius:6px; color:var(--muted); white-space:nowrap; background:none; border:1px solid transparent !important; }
.seg button.on { background:rgba(255,255,255,.07); color:var(--chalk); border:1px solid rgba(255,255,255,.28) !important; }
.segwrap { padding:0 16px 4px; display:flex; align-items:center; gap:10px; }
.seg.full, .segwrap .seg { width:fit-content; }
.addtop-tb { flex:none; height:34px; padding:0 14px 0 10px; border-radius:9px; background:var(--amber); border:1px solid rgba(255,255,255,.18); color:#13161a; font-weight:700; font-size:13px; display:flex; align-items:center; gap:5px; position:relative; z-index:1; }
.addtop-tb .plus { font-size:17px; font-weight:300; line-height:1; }


/* leaderboard */
.lb { padding:4px 14px 96px; }
.lbrow { display:flex; align-items:center; gap:13px; padding:13px 12px; border-radius:13px; margin-bottom:8px; background:var(--panel); border:1px solid var(--line); }
.lbrow.lead { background:linear-gradient(100deg,#2a2f25,#1f242c); border-color:#3f4733; }
.lbrow.meRow { border:1px solid var(--amber); }
.rank { font-family:'Barlow Condensed'; font-weight:700; font-size:22px; width:24px; text-align:center; color:var(--muted); }
.lbrow.lead .rank { color:var(--amber); }
.who { flex:1; min-width:0; }
.who .nm { font-weight:600; font-size:15.5px; display:flex; align-items:center; gap:7px; }
.youtag { font-size:9px; letter-spacing:.1em; color:var(--bg); background:var(--amber); padding:1px 5px; border-radius:4px; font-weight:700; }
.who .meta { font-size:11.5px; color:var(--muted); margin-top:2px; display:flex; gap:10px; }
.who .meta b { color:var(--amber); font-weight:600; }
.pts { text-align:right; }
.pts .v { font-family:'Barlow Condensed'; font-weight:700; font-size:30px; line-height:.9; }
.pts .u { font-size:10px; color:var(--muted); letter-spacing:.12em; text-transform:uppercase; }
.bar { height:4px; background:var(--line); border-radius:3px; margin-top:7px; overflow:hidden; }
.bar > i { display:block; height:100%; background:var(--amber); border-radius:3px; }

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
.du { flex:1; display:flex; align-items:center; justify-content:center; gap:8px; padding:10px 13px; border-radius:10px; border:1px solid rgba(255,255,255,.28); background:#242c3a; color:var(--chalk); font-weight:700; font-size:13.5px; user-select:none; }

 50% { box-shadow:0 0 11px 0 rgba(242,180,65,.28);} }
.du:active { transform:scale(.98); }
.du.top { background:#1f3a26; border-color:#3fae5e; color:#5cc97e; }
.du.flash { background:#2a2310; border-color:var(--amber); color:var(--amber); }
.du .dpts { font-family:'Barlow Condensed'; font-weight:700; opacity:.85; }
.pill { display:inline-flex; align-items:center; gap:5px; padding:8px 11px; border-radius:10px; background:#242c3a; border:1px solid rgba(255,255,255,.22); color:var(--chalk); font-weight:600; font-size:13px; flex:none; }
.pill.has { color:var(--chalk); }

/* route stats */
.rc { position:relative; }



/* unified color+grade chip */
.gcol { width:52px; height:52px; border-radius:12px; flex:none; display:flex; align-items:center; justify-content:center; border:1px solid rgba(0,0,0,.2); }
.gcol .ggrade { font-family:'Barlow Condensed'; font-weight:800; font-size:30px; line-height:1; text-align:center; }
.wldone { font-family:'Barlow Condensed'; font-weight:700; font-size:14px; color:#5cc97e; margin-left:auto; padding:0 6px; }
.wlcount { min-width:20px; text-align:right; }
.ovdone { font-size:12px; font-weight:700; color:#5cc97e; margin-left:6px; }
.ovb { position:relative; }
.ovb.done { border:1px solid #5cc97e !important; }
.ovchk { position:absolute; right:-3px; top:-3px; width:17px; height:17px; border-radius:50%; background:#3fae5e; color:#0d130f; font-size:11px; font-weight:800; font-style:normal; display:flex; align-items:center; justify-content:center; border:1px solid var(--panel); }
.routebadge { position:absolute; top:8px; right:8px; display:flex; gap:4px; z-index:4; }
.rbadge { font-size:13px; line-height:1; opacity:.85; }
.rpills { display:flex; gap:5px; align-items:center; flex:none; margin-left:auto; }
.rschip { font-size:11px; font-weight:700; padding:2px 7px; border-radius:999px; white-space:nowrap; }
.rschip.top { background:#1f3a26; color:#5cc97e; }
.rschip.flash { background:#2a2e0a; color:var(--amber); }

/* stats */
.stats { padding:8px 14px 120px; }
.stcard { background:var(--panel); border:1px solid var(--line); border-radius:14px; padding:14px; margin-bottom:10px; }
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
.rolebtn.adm { color:var(--amber); border-color:#5a4715; }
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
.tabbar { display:flex; background:var(--panel); border-top:1px solid var(--line); padding:8px 8px calc(8px + env(safe-area-inset-bottom)); gap:4px; }
.tab { flex:1; display:flex; flex-direction:column; align-items:center; gap:3px; padding:5px; border-radius:10px; color:var(--muted); border:1px solid transparent; }
.tab.on { color:var(--chalk); border:1px solid rgba(255,255,255,.25); background:rgba(255,255,255,.05); }
.tab .ic { font-size:18px; line-height:1; }
.tab .tl { font-size:10px; font-weight:600; }
.fab { position:fixed; right:18px; bottom:84px; height:52px; padding:0 22px 0 18px; border-radius:26px; background:var(--amber); color:#13161a; font-size:15px; font-weight:700; display:flex; align-items:center; gap:7px; border:1px solid rgba(255,255,255,.18); z-index:60; }
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
.wb-change { color:var(--amber); font-weight:600; font-size:13px; padding:6px 10px; border:1px solid rgba(200,212,46,.3); border-radius:8px; background:transparent; }
.gradepick { display:grid; grid-template-columns:repeat(4,1fr); gap:7px; }
.gradepick button { padding:11px 0; border-radius:10px; background:var(--panel2); border:1px solid var(--line); color:var(--muted); font-weight:700; font-family:'Barlow Condensed'; font-size:18px; }
.gradepick button.on { color:#13161a; }
.statusseg { display:grid; grid-template-columns:repeat(2,1fr); gap:8px; }
.statusseg button { padding:11px 0; border-radius:10px; background:var(--panel2); border:1px solid var(--line); color:var(--muted); font-weight:700; }
.statusseg button.on { color:#13161a; }
.ghint { font-size:12px; color:var(--muted); margin-top:8px; }
.ghint b { color:var(--chalk); }
.bigtri { display:flex; gap:8px; }
.bigtri button { flex:1; padding:14px 4px; border-radius:11px; border:1px solid var(--line); font-weight:700; font-size:14px; color:var(--muted); background:var(--bg); display:flex; flex-direction:column; gap:3px; align-items:center; }
.bigtri button .sp { font-family:'Barlow Condensed'; font-size:12px; opacity:.8; }
.bigtri button.a { background:var(--topbg); border-color:var(--topbd); color:var(--chalk); }
.bigtri button.f { background:#252208; border-color:var(--amber); color:var(--amber); }
.photos { display:flex; gap:8px; flex-wrap:wrap; }
.thumb { position:relative; width:84px; height:84px; border-radius:11px; overflow:hidden; border:1px solid var(--line); }
.thumb img { width:100%; height:100%; object-fit:cover; display:block; }
.thx { position:absolute; top:4px; right:4px; width:21px; height:21px; border-radius:50%; background:rgba(8,10,13,.74); color:#fff; font-size:11px; display:flex; align-items:center; justify-content:center; }
.addphoto { width:84px; height:84px; border-radius:11px; border:1px dashed var(--line); color:var(--muted); background:var(--panel2); font-size:12.5px; font-weight:600; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; }
.phint { font-size:11px; color:var(--muted); margin-top:8px; line-height:1.4; }
.save { width:100%; background:var(--amber); color:#13161a; font-weight:700; font-size:16px; padding:14px; border-radius:12px; margin-top:6px; border:1px solid rgba(255,255,255,.18); }
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
.tipcompose button { background:var(--amber); color:#13161a; font-weight:700; border-radius:10px; padding:0 16px; align-self:stretch; }

/* map browse */
.mapbrowse { padding:0 0 120px; }
.walllegend { margin-top:12px; display:flex; flex-direction:column; gap:7px; }
.wlrow { display:flex; align-items:center; gap:11px; background:var(--panel); border:1px solid var(--line); border-radius:11px; padding:10px 12px; text-align:left; width:100%; }
.wlrow:active { transform:scale(.99); }
.wlic { width:30px; height:30px; border-radius:8px; background:var(--panel2); border:1px solid var(--line); color:var(--chalk); display:flex; align-items:center; justify-content:center; flex:none; }
.wlname { flex:1; font-weight:600; font-size:14px; }
.wlcount { font-family:'Barlow Condensed'; font-weight:700; font-size:16px; color:var(--amber); min-width:20px; text-align:right; }

/* groups */
.gemoji { width:38px; height:38px; border-radius:10px; background:var(--panel2); border:1px solid var(--line); display:flex; align-items:center; justify-content:center; font-size:20px; flex:none; }
.lbrow .gemoji { width:34px; height:34px; font-size:18px; }
.primaryaction { width:100%; background:var(--amber); color:#13161a; font-weight:700; font-size:15px; border-radius:11px; padding:13px; margin-bottom:16px; border:1px solid rgba(255,255,255,.18); }

.primaryaction.locked { opacity:.6; cursor:not-allowed; background:var(--panel2); color:var(--muted); box-shadow:none; border:1px solid var(--line); }
/* Accordion */
.routefilters { padding:10px 14px 14px; display:flex; flex-direction:column; gap:10px; }
.filterrow { display:flex; flex-wrap:wrap; gap:6px; align-items:center; }
.searchinp { width:100%; padding:11px 14px; border-radius:12px; background:#242c3a; border:1px solid rgba(255,255,255,.22); color:var(--chalk); font-size:14px; outline:none; }
.searchinp::placeholder { color:var(--muted); }
.gradefilter { display:flex; flex-wrap:wrap; gap:5px; }
.wallsection { border-radius:14px; overflow:hidden; margin:0 14px 10px; border:1px solid rgba(255,255,255,.18); }
.wallacchead { width:100%; display:flex; align-items:center; gap:10px; padding:13px 16px; background:#2c3650; text-align:left; border:none; color:var(--chalk); cursor:pointer; }
.wallacchead:active { background:rgba(255,255,255,.04); }
.wallacchead.open { background:#2a3545; border-bottom:1px solid #4a6080; }
.waname { flex:1; font-weight:600; font-size:15px; }
.waic { display:flex; align-items:center; color:var(--muted); }
.wadone { font-family:'Barlow Condensed'; font-weight:700; font-size:13px; color:#5cc97e; }
.wacount { font-family:'Barlow Condensed'; font-weight:700; font-size:13px; color:var(--muted); }
.waflash { font-family:'Barlow Condensed'; font-weight:700; font-size:13px; color:var(--amber); }
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
.joinbtn { background:var(--amber); color:#13161a; font-weight:700; font-size:13px; border-radius:9px; padding:9px 14px; flex:none; border:1px solid rgba(255,255,255,.18); }
.leavebtn { background:var(--panel2); border:1px solid var(--line); color:var(--muted); font-weight:600; font-size:14px; border-radius:11px; }
.emojipick { display:flex; gap:6px; flex-wrap:wrap; }
.emojipick button { width:44px; height:44px; border-radius:11px; background:var(--panel2); border:1px solid var(--line); font-size:22px; display:flex; align-items:center; justify-content:center; }
.emojipick button.on { border-color:var(--amber); background:#202508; }
.emojipick.big { display:grid; grid-template-columns:repeat(auto-fill, minmax(44px, 1fr)); gap:6px; max-height:260px; overflow-y:auto; padding:8px; background:var(--panel); border:1px solid var(--line); border-radius:12px; }
.emojipick.big .epick { width:100%; height:44px; border-radius:9px; font-size:22px; background:transparent; border:1px solid transparent; cursor:pointer; display:flex; align-items:center; justify-content:center; }
.emojipick.big .epick.on { border-color:var(--amber); background:#202508; }
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

.reroll { font-size:11px; font-weight:600; color:var(--amber); background:transparent; border:1px solid rgba(200,212,46,.3); border-radius:7px; padding:4px 8px; text-transform:none; letter-spacing:0; }

/* professional login */
.login { display:flex; flex-direction:column; background-size:cover; background-position:center top; background-repeat:no-repeat; }
.loginhero { padding:62px 26px 24px; text-align:center; display:flex; flex-direction:column; align-items:center; }
.lmark { width:50px; height:50px; border-radius:14px; background:var(--amber); color:#13161a; display:flex; align-items:center; justify-content:center; flex:none; box-shadow:0 8px 26px rgba(0,0,0,.5); }
.lwordmark { font-family:'Barlow Condensed',sans-serif; font-weight:300; font-size:56px; letter-spacing:.04em; line-height:.9; margin:20px 0 0; color:#fff; text-shadow:0 2px 22px rgba(0,0,0,.55); }
.lwordmark span { color:var(--amber); }
.ltagline { font-family:'Inter',sans-serif; font-weight:300; font-size:13px; letter-spacing:.36em; text-transform:uppercase; color:rgba(255,255,255,.84); margin-top:13px; padding-left:.36em; text-shadow:0 1px 12px rgba(0,0,0,.7); }
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
.reqnote.warn { border-color:#5a4715; background:#2a230f; }
.reqbadge { display:inline-block; margin-left:7px; font-size:10.5px; font-weight:700; color:var(--amber); background:#21240a; border:1px solid #3a4010; border-radius:6px; padding:1px 6px; }
.archbadge { display:inline-block; font-size:10.5px; font-weight:700; color:#cdd4dc; background:var(--panel2); border:1px solid var(--line); border-radius:6px; padding:1px 6px; }
/* Hall stats */
.hkpi-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:10px; }
.hkpi { background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:12px 14px; }
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
.hrswatch { width:28px; height:28px; border-radius:7px; flex:none; border:1px solid rgba(0,0,0,.2); }
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
.skpi { flex:1; background:var(--panel2); border:1px solid var(--line); border-radius:10px; padding:9px 10px; text-align:center; }
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
.confirm .cf-yes { flex:1; padding:12px; border-radius:11px; background:var(--amber); color:#13161a; font-weight:700; font-size:14px; }
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
.rc.flash { border-color:var(--amber); }

/* role dropdown */
.roledd { background:var(--panel2); border:1px solid var(--amber); color:var(--chalk); border-radius:8px; padding:7px 10px; font-size:12.5px; font-weight:700; outline:none; cursor:pointer; }
.roledd:focus { border-color:var(--amber); }

/* achievements */
.achhero { display:flex; align-items:center; gap:16px; background:linear-gradient(150deg,#2a2118,#1c1f27); border:1px solid var(--line); border-radius:18px; padding:18px; margin-bottom:16px; }
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
.achbadge { flex:none; width:120px; background:linear-gradient(155deg,#3a2f12,#241f12); border:1px solid #5a4715; border-radius:13px; padding:11px; display:flex; flex-direction:column; gap:5px; }
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
.achbar i { display:block; height:100%; background:var(--amber); border-radius:3px; }
.achprog { font-family:'Barlow Condensed'; font-weight:700; font-size:15px; text-align:right; flex:none; }
.achpts { font-size:10px; color:var(--amber); font-family:'Inter'; font-weight:600; }
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
.cmt.mine .cmttext { background:linear-gradient(160deg,#3a2f12,#2c2614); border-color:#5a4715; color:#f6e8c8; border-radius:13px 3px 13px 13px; }
.cmempty { text-align:center; color:var(--muted); padding:34px 10px; display:flex; flex-direction:column; align-items:center; gap:4px; }
.cmempty .big { font-size:34px; margin-bottom:4px; }
.cmempty b { color:var(--chalk); font-size:15px; }
.cmempty span { font-size:12.5px; }
.cmcompose { display:flex; align-items:flex-end; gap:9px; margin-top:14px; position:sticky; bottom:0; background:var(--panel); padding:8px 0 2px; }
.cmcompose textarea { flex:1; min-height:44px; max-height:120px; resize:none; border-radius:20px; padding:11px 15px; background:var(--panel2); border:1px solid var(--line); color:var(--chalk); font-size:14px; outline:none; }
.cmcompose textarea:focus { border-color:var(--amber); }
.cmsend { width:44px; height:44px; border-radius:50%; background:var(--panel2); border:1px solid var(--line); color:var(--muted); font-size:16px; flex:none; transition:.12s; }
.cmsend.on { background:var(--amber); color:#13161a; border-color:var(--amber); }
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
        <span className="lmark"><BrandMark size={26} /></span>
        <h1 className="lwordmark">bloc<span>score</span></h1>
        <div className="ltagline">Elevate. Score. Repeat.</div>
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
      <div className="loginfoot">{t("login.foot")}</div>
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
                {GRADES.map(g => <button key={g} className={"chip" + (fGrade === g ? " on" : "")} style={{ color: GRADE_COLOR[g], borderColor: fGrade === g ? GRADE_COLOR[g] : undefined, background: fGrade === g ? GRADE_COLOR[g]+"22" : undefined }} onClick={() => setFGrade(fGrade === g ? 0 : g)}>{g}er</button>)}
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
                  {myWallDone[s.wall] > 0 && <span className="wadone">✓ {myWallDone[s.wall]}</span>}
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
                              <div className="gcol" style={col ? { background: col, color: colorFgOf(r.name) } : { background: GRADE_COLOR[r.grade] || "#666", color: "#fff" }}>
                                <span className="ggrade">{r.grade}</span>
                              </div>
                              <div className="rname">
                                <div className="t1"><span className="txt">{routeTitle(r)}</span>{r.archived && <span className="archtag">Archiv</span>}</div>
                                {r.note ? <div className="rnote">{r.note}</div> : null}
                                <div className="t2">{colorWord(r.name) ? colorWord(r.name) + " · " : ""}{r.grade}er · {wallName(r.gym)}</div>
                              </div>
                              <div className="rpills">
                                <span className="rschip top">✓ {topN}</span>
                                <span className="rschip flash">⚡ {flashN}</span>
                              </div>
                              {canSetRoutes && <button className="edit" onClick={() => setEditing(r)}>✎</button>}
                            </div>
                            <div className="rfoot">
                              <button className={"du " + (myStatus || "")} onClick={() => cycleMine(r.id)}>
                                {myStatus === "flash" ? <>⚡ Flash <span className="dpts">+{fmtPts(pointsFor(r.grade, "flash"))}</span></>
                                  : myStatus === "top" ? <>✓ Top <span className="dpts">+{fmtPts(pointsFor(r.grade, "top"))}</span></>
                                    : <>+ Eintragen</>}
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
                  <span className="hws">{w.sendCount} {t("hall.sendCount")}</span>
                  <span className="hwf">⚡ {w.flashCount}</span>
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
                  {colorOf(r.name) && <span className="hrswatch" style={{ background: colorOf(r.name) }} />}
                  <div className="hrname">
                    <div className="t1">{routeTitle(r)}</div>
                    <div className="t2">{r.grade}er · {wallName(r.gym)} · 🛠 {fmtDate(r.date)}</div>
                  </div>
                  <div className="hrstat">
                    <span className="rschip top">✓ {r.sendCount - Object.values(r.results || {}).filter(s => s === "flash").length}</span>
                    <span className="rschip flash">⚡ {Object.values(r.results || {}).filter(s => s === "flash").length}</span>
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
                    {colorOf(r.name) && <span className="hrswatch" style={{ background: colorOf(r.name) }} />}
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
                    <div className="skpi"><span className="skv">⚡ {sess.flashes}</span><span className="sku">{t("hall.flashCount")}</span></div>
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
                          {colorOf(r.name) && <span className="hrswatch sm" style={{ background: colorOf(r.name) }} />}
                          <span className="srn">{routeTitle(r)} <span className="sgrade">{r.grade}er</span></span>
                          <span className="rschip top" style={{ marginLeft: "auto" }}>✓ {sends - flashes}</span>
                          <span className="rschip flash">⚡ {flashes}</span>
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
            <h3><span>{isAdmin ? t("acc.users") : t("acc.members")}</span><span className="r">{accounts.length}</span></h3>
            {accounts.map(a => { const arch = isArchivedAcc(a, routes, today); return (
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
              <button className="miniaction danger" onClick={() => { if (confirm("Board wirklich zurücksetzen?")) setCommunity(SEED_COMMUNITY); }}>Board zurücksetzen</button>
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
        {[["routes", "🧗", t("nav.routes")], ["stats", "🏅", t("nav.ach")], ["gruppen", "👥", t("nav.groups")], ["board", "🏆", t("nav.board")], ["hall", "📊", t("nav.hall")], ["account", "👤", t("nav.account")]].map(([k, ic, l]) => (
          <button key={k} className={"tab" + (tab === k ? " on" : "")} onClick={() => setTab(k)}><span className="ic">{ic}</span><span className="tl">{l}</span></button>
        ))}
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
  const fill = on ? "#14171c" : "#f1f1ec";
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
          <path d={s.d} fill={on ? "var(--amber)" : fresh ? "#3a4150" : "#2c3037"} stroke={on ? "#8a9520" : fresh ? "#9fe6a0" : "rgba(200,212,46,.5)"} strokeWidth={on || fresh ? 1.5 : 1.0} strokeLinejoin="round" />
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
  const [wall, setWall] = useState(route ? wallCanon(route.gym) : null);
  const defaultDate = isNew ? (wall && screwDates?.[wall] ? screwDates[wall] : todayISO()) : (route?.date || todayISO());
  const [date, setDate] = useState(defaultDate);
  // Update date when wall changes (only for new routes)
  function changeWall(w) { setWall(w); if (isNew && screwDates?.[w]) setDate(screwDates[w]); }
  const [grade, setGrade] = useState(route?.grade || 5);
  const [name, setName] = useState(route?.name || "");
  const [nick, setNick] = useState(route?.nick || genName((route?.id || "new") + "|" + (route?.name || ""), route?.grade || 5));
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
            <div className="gradepick">{GRADES.map(g => <button key={g} className={grade === g ? "on" : ""} style={grade === g ? { background: GRADE_COLOR[g], borderColor: GRADE_COLOR[g] } : {}} onClick={() => setGrade(g)}>{g}er</button>)}</div>
            <div className="ghint">Punkte: <b>{fmtPts(topPts(grade))}</b> für Top · <b>{fmtPts(topPts(grade) + FLASH_BONUS)}</b> für Flash</div>
          </div>

          <div className="field"><label>Farbe der Griffe</label>
            <div className="colpicker">
              {[["lila","#7B3FC8"],["pink","#D4287A"],["blau","#1A6FD4"],["rot","#D93025"],["grün","#1E9E48"],["gelb","#F5C800"],["holz","#9A5020"],["schwarz","#181C22"],["weiß","#EEEEE4"]].map(([cname, hex]) => {
                const active = (name || "").toLowerCase() === cname;
                const isLight = cname === "gelb" || cname === "weiß";
                return (
                  <button key={cname} type="button" className={"colbtn" + (active ? " on" : "")} style={{ background: hex, color: isLight ? "#111" : "#fff", boxShadow: active ? `0 0 0 3px ${hex}, 0 0 0 5px var(--bg)` : "none" }} onClick={() => setName(cname)} title={cname}>
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
