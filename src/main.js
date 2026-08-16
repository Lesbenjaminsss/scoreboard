'use strict';

const { app, BrowserWindow, ipcMain, globalShortcut, screen } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { fetchAndParseDay, fetchMatchEvents, fetchMatchStats, fetchMatchLineup } = require('./mackolik');
const { getLeagueStyle } = require('./leagues');

const PORT_START = 3710;
const OVERLAY_W = 1300;
const OVERLAY_H = 220;

let server = null;
let port = PORT_START;
let controlWin = null;
let overlayWin = null;
let pollTimer = null;
let polling = false;
let data = null;
let lastError = null;

const DEFAULTS = {
  cycleInterval: 8000,
  pollInterval: 5000,
  scale: 1.0,
  opacity: 1.0,
  position: 'bottom',
  offsetY: 26,
  language: 'tr',
  showVersion: false,
  versionPosition: 'bottom-left',
  overlayVisible: true,
  statsShowSec: 12,
  statsHalfShowSec: 20,
  statsShowMinutes: [20, 40, 60, 80],
  selectedLeagueId: null,
  selectedMatchIds: [],
  favoriteLeagueIds: [],
};

let settings = { ...DEFAULTS };

const settingsFile = () => path.join(app.getPath('userData'), 'skor-panosu.json');

function loadSettings() {
  try {
    const raw = fs.readFileSync(settingsFile(), 'utf8');
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed };
  } catch (e) {
    return { ...DEFAULTS };
  }
}

function saveSettings() {
  try {
    fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 2));
  } catch (e) {
    /* ignore */
  }
}// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

async function poll() {
  if (polling) return;
  polling = true;
  try {
    const parsed = await fetchAndParseDay(new Date());
    data = parsed;
    lastError = null;
    await attachSelectedEvents();
  } catch (e) {
    lastError = String((e && e.message) || e);
  } finally {
    polling = false;
    broadcast();
    schedulePoll();
  }
}

// Attach card events to the selected live matches so the overlay can show
// them as small badges stacked on each team's crest. Goals are not added to
// the persistent list to avoid clutter (the score + goal animation covers them).
async function attachSelectedEvents() {
  if (!data) return;
  const selected = (settings.selectedMatchIds || [])
    .map((id) => data.matches.get(id))
    .filter((m) => m && m.isLive);
  await Promise.all(selected.slice(0, 6).map(attachMatchEvents));
}

async function attachMatchEvents(m) {
  try {
    const raw = await fetchMatchEvents(m.id);
    const home = [];
    const away = [];
    const goals = [];
    const penalties = [];
    const subs = [];
    for (const e of raw) {
      if (!e || !e.type) continue;
      if (e.type === 'substitute') {
        const side = e.position === 'home' || e.position === 'away' ? e.position : null;
        if (side) {
          const inId = String(e.playerUrl || '').replace(/\/+$/, '').split('/').pop() || null;
          const outId = String(e.playerOutUrl || '').replace(/\/+$/, '').split('/').pop() || null;
          subs.push({
            key: `${e.timeMin}|${e.periodId}|${side}|${e.playerName || ''}|${e.playerOutName || ''}`,
            minute: e.timeMin != null ? String(e.timeMin) : '',
            periodId: e.periodId,
            position: side,
            playerIn: e.playerName || '',
            playerOut: e.playerOutName || '',
            inPhoto: inId ? `https://file.mackolikfeeds.com/people/${inId}` : null,
            outPhoto: outId ? `https://file.mackolikfeeds.com/people/${outId}` : null,
          });
        }
        continue;
      }
      if (e.type === 'goal') {
        const pid = String(e.playerUrl || '').replace(/\/+$/, '').split('/').pop() || null;
        goals.push({
          key: `${e.timeMin}|${e.periodId}|${e.position}|${e.playerName || ''}|${e.score || ''}`,
          minute: e.timeMin != null ? String(e.timeMin) : '',
          periodId: e.periodId,
          position: e.position === 'home' || e.position === 'away' ? e.position : null,
          playerName: e.playerName || '',
          assist: e.assistPlayerName || null,
          pen: String(e.subType).toLowerCase() === 'penalty-goal',
          photo: pid ? `https://file.mackolikfeeds.com/people/${pid}` : null,
        });
        if (String(e.subType).toLowerCase() === 'penalty-goal') {
          penalties.push({
            key: `${e.timeMin}|${e.periodId}|${e.position}|penalty-goal`,
            minute: e.timeMin != null ? String(e.timeMin) : '',
            position: e.position === 'home' || e.position === 'away' ? e.position : null,
            scored: true,
          });
        }
        continue;
      }
      if (e.type === 'card') {
        const side = e.position === 'home' || e.position === 'away' ? e.position : null;
        if (!side) continue;
        const kind = e.subType === 'rc' || e.subType === 'y2rc' ? 'rc' : 'yc';
        (side === 'home' ? home : away).push({
          kind,
          minute: e.timeMin != null ? String(e.timeMin) : '',
        });
        continue;
      }
      if (String(e.type).toLowerCase().startsWith('penalty')) {
        const side = e.position === 'home' || e.position === 'away' ? e.position : null;
        if (side) {
          penalties.push({
            key: `${e.timeMin}|${e.periodId}|${e.position}|${e.type}`,
            minute: e.timeMin != null ? String(e.timeMin) : '',
            position: side,
            scored: false,
          });
        }
      }
    }
    m.events = { home, away, goals, penalties, subs };
  } catch (e) {
    m.events = m.events || { home: [], away: [], goals: [], penalties: [], subs: [] };
  }
}

