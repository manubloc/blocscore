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
const STEP = 0.25;            // Punkte je Grad (Top = Grad × 0,25)
const FLASH_BONUS = 0.25;     // Flash = Top + 0,25
const GRADES = [1, 2, 3, 4, 5, 6, 7, 8];
const GRADE_COLOR = { 1: "#4fbf7a", 2: "#7cc267", 3: "#aec353", 4: "#d8c044", 5: "#e69f3e", 6: "#e47f3f", 7: "#e16245", 8: "#dd4f5f" };
function topPts(g) { return g * STEP; }
function pointsFor(grade, status) { if (!status) return 0; return grade * STEP + (status === "flash" ? FLASH_BONUS : 0); }

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
function medal(i) { return ["🥇", "🥈", "🥉"][i] || null; }
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
    "nav.hall": "Statistik",
    "hall.activity": "Hallenaktivität", "hall.creator": "Route Creator",
    "hall.today": "Heute", "hall.week": "Diese Woche", "hall.month": "Dieser Monat", "hall.total": "Gesamt",
    "hall.sends": "Begehungen", "hall.flashes": "Flashes", "hall.routes": "Aktive Routen",
    "hall.popular": "Beliebteste Routen", "hall.climbers": "Aktivste Kletterer",
    "hall.walls": "Wände im Überblick", "hall.sessions": "Schraubsessions",
    "hall.session": "Session", "hall.routeCount": "Routen", "hall.sendCount": "Begehungen",
    "hall.flashCount": "Flashes", "hall.popularity": "Beliebtheit",
    "hall.creatorHint": "Auswertung der Schraubsessions — beliebte Routen zeigen die Qualität.",
  },
  en: {
    "nav.routes": "Routes", "nav.ach": "Achievements", "nav.groups": "Groups", "nav.board": "Board", "nav.account": "Account",
    "common.save": "Save", "common.cancel": "Cancel", "common.delete": "Delete", "common.back": "Back", "common.all": "All",
    "login.signin": "Sign in", "login.signup": "Sign up", "login.name": "Name", "login.pin": "PIN",
    "login.namePh": "Your name", "login.pinPh": "PIN", "login.pinSet": "Set a PIN (min. 4 characters)",
    "login.suggest": "🎲 Suggest", "login.create": "Create account",
    "login.privTitle": "Private mode", "login.privDesc": "You track everything but appear in nobody's leaderboards — only you see your rank.",
    "login.demoShow": "Show demo accounts", "login.demoHide": "Hide demo accounts",
    "login.demoHint": "Example accounts · PIN for all: 1234 · Admin: login admin, password admin",
    "login.foot": "Local prototype · data stays in this browser",
    "login.errNoAcc": "No account with that name.", "login.errPin": "Wrong PIN.",
    "login.errName": "Please enter a name.", "login.errTaken": "Name is already taken.", "login.errShort": "PIN needs at least 4 characters.",
    "board.einzel": "Solo", "board.gruppen": "Groups", "board.aktuell": "Current", "board.gesamt": "All-time", "board.erfolge": "Achievements", "board.achpts": "ach. pts",
    "board.points": "points", "board.members": "members", "board.noGroups": "No groups yet. Create the first one in the “Groups” tab.",
    "routes.map": "Map", "routes.list": "List", "routes.tapHint": "Tap an area or a colored grade bubble to see its routes.",
    "routes.done": "done", "routes.search": "Search route (name, color, wall…)", "routes.allWalls": "all walls",
    "routes.scope.aktuell": "Current", "routes.scope.archiv": "Archive", "routes.scope.alle": "All", "routes.allGrades": "All grades",
    "routes.empty": "No routes in this view.", "routes.add": "Route", "routes.rescrewed": "reset on",
    "ach.unlocked": "achievements unlocked", "ach.points": "achievement points", "ach.done": "Unlocked", "ach.next": "Up next", "ach.cats": "Categories", "ach.view.ach": "Achievements", "ach.view.grade": "Grades",
    "groups.intro": "A group = your team. All members' points add up. Max. 10 members, you can only be in one group. Join by request to the creator or by invitation.",
    "groups.yours": "Your group", "groups.create": "+ Create your own group", "groups.discover": "Discover groups",
    "groups.request": "Request", "groups.requested": "Requested ✕", "groups.full": "full", "groups.manageHint": "Tap your group to manage members, requests and invites.",
    "cmt.title": "Comments", "cmt.empty": "No comments yet", "cmt.emptyHint": "Share the first tip or beta move for this route!", "cmt.ph": "Write a comment…",
    "acc.role.admin": "Administrator", "acc.role.schrauber": "Setter", "acc.role.community": "Community",
    "acc.changePw": "Change password", "acc.logout": "Sign out", "acc.privOn": "Private mode on", "acc.privOff": "Private mode off",
    "acc.privDesc": "When on, you appear in nobody's leaderboards — only you see your rank.",
    "acc.language": "Language", "acc.members": "Members", "acc.points": "Points system", "acc.canSet": "You can create and edit routes and add photos.",
    "acc.cannotSet": "You log your own results and can form groups. Only Route Creators & admins can create routes.",
    "plan.title": "Reset schedule", "plan.fresh": "fresh", "plan.next": "up next",
    "card.tops": "Tops", "card.flash": "Flash", "card.sends": "sends",
    "acc.emoji": "Profile emoji", "acc.pickEmoji": "Pick emoji", "acc.none": "none",
    "acc.reqCreator": "Become Route Creator (request)", "acc.reqPending": "Request sent ✓", "acc.reqInfo": "An admin will approve you.",
    "acc.users": "User management", "acc.wantsCreator": "wants Route Creator", "acc.archived": "Archived (inactive > 1 year)", "acc.reactivate": "Reactivate", "acc.reqReactivate": "Request reactivation", "acc.archivedSelf": "Your account is archived due to inactivity and doesn't appear in scorings.",
    "grp.create": "Create group", "grp.name": "Group name", "grp.symbol": "Symbol", "grp.roll": "🎲 reroll", "grp.pickMore": "More symbols", "grp.nameHint": "Team name with a plural noun — fully editable.",
    "prof.nameHint": "Auto-generated — fully editable.",
    "route.note": "Description (optional)", "route.notePh": "e.g. big holds · route by the window", "route.noteHint": "Only needed to tell apart routes of the same color & grade.",
    "lock.comments": "Comments unlock at 100 achievement points (you have {n}).", "lock.group": "Creating groups unlocks at 1000 achievement points (you have {n}).", "lock.creator": "You can request Route Creator at 10000 achievement points (you have {n}).",
    "cf.title": "Become Route Creator?", "cf.body": "Are you sure you have what it takes to be a Route Creator? You take on responsibility for setting and maintaining routes — an admin still has to approve the request.", "cf.yes": "Yes, request", "cf.cancel": "Cancel", "lock.label": "🔒 locked",
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
function buildEmojiPool(ranges) { const a = []; for (const [s, e] of ranges) for (let c = s; c <= e; c++) { try { a.push(String.fromCodePoint(c)); } catch (e) {} } return a; }
const ALL_EMOJI = buildEmojiPool([[0x1F300, 0x1F5FF], [0x1F680, 0x1F6FF], [0x1F900, 0x1F9FF], [0x1FA70, 0x1FAFF], [0x1F600, 0x1F64F], [0x2600, 0x26FF], [0x2700, 0x27BF], [0x2B00, 0x2BFF], [0x1F000, 0x1F0FF]]);
const EMOJI_GROUP = ALL_EMOJI.filter((_, i) => i % 2 === 0);
const EMOJI_PROFILE = ALL_EMOJI.filter((_, i) => i % 2 === 1);

/* ============================ Achievements ============================ */
function buildAchievements(lang) {
  const en = lang === "en";
  const A = []; let id = 0;
  const push = (cat, icon, name, desc, target, key, pts) => A.push({ id: "a" + (id++), cat, icon, name, desc, target, key, pts });
  const COLORS = ["blau", "grün", "rot", "gelb", "lila", "schwarz", "weiß", "pink", "orange", "holz"];
  const CEN = { blau: "blue", grün: "green", rot: "red", gelb: "yellow", lila: "purple", schwarz: "black", weiß: "white", pink: "pink", orange: "orange", holz: "wood" };
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const cName = c => en ? cap(CEN[c]) : cap(c);          // display color (capitalized)
  const cLow = c => en ? CEN[c] : c;                       // color in description
  const cAdj = c => en ? CEN[c] : c + "e";                 // color adjective before "routes"
  const tier = (arr, i, f) => arr[i] || `${f} ${i + 1}`;
  const pts = n => Math.min(120, Math.max(5, Math.round(Math.sqrt(n) * 4)));
  const L = { Gesamt: en ? "Total" : "Gesamt", Flash: "Flash", Punkte: en ? "Points" : "Punkte", Kombi: en ? "Combo" : "Kombi", Tagesform: en ? "Day form" : "Tagesform", Tagesfarbe: en ? "Day color" : "Tagesfarbe", Tagesgrad: en ? "Day grade" : "Tagesgrad", Spezial: en ? "Special" : "Spezial", Treue: en ? "Loyalty" : "Treue", Straßen: en ? "Straights" : "Straßen", Mehrling: en ? "Multiples" : "Mehrling", Ausdauer: en ? "Endurance" : "Ausdauer" };
  const catGrade = g => en ? `Grade ${g}` : `Grad ${g}er`;
  const catColor = c => en ? `Color ${cName(c)}` : `Farbe ${cName(c)}`;
  const catWall = wn => en ? `Wall ${wn}` : `Wand ${wn}`;

  const TOTAL = [1, 3, 5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100, 125, 150, 200, 250, 300, 400, 500, 600, 750, 1000, 1500, 2000];
  const TNAMES = ["Erster Zug", "Aufgewärmt", "Dabei", "Stammgast", "Eifrig", "Fleißig", "Vielkletterer", "Ehrgeizig", "Routenfresser", "Halbhundert", "Unermüdlich", "Wandfresser", "Hundert!", "Besessen", "Routen-Veteran", "Zweihundert", "Hartnäckig", "Dreihundert", "Routen-Maschine", "Fünfhundert", "Wandlegende", "Siebenfünfzig", "Tausendsassa", "Übermensch", "Boulder-Gott"];
  const TNAMES_EN = ["First Move", "Warmed Up", "On Board", "Regular", "Keen", "Diligent", "Prolific", "Ambitious", "Route Muncher", "Half Century", "Tireless", "Wall Eater", "Hundred!", "Obsessed", "Route Veteran", "Two Hundred", "Persistent", "Three Hundred", "Route Machine", "Five Hundred", "Wall Legend", "Seven-Fifty", "Jack of All", "Superhuman", "Boulder God"];
  TOTAL.forEach((n, i) => push(L.Gesamt, "🧗", tier(en ? TNAMES_EN : TNAMES, i, en ? "Collector" : "Sammler"), en ? `Climb ${n} routes in total` : `Schaffe ${n} Routen insgesamt`, n, "tops", pts(n)));
  const FL = [1, 3, 5, 10, 15, 25, 40, 60, 100, 150, 200, 300, 500, 750, 1000];
  const FNAMES = ["Blitzstart", "Schneller Finger", "Flash-Talent", "Schnellzünder", "Reflexe", "Flink", "Flash-Profi", "Im Flow", "Flash-Hunderter", "Lichtgeschwindigkeit", "Blitzmeister", "Dreihundert Blitze", "Flash-Maschine", "Überschall", "Flash-Legende"];
  const FNAMES_EN = ["Quickstart", "Fast Finger", "Flash Talent", "Fast Fuse", "Reflexes", "Nimble", "Flash Pro", "In Flow", "Flash Hundred", "Light Speed", "Flash Master", "Three Hundred Flashes", "Flash Machine", "Supersonic", "Flash Legend"];
  FL.forEach((n, i) => push(L.Flash, "⚡", tier(en ? FNAMES_EN : FNAMES, i, "Flash"), en ? `Flash ${n} routes in total` : `Flashe ${n} Routen insgesamt`, n, "flashes", pts(n) + 5));
  const PTS = [5, 10, 25, 50, 75, 100, 150, 200, 300, 400, 500, 750, 1000, 1500, 2000, 3000];
  PTS.forEach((n, i) => push(L.Punkte, "💯", en ? `Point Hunter ${i + 1}` : `Punktejäger ${i + 1}`, en ? `Reach ${n} points` : `Erreiche ${n} Punkte`, n, "points", pts(n)));
  const GT = [5, 10, 20, 35, 50, 75, 100, 150, 200, 300];
  for (let g = 1; g <= 8; g++) GT.forEach(n => push(catGrade(g), "🔢", en ? `Grade ${g} Hunter ${n}` : `${g}er-Jäger ${n}`, en ? `Climb ${n} routes at grade ${g}` : `Schaffe ${n} Routen im Grad ${g}`, n, `grade:${g}:t`, pts(n)));
  const GF = [3, 5, 10, 20, 35, 50];
  for (let g = 1; g <= 8; g++) GF.forEach(n => push(catGrade(g), "🔢", en ? `Grade ${g} Flash ${n}` : `${g}er-Blitz ${n}`, en ? `Flash ${n} routes at grade ${g}` : `Flashe ${n} Routen im Grad ${g}`, n, `grade:${g}:f`, pts(n) + 5));
  const CT = [5, 10, 20, 35, 50, 75, 100, 150, 200];
  COLORS.forEach(c => CT.forEach(n => push(catColor(c), "🎨", en ? `${cName(c)} Hunter ${n}` : `${cName(c)}-Jäger ${n}`, en ? `Climb ${n} ${cAdj(c)} routes` : `Schaffe ${n} ${cAdj(c)} Routen`, n, `color:${c}:t`, pts(n))));
  const CF = [3, 5, 10, 20, 35, 50, 75];
  COLORS.forEach(c => CF.forEach(n => push(catColor(c), "🎨", en ? `${cName(c)} Flash ${n}` : `${cName(c)}-Blitz ${n}`, en ? `Flash ${n} ${cAdj(c)} routes` : `Flashe ${n} ${cAdj(c)} Routen`, n, `color:${c}:f`, pts(n) + 5)));
  const WALLS = ["v", "h", "tb", "pl", "wkw"]; const WN = { v: "Block vorne", h: "Block hinten", tb: "Training & Bug", pl: "Platte", wkw: "Wettkampfwand" }; const WNEN = { v: "Front block", h: "Back block", tb: "Training & Bug", pl: "Slab", wkw: "Comp wall" };
  const wn = w => en ? WNEN[w] : WN[w];
  const WT = [10, 25, 50, 75, 100, 150, 200, 300];
  WALLS.forEach(w => WT.forEach(n => push(catWall(wn(w)), "🧱", `${wn(w)} ×${n}`, en ? `Climb ${n} routes on: ${wn(w)}` : `Schaffe ${n} Routen an: ${wn(w)}`, n, `wall:${w}:t`, pts(n))));
  const GCT = [3, 10, 25, 50];
  for (let g = 1; g <= 8; g++) COLORS.forEach(c => GCT.forEach(n => push(L.Kombi, "🎯", en ? `${cName(c)} G${g} ×${n}` : `${cName(c)} ${g}er ×${n}`, en ? `Climb ${n} ${cLow(c)} grade-${g} routes` : `Schaffe ${n} ${cAdj(c)} ${g}er`, n, `gc:${g}:${c}:t`, pts(n) + 3)));
  const GCF = [3, 10, 25];
  for (let g = 2; g <= 8; g++) COLORS.forEach(c => GCF.forEach(n => push(L.Kombi, "🎯", en ? `${cName(c)} G${g} Flash ×${n}` : `${cName(c)} ${g}er-Blitz ×${n}`, en ? `Flash ${n} ${cLow(c)} grade-${g} routes` : `Flashe ${n} ${cAdj(c)} ${g}er`, n, `gc:${g}:${c}:f`, pts(n) + 8)));
  [3, 5, 10, 15, 20, 25, 30, 40, 50].forEach(n => push(L.Tagesform, "📅", en ? `Day Form ${n}` : `Tagesform ${n}`, en ? `Climb ${n} routes in a single day` : `Schaffe ${n} Routen an einem Tag`, n, "maxDayTops", pts(n) + 5));
  [3, 5, 10, 15, 20].forEach(n => push(L.Tagesform, "📅", en ? `Flash Day ${n}` : `Blitztag ${n}`, en ? `Flash ${n} routes in a single day` : `Flashe ${n} Routen an einem Tag`, n, "maxDayFlashes", pts(n) + 8));
  COLORS.forEach(c => [3, 5, 10, 15, 20].forEach(n => push(L.Tagesfarbe, "🎨", en ? `${n}× ${cName(c)} in a day` : `${n}× ${cName(c)} an einem Tag`, en ? `Climb ${n} ${cAdj(c)} routes in a day` : `Schaffe ${n} ${cAdj(c)} Routen an einem Tag`, n, `maxColorDay:${c}`, pts(n) + 6)));
  for (let g = 1; g <= 8; g++) [3, 5, 10, 15].forEach(n => push(L.Tagesgrad, "📈", en ? `${n}× G${g} in a day` : `${n}× ${g}er an einem Tag`, en ? `Climb ${n} grade-${g} routes in a day` : `Schaffe ${n} ${g}er an einem Tag`, n, `maxGradeDay:${g}`, pts(n) + 6));
  [1, 2, 3, 5, 10].forEach((n, i) => push(L.Spezial, "🌈", tier(en ? ["Rainbow Day", "Double Rainbow", "Rainbow Collector", "Rainbow Pro", "Rainbow Legend"] : ["Regenbogen-Tag", "Doppel-Regenbogen", "Regenbogen-Sammler", "Regenbogen-Profi", "Regenbogen-Legende"], i, "Rainbow"), en ? `On ${n} day(s), climb a blue, green, red, yellow and purple route each` : `Schaffe an ${n} Tag(en) je eine blaue, grüne, rote, gelbe und lila Route`, n, "rainbowDays", 40 + i * 15));
  [1, 2, 3, 5].forEach((n, i) => push(L.Spezial, "🌈", en ? `Grade Collector Day ${n > 1 ? n : ""}`.trim() : `Grad-Sammler-Tag ${n > 1 ? n : ""}`.trim(), en ? `On ${n} day(s), climb all grades 1–8` : `Schaffe an ${n} Tag(en) alle Grade 1–8`, n, "allGradeDays", 60 + i * 20));
  const STR = en ? [["Small Straight", 4, 50], ["Medium Straight", 5, 70], ["Big Straight", 6, 95], ["Long Straight", 7, 120], ["Perfect Straight", 8, 150]] : [["Kleine Straße", 4, 50], ["Mittlere Straße", 5, 70], ["Große Straße", 6, 95], ["Lange Straße", 7, 120], ["Perfekte Straße", 8, 150]];
  STR.forEach(([nm, k, p]) => push(L.Straßen, "🛤️", nm, en ? `In one day, climb grades 1 to ${k}` : `Schaffe an einem Tag die Grade 1 bis ${k}`, k, "maxFrom1", p));
  const RUN = en ? [["Four Run", 4, 45], ["Five Run", 5, 65], ["Six Run", 6, 90]] : [["Vierer-Lauf", 4, 45], ["Fünfer-Lauf", 5, 65], ["Sechser-Lauf", 6, 90]];
  RUN.forEach(([nm, k, p]) => push(L.Straßen, "🛤️", nm, en ? `In one day, climb ${k} consecutive grades` : `Schaffe an einem Tag ${k} aufeinanderfolgende Grade`, k, "maxRun", p));
  const MUL = en ? [["Triple", 3, 35], ["Quad", 4, 50], ["Quintuple", 5, 70], ["Sextuple", 6, 95], ["Septuple", 7, 120], ["Octuple", 8, 150]] : [["Drilling", 3, 35], ["Vierling", 4, 50], ["Fünfling", 5, 70], ["Sechsling", 6, 95], ["Siebenling", 7, 120], ["Achtling", 8, 150]];
  MUL.forEach(([nm, k, p]) => push(L.Mehrling, "🎲", nm, en ? `In one day, climb ${k} routes of the same grade` : `Schaffe an einem Tag ${k} Routen im selben Grad`, k, "maxOfAKind", p));
  [1, 3, 5, 10, 15, 25, 50, 75, 100, 150, 200].forEach((n, i) => push(L.Treue, "🔥", tier(en ? ["First Day", "Returner", "Regular", "Loyal Soul", "Half Month", "Routine", "Die-hard", "Frequenter", "Hundred Days", "Addicted", "Life's Work"] : ["Erster Tag", "Wiederkehrer", "Stammkunde", "Treuer Geist", "Halbmonat", "Routine", "Eingefleischt", "Dauergast", "Hundert Tage", "Süchtig", "Lebensaufgabe"], i, en ? "Loyalty" : "Treue"), en ? `Climb on ${n} different days` : `Klettere an ${n} verschiedenen Tagen`, n, "distinctDays", pts(n * 3)));
  // Ausdauer / Konsistenz
  [3, 5, 8, 10, 15, 20, 30, 52].forEach(n => push(L.Ausdauer, "⏳", en ? `${n} weeks in a row` : `${n} Wochen in Folge`, en ? `Climb at least once a week for ${n} weeks straight` : `Klettere in ${n} aufeinanderfolgenden Wochen mindestens 1×`, n, "weekStreak1", pts(n * 4) + 10));
  [2, 3, 4, 6, 8, 12].forEach(n => push(L.Ausdauer, "⏳", en ? `2×/week · ${n} weeks` : `2×/Woche · ${n} Wochen`, en ? `Climb at least twice a week for ${n} weeks straight` : `Klettere in ${n} aufeinanderfolgenden Wochen mindestens 2×`, n, "weekStreak2", pts(n * 6) + 15));
  [10, 25, 50].forEach(n => push(L.Ausdauer, "📆", en ? `${n} days within 100` : `${n} Tage in 100`, en ? `Climb on ${n} days within any 100-day span` : `Klettere an ${n} Tagen innerhalb von 100 Tagen`, n, "daysIn100", pts(n * 4) + 10));
  [25, 50, 100, 150, 200].forEach(n => push(L.Ausdauer, "📆", en ? `${n} days in a year` : `${n} Tage im Jahr`, en ? `Climb on ${n} days within any 365-day span` : `Klettere an ${n} Tagen innerhalb eines Jahres`, n, "daysIn365", pts(n * 3) + 10));
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
    agg.tops++; if (isF) agg.flashes++; agg.points += pointsFor(g, st);
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
  if (key === "distinctDays") return agg.distinctDays;
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
function downscale(file, maxDim = 1280, quality = 0.72) {
  return new Promise((res, rej) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => { let w = img.naturalWidth, h = img.naturalHeight; const s = Math.min(1, maxDim / Math.max(w, h)); w = Math.round(w * s); h = Math.round(h * s); const c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d").drawImage(img, 0, 0, w, h); URL.revokeObjectURL(url); try { res(c.toDataURL("image/jpeg", quality)); } catch (e) { rej(e); } };
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

function RoutePhoto({ photoId, className, style }) {
  const inline = typeof photoId === "string" && photoId.startsWith("data:");
  const [src, setSrc] = useState(inline ? photoId : null);
  useEffect(() => { if (inline) return; let on = true; (async () => { const b = await loadPhotoBlob(photoId); if (on) setSrc(b); })(); return () => { on = false; }; }, [photoId]);
  if (!src) return null;
  return <img className={className} style={style} src={src} alt="" />;
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
.bld, .login { --bg:#14171c; --panel:#1d222a; --panel2:#262d37; --line:#323a46; --chalk:#edeee8; --muted:#909caa; --amber:#c8d42e; --topfill:#aeb9c4; --topbg:#33414e; --topbd:#46586a; }
.bld { position:fixed; inset:0; background:var(--bg); color:var(--chalk); font-family:'Inter',system-ui,sans-serif; -webkit-font-smoothing:antialiased; display:flex; flex-direction:column; overflow:hidden; }
.bld *, .login * { font-family:inherit; }
.bld button, .login button { cursor:pointer; border:none; background:none; color:inherit; font:inherit; }
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
.btn { width:100%; background:var(--amber); color:#13161a; font-weight:700; font-size:16px; padding:14px; border-radius:12px; margin-top:12px; }
.btn.ghost { background:var(--panel2); color:var(--chalk); border:1px solid var(--line); }
.err { color:#dd5468; font-size:13px; margin-top:10px; }
.linkbtn { color:var(--amber); font-weight:600; font-size:14px; padding:14px 4px; display:block; width:100%; text-align:center; margin-top:6px; }
.hint { font-size:12px; color:var(--muted); line-height:1.5; background:var(--panel); border:1px solid var(--line); border-radius:11px; padding:11px 12px; margin-top:18px; }
.roleseg { display:flex; gap:8px; margin-top:8px; }
.roleseg button { flex:1; padding:11px; border-radius:10px; background:var(--panel2); border:1px solid var(--line); color:var(--muted); font-weight:600; font-size:13.5px; }
.roleseg button.on { background:var(--chalk); color:var(--bg); border-color:var(--chalk); }

/* top bar */
.topbar { padding:14px 16px 12px; display:flex; align-items:center; justify-content:space-between; gap:10px; position:relative; background-size:cover; background-position:center 40%; min-height:64px; }
.topbar-overlay { position:absolute; inset:0; background:linear-gradient(90deg, rgba(14,17,20,.82) 0%, rgba(14,17,20,.55) 60%, rgba(14,17,20,.75) 100%); pointer-events:none; }
.brand { display:flex; align-items:center; position:relative; z-index:1; }
.brand-logo { height:36px; width:auto; object-fit:contain; filter:drop-shadow(0 1px 4px rgba(0,0,0,.5)); }
.brand h1 { font-family:'Barlow Condensed'; font-weight:300; font-size:27px; margin:0; line-height:1; letter-spacing:.05em; color:var(--chalk); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.uchip { display:flex; align-items:center; gap:8px; background:rgba(255,255,255,.1); border:1px solid rgba(255,255,255,.18); backdrop-filter:blur(8px); border-radius:22px; padding:4px 5px 4px 10px; flex:none; position:relative; z-index:1; }
.uchip .un { font-size:12.5px; font-weight:600; max-width:74px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.adminpill { font-size:8.5px; letter-spacing:.1em; text-transform:uppercase; color:var(--amber); border:1px solid #5a4715; background:#332a12; padding:1px 5px; border-radius:5px; font-weight:700; }
.seg { display:flex; background:var(--panel); border:1px solid var(--line); border-radius:9px; padding:3px; width:fit-content; }
.seg button { font-size:12px; font-weight:600; padding:6px 11px; border-radius:6px; color:var(--muted); white-space:nowrap; }
.seg button.on { background:var(--panel2); color:var(--chalk); }
.segwrap { padding:0 16px 4px; display:flex; align-items:center; gap:10px; }
.seg.full, .segwrap .seg { width:fit-content; }
.addtop { margin-left:auto; flex:none; height:36px; padding:0 14px 0 11px; border-radius:10px; background:var(--amber); color:#13161a; font-weight:700; font-size:13.5px; display:flex; align-items:center; gap:5px; }
.addtop .plus { font-size:19px; font-weight:300; line-height:1; }

/* leaderboard */
.lb { padding:4px 14px 96px; }
.lbrow { display:flex; align-items:center; gap:13px; padding:13px 12px; border-radius:13px; margin-bottom:8px; background:var(--panel); border:1px solid var(--line); }
.lbrow.lead { background:linear-gradient(100deg,#2a2f25,#1f242c); border-color:#3f4733; }
.lbrow.meRow { box-shadow:inset 0 0 0 1.5px var(--amber); }
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
.du { flex:1; display:flex; align-items:center; justify-content:center; gap:8px; padding:9px 13px; border-radius:10px; border:1.5px solid #3a4150; background:var(--panel2); color:var(--chalk); font-weight:700; font-size:13.5px; user-select:none; }
.du:not(.top):not(.flash) { background:linear-gradient(160deg,#2a2f1a,#222831); border-color:#5a4715; color:var(--amber); box-shadow:0 0 0 0 rgba(242,180,65,.5); animation:duglow 2.6s ease-in-out infinite; }
@keyframes duglow { 0%,100% { box-shadow:0 0 0 0 rgba(242,180,65,0);} 50% { box-shadow:0 0 11px 0 rgba(242,180,65,.28);} }
.du:active { transform:scale(.98); }
.du.top { background:linear-gradient(160deg,#1f3a26,#1c2a22); border:1.5px solid #3fae5e; color:#9fe6a0; animation:none; }
.du.flash { background:linear-gradient(160deg,#5a4715,#3c3a1c); border:1.5px solid var(--amber); color:var(--amber); animation:none; }
.du .dpts { font-family:'Barlow Condensed'; font-weight:700; opacity:.85; }
.pill { display:inline-flex; align-items:center; gap:5px; padding:8px 11px; border-radius:10px; background:var(--panel2); border:1px solid var(--line); color:var(--muted); font-weight:600; font-size:13px; flex:none; }
.pill.has { color:var(--chalk); }

/* route stats */
.rc { position:relative; }



/* unified color+grade chip */
.gcol { width:52px; height:52px; border-radius:12px; flex:none; display:flex; align-items:center; justify-content:center; box-shadow:inset 0 0 0 1.5px rgba(0,0,0,.2), 0 2px 6px rgba(0,0,0,.3); }
.gcol .ggrade { font-family:'Barlow Condensed'; font-weight:800; font-size:30px; line-height:1; text-align:center; text-shadow:0 1px 2px rgba(0,0,0,.15); }
.wldone { font-family:'Barlow Condensed'; font-weight:700; font-size:14px; color:#5cc97e; margin-left:auto; padding:0 6px; }
.wlcount { min-width:20px; text-align:right; }
.ovdone { font-size:12px; font-weight:700; color:#5cc97e; margin-left:6px; }
.ovb { position:relative; }
.ovb.done { box-shadow:0 0 0 2.6px #5cc97e !important; }
.ovchk { position:absolute; right:-3px; top:-3px; width:17px; height:17px; border-radius:50%; background:#3fae5e; color:#0d130f; font-size:11px; font-weight:800; font-style:normal; display:flex; align-items:center; justify-content:center; border:2px solid var(--panel); }
.rpills { display:flex; gap:5px; align-items:center; flex:none; margin-left:auto; }
.rschip { font-size:11px; font-weight:700; padding:2px 7px; border-radius:999px; white-space:nowrap; }
.rschip.top { background:#1f3a26; color:#5cc97e; }
.rschip.flash { background:#2a2e0a; color:var(--amber); }

/* stats */
.stats { padding:8px 14px 120px; }
.stcard { background:var(--panel); border:1px solid var(--line); border-radius:14px; padding:14px; margin-bottom:10px; }
.stcard.meCard { box-shadow:inset 0 0 0 1.5px var(--amber); }
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
.removex { color:var(--muted); font-size:16px; padding:2px 7px; }
.danger { color:#dd5468 !important; }
.miniaction { width:100%; text-align:center; background:var(--panel2); border:1px solid var(--line); border-radius:10px; padding:11px 12px; font-size:13.5px; font-weight:700; margin-top:8px; color:var(--chalk); display:inline-flex; align-items:center; justify-content:center; gap:7px; box-shadow:0 1px 0 rgba(0,0,0,.25); transition:background .12s, border-color .12s; }
.miniaction:hover { background:#2e3742; border-color:#46566a; }
.miniaction:active { background:#262d37; }
.miniaction.primary { background:var(--amber); border-color:var(--amber); color:#13161a; box-shadow:0 4px 14px rgba(200,212,46,.28); }
.miniaction.primary:hover { background:#f5c25c; border-color:#f5c25c; }
.miniaction.danger { color:#e98b7d; border-color:#5a2f2a; background:#2a1c1a; }
.miniaction.danger:hover { background:#3a221f; }
.miniaction.locked { opacity:.6; cursor:not-allowed; }
.miniaction .mi-ic { font-size:15px; line-height:1; }

/* tabbar / fab */
.tabbar { display:flex; background:var(--panel); border-top:1px solid var(--line); padding:8px 8px calc(8px + env(safe-area-inset-bottom)); gap:4px; }
.tab { flex:1; display:flex; flex-direction:column; align-items:center; gap:3px; padding:5px; border-radius:10px; color:var(--muted); }
.tab.on { color:var(--chalk); }
.tab .ic { font-size:18px; line-height:1; }
.tab .tl { font-size:10px; font-weight:600; }
.fab { position:fixed; right:18px; bottom:84px; height:52px; padding:0 22px 0 18px; border-radius:26px; background:var(--amber); color:#13161a; font-size:15px; font-weight:700; display:flex; align-items:center; gap:7px; box-shadow:0 10px 26px rgba(0,0,0,.5); z-index:60; }
.fab:active { transform:scale(.96); }
.fab .plus { font-size:24px; font-weight:300; }

/* sheet */
.scrim { position:absolute; inset:0; background:rgba(8,10,13,.66); z-index:50; display:flex; align-items:flex-end; }
.sheet { background:var(--panel); width:100%; max-height:94%; border-radius:20px 20px 0 0; border-top:1px solid var(--line); display:flex; flex-direction:column; animation:up .22s ease; }
@keyframes up { from { transform:translateY(100%);} to { transform:translateY(0);} }
.grip { width:38px; height:4px; background:var(--line); border-radius:3px; margin:10px auto 4px; }
.shead { display:flex; align-items:center; justify-content:space-between; padding:6px 18px 12px; }
.shead h2 { font-family:'Barlow Condensed'; font-weight:700; font-size:22px; margin:0; }
.x { color:var(--muted); font-size:24px; padding:2px 6px; }
.sbody { overflow-y:auto; padding:4px 18px 22px; }
.field { margin-bottom:16px; }
.field > label { display:block; font-size:11px; letter-spacing:.1em; text-transform:uppercase; color:var(--muted); margin-bottom:8px; font-weight:600; }
.field input[type=text], .field input[type=date], .field textarea { width:100%; background:var(--panel2); border:1px solid var(--line); color:var(--chalk); border-radius:10px; padding:11px 13px; font-size:15px; outline:none; }
.field input:focus, .field textarea:focus { border-color:var(--amber); }
.walltiles { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
.wtile { display:flex; flex-direction:column; align-items:center; gap:6px; padding:12px 6px; border-radius:12px; background:var(--panel2); border:1px solid var(--line); color:var(--muted); }
.wtile.on { background:#23262a; border-color:var(--amber); color:var(--chalk); }
.wtile .wl { font-size:11px; font-weight:600; text-align:center; line-height:1.2; }
.fpttl { font-size:13px; color:var(--muted); text-align:center; line-height:1.5; margin:2px 6px 12px; }
.fpwrap { background:var(--panel2); border:1px solid var(--line); border-radius:16px; padding:14px; }
.fp { width:100%; max-width:420px; display:block; margin:0 auto; }
.fp text { user-select:none; }
.wallbar { display:flex; align-items:center; gap:11px; background:var(--panel2); border:1px solid var(--line); border-radius:12px; padding:11px 12px; margin-bottom:16px; }
.wallbar-ic { width:34px; height:34px; border-radius:9px; background:var(--bg); border:1px solid var(--line); color:var(--chalk); display:flex; align-items:center; justify-content:center; flex:none; }
.wb-name { flex:1; font-weight:600; font-size:15.5px; }
.wb-change { color:var(--amber); font-weight:600; font-size:13px; padding:6px 10px; border:1px solid #5a4715; border-radius:8px; background:#202508; }
.gradepick { display:grid; grid-template-columns:repeat(4,1fr); gap:7px; }
.gradepick button { padding:11px 0; border-radius:10px; background:var(--panel2); border:1px solid var(--line); color:var(--muted); font-weight:700; font-family:'Barlow Condensed'; font-size:18px; }
.gradepick button.on { color:#13161a; }
.statusseg { display:grid; grid-template-columns:repeat(2,1fr); gap:8px; }
.statusseg button { padding:11px 0; border-radius:10px; background:var(--panel2); border:1px solid var(--line); color:var(--muted); font-weight:700; }
.statusseg button.on { color:#13161a; }
.ghint { font-size:12px; color:var(--muted); margin-top:8px; }
.ghint b { color:var(--chalk); }
.bigtri { display:flex; gap:8px; }
.bigtri button { flex:1; padding:14px 4px; border-radius:11px; border:1.5px solid var(--line); font-weight:700; font-size:14px; color:var(--muted); background:var(--bg); display:flex; flex-direction:column; gap:3px; align-items:center; }
.bigtri button .sp { font-family:'Barlow Condensed'; font-size:12px; opacity:.8; }
.bigtri button.a { background:var(--topbg); border-color:var(--topbd); color:var(--chalk); }
.bigtri button.f { background:linear-gradient(160deg,#5a4715,#3c3a1c); border-color:var(--amber); color:var(--amber); }
.photos { display:flex; gap:8px; flex-wrap:wrap; }
.thumb { position:relative; width:84px; height:84px; border-radius:11px; overflow:hidden; border:1px solid var(--line); }
.thumb img { width:100%; height:100%; object-fit:cover; display:block; }
.thx { position:absolute; top:4px; right:4px; width:21px; height:21px; border-radius:50%; background:rgba(8,10,13,.74); color:#fff; font-size:11px; display:flex; align-items:center; justify-content:center; }
.addphoto { width:84px; height:84px; border-radius:11px; border:1px dashed var(--line); color:var(--muted); background:var(--panel2); font-size:12.5px; font-weight:600; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; }
.phint { font-size:11px; color:var(--muted); margin-top:8px; line-height:1.4; }
.save { width:100%; background:var(--amber); color:#13161a; font-weight:700; font-size:16px; padding:14px; border-radius:12px; margin-top:6px; }
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
.mapbrowse { padding:8px 14px 120px; }
.walllegend { margin-top:12px; display:flex; flex-direction:column; gap:7px; }
.wlrow { display:flex; align-items:center; gap:11px; background:var(--panel); border:1px solid var(--line); border-radius:11px; padding:10px 12px; text-align:left; width:100%; }
.wlrow:active { transform:scale(.99); }
.wlic { width:30px; height:30px; border-radius:8px; background:var(--panel2); border:1px solid var(--line); color:var(--chalk); display:flex; align-items:center; justify-content:center; flex:none; }
.wlname { flex:1; font-weight:600; font-size:14px; }
.wlcount { font-family:'Barlow Condensed'; font-weight:700; font-size:16px; color:var(--amber); min-width:20px; text-align:right; }

/* groups */
.gemoji { width:38px; height:38px; border-radius:10px; background:var(--panel2); border:1px solid var(--line); display:flex; align-items:center; justify-content:center; font-size:20px; flex:none; }
.lbrow .gemoji { width:34px; height:34px; font-size:18px; }
.primaryaction { width:100%; background:var(--amber); color:#13161a; font-weight:700; font-size:15px; border-radius:11px; padding:13px; margin-bottom:16px; }
.gcard { display:flex; align-items:center; gap:12px; background:var(--panel); border:1px solid var(--line); border-radius:13px; padding:11px 12px; margin-bottom:9px; }
.gcard .ginfo { flex:1; min-width:0; }
.gcard .gn { font-weight:600; font-size:15px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.gcard .gm { font-size:11.5px; color:var(--muted); margin-top:2px; }
.gcard .gp { text-align:right; flex:none; }
.gcard .gp .v { font-family:'Barlow Condensed'; font-weight:700; font-size:22px; line-height:.9; }
.gcard .gp .u { font-size:9px; color:var(--muted); text-transform:uppercase; letter-spacing:.1em; }
.joinbtn { background:var(--amber); color:#13161a; font-weight:700; font-size:13px; border-radius:9px; padding:9px 14px; flex:none; }
.leavebtn { background:var(--panel2); border:1px solid var(--line); color:var(--muted); font-weight:600; font-size:14px; border-radius:11px; }
.emojipick { display:flex; gap:8px; flex-wrap:wrap; }
.emojipick button { width:46px; height:46px; border-radius:11px; background:var(--panel2); border:1px solid var(--line); font-size:22px; display:flex; align-items:center; justify-content:center; }
.emojipick button.on { border-color:var(--amber); background:#202508; }
.emojipick.big { display:grid; grid-template-columns:repeat(auto-fill, minmax(42px, 1fr)); gap:6px; max-height:240px; overflow-y:auto; padding:8px; background:var(--panel); border:1px solid var(--line); border-radius:12px; }
.emojipick.big button { width:100%; height:40px; border-radius:9px; font-size:20px; background:transparent; border:1px solid transparent; }
.emojipick.big button.on { border-color:var(--amber); background:#202508; }
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
.gpill { display:inline-flex; align-items:center; justify-content:center; min-width:26px; height:28px; padding:0 9px; border-radius:14px; font-family:'Barlow Condensed'; font-weight:700; font-size:15px; color:#13161a; border:1.5px solid transparent; }
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
.colpicker { display:flex; flex-wrap:wrap; gap:10px; padding:4px 0; }
.colbtn { width:46px; height:46px; border-radius:12px; flex:none; display:flex; align-items:center; justify-content:center; font-size:18px; font-weight:800; border:2px solid rgba(255,255,255,.1); transition:transform .1s; }
.colbtn:active { transform:scale(.9); }
.colbtn.on { border-color:transparent; }
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

.reroll { font-size:11px; font-weight:600; color:var(--amber); background:#202508; border:1px solid #5a4715; border-radius:7px; padding:4px 8px; text-transform:none; letter-spacing:0; }

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
.hkpi-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:10px; padding:0 16px 4px; }
.hkpi { background:var(--panel); border:1px solid var(--line); border-radius:14px; padding:14px 16px; }
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
.hrswatch { width:28px; height:28px; border-radius:7px; flex:none; box-shadow:inset 0 0 0 1.5px rgba(0,0,0,.28); }
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
.confirm { width:min(360px,92vw); background:var(--panel); border:1px solid var(--line); border-radius:18px; padding:22px 20px 18px; margin:auto; box-shadow:0 24px 60px rgba(0,0,0,.6); text-align:center; }
.confirm .cf-ic { font-size:34px; line-height:1; margin-bottom:6px; }
.confirm h3 { margin:0 0 8px; font-size:18px; font-weight:700; color:var(--chalk); }
.confirm p { margin:0 0 16px; font-size:13.5px; line-height:1.5; color:var(--muted); }
.confirm .cf-btns { display:flex; gap:10px; }
.confirm .cf-cancel { flex:1; padding:12px; border-radius:11px; background:var(--panel2); border:1px solid var(--line); color:var(--chalk); font-weight:700; font-size:14px; }
.confirm .cf-yes { flex:1; padding:12px; border-radius:11px; background:var(--amber); color:#13161a; font-weight:700; font-size:14px; }
.langseg { display:flex; background:var(--panel2); border:1px solid var(--line); border-radius:10px; padding:3px; }
.langseg button { padding:8px 14px; border-radius:7px; font-size:13px; font-weight:600; color:var(--muted); }
.langseg button.on { background:var(--chalk); color:var(--bg); }
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
.rc.flash { box-shadow:0 0 0 2px var(--amber); }

/* role dropdown */
.roledd { background:var(--bg); border:1px solid var(--line); color:var(--chalk); border-radius:8px; padding:7px 8px; font-size:12.5px; font-weight:600; outline:none; }
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
  const [routesView, setRoutesView] = useState("karte");
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [openGroupId, setOpenGroupId] = useState(null);
  const [flashId, setFlashId] = useState(null);
  const [changePinOpen, setChangePinOpen] = useState(false);
  const [confirmCreator, setConfirmCreator] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [statsView, setStatsView] = useState("erfolge");
  const [achCat, setAchCat] = useState(null);
  const [hallTab, setHallTab] = useState("halle"); // halle | creator
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

  const sessions = useMemo(() => {
    let rs = routes.filter(r => {
      if (filterScope === "aktuell" && r.archived) return false;
      if (filterScope === "archiv" && !r.archived) return false;
      if (fWall !== "alle" && wallCanon(r.gym) !== fWall) return false;
      if (fGrade && r.grade !== fGrade) return false;
      if (q && !((r.name || "").toLowerCase().includes(q.toLowerCase()) || routeTitle(r).toLowerCase().includes(q.toLowerCase()) || wallName(r.gym).toLowerCase().includes(q.toLowerCase()))) return false;
      return true;
    });
    const map = new Map();
    rs.forEach(r => { const k = (r.date || "0") + "|" + wallCanon(r.gym); if (!map.has(k)) map.set(k, { date: r.date, wall: wallCanon(r.gym), items: [] }); map.get(k).items.push(r); });
    const arr = Array.from(map.values());
    arr.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    arr.forEach(s => s.items.sort((a, b) => a.grade - b.grade));
    return arr;
  }, [routes, filterScope, fWall, fGrade, q]);

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
  const NEED_COMMENT = 100, NEED_GROUP = 1000, NEED_CREATOR = 10000;
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
    return { activeRoutes, todaySends, weekSends, monthSends, totalSends, totalFlashes, popularRoutes, activeClimbers, wallStats, sessionList, creators, totalComments, mostCommented };
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
          <img src={LOGO_IMG} alt="blocscore" className="brand-logo" />
        </div>
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
        <div className="segwrap">
          <div className="seg">
            <button className={routesView === "karte" ? "on" : ""} onClick={() => setRoutesView("karte")}>{t("routes.map")}</button>
            <button className={routesView === "liste" ? "on" : ""} onClick={() => setRoutesView("liste")}>{t("routes.list")}</button>
          </div>
          {canSetRoutes && <button className="addtop" onClick={() => setEditing("new")}><span className="plus">+</span>{t("routes.add")}</button>}
        </div>

        {routesView === "karte" && (
          <div className="scroll"><div className="mapbrowse">
            <div className="fpttl">{t("routes.tapHint")}</div>
            <div className="fpwrap"><FloorPlan value={fWall === "alle" ? null : fWall} counts={wallCounts} newest={newestWall} onChange={(c) => { setFWall(c); setFGrade(0); setRoutesView("liste"); }} /></div>

            <div className="walllegend">
              {WALLS.map(w => { const gs = gradesByWall[w.code] || []; const fresh = newestWall === w.code; const nxt = nextWall === w.code; return (
                <div key={w.code} className="wlrow2">
                  <button className="wlhead" onClick={() => { setFWall(w.code); setFGrade(0); setRoutesView("liste"); }}>
                    <span className="wlic"><WallIcon code={w.code} size={18} /></span>
                    <span className="wlname">{w.name}{fresh && <span className="freshbadge">NEU</span>}{nxt && <span className="nextbadge">bald</span>}</span>
                    {myWallDone[w.code] > 0 && <span className="wldone">✓ {myWallDone[w.code]}</span>}
                    <span className="wlcount">{wallCounts[w.code] || 0}</span>
                  </button>
                  {gs.length > 0 && <div className="wlpills">{gs.map(g => {
                    // Find routes of this grade on this wall to get hold colors
                    const wallRoutes = routes.filter(r => !r.archived && wallCanon(r.gym) === w.code && r.grade === g);
                    return wallRoutes.map(r => {
                      const col = colorOf(r.name) || "#3a4150";
                      const fg = colorFgOf(r.name);
                      const myStatus = r.results?.[me.name];
                      return (
                        <button key={r.id} className={"gpill2" + (myStatus ? " done" : "")}
                          style={{ background: col, color: fg, boxShadow: myStatus === "flash" ? `0 0 0 2.5px var(--amber)` : myStatus === "top" ? `0 0 0 2.5px #29b85a` : "none" }}
                          title={routeTitle(r)}
                          onClick={() => cycleMine(r.id)}>
                          {g}{myStatus === "flash" ? "⚡" : myStatus === "top" ? "✓" : ""}
                        </button>
                      );
                    });
                  })}</div>}
                </div>
              ); })}
            </div>

            <div className="plancard">
              <div className="planttl">🛠 {t("plan.title")}</div>
              {Object.entries(screwDates).sort((a, b) => a[1].localeCompare(b[1])).map(([w, d]) => { const fresh = newestWall === w; const nxt = nextWall === w; return (
                <div key={w} className={"planrow" + (fresh ? " fresh" : "") + (nxt ? " next" : "")}>
                  <span className="plw"><WallIcon code={w} size={14} /> <span className="plwn">{wallName(w)}</span></span>
                  {canSetRoutes
                    ? <input type="date" className="pldInput" value={d} onChange={e => { if (e.target.value) setScrewDate(w, e.target.value); }} />
                    : <span className="pld">{fmtDate(d)}</span>}
                  {fresh && <span className="freshbadge">{t("plan.fresh")}</span>}
                  {nxt && <span className="nextbadge">{t("plan.next")}</span>}
                </div>
              ); })}
              {canSetRoutes && <div className="phint" style={{ marginTop: 8 }}>Datum ändern → neue Routen dieser Wand erben automatisch das Schraubdatum.</div>}
            </div>
          </div></div>
        )}

        {routesView === "liste" && (<>
        <div className="filters">
          <button className="chip" onClick={() => setRoutesView("karte")}>🗺 {t("routes.map")}</button>
          {["aktuell", "archiv", "alle"].map(s => <button key={s} className={"chip" + (filterScope === s ? " on" : "")} onClick={() => setFilterScope(s)}>{s === "aktuell" ? t("routes.scope.aktuell") : s === "archiv" ? t("routes.scope.archiv") : t("routes.scope.alle")}</button>)}
          <button className={"chip" + (fGrade === 0 ? " on" : "")} onClick={() => setFGrade(0)}>{t("routes.allGrades")}</button>
          {wallsPresent.map(w => <button key={w.code} className={"chip" + (fWall === w.code ? " on" : "")} onClick={() => setFWall(fWall === w.code ? "alle" : w.code)}><WallIcon code={w.code} size={15} />{w.short}</button>)}
        </div>
        <div className="search"><input value={q} onChange={e => setQ(e.target.value)} placeholder={t("routes.search")} /></div>
        <div className="listhead">
          {fWall !== "alle" && (
            <div className="lhwall">
              <span className="wlic"><WallIcon code={fWall} size={18} /></span>
              <div className="lhmeta">
                <div className="lhname">{wallName(fWall)}{newestWall === fWall && <span className="freshbadge">NEU</span>}</div>
                {screwDates[fWall] && <div className="lhsub">{t("routes.rescrewed")} {fmtDate(screwDates[fWall])}</div>}
              </div>
              <button className="lhclear" onClick={() => setFWall("alle")}>{t("routes.allWalls")}</button>
            </div>
          )}
          <div className="gpillrow">
            <button className={"gpill gp0" + (fGrade === 0 ? " on" : "")} onClick={() => setFGrade(0)}>Alle</button>
            {(fWall !== "alle" ? (gradesByWall[fWall] || []) : gradesPresent).map(g => (
              <button key={g} className="gpill" style={fGrade === g ? { background: GRADE_COLOR[g], borderColor: GRADE_COLOR[g], color: "#13161a" } : { background: "transparent", borderColor: GRADE_COLOR[g], color: GRADE_COLOR[g] }} onClick={() => setFGrade(fGrade === g ? 0 : g)}>{g}er</button>
            ))}
          </div>
        </div>
        <div className="scroll"><div className="routes">
          {fWall !== "alle" && sessions.length > 0 && (() => { const flat = sessions.flatMap(s => s.items); const doneN = flat.filter(r => r.results?.[me.name]).length; return (
            <div className="ovcard">
              <div className="ovttl"><span className="wlic" style={{ width: 28, height: 28 }}><WallIcon code={fWall} size={16} /></span>{wallName(fWall)} · {flat.length} Routen <span className="ovdone">✓ {doneN} {t("routes.done")}</span></div>
              <div className="ovbubbles">
                {flat.map(r => { const col = colorOf(r.name) || "#3a4150"; const fg = colorFgOf(r.name); const myStatus = r.results?.[me.name]; return (
                  <button key={r.id} className={"ovb" + (flashId === r.id ? " fl" : "") + (myStatus ? " done" : "")}
                    onClick={() => cycleMine(r.id)}
                    style={{ background: col, color: fg, boxShadow: myStatus === "flash" ? `0 0 0 3px var(--amber), 0 0 0 4.5px ${col}` : myStatus === "top" ? `0 0 0 3px #29b85a, 0 0 0 4.5px ${col}` : `0 0 0 2px rgba(255,255,255,.12)` }}
                    title={routeTitle(r)}>
                    <span className="ovgrade">{r.grade}</span>
                    {myStatus === "flash" && <i className="ovchk">⚡</i>}
                    {myStatus === "top" && <i className="ovchk">✓</i>}
                  </button>
                ); })}
              </div>
              <div className="ovlegend">Tippe eine Bubble zum Eintragen · Farbe = Griff · Ring = Status</div>
            </div>
          ); })()}
          {sessions.length === 0 && <div className="empty"><div className="big">🪨</div>{t("routes.empty")}</div>}
          {sessions.map(s => (
            <div key={s.date + s.wall}>
              <div className="sesh"><span className="ic"><WallIcon code={s.wall} size={18} /></span><span className="gymfull">{wallName(s.wall)}</span><span style={{ color: "var(--muted)" }}>· {fmtDate(s.date)}</span><span className="ln" /><span>{s.items.length}</span></div>
              <div className="route-grid">
              {s.items.map(r => {
                const myStatus = r.results?.[me.name] || null;
                const senders = players.filter(p => visName.has(p) && r.results?.[p]);
                const sendsN = senders.length;
                const flashN = senders.filter(p => r.results[p] === "flash").length;
                const topN = sendsN - flashN;
                const hasPhoto = r.photos?.length > 0;
                const tipsN = (r.tips || []).length;
                const col = colorOf(r.name);
                return (
                  <div key={r.id} id={"r-" + r.id} className={"rc" + (col ? " rccol" : "") + (r.archived ? " arch" : "") + (flashId === r.id ? " flash" : "")} style={col ? { "--rcol": col } : undefined}>
                    {hasPhoto && <RoutePhoto photoId={r.photos[0]} className="rbanner" />}
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
                              : <>+ {t("routes.add")}</>}
                        </button>
                        <button className={"pill" + (tipsN ? " has" : "") + (canComment ? "" : " locked")} title={canComment ? "" : t("lock.comments", { n: achScore })} onClick={() => { if (canComment) setTipsRouteId(r.id); }}>{canComment ? <>💬 {tipsN || ""}</> : <>🔒</>}</button>
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          ))}
        </div></div>
        </>)}
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

      )}

      {/* STATISTIK */}
      {tab === "hall" && (
        <div className="scroll"><div className="stats">

          {/* Umschalter: Halle / Route Creator (nur Admin) */}
          {isAdmin && (
            <div className="segwrap" style={{ marginBottom: 4 }}>
              <div className="seg">
                <button className={hallTab === "halle" ? "on" : ""} onClick={() => setHallTab("halle")}>{t("hall.activity")}</button>
                <button className={hallTab === "creator" ? "on" : ""} onClick={() => setHallTab("creator")}>{t("hall.creator")}</button>
              </div>
            </div>
          )}

          {/* ── Hallenaktivität (alle sehen das) ── */}
          {hallTab === "halle" && (<>

            {/* Kennzahlen */}
            <div className="hkpi-grid">
              <div className="hkpi"><div className="hkv">{hallStats.activeRoutes.length}</div><div className="hku">{t("hall.routes")}</div></div>
              <div className="hkpi"><div className="hkv">{hallStats.totalSends}</div><div className="hku">{t("hall.sends")}</div></div>
              <div className="hkpi"><div className="hkv">{hallStats.totalFlashes}</div><div className="hku">{t("hall.flashes")}</div></div>
              <div className="hkpi"><div className="hkv">{accounts.filter(a => !a.staff).length}</div><div className="hku">{t("acc.members")}</div></div>
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
                <div key={r.id} className="hpop-row" onClick={() => { setTab("routes"); setRoutesView("liste"); setTimeout(() => jumpToRoute(r.id), 80); }} style={{ cursor: "pointer" }}>
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
            <div className="hkpi-grid" style={{ marginBottom: 12 }}>
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
          </div>
          <div className="stcard">
            <h3><span>{t("acc.points")}</span></h3>
            <div className="ptbl">
              <span className="ph">Grad</span><span className="ph">Top</span><span className="ph">Flash</span>
              {GRADES.map(g => (<React.Fragment key={g}><span className="pg" style={{ color: GRADE_COLOR[g] }}>{g}er</span><span className="pv">{fmtPts(topPts(g))}</span><span className="pv">{fmtPts(topPts(g) + FLASH_BONUS)}</span></React.Fragment>))}
            </div>
          </div>
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
      {newGroupOpen && <NewGroupSheet onClose={() => setNewGroupOpen(false)} onCreate={(n, e) => { createGroup(n, e); setNewGroupOpen(false); }} />}
      {changePinOpen && <ChangePinSheet me={me} onClose={() => setChangePinOpen(false)} onSave={(p) => { setMyPin(p); setChangePinOpen(false); }} />}
      {emojiOpen && <ProfileEmojiSheet me={me} onClose={() => setEmojiOpen(false)} onPick={(e) => { setMyEmoji(e); setEmojiOpen(false); }} />}
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
const FP_SEGS = [
  { code: "wkw", d: "M4,10 L36,10 L27,26 L36,40 L26,54 L36,68 L22,82 L4,82 Z",  tx: 16,  ty: 46, rot: -90, label: "WETTKAMPF­WAND" },
  { code: "h",   d: "M43,13 L60,13 L62,27 L57,43 L46,46 L40,42 L39,27 Z",         tx: 50,  ty: 30, label: "BLOCK\nHINTEN" },
  { code: "v",   d: "M46,50 L58,50 L64,66 L59,86 L44,87 L38,70 L41,57 Z",         tx: 51,  ty: 69, label: "BLOCK\nVORNE" },
  { code: "pl",  d: "M67,20 L79,19 L81,87 L68,88 Z",                               tx: 74,  ty: 54, rot: -90, label: "PLATTE & BUG" },
  { code: "tb",  d: "M84,11 L104,11 L104,32 L112,32 L112,56 L92,56 L84,37 Z",     tx: 96,  ty: 34, rot: -90, label: "TRAINING" },
];
function FpLabel({ s, on }) {
  const fill = on ? "#14171c" : "#f1f1ec";
  if (s.label.includes("\n")) {
    const [a, b] = s.label.split("\n");
    return <text x={s.tx} y={s.ty} textAnchor="middle" fontFamily="'Barlow Condensed'" fontWeight="700" fontSize="3.6" fill={fill}><tspan x={s.tx} dy="0">{a}</tspan><tspan x={s.tx} dy="4.2">{b}</tspan></text>;
  }
  const t2 = s.rot ? `rotate(${s.rot} ${s.tx} ${s.ty})` : undefined;
  const fs = s.label.length > 12 ? 2.7 : 3.4;
  return <text x={s.tx} y={s.ty} transform={t2} textAnchor="middle" dominantBaseline="middle" fontFamily="'Barlow Condensed'" fontWeight="700" fontSize={fs} fill={fill} letterSpacing="0.3">{s.label}</text>;
}
function FloorPlan({ value, onChange, counts, newest }) {
  return (
    <svg className="fp" viewBox="0 0 118 100">
      <rect x="1" y="1" width="116" height="98" rx="4" fill="#d8d8d2" stroke="#b4b4ac" strokeWidth="0.8" />
      <text x="60" y="7.5" textAnchor="middle" fontSize="3.2" fontWeight="700" fill="#3f444b" letterSpacing="0.6">GARTEN</text>
      <text x="46" y="96" textAnchor="middle" fontSize="3.2" fontWeight="700" fill="#3f444b" letterSpacing="0.6">EINGANG</text>
      <rect x="84" y="62" width="20" height="20" rx="2" fill="#bdbdb6" stroke="#9c9c93" strokeWidth="0.6" />
      <text x="94" y="71" textAnchor="middle" fontSize="2.4" fontWeight="600" fill="#42474e"><tspan x="94" dy="0">KINDER-</tspan><tspan x="94" dy="3.2">BEREICH</tspan></text>
      {FP_SEGS.map(s => { const on = value === s.code; const fresh = newest === s.code; return (
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
function ProfileEmojiSheet({ me, onClose, onPick }) {
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="grip" />
        <div className="shead"><h2>{t("acc.pickEmoji")}</h2><button className="x" onClick={onClose}>✕</button></div>
        <div className="sbody">
          <div className="emojipick big">{EMOJI_PROFILE.map((e, i) => <button key={i} className={me.emoji === e ? "on" : ""} onClick={() => onPick(e)}>{e}</button>)}</div>
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
function NewGroupSheet({ onClose, onCreate }) {
  const [name, setName] = useState(() => genGroupName(LANG));
  const [emoji, setEmoji] = useState(EMOJI_GROUP[0]);
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
            <div className="emojipick big">{EMOJI_GROUP.map((e, i) => <button key={i} className={emoji === e ? "on" : ""} onClick={() => setEmoji(e)}>{e}</button>)}</div>
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

          {!isNew && (
            <div className="field"><label>Status</label>
              <div className="statusseg">
                <button className={!archived ? "on" : ""} style={!archived ? { background: "var(--chalk)", color: "var(--bg)", borderColor: "var(--chalk)", fontSize: 14 } : { fontSize: 14 }} onClick={() => setArchived(false)}>Aktuell</button>
                <button className={archived ? "on" : ""} style={archived ? { background: "var(--chalk)", color: "var(--bg)", borderColor: "var(--chalk)", fontSize: 14 } : { fontSize: 14 }} onClick={() => setArchived(true)}>Archiv</button>
              </div>
            </div>
          )}

          <button className={"save" + (valid ? "" : " disabled")} onClick={commit}>{isNew ? "Route anlegen" : "Speichern"}</button>
          {!isNew && isAdmin && <button className="del" onClick={() => { if (confirm("Diese Route wirklich löschen?")) onDelete(route.id); }}>Route löschen (Admin)</button>}
          {!isNew && !isAdmin && <div className="phint" style={{ textAlign: "center", marginTop: 12 }}>Löschen kann nur ein Administrator.</div>}
          </>)}
        </div>
      </div>
    </div>
  );
}
