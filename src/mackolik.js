'use strict';

const BASE = 'https://www.mackolik.com/perform/p0/ajax/components/competition/livescores/json';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const teamLogo = (id) => `https://file.mackolikfeeds.com/teams/${id}`;
const compLogo = (id) => `https://file.mackolikfeeds.com/competitions/${id}`;

function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function fetchAndParseDay(date = new Date()) {
  const url = `${BASE}?sports[]=Soccer&matchDate=${fmtDate(date)}`;
  const res = await fetch(url, {
    headers: {
      Referer: 'https://www.mackolik.com/canli-sonuclar',
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Mackolik HTTP ${res.status}`);
  const json = await res.json();
  if (!json || json.status !== 'success' || !json.data) {
    throw new Error('Mackolik yaniti beklenmeyen bicimde');
  }
  return parse(json);
}

// For live matches the minute is derived from periodStart.
function computeMinute(m, now) {
  if (m.state !== 'live' || m.status !== 'minutes' || !m.periodStart) return null;
  const elapsed = Math.floor((now - m.periodStart) / 60000) + 1;
  if (m.periodId === 1) return Math.max(1, Math.min(45, elapsed));
  if (m.periodId === 2) return Math.max(46, Math.min(90, 45 + elapsed));
  return Math.max(91, Math.min(120, 90 + elapsed));
}

function clockLabel(m, minute) {
  if (m.state === 'live') {
    if (minute != null) return `${minute}'`;
    if (m.substate === 'penalties') return 'PEN';
    if (m.substate === 'extratime') return 'UZT';
    if (m.statusBoxContent) return String(m.statusBoxContent).trim();
    return 'CANLI';
  }
  if (m.state === 'post') return m.statusBoxContent ? String(m.statusBoxContent).trim() : 'MS';
  const d = new Date(m.mstUtc);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function parse(json) {
  const now = Date.now();
  const competitions = new Map();
  const matches = new Map();

  const rawComps = (json.data && json.data.competitions) || {};
  for (const [id, c] of Object.entries(rawComps)) {
    competitions.set(id, {
      id,
      name: c.name || '',
      country: c.country ? c.country.name : '',
      code: c.code || '',
      logo: compLogo(id),
      liveCount: 0,
    });
  }

  const rawMatches = (json.data && json.data.matches) || {};
  for (const [id, m] of Object.entries(rawMatches)) {
    const comp = competitions.get(m.competitionId);
    const match = {
      id,
      home: {
        id: m.homeTeam ? m.homeTeam.id : null,
        name: m.homeTeam ? m.homeTeam.name : '?',
        logo: m.homeTeam ? teamLogo(m.homeTeam.id) : null,
      },
      away: {
        id: m.awayTeam ? m.awayTeam.id : null,
        name: m.awayTeam ? m.awayTeam.name : '?',
        logo: m.awayTeam ? teamLogo(m.awayTeam.id) : null,
      },
      competitionId: m.competitionId,
      competitionName: comp ? comp.name : '',
      competitionCountry: comp ? comp.country : '',
      competitionLogo: comp ? comp.logo : null,
      score: {
        home: m.score ? m.score.home : '',
        away: m.score ? m.score.away : '',
        ht: m.score ? m.score.ht : null,
        pen: m.score ? m.score.pen : null,
        agg: m.score ? m.score.agg : null,
      },
      state: m.state,
      status: m.status,
      substate: m.substate,
      statusBoxContent: m.statusBoxContent || null,
      periodId: m.periodId,
      periodStart: m.periodStart,
      mstUtc: m.mstUtc,
      iddaaCode: m.iddaaCode || null,
      matchSlug: m.matchSlug || null,
    };
    match.isLive = m.state === 'live';
    match.minute = computeMinute(m, now);
    match.clockLabel = clockLabel(m, match.minute);
    if (match.isLive && comp) comp.liveCount += 1;
    matches.set(id, match);
  }

  return { updatedAt: now, competitions, matches };
}

// ---------------------------------------------------------------------------
// Match events (goals/cards) + player shirt numbers
// ---------------------------------------------------------------------------

let sessionCookie = '';
const playerNumberCache = new Map();
const playerNumberPending = new Map();

function collectCookies(res) {
  try {
    const values =
      typeof res.headers.getSetCookie === 'function'
        ? res.headers.getSetCookie()
        : (res.headers.get('set-cookie') || '').split(',').map((c) => c.trim());
    for (const c of values) {
      const first = c.split(';')[0].trim();
      if (!first) continue;
      if (first.startsWith('laravel_session=')) {
        sessionCookie = first;
        return;
      }
    }
  } catch (e) {
    /* ignore */
  }
}

async function ensureSession() {
  if (sessionCookie) return sessionCookie;
  try {
    const res = await fetch('https://www.mackolik.com/canli-sonuclar', {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      signal: AbortSignal.timeout(15000),
    });
    collectCookies(res);
  } catch (e) {
    /* ignore */
  }
  return sessionCookie;
}

async function httpGet(url, referer) {
  await ensureSession();
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: '*/*',
      Referer: referer || 'https://www.mackolik.com/canli-sonuclar',
      Cookie: sessionCookie,
    },
    signal: AbortSignal.timeout(15000),
  });
  collectCookies(res);
  return res;
}