function schedulePoll() {
  clearTimeout(pollTimer);
  pollTimer = setTimeout(poll, Math.max(5000, Number(settings.pollInterval) || 5000));
}

function buildOverlayState() {
  const matches = (settings.selectedMatchIds || [])
    .map((id) => (data && data.matches.get(id)) || null)
    .filter(Boolean)
    .map((m) => ({
      id: m.id,
      home: m.home,
      away: m.away,
      score: m.score,
      state: m.state,
      status: m.status,
      substate: m.substate,
      statusBoxContent: m.statusBoxContent,
      periodId: m.periodId,
      periodStart: m.periodStart,
      lastUpdated: m.lastUpdated,
      isLive: m.isLive,
      minute: m.minute,
      clockLabel: m.clockLabel,
      competitionId: m.competitionId,
      competitionName: m.competitionName,
      competitionCountry: m.competitionCountry,
      competitionLogo: m.competitionLogo,
      iddaaCode: m.iddaaCode,
      matchSlug: m.matchSlug,
      events: m.events || { home: [], away: [], goals: [], penalties: [], subs: [] },
      style: getLeagueStyle({
        id: m.competitionId,
        name: m.competitionName,
        country: m.competitionCountry,
      }),
    }));
  return {
    settings: {
      cycleInterval: settings.cycleInterval,
      scale: settings.scale,
      opacity: settings.opacity,
      position: settings.position,
      offsetY: settings.offsetY,
      language: settings.language,
      showVersion: settings.showVersion,
      versionPosition: settings.versionPosition,
      overlayVisible: settings.overlayVisible,
      statsShowSec: settings.statsShowSec,
      statsHalfShowSec: settings.statsHalfShowSec,
      statsShowMinutes: settings.statsShowMinutes,
    },
    updatedAt: data ? data.updatedAt : null,
    error: lastError,
    matches,
  };
}

function buildControlState() {
  return {
    settings,
    updatedAt: data ? data.updatedAt : null,
    error: lastError,
    competitions: data ? [...data.competitions.values()] : [],
    matches: data ? [...data.matches.values()] : [],
  };
}

function broadcast() {
  const controlState = buildControlState();
  if (controlWin && !controlWin.isDestroyed()) {
    controlWin.webContents.send('state', controlState);
  }
  const overlayState = buildOverlayState();
  if (overlayWin && !overlayWin.isDestroyed()) {
    overlayWin.webContents.send('overlay-state', overlayState);
  }
}

// ---------------------------------------------------------------------------
// HTTP server (control panel + overlay + API, OBS-friendly)
// ---------------------------------------------------------------------------

