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
const HEADER_BG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAsICAoIBwsKCQoNDAsNERwSEQ8PESIZGhQcKSQrKigkJyctMkA3LTA9MCcnOEw5PUNFSElIKzZPVU5GVEBHSEX/2wBDAQwNDREPESESEiFFLicuRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUX/wAARCADIAlgDASIAAhEBAxEB/8QAGwABAAMBAQEBAAAAAAAAAAAAAAECAwQFBgf/xAAxEAACAgEDAwMDAwMFAQEAAAAAAQIRIQMSMQRBURNhcQUigTKRoRSxwQYjQlLw8UP/xAAZAQEBAQEBAQAAAAAAAAAAAAAAAQIEAwX/xAAhEQEBAQEAAwACAgMAAAAAAAAAAQIRAxIhMUEEE1Fx8f/aAAwDAQACEQMRAD8A/IgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABel4LKCfYDIG3prwT6S8AYA6PSX/Uj014QGAN/TXgemvAGANvTXgbF4AxBtsXgbF4AxBrsXgnYvAGINdi8E7F4AxBtsXgjYvAGQNdi8DYvAGQNdl9iNnsBmDX0/Yen7AZA12LwNi8AZA12LwRsXgDMGmxDYgMwabRsQGYNNi8DYvAGYNNi8E7F4AyBrsXgbF4AyBpsXgbV4AzBptXgbfYDMGm1eBt9gMwabV4G1eAMwabV4G1eAMwabV4G32AzBpt9ht9gMwabV4G32AzBfb7Db7AUBevYivYCoLUKAqC9CgKAvQr2AoC9EUBUFqFAVBahXsBUF69hQFAWoUBUFqAGkYmkYp4ZEVxg0Srs2VFlBPIUVHhF40max0tytpr5AwcVa9hS8HT6OYqm7fPgstJXwFc8NFbeO5D0E2vk69OK2fcmrb5GpFRaw3brHYI5JaVclHBJt0dLSk14s7/qel0Ogt2lpShpyS2Scm3PDt1wsmNbmbJf2snXi7EPTpF4P1FaL7G4p1Tq6PRGPp8YIcKOmMbpbXnv4J9NPNBHNGCp47hwVUdUNK08d8e5E9Oot037LuRXLttjZ7G8opOvB1dLpaTf+7Ddad08pV2RrObq8jOtTM7XmqGSdiwuKN3qaKi/T0tRpfqnJ/wCCI1qLdGLSbxYs4svVI6au67E+mng1jWbXCuyIu5NMgy9OlhDZw64Ojbxhp1dDbbS83bvgDm9PJHp5eOTqpEbMvFJd/IHI4kbVR1PTXgpswsV3p9gOfaKN/TvjIel4IrnpDab+ks+w2KgMtt9i2xYo12KOHV1nNmmnpRlqQi3tTaTfgpPt45vTQ2Jdjr6vT0un1XGO5Lc0lNq/2Rklb4/Ia3m4vKw2KydqNat4X5LRgnYZc+1fBDimjpenh4rL7lHFbeLYGNdxsyb+mk2ua8FlBXxWLA5vTI2UdTjbwjecdGeg3HRUZKPO7j3oDzttolxNG4uDnBPanWaQVPimQZ7fYjZZuoYsivCt+AMnEjb7HQ4V7lduXgDHaTswka7bCj9qvDfYDLZwNhrt4r+5D+AMpRxwVas3klTXJRxq+4Ge3JG02cUnWH8ENKuAMtpO0024slRv/wCgZbcDaa0q9iNtAZ0idpfb3FYwBm40RRrKNOsfgjbhPyBntoUabG2FHIGe0bTTbjI22BntFF8WKwvcDOiKNKzRDQFKBLQA1RpFFI1j2NFVd8+ALwX3Kzu0lb4OPTVzzhH2H0b6B066fT1uplLVlqVNaV4SfFnn5fJnxztbxm6vI8jpvp/UdXFvR03KKfLwr+Tpn9A6yMG3HSXt6is9NfUNaGp1ceq0XpaGjG9BKG2EVurnu2j5vqfq8563qadQjC0t2W77s4v7vLvXMz49vTMn1hrqUZOCxKLpkU5JM5tLqZa0tSTbdvk6tGKlBW20pbueT6Ge8+ua/lHpPazLqYS1OnWnvlti3JRvGf8A4dqdlfSinKWbaXLwvg1Z0cHT6LjCqo39NpKv5LvFpLBMUlFRV0lWXd/IRX04pctGbf3UjaUU5Ju/td1ePyYyX3VZUWhPbeGGpSjajhG3TdJLWc1G/wDtJt8I5VqKe5Rk0nh1hkVNJSSNIycXatMfa5Nolx+7d3qucIqOWcNSeptnK4J3XFl5cUjaqeeSHDbGKqqVZdti238kkn4YtYEFUskyaTt5dVzwRZFXbpFW2ReElwl5Iv7rauroCyHci69iFKrtW21mwL5Ia/8AMhS9+CLSikrwqy7A9L6R0fT9Q9WfUqbUOK44bzWexl10um1dKOv08NkJtxjFRrK7My0Ou1OjhrR0/wD9I7eeH5/uYdb1Gvv0Z6mtuaimqdpHle+zm1Nf2d7/AKV7EUZafUepJ2lyapnq6UNE7nt5J7YItYVcKgrHqFPW1nqSk5OTt2dCi1FFcLjzyXSqLfd+4LbftV44LQklzl+CtVl58ZFoI0ck23REtOldfJEJ7VS83d8iXFNtX4dAQo3x/JCTjLKZo3ltKr8EKTTbtvFJXwASv2+Sms1p6M3i3gtuStu237kxcJwcXFfc7bYHmznKaVvC4Rr0ylb8M3n00bx/BfbTwkvgipUPJKgrK2s457tjdS5fwmVF2sewhpS1JqEYtylhJIzc3K03hs9D6V1EOm13OTcW40n4D18eZrczXV0f0ZRan1Uot8rTT/uYPW9Xr9XSjpacNHSjJ5guF3v3N9HV1Or6mXoqUYQysdjy/qPUzepqaSlLbdU2ZfVuMeLHc/8AWXUda9W01FJcbYpGXJySlbrsdOnUo5/uV8ry69tdWp0KLyePGeERiXN/grzTDSlqTUIK5PgrKDjJxfKOjRclrJww+zXYx67XT6iUpNOWMRVdsu/kDOqJorGalHC97LxxznxkgisYIXJaXGMWRJp5SS9kBVnrfSfpGn1nTa3VdTq+noaV/peZNK2eVux73yeh9M+o/wBCtW9L1N0GoeYy8ikZdf0/T6Eo/wBPqzkpJNxnGmrVr5wckVkx19XU1dS5uTfdy5bNtNpw/v7iFW22kNt2Wwmnz+RFOclGKtt0ku7CxRxbaSV/BbU0dTRxqQlBvjcqPcWnpfQ+l09TUhHU6zVut0sQX/mef9e1dbT6iOnqyi3GKk4rs2jnnm9t8k+OnXg9cXWr9eZ3JSrkhSTyW5iq7fydDlaPp70Y6nqQtutr5Rg+5rPUlp6dabqTd2uUc0G1It4k6sCXVAitI84Vl1fZN+yM0aRKN4/bKuex9p/p/wCoavWrR09qj6Edsk3TaWFJHxMOx39H1mp0nUQ1tF04vK7SXdHP/I8P9uOft6ePfpeur/UXVS1OtlovUlKEXuabxbPndfUc3s/c9T6hq9LFR9GLtNvvbvszydOEnPdJZbsx/HxzM+L5Ndrp6SFRtpq2dsG4qKjFycnWO3uYaeEbRbOt5NuGirnJuSSaUaz5KSm1PaRechFlJO7KSk9ibTi3mmTKorD5Odt7nXDA6ozb2pRcrfPhe5Xbc7fyVhNbLstbbwBeeq102vW+KUWrWNyrNHjz6hvUbjFRV4XNfk9eX3wlpu3FrNHBo9JFzk5cIDTQU51JHZFtummklbl2+DOM4wdYLOaX5As1FPko1KaVxcbSdP8AyU375ukLnB2nZURLRbaq2qtvsiJxjF0nZq2/Td8nM9ybsirbcq1Vq6fY9X6f9GWvow6vrdeHS9E57PUlLM34iv8AJ4+/a+D2fpv1SWppQ6TWnox0tOElCOtBSjJ5au/clWMPri6LR6icekS01pz9PYrbarlt97PNXd1hdzn6zWlqzbnPfqSk5Sd9ydOTaEK6Y08eSKdJtVeaY07olu0VEPTcpWk226oy6nTTfZ/Bs7orNX2Aw0dGrlXHk6Eltz2KxiaJSlLbFNtukkFQ1UakqYUaSbw2rp9hOEtN1OLi/DKNMCazfCvBeUsOousZ7GXfJMn9oRZNt96q2/BW05YK8jNgadrapPCQd9k27wl3KylaolvHsB0dJOOn1WnLUUXGMsqWV+Tn676jLX1E7VW3Siklb7Jf5K3u54KavTqTTiqs17XnE9Z3q0Xup9jq00lBtxrNLHJzaa2Uu5tbrkyqXP7X9ueySJle7bzTrkzvHJG52leALSi2nS+1V+TNp1hNvijVvz4MpPt2CoktraZKbq2sLF+SjdsZbIPV6Xq56mh6MJx05pVu43KzyOt2w1tTbqPUz+qqtmj4p9zk1NOmHVr+RdYmb+mcVbOvTWFSbfGDHTgdMFSDlaSgtjxbXgo1zjhdiXbWCFfdlEu4t5SZxThNO5LLydPLwTJbkQc+jFo6FFvt2tlVHaywBvGRt88gRTT4Ahad21wnWTSCcWklbb/Yq7Tu7JTtARqaam7qmIwqKbVX2LWRwgLNN1j3fsb/AE7qP6XrdPV+1O6tq9t4s5ZMq5tKqJrPtLK1nXrZZ+n0H1frv6VaenGTnrfqlJrg+b6nWlrNy1JOU5O23yTrampqNylNtvlvkyjp28nh4vD6R7+bz3yVGmbJVFPuyjjTwSm0vY6HMu43wZ0rui8rpFb7MCGsWCGALI0VdzOJZPwrYGylm+DSM9qRiuaLLCz37WUbSrUptcdvJiopSZrF5SS+c8CkwJg1GFfktak1z9ueSmdl8PxZMHT4u8chHR0nSanV68dOFW8tvsjp1tDougbfUa09Wd5hp8fv2NYa2jp9Eox1I6EpxatO3Nvz4PK6zThodJCEdV6rbdzar8I6piZz2uX3u9cnxXX63T1dVenpLSi+0WUb+1JPC8nA3T/J1Qk3FWc2r2unM5ON4NYbzWas0Us4MIvhL82+CylXBFdSrLeW3bbZGqoOG1UrWWuTFNvMlSulnktN/Y2lb7ICGo3aVexKpvvxXJV4dckq7ysVzf8ABUWwibiopJUkqyyt5Kyk2lapvPN0BopK7beFSzj5IlJN4/gomm67Vbz/AARuim0ERKKSW1cKuR9uMFuy7Nq2VatquM274Cs1pae54LKFXjlkJ0+C1t7n2XGeSKmKrJGEks48vLJUrRH/ABTaptXV3QE8r8+S1X+Sl4Vc/NEppd7AVV5yy0Opn0u6elFPUqlJv9Puvco5Xfj55KWqyBy6uq3qRfDSq7bs6dOW6NspPSVq6/uaQX2rFYCpaTDSrvb9w1WcfuS264x5AqnV2dc+t0tLoVpaEdrUf9yUoJuUnnnxg42u6+WZyipKmG8eS4/BHV9TnBsqarNM59PTUc+exun9uFb7IMVaT3S4S9kSklb71V+CZRSxd138kblxWKsIri7RK4fPN8kN2+KRppQlqzjCEXKUpbYxXcKo1aazT9yJZfFfB9dD6f8AS/p046es9LX6mGnulFtyt1y1xR8p1M9F6iem/wBS3SW2lF3wvbgnTiu7Hv8A2K1fPATWX/km8YVv9iir2t3wWikk8ZfcrVPz7k5zdUvfkgmlfJScVsSSSpUWTIt1nuuL4AyiqaNcVnK8FEraXHu2Xi1aA6On6afV+ps2/bHdLc0lRlrR9OcoNp06tcP4NP6laHT6sI6cZy1Eo2+yvODz5a856znJu3yT71ie3tf8N918Y+Cey7V4KxdryWzS8lbO3AVL3Jp1brnGS+hoy1tSMIrnl+F5LJ0df0vQ0pa0Z6+YXSVd/P4NPqDWlDUU2r/4x8WdN6XRaC1ZJWlt04v/AN+54GrqepPV1NbUctSeUjovMZ49fxOJU4ttLzll083ykckZVK0b6ctzXH5ZzPJpYtbUkqr+QP8Air5fbwA72yKV5CVtcflkrkCHFUqVUVUUmi7rauM9rHLSx8tgZSX3fBLSpUuESk3J2XlrR09JqlbeZPP8AZSfBRLyRv3zdPF4JbAhglrAAhF0VXnklVeVfsBdNlk2Tp6UtbVUYRucnhIvr9PPppKGolF1dJlX1vOiZZNmUZJSTaTa4vsWu+AyvzfgW0RajBJJefki1htJ1mmBGo3KNXx2M9V+rpJN1KPZs0tGcqzjl2amrEuY5ZPhHRp8FdqvgvFUqRhpquCVyVVWnSdcWWTAsmNzZCrNLl3ZDjinwVFkyU8mcpPdxySpLc8LKq/YDRy3YK8Kyt8k76qklVUl2KjV9NrQuWpBwjVtzwjDcpZRXreo3Vub1JyirlJvFPhHNpTdsuufpqyfp23SIeUU3WlhJJUqLbu9K6dX2Ms8E6ZLKXktap4WXbfcKmsBcEbgqpRSSSVYAO6Iyi21urjdZqirkAp2GhfNVnuLwFKtIu+MFNyfZL4LKSpJYSVUgKPku39oTVUkubFKnhW+4FGRRZ0nwm+L8EdwI2kq0TaSpJL/ACRaapq0Be8ElHK3fksmk26V1VhEbXfdn0X+n+m6fQ0n9R6zUjGm4aUbzfd/4PnlNRbpZfLJlrz2bYy+1S3JPiyVY9jrfqHSaXX6+vo6e/XnGUXJydK8ceaPnddrdGS58DqNaWpqSko7NzbpPgxScnkzIvXQpNtMtdlIYXCLqu6T9maRKdDghytt+ReGkll3fcCbZARHZJJKgBMcBcp0nXFkNXysASlRnKGbNZStZSebKun2AiKovddyG7bsWqWOMAXR39Jr6XTdPqaji5azdRXY85SpJYSy8IiUnK1F17ms65erLyp6jrNTV1JS1PumsZ7HG5EyTWCtE1q1bepTyjaBlFZN4VawiMtE7JtpFUqLN3FKlSwqAzd2WTfAwndL8ke4Eh3gjcqSpJLwWTpppJ/IFeGV1Epqv5LN0yLTSVJUBhGLjI2QdWR8AQwHxwAKpl08mSLpget0L9CD19OK1NXiMboy6mWhq62rv1HGVtq8q/k4G26fjsZzeftTQdOfLJn146Iu6qq8lryc+mnto2qu9sOZon9qbrPYi7pYWctsreCCi27JDzbxzSLQ09+77oxUVbcnRR0pNJp13XcBRKwldX7EC2Qac1x72X09OWrqRjpq5SdJeTFM9H6Tqaen1L1dSVOEG4/PBLeTrG9eubXfH6HpaU4x6jqVlW9jWP3Mvqkvp/TaK0NCGnKSWZrLv5ObqZdLq9Y9eWtqOW5YhBPd7HldTP1OonKqzhLsec7fy5sTW721opbo2iVXLrC/c5dKdWmb3Z6uxbcS3SV1+GUQZQnFT8YRSEEi5BBaqSXf2Jq/CVZbNuj6WXV9Xp6MZKO95b7I9TX+m9B0vqep1k5bMOMIq0+1+B0eJZN8vHOCkmtzSeEyCjTcgu1/x2M8hsDs6zrFtlpLUdKCiopZa938HDHV3ZpLPBTUjbtEQjXJbro6E7Tdr48k2ZpEkGnGLT+Cey896M1dm+hpPX19PSUoxc5JXJ0kS3n04rapvjwQ5c8Y/k6/qPR6PSSfo9VHWSltacWna59uTgvJM6mp2LZxduyLK9waRfFX5/gdsc9imSbAs8Ov58k+/ZL9y/TPR9ZPXzBJus5fZGGrrQeotijFUsRvH78l586nfq6l/wCYTq3jxRnYRFRKN5Q2pOln3JIILJE54VfkqSmBLwyUuePgo7C54sCyZCeFwWVOLvlFFhgd/Tf0q0lKWlPV1ov9DklB57s4tbUUtaSSjy8x4fx7FPUlsnFPElT9zBJqRHtryS4mZHSnayRZCuiFyV4tGqfN/AfCOn6f0ses6uGjPUWmpcyZTrNFaOo/Slv0W2oT/wCxj2nt6tcvOsO1/wABfhFMk2bZJKyjhTxkuQBVRwXjyvnuRQA0WTXUlpw01Jaai3Fv7pX+yMHLBnOO5X3LLxYtGe/uiyMdNNM0Ii2Eu2f4JWXXHuUJAnuOIrjJXuWhCWpLbFWwK8vwVvJ0enDTzqyXxZyuVyeK9i2JL1ZsFGwRUIsmUJA0sr8EEoC0XTTq6L7jMncBfdikkgpU1i/kouMi+AL732dMyTl6jk2228staCAvZNqsJL4KWLAupZTw68hzopZGAcW9acJeV7GcprmN37k1gq4k4nrERTNoulxniyiLWVVrG7CVJV4KWL8gX3V2XFBMpdiwNo6uxprFcUX6rrnrxTk6zbil37Z7/k5RVsCNOTbbZra/fuZqkTYF7FqqqqK2RYFnRDYbvgiwLJ8iyl8iwL7vx8F1Osrtx7GN0TYGvXdXq9VrucsJu0k8Izi/PJDyRZJJJyLb1pdfIspZNlRZSxQbxTyVQbtAWcr57mLhTwacCwEWTeMLuVsWBa7WSXK3ZSxYF79l8kWVsiwOjS0560moq3y/YnqPShtjpPdS++fZv2Ofe43tdGc5ynVtuifWeXrbd7jdhLCrwZJsteCtL2r4RGL4K3YsDR1tfkpYbpe5WwOvpurn0ur6unW9JpX2s5dXX1NSdzk38i6KvJn1ner39Lp4JUq7LxkoLNIveButlLF0BpeKRLhOMYzlBqL/AEtrDM7xZ3P6jOXT6e7UzBOO1YxWGQcW4ncqSqqRnuvJPYotdO6JsrYsCbJTpleBYFrDeKWMVgpYsApuCtXuTwzPuXeSKAAgARZO4qCKtuG4qALbhuKgC+8bygAvvG8oAL7xvKAC+8bygA03ojeigAvuQ3lABfeN5QAX3Ib0UAF96G8oAL7xvKAC+9DeUAF943ooALbkNxUAW3E7igAvvG8oAL70N6KAC+9DeUAF96G9FABfeN5QAX3EbkVAFtyG4qALbhuRUAW3E7kUAF9w3FABbcNxUAW3DcVAFtw3FQBbcNxUAW3BtMqAJTSJ3FQBbcNxUAX3IjcVAFtw3IqALbhuRUAWtAqAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//9k=";

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
.fp { width:100%; max-width:340px; display:block; margin:0 auto; }
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
.ovbubbles { display:flex; flex-wrap:wrap; gap:11px; }
.ovb { width:46px; height:46px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-family:'Barlow Condensed'; font-weight:700; font-size:20px; transition:transform .12s; }
.ovb:active { transform:scale(.9); }
.ovb.fl { animation:ovpulse 1.6s ease; }
@keyframes ovpulse { 0%,100% { transform:scale(1);} 20% { transform:scale(1.25);} }
.ovlegend { font-size:11px; color:var(--muted); margin-top:11px; }
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
    <div className="login" style={{ backgroundImage: `linear-gradient(180deg, rgba(15,17,20,.30) 0%, rgba(15,17,20,.55) 38%, rgba(15,17,20,.93) 72%, rgba(15,17,20,.99) 100%), url(${typeof BG_LOGIN !== "undefined" ? BG_LOGIN : ""})` }}>
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
    return { activeRoutes, todaySends, weekSends, monthSends, totalSends, totalFlashes, popularRoutes, activeClimbers, wallStats, sessionList, creators };
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
                  {gs.length > 0 && <div className="wlpills">{gs.map(g => (
                    <button key={g} className="gpill" style={{ background: GRADE_COLOR[g] }} onClick={() => { setFWall(w.code); setFGrade(g); setRoutesView("liste"); }}>{g}</button>
                  ))}</div>}
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
                {flat.map(r => { const col = colorOf(r.name) || "#3a4150"; const done = !!r.results?.[me.name]; const fg = colorFgOf(r.name); return (
                  <button key={r.id} className={"ovb" + (flashId === r.id ? " fl" : "") + (done ? " done" : "")} onClick={() => jumpToRoute(r.id)} style={{ background: col, boxShadow: `0 0 0 3px ${GRADE_COLOR[r.grade] || "#666"}, 0 0 0 4.5px ${col}` }} title={`${routeTitle(r)} · ${r.grade}er`}>
                    {done && <i className="ovchk" style={{ color: fg }}>✓</i>}
                  </button>
                ); })}
              </div>
              <div className="ovlegend">Bubble = Grifffarbe · Ring = Schwierigkeit · ✓ = geschafft</div>
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
                      return (
                        <div key={r.id} className="sroute-row">
                          {colorOf(r.name) && <span className="hrswatch sm" style={{ background: colorOf(r.name) }} />}
                          <span className="srn">{routeTitle(r)} <span className="sgrade">{r.grade}er</span></span>
                          <span className="rschip top" style={{ marginLeft: "auto" }}>✓ {sends - flashes}</span>
                          <span className="rschip flash">⚡ {flashes}</span>
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
  { code: "wkw", d: "M5,12 L34,12 L25,26 L34,38 L24,50 L34,62 L22,76 L5,76 Z", tx: 15, ty: 44, rot: -90, label: "WETTKAMPFWAND", bx: 11, by: 18 },
  { code: "h", d: "M41,15 L56,15 L58,27 L54,41 L44,44 L39,40 L38,27 Z", tx: 47.5, ty: 29, label: "BLOCK\nHINTEN", bx: 51, by: 39 },
  { code: "v", d: "M44,47 L55,47 L60,61 L56,81 L42,82 L37,67 L40,55 Z", tx: 48, ty: 65, label: "BLOCK\nVORNE", bx: 51, by: 76 },
  { code: "pl", d: "M62,22 L72,21 L73,81 L63,82 Z", tx: 67.5, ty: 52, rot: -90, label: "PLATTE", bx: 67.5, by: 75 },
  { code: "tb", d: "M75,13 L91,13 L91,30 L98,30 L98,52 L80,52 L75,36 Z", tx: 83, ty: 30, rot: -90, label: "TRAINING & BUG", bx: 83, by: 47 },
];
function FpLabel({ s, on }) {
  const fill = on ? "#14171c" : "#f1f1ec";
  const fs = s.label.length > 11 ? 3.0 : 3.4;
  if (s.label.includes("\n")) {
    const [a, b] = s.label.split("\n");
    return <text x={s.tx} y={s.ty} textAnchor="middle" fontFamily="'Barlow Condensed'" fontWeight="700" fontSize="3.4" fill={fill}><tspan x={s.tx} dy="0">{a}</tspan><tspan x={s.tx} dy="3.8">{b}</tspan></text>;
  }
  const t = s.rot ? `rotate(${s.rot} ${s.tx} ${s.ty})` : undefined;
  return <text x={s.tx} y={s.ty} transform={t} textAnchor="middle" dominantBaseline="middle" fontFamily="'Barlow Condensed'" fontWeight="700" fontSize={fs} fill={fill} letterSpacing="0.3">{s.label}</text>;
}
function FloorPlan({ value, onChange, counts, newest }) {
  return (
    <svg className="fp" viewBox="0 0 100 100">
      <rect x="1" y="1" width="98" height="98" rx="4" fill="#d8d8d2" stroke="#b4b4ac" strokeWidth="0.8" />
      <text x="50" y="8" textAnchor="middle" fontSize="3.4" fontWeight="700" fill="#3f444b" letterSpacing="0.6">GARTEN</text>
      <text x="39" y="96" textAnchor="middle" fontSize="3.4" fontWeight="700" fill="#3f444b" letterSpacing="0.6">EINGANG</text>
      <rect x="80" y="58" width="17.5" height="20" rx="2" fill="#bdbdb6" stroke="#9c9c93" strokeWidth="0.6" />
      <text x="88.7" y="67" textAnchor="middle" fontSize="2.4" fontWeight="600" fill="#42474e"><tspan x="88.7" dy="0">KINDER-</tspan><tspan x="88.7" dy="3">BEREICH</tspan></text>
      {FP_SEGS.map(s => { const on = value === s.code; const fresh = newest === s.code; const n = counts ? (counts[s.code] || 0) : null; return (
        <g key={s.code} onClick={() => onChange(s.code)} style={{ cursor: "pointer" }}>
          <path d={s.d} fill={on ? "#f2b441" : fresh ? "#3a4150" : "#2c3037"} stroke={on ? "#b9831a" : fresh ? "#9fe6a0" : "#f2b441"} strokeWidth={on || fresh ? 1.5 : 1.1} strokeLinejoin="round" />
          <FpLabel s={s} on={on} />
          {n != null && n > 0 && (<g>
            <circle cx={s.bx} cy={s.by} r="4.7" fill="#14171c" stroke={on ? "#b9831a" : "#f2b441"} strokeWidth="0.8" />
            <text x={s.bx} y={s.by} textAnchor="middle" dominantBaseline="central" fontSize="3.7" fontWeight="700" fontFamily="'Barlow Condensed'" fill="#fff">{n}</text>
          </g>)}
          {fresh && (<g>
            <rect x={s.bx - 6} y={s.by - 11.5} width="12" height="5" rx="2.5" fill="#3fae5e" />
            <text x={s.bx} y={s.by - 9} textAnchor="middle" dominantBaseline="central" fontSize="3.1" fontWeight="700" fontFamily="'Barlow Condensed'" fill="#fff">NEU</text>
          </g>)}
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
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="z. B. lila, rot, blau…" autoFocus={isNew} />
          </div>

          <div className="field">
            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>Routenname <button type="button" className="reroll" onClick={() => setNick(genName(uid(), grade))}>🎲 neu würfeln</button></label>
            <input type="text" value={nick} onChange={e => setNick(e.target.value)} placeholder="Name der Route" />
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