async function fetchMatchEvents(matchId) {
  const url = `https://www.mackolik.com/ajax/football/key-events?ajaxViewName=events&matchId=${encodeURIComponent(matchId)}`;
  const res = await httpGet(url, 'https://www.mackolik.com/mac/');
  if (!res.ok) throw new Error(`Mackolik events HTTP ${res.status}`);
  const json = await res.json();
  if (!json || json.status !== 'success' || !json.data) return [];
  return Array.isArray(json.data.keyEvents) ? json.data.keyEvents : [];
}

function playerIdFromUrl(playerUrl) {
  if (!playerUrl) return null;
  const parts = String(playerUrl).replace(/\/+$/, '').split('/');
  return parts[parts.length - 1] || null;
}

// ---------------------------------------------------------------------------
// Match statistics (Opta widgets rendered server-side on the stats page)
// ---------------------------------------------------------------------------

const STAT_TAB_KEYS = ['general', 'distribution', 'attack', 'defence', 'discipline'];

async function fetchMatchStats(matchId, matchSlug) {
  const url = `https://www.mackolik.com/mac/${encodeURIComponent(matchSlug || 'mac')}/istatistik/${encodeURIComponent(matchId)}`;
  let lastErr = null;
  // The stats page occasionally returns a transient 502; retry a few times.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const res = await httpGet(url, 'https://www.mackolik.com/canli-sonuclar');
      if (res.ok) {
        const tabs = parseStatsHtml(await res.text());
        const total = Object.values(tabs).reduce((n, a) => n + a.length, 0);
        if (total > 0) return tabs;
        lastErr = new Error('Mackolik stats empty');
      } else {
        lastErr = new Error(`Mackolik stats HTTP ${res.status}`);
      }
    } catch (e) {
      lastErr = e;
    }
    await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
  }
  throw lastErr || new Error('Mackolik stats failed');
}

function parseStatsHtml(html) {
  const tabs = { general: [], distribution: [], attack: [], defence: [], discipline: [] };
  const seen = new Set();
  const liRe = /<li nav-item="(\d+)"[^>]*>([\s\S]*?)<\/li>/g;
  let m;
  while ((m = liRe.exec(html)) !== null) {
    const nav = parseInt(m[1], 10);
    if (nav < 0 || nav > 4 || seen.has(nav)) continue;
    const content = m[2];
    const rows = [];
    const tableRe = /<table class="Opta-Stats-Bars">([\s\S]*?)<\/table>/g;
    let tm;
    let label = null;
    while ((tm = tableRe.exec(content)) !== null) {
      const trRe = /<tr>([\s\S]*?)<\/tr>/g;
      let trm;
      while ((trm = trRe.exec(tm[1])) !== null) {
        const tr = trm[1];
        const th = tr.match(/<th[^>]*>([\s\S]*?)<\/th>/s);
        if (th) {
          label = th[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
          continue;
        }
        const tds = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((x) =>
          x[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()
        );
        if (tds.length === 3 && label) {
          rows.push({ label, home: tds[0], away: tds[2] });
        }
      }
    }
    if (rows.length) {
      tabs[STAT_TAB_KEYS[nav]] = rows;
      seen.add(nav);
    }
    if (seen.size === 5) break;
  }
  return tabs;
}

function extractShirtNumber(html) {
  const m = String(html).match(/p0c-person-information__shirt-number">\s*([0-9]{1,2})\s*<\/span>/);
  return m ? parseInt(m[1], 10) : null;
}

let activeFetches = 0;
const fetchWaiters = [];

function withConcurrency(fn) {
  return new Promise((resolve) => {
    const run = async () => {
      activeFetches += 1;
      try {
        resolve(await fn());
      } catch (e) {
        resolve(null);
      } finally {
        activeFetches -= 1;
        const next = fetchWaiters.shift();
        if (next) next();
      }
    };
    if (activeFetches >= 3) {
      fetchWaiters.push(run);
    } else {
      run();
    }
  });
}

async function resolvePlayerNumber(playerUrl) {
  const pid = playerIdFromUrl(playerUrl);
  if (!pid) return null;
  if (playerNumberCache.has(pid)) return playerNumberCache.get(pid);
  if (playerNumberPending.has(pid)) return playerNumberPending.get(pid);

  const task = (async () => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const num = await withConcurrency(async () => {
        try {
          const res = await httpGet(playerUrl, 'https://www.mackolik.com/mac/');
          if (res.ok) return extractShirtNumber(await res.text());
        } catch (e) {
          /* retry */
        }
        return null;
      });
      if (num != null) return num;
      sessionCookie = '';
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
    return null;
  })();

  playerNumberPending.set(pid, task);
  task
    .then((n) => {
      if (n != null) playerNumberCache.set(pid, n);
    })
    .finally(() => playerNumberPending.delete(pid));
  return task;
}

module.exports = {
  fetchAndParseDay,
  parse,
  teamLogo,
  compLogo,
  fetchMatchEvents,
  resolvePlayerNumber,
  fetchMatchStats,
  parseStatsHtml,
};