function sendJson(res, obj) {
  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(obj));
}

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/control';

  // Redirect so relative assets (style.css, app.js) resolve under the page dir.
  if (urlPath === '/overlay' || urlPath === '/control') {
    res.writeHead(302, { Location: `${urlPath}/` });
    res.end();
    return;
  }

  let file = null;
  let baseDir = null;
  if (urlPath === '/i18n.js') {
    res.writeHead(200, {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    });
    res.end(fs.readFileSync(path.join(__dirname, 'i18n.js')));
    return;
  } else if (urlPath === '/overlay/' || urlPath.startsWith('/overlay/')) {
    baseDir = path.join(__dirname, 'overlay');
    file = urlPath === '/overlay/' ? 'index.html' : urlPath.slice('/overlay/'.length);
  } else if (urlPath === '/control/' || urlPath.startsWith('/control/')) {
    baseDir = path.join(__dirname, 'control');
    file = urlPath === '/control/' ? 'index.html' : urlPath.slice('/control/'.length);
  } else if (urlPath === '/favicon.ico') {
    res.writeHead(204);
    res.end();
    return;
  } else {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const full = path.normalize(path.join(baseDir, file));
  if (!full.startsWith(baseDir)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(full).toLowerCase();
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
  };
  fs.readFile(full, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': types[ext] || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    });
    res.end(content);
  });
}

let statsBusy = false;

async function handleStatsApi(req, res) {
  const id = new URL(req.url, 'http://localhost').searchParams.get('id');
  if (!id) return sendJson(res, { id: null, stats: null });
  if (statsBusy) return sendJson(res, { id, stats: null, busy: true });
  statsBusy = true;
  try {
    const m = data && data.matches.get(id);
    const stats = m && m.matchSlug ? await fetchMatchStats(m.id, m.matchSlug) : null;
    sendJson(res, { id, stats });
  } catch (e) {
    sendJson(res, { id, stats: null, error: String((e && e.message) || e) });
  } finally {
    statsBusy = false;
  }
}

let lineupBusy = false;

async function handleLineupApi(req, res) {
  const id = new URL(req.url, 'http://localhost').searchParams.get('id');
  if (!id) return sendJson(res, { id: null, lineup: null });
  if (lineupBusy) return sendJson(res, { id, lineup: null, busy: true });
  lineupBusy = true;
  try {
    const m = data && data.matches.get(id);
    const lineup = m && m.matchSlug ? await fetchMatchLineup(m.id, m.matchSlug) : null;
    sendJson(res, { id, lineup });
  } catch (e) {
    sendJson(res, { id, lineup: null, error: String((e && e.message) || e) });
  } finally {
    lineupBusy = false;
  }
}

function startServer() {
  return new Promise((resolve, reject) => {
    const srv = http.createServer((req, res) => {
      const urlPath = req.url.split('?')[0];
      if (urlPath === '/api/state') return sendJson(res, buildOverlayState());
      if (urlPath === '/api/settings') return sendJson(res, settings);
      if (urlPath === '/api/health') return sendJson(res, { ok: true });
      if (urlPath === '/api/stats') return handleStatsApi(req, res);
      if (urlPath === '/api/lineup') return handleLineupApi(req, res);
      return serveStatic(req, res);
    });
    srv.on('error', (err) => {
      if (err && err.code === 'EADDRINUSE') {
        port += 1;
        srv.close();
        return startServer().then(resolve, reject);
      }
      reject(err);
    });
    srv.listen(port, '127.0.0.1', () => {
      server = srv;
      resolve();
    });
  });
}

// ---------------------------------------------------------------------------
// Windows
// ---------------------------------------------------------------------------

function createControlWindow() {
  controlWin = new BrowserWindow({
    width: 1100,
    height: 780,
    minWidth: 900,
    minHeight: 600,
    title: 'Scoreboard',
    backgroundColor: '#0b0a12',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  controlWin.loadURL(`http://127.0.0.1:${port}/control`);
  controlWin.on('closed', () => {
    controlWin = null;
  });
}

function createOverlayWindow() {
  const disp = screen.getPrimaryDisplay();
  const b = disp.bounds;
  overlayWin = new BrowserWindow({
    x: b.x,
    y: b.y,
    width: b.width,
    height: b.height,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    hasShadow: false,
    enableLargerThanScreen: true,
    show: settings.overlayVisible !== false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  overlayWin.setAlwaysOnTop(true, 'screen-saver');
  overlayWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWin.setIgnoreMouseEvents(true);
  overlayWin.loadURL(`http://127.0.0.1:${port}/overlay`);
  overlayWin.on('closed', () => {
    overlayWin = null;
  });
}

function toggleOverlay() {
  if (!overlayWin || overlayWin.isDestroyed()) return;
  if (overlayWin.isVisible()) {
    overlayWin.hide();
    settings.overlayVisible = false;
  } else {
    overlayWin.show();
    settings.overlayVisible = true;
  }
  saveSettings();
  broadcast();
}

// ---------------------------------------------------------------------------
// IPC
// ---------------------------------------------------------------------------

function registerIpc() {
  ipcMain.handle('get-state', () => buildControlState());
  ipcMain.handle('get-overlay-state', () => buildOverlayState());
  ipcMain.handle('get-server-url', () => `http://127.0.0.1:${port}`);
  ipcMain.handle('refresh', async () => {
    await poll();
    return buildControlState();
  });

  ipcMain.handle('set-settings', (_e, patch) => {
    const p = patch || {};
    settings = { ...settings, ...p };
    saveSettings();
    schedulePoll();
    broadcast();
    return settings;
  });

  ipcMain.handle('set-league', (_e, id) => {
    settings.selectedLeagueId = id || null;
    saveSettings();
    broadcast();
    return settings;
  });

  ipcMain.handle('toggle-favorite-league', (_e, id) => {
    const list = settings.favoriteLeagueIds || [];
    if (list.includes(id)) {
      settings.favoriteLeagueIds = list.filter((x) => x !== id);
    } else {
      settings.favoriteLeagueIds = [...list, id];
    }
    saveSettings();
    broadcast();
    return settings.favoriteLeagueIds;
  });

  ipcMain.handle('toggle-match', (_e, id) => {
    const list = settings.selectedMatchIds;
    if (list.includes(id)) {
      settings.selectedMatchIds = list.filter((x) => x !== id);
    } else {
      settings.selectedMatchIds = [...list, id];
    }
    saveSettings();
    broadcast();
    return settings.selectedMatchIds;
  });

  ipcMain.handle('set-selected-matches', (_e, ids) => {
    settings.selectedMatchIds = Array.isArray(ids) ? ids : [];
    saveSettings();
    broadcast();
    return settings.selectedMatchIds;
  });

  ipcMain.handle('toggle-overlay', () => {
    toggleOverlay();
    return settings;
  });
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

async function runSmoke() {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const ctrl = {};
  const overlay = {};
  try {
    ctrl.ctrl = await controlWin.webContents.executeJavaScript(`(() => ({
      leagueItems: document.querySelectorAll('.league-item').length,
      stars: document.querySelectorAll('.star').length,
      favCount: document.getElementById('favCount').textContent,
      matchItems: document.querySelectorAll('.match-item').length,
      matchTitle: document.getElementById('matchesTitle').textContent,
      selCount: document.getElementById('selCount').textContent,
      connBadge: document.getElementById('connBadge').textContent,
      obsUrl: document.getElementById('obsUrl').value,
      brand: document.querySelector('h1').textContent,
      taglinePresent: !!document.querySelector('.tagline'),
      posOptions: document.getElementById('positionSel').options.length,
      langSel: document.getElementById('langSel').value,
    }))()`);
  } catch (e) {
    ctrl.ctrlErr = String(e);
  }
  try {
    overlay.ovl = await overlayWin.webContents.executeJavaScript(`(() => ({
      home: document.getElementById('homeName').textContent,
      away: document.getElementById('awayName').textContent,
      score: document.getElementById('scoreHome').textContent + ':' + document.getElementById('scoreAway').textContent,
      clock: document.getElementById('clock').textContent,
      league: document.getElementById('leagueName').textContent,
      sbHidden: document.getElementById('sb').classList.contains('hidden'),
      sbPos: document.getElementById('sb').dataset.pos,
      versionHidden: document.getElementById('version').classList.contains('hidden'),
      versionText: document.getElementById('version').textContent,
    }))()`);
  } catch (e) {
    overlay.ovlErr = String(e);
  }
  console.log('SMOKE ' + JSON.stringify({ ctrl, overlay }));

  // Simulate clicking the first league's star to verify favorite toggle works.
  try {
    await controlWin.webContents.executeJavaScript(`document.querySelector('.league-item .star').click()`);
    await wait(800);
    const favInfo = await controlWin.webContents.executeJavaScript(`({
      favCount: document.getElementById('favCount').textContent,
      starsOn: document.querySelectorAll('.star.on').length,
    })`);
    const srvState = JSON.parse(await new Promise((resolve) => {
      http.get(`http://127.0.0.1:${port}/api/settings`, (res) => {
        let b = '';
        res.on('data', (c) => (b += c));
        res.on('end', () => resolve(b));
      });
    }));
    console.log('FAV ' + JSON.stringify({ favInfo, favoriteLeagueIds: srvState.favoriteLeagueIds }));
    await controlWin.webContents.executeJavaScript(`document.querySelector('.league-item .star').click()`);
    await wait(400);
  } catch (e) {
    console.log('FAV_ERR ' + String(e));
  }

  try {
    const image = await overlayWin.webContents.capturePage();
    fs.writeFileSync(path.join(app.getPath('temp'), 'skor-panosu-smoke.png'), image.toPNG());
    console.log('SMOKE_SHOT ' + path.join(app.getPath('temp'), 'skor-panosu-smoke.png'));
  } catch (e) {
    console.log('SMOKE_SHOT_ERR ' + String(e));
  }

  // Verify card events resolve for a selected live match and render as
  // badges on the team crests.
  try {
    const liveMatches = await controlWin.webContents.executeJavaScript(
      `window.api.getState().then((s) => s.matches.filter((m) => m.isLive))`
    );
    let report = null;
    for (const candidate of (liveMatches || []).slice(0, 5)) {
      await controlWin.webContents.executeJavaScript(
        `window.api.setSelectedMatches([${JSON.stringify(candidate.id)}])`
      );
      await controlWin.webContents.executeJavaScript(`window.api.refresh()`);
      let cards = null;
      let lastEvents = null;
      for (let i = 0; i < 10; i += 1) {
        await wait(800);
        const s = JSON.parse(await new Promise((resolve) => {
          http.get(`http://127.0.0.1:${port}/api/state`, (res) => {
            let b = '';
            res.on('data', (c) => (b += c));
            res.on('end', () => resolve(b));
          });
        }));
        const mm = (s.matches || []).find((x) => x.id === candidate.id);
        if (mm && mm.events && (mm.events.home.length || mm.events.away.length)) {
          cards = mm.events;
          lastEvents = mm.events;
          break;
        }
      }
      if (cards) {
        const fmt = (list) =>
          (list || []).map((e) => e.kind + " " + e.minute + "'");
        report = {
          match: candidate.home.name + ' vs ' + candidate.away.name,
          home: fmt(cards.home),
          away: fmt(cards.away),
          goals: ((lastEvents && lastEvents.goals) || []).map((g) => g.playerName + " " + g.minute + "'" + (g.photo ? " [photo]" : "") + (g.assist ? " [asist:" + g.assist + "]" : "")),
          penalties: ((lastEvents && lastEvents.penalties) || []).map((p) => (p.scored ? "pen" : "pm") + " " + p.minute + "' " + p.position),
        };
        await wait(3500);
        const ovlCards = await overlayWin.webContents.executeJavaScript(`({
          homeCards: document.getElementById('homeCards').querySelectorAll('.card').length,
          awayCards: document.getElementById('awayCards').querySelectorAll('.card').length,
          homeGoals: document.getElementById('homeGoals').querySelectorAll('.goal-chip').length,
          awayGoals: document.getElementById('awayGoals').querySelectorAll('.goal-chip').length,
          goalChipName: document.querySelector('.goal-chip .g-chip-name') ? document.querySelector('.goal-chip .g-chip-name').textContent : '',
          sample: document.querySelector('.card') ? document.querySelector('.card').className : '',
        })`);
        report.overlay = ovlCards;
        break;
      }
    }
    await controlWin.webContents.executeJavaScript(`window.api.setSelectedMatches([])`);
    console.log('CARDS ' + JSON.stringify(report || { note: 'no-live-cards-found' }));
  } catch (e) {
    console.log('CARDS_ERR ' + String(e));
  }

  // Verify match statistics (possession, passes, shots...) can be fetched.
  try {
    const liveMatches = await controlWin.webContents.executeJavaScript(
      `window.api.getState().then((s) => s.matches.filter((m) => m.isLive))`
    );
    const candidate = (liveMatches || [])[0];
    let statsInfo = { note: 'no-live-match' };
    if (candidate) {
      const stats = await fetchMatchStats(candidate.id, candidate.matchSlug);
      const flat = [].concat(stats.general, stats.distribution, stats.attack, stats.defence, stats.discipline);
      statsInfo = {
        match: candidate.home.name + ' vs ' + candidate.away.name,
        rows: flat.length,
        labels: flat.slice(0, 5).map((r) => r.label + ' ' + r.home + '-' + r.away),
      };
    }
    console.log('STATS ' + JSON.stringify(statsInfo));
  } catch (e) {
    console.log('STATS_ERR ' + String(e));
  }

  // Verify starting lineups can be fetched and rendered in the overlay.
  try {
    const liveMatches = await controlWin.webContents.executeJavaScript(
      `window.api.getState().then((s) => s.matches.filter((m) => m.isLive))`
    );
    let report = null;
    for (const candidate of (liveMatches || []).slice(0, 5)) {
      let lineup = null;
      try {
        lineup = await fetchMatchLineup(candidate.id, candidate.matchSlug);
      } catch (e) {
        continue;
      }
      const fmt = (side) => ({
        formation: side.formation,
        count: side.players.length,
        first: side.players.slice(0, 3).map((p) => p.number + ' ' + p.name + ' ' + p.positionShort),
        sample: side.players[0]
          ? { name: side.players[0].name, photo: !!side.players[0].photo, url: !!side.players[0].url }
          : null,
      });
      report = {
        match: candidate.home.name + ' vs ' + candidate.away.name,
        home: fmt(lineup.home),
        away: fmt(lineup.away),
      };
      const mObj = { id: candidate.id, home: candidate.home, away: candidate.away };
      await controlWin.webContents.executeJavaScript(
        `window.api.setSelectedMatches([${JSON.stringify(candidate.id)}])`
      );
      await wait(500);
      await overlayWin.webContents.executeJavaScript(
        `window.__scoreboardDebug.renderLineup(${JSON.stringify(mObj)}, ${JSON.stringify(lineup)})`
      );
      await wait(1200);
      const ovl = await overlayWin.webContents.executeJavaScript(`({
        panelHidden: document.getElementById('lineupPanel').classList.contains('hidden'),
        title: document.getElementById('lineupTitle').textContent,
        homeRows: document.querySelectorAll('#lineupHomeBody .lineup-row').length,
        awayRows: document.querySelectorAll('#lineupAwayBody .lineup-row').length,
        homeFirst: document.querySelector('#lineupHomeBody .lineup-row .lineup-pname')
          ? document.querySelector('#lineupHomeBody .lineup-row .lineup-pname').textContent
          : '',
        homeFormation: document.getElementById('lineupHomeFormation').textContent,
        awayFormation: document.getElementById('lineupAwayFormation').textContent,
      })`);
      report.overlay = ovl;
      break;
    }
    await controlWin.webContents.executeJavaScript(`window.api.setSelectedMatches([])`);
    console.log('LINEUP ' + JSON.stringify(report || { note: 'no-lineup-found' }));
  } catch (e) {
    console.log('LINEUP_ERR ' + String(e));
  }

  // Verify substitution events (out/in players) can be fetched and rendered in
  // the overlay substitution popup for a live match.
  try {
    const liveMatches = await controlWin.webContents.executeJavaScript(
      `window.api.getState().then((s) => s.matches.filter((m) => m.isLive))`
    );
    let report = null;
    for (const candidate of (liveMatches || []).slice(0, 5)) {
      const raw = await fetchMatchEvents(candidate.id);
      const sub = (raw || []).find((e) => e && e.type === 'substitute');
      if (!sub) continue;
      const inId = String(sub.playerUrl || '').replace(/\/+$/, '').split('/').pop() || null;
      const outId = String(sub.playerOutUrl || '').replace(/\/+$/, '').split('/').pop() || null;
      const mObj = { id: candidate.id, home: { name: candidate.home.name }, away: { name: candidate.away.name } };
      const subObj = {
        position: sub.position === 'home' || sub.position === 'away' ? sub.position : 'away',
        minute: String(sub.timeMin != null ? sub.timeMin : ''),
        playerIn: sub.playerName || '',
        playerOut: sub.playerOutName || '',
        inPhoto: inId ? `https://file.mackolikfeeds.com/people/${inId}` : null,
        outPhoto: outId ? `https://file.mackolikfeeds.com/people/${outId}` : null,
      };
      await controlWin.webContents.executeJavaScript(
        `window.api.setSelectedMatches([${JSON.stringify(candidate.id)}])`
      );
      await wait(500);
      await overlayWin.webContents.executeJavaScript(
        `window.__scoreboardDebug.showSubPopup(${JSON.stringify(mObj)}, ${JSON.stringify(subObj)})`
      );
      await wait(1500);
      const ovl = await overlayWin.webContents.executeJavaScript(`({
        panelHidden: document.getElementById('subPanel').classList.contains('hidden'),
        team: document.getElementById('subTeam').textContent,
        minute: document.getElementById('subMin').textContent,
        inName: document.getElementById('subInName').textContent,
        outName: document.getElementById('subOutName').textContent,
        hasInPhoto: !!document.getElementById('subInPhoto').getAttribute('src'),
        hasOutPhoto: !!document.getElementById('subOutPhoto').getAttribute('src'),
      })`);
      report = { match: candidate.home.name + ' vs ' + candidate.away.name, overlay: ovl };
      break;
    }
    await controlWin.webContents.executeJavaScript(`window.api.setSelectedMatches([])`);
    console.log('SUBS ' + JSON.stringify(report || { note: 'no-sub-events-found' }));
  } catch (e) {
    console.log('SUBS_ERR ' + String(e));
  }

  // Verify language switching updates the control panel UI end-to-end.
  try {
    await controlWin.webContents.executeJavaScript(`window.api.setSettings({ language: 'en' })`);
    await wait(900);
    const en = await controlWin.webContents.executeJavaScript(`({
      matchesTitle: document.getElementById('matchesTitle').textContent,
      connBadge: document.getElementById('connBadge').textContent,
      langSel: document.getElementById('langSel').value,
      refresh: document.getElementById('refreshBtn').textContent,
    })`);
    await controlWin.webContents.executeJavaScript(`window.api.setSettings({ language: 'tr' })`);
    await wait(900);
    const tr = await controlWin.webContents.executeJavaScript(`({
      matchesTitle: document.getElementById('matchesTitle').textContent,
      connBadge: document.getElementById('connBadge').textContent,
      langSel: document.getElementById('langSel').value,
      refresh: document.getElementById('refreshBtn').textContent,
    })`);
    console.log('LANG ' + JSON.stringify({ en, tr }));
  } catch (e) {
    console.log('LANG_ERR ' + String(e));
  }

  // Verify the version badge can be shown at the top-left of the overlay.
  try {
    await controlWin.webContents.executeJavaScript(
      `window.api.setSettings({ showVersion: true, versionPosition: 'top-left' })`,
    );
    await wait(900);
    const v = await overlayWin.webContents.executeJavaScript(`({
      visible: !document.getElementById('version').classList.contains('hidden'),
      posTop: document.getElementById('version').classList.contains('pos-top'),
      text: document.getElementById('version').textContent,
    })`);
    await controlWin.webContents.executeJavaScript(`window.api.setSettings({ showVersion: false })`);
    await wait(400);
    console.log('VERSION ' + JSON.stringify(v));
  } catch (e) {
    console.log('VERSION_ERR ' + String(e));
  }

  await wait(300);
  app.exit(0);
}
app.whenReady().then(async () => {
  settings = loadSettings();
  await startServer();
  registerIpc();
  createControlWindow();
  createOverlayWindow();

  globalShortcut.register('Control+Shift+S', toggleOverlay);

  app.on('activate', () => {
    if (!controlWin) createControlWindow();
  });

  await poll();

  if (process.argv.includes('--smoke')) {
    setTimeout(runSmoke, 9000);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (pollTimer) clearTimeout(pollTimer);
});

// Allow the overlay API port to be opened on OBS host machines.
app.commandLine.appendSwitch('no-sandbox');
