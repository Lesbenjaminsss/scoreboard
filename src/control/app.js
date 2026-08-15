'use strict';

(function () {
  const $ = (id) => document.getElementById(id);

  let state = {
    settings: {},
    competitions: [],
    matches: [],
    error: null,
    updatedAt: null,
  };
  let search = '';
  let onlyFav = false;
  let autoSelected = false;
  let lang = 'tr';

  function t(key) {
    return (window.I18N && window.I18N[lang] && window.I18N[lang][key]) || (window.I18N && window.I18N.tr[key]) || key;
  }

  function setLang() {
    lang = (state.settings && state.settings.language) || 'tr';
    if (lang !== 'en') lang = 'tr';
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
  }

  // ---------- rendering helpers ----------

  function fmtTime(ms) {
    if (!ms) return '';
    const d = new Date(ms);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  function fmtUpdated(ms) {
    if (!ms) return '—';
    const d = new Date(ms);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(
      d.getSeconds(),
    ).padStart(2, '0')}`;
  }

  // ---------- league list ----------

  function renderLeagues() {
    const list = $('leagueList');
    const needle = search.toLowerCase();
    const fav = new Set(state.settings.favoriteLeagueIds || []);
    const comps = state.competitions
      .filter((c) => !needle || (c.name + ' ' + c.country).toLowerCase().includes(needle))
      .filter((c) => !onlyFav || fav.has(c.id))
      .sort((a, b) => {
        const fa = fav.has(a.id) ? 1 : 0;
        const fb = fav.has(b.id) ? 1 : 0;
        if (fa !== fb) return fb - fa;
        if (b.liveCount !== a.liveCount) return b.liveCount - a.liveCount;
        return (a.country + a.name).localeCompare(b.country + b.name);
      });

    $('leagueCount').textContent = comps.length;
    $('favCount').textContent = fav.size;
    list.innerHTML = '';

    if (comps.length === 0) {
      list.innerHTML = onlyFav
        ? `<div class="hint">${t('noFavorites')}</div>`
        : `<div class="hint">${t('noLeagues')}</div>`;
      return;
    }

    for (const c of comps) {
      const isFav = fav.has(c.id);
      const item = document.createElement('div');
      item.className = 'league-item' + (c.id === state.settings.selectedLeagueId ? ' active' : '');
      item.innerHTML = `
        <div class="li-left">
          <img class="li-logo" src="${c.logo || ''}" alt="" onerror="this.style.visibility='hidden'" />
          <div>
            <div class="li-name">${esc(c.name)}</div>
            <div class="li-country">${esc(c.country)}</div>
          </div>
        </div>
        <div class="li-right">
          ${c.liveCount > 0 ? `<span class="live-chip">${c.liveCount} CANLI</span>` : ''}
          <button class="star ${isFav ? 'on' : ''}" title="${t('favTitle')}">${isFav ? '★' : '☆'}</button>
        </div>
      `;
      const star = item.querySelector('.star');
      star.addEventListener('click', (e) => {
        e.stopPropagation();
        window.api.toggleFavoriteLeague(c.id);
      });
      item.addEventListener('click', () => window.api.setLeague(c.id));
      list.appendChild(item);
    }
  }

  function esc(s) {
    const div = document.createElement('div');
    div.textContent = s == null ? '' : String(s);
    return div.innerHTML;
  }

  // ---------- match list ----------

  function renderMatches() {
    const list = $('matchList');
    const selId = state.settings.selectedLeagueId;
    if (!selId) {
      list.innerHTML = `<div class="hint">${t('selectLeagueHint')}</div>`;
      $('matchesTitle').textContent = t('matches');
      $('matchCount').textContent = 0;
      return;
    }

    const league = state.competitions.find((c) => c.id === selId);
    $('matchesTitle').textContent = league ? `${league.name} — ${t('matches')}` : t('matches');

    const groupOrder = { live: 0, pre: 1, post: 2 };
    const matches = state.matches
      .filter((m) => m.competitionId === selId)
      .sort((a, b) => {
        if (groupOrder[a.state] !== groupOrder[b.state]) {
          return groupOrder[a.state] - groupOrder[b.state];
        }
        if (a.state === 'post' && b.state === 'post') return b.mstUtc - a.mstUtc;
        return a.mstUtc - b.mstUtc;
      });

    $('matchCount').textContent = matches.length;
    list.innerHTML = '';

    if (matches.length === 0) {
      list.innerHTML = `<div class="hint">${t('noMatchesToday')}</div>`;
      return;
    }

    let lastGroup = '';
    for (const m of matches) {
      if (m.state !== lastGroup) {
        lastGroup = m.state;
        const label =
          m.state === 'live'
            ? t('liveGroup')
            : m.state === 'post'
              ? t('finishedGroup')
              : t('upcomingGroup');
        const g = document.createElement('div');
        g.className = 'group-label';
        g.textContent = label;
        list.appendChild(g);
      }

      const selected = state.settings.selectedMatchIds.includes(m.id);
      const score =
        m.state === 'pre'
          ? '–'
          : `${m.score.home !== '' ? m.score.home : '-'} : ${m.score.away !== '' ? m.score.away : '-'}`;
      const sub =
        m.state === 'live'
          ? `<span class="live">● CANLI</span><span class="clock">${esc(m.clockLabel || '')}</span>`
          : m.state === 'post'
            ? `<span class="clock">${t('FINISHED')}</span>`
            : `<span class="clock">${fmtTime(m.mstUtc)}</span>`;

      const item = document.createElement('div');
      item.className = 'match-item' + (selected ? ' selected' : '');
      item.innerHTML = `
        <input type="checkbox" ${selected ? 'checked' : ''} />
        <div class="mt-info">
          <div class="mt-teams">
            <img class="cr" src="${m.home.logo || ''}" alt="" onerror="this.style.visibility='hidden'" />
            <span>${esc(m.home.name)}</span>
            <span class="vs">vs</span>
            <span>${esc(m.away.name)}</span>
            <img class="cr" src="${m.away.logo || ''}" alt="" onerror="this.style.visibility='hidden'" />
          </div>
          <div class="mt-time">${esc(m.competitionName)}</div>
        </div>
        <div class="mt-score">${esc(score)}${sub}</div>
      `;
      const cb = item.querySelector('input');
      cb.addEventListener('change', () => window.api.toggleMatch(m.id));
      item.addEventListener('click', (e) => {
        if (e.target !== cb) {
          cb.checked = !cb.checked;
          window.api.toggleMatch(m.id);
        }
      });
      list.appendChild(item);
    }
  }

  // ---------- footer / settings ----------

  function renderSettings() {
    const s = state.settings || {};
    $('cycleSec').value = Math.round(s.cycleInterval / 1000 || 8);
    $('pollSec').value = Math.round(s.pollInterval / 1000 || 5);
    $('statsSec').value = Math.round(s.statsShowSec || 12);
    $('statsHalfSec').value = Math.round(s.statsHalfShowSec || 20);
    $('statsMins').value = (s.statsShowMinutes && s.statsShowMinutes.length ? s.statsShowMinutes : [20, 40, 60, 80]).join(', ');
    $('scalePct').value = Math.round((s.scale || 1) * 100);
    $('opacityPct').value = Math.round((s.opacity == null ? 1 : s.opacity) * 100);
    $('positionSel').value = s.position || 'bottom';
    $('langSel').value = s.language === 'en' ? 'en' : 'tr';
    $('showVersion').checked = s.showVersion === true;
    $('versionPosSel').value = s.versionPosition === 'top-left' ? 'top-left' : 'bottom-left';
    $('selCount').textContent = (s.selectedMatchIds || []).length;
    $('overlayBtn').textContent = s.overlayVisible === false ? t('showBoard') : t('hideBoard');
  }

  function renderStatus() {
    const badge = $('connBadge');
    if (state.error) {
      badge.className = 'badge err';
      badge.textContent = t('error');
      badge.title = state.error;
    } else if (state.updatedAt) {
      badge.className = 'badge ok';
      badge.textContent = t('connected');
      badge.title = '';
    } else {
      badge.className = 'badge warn';
      badge.textContent = t('connecting');
    }
    $('updated').textContent = t('lastUpdate') + fmtUpdated(state.updatedAt);
  }

  // ---------- events ----------

  function bindEvents() {
    $('refreshBtn').addEventListener('click', () => window.api.refresh());

    $('search').addEventListener('input', (e) => {
      search = e.target.value.trim();
      renderLeagues();
    });

    $('onlyFav').addEventListener('change', (e) => {
      onlyFav = e.target.checked;
      renderLeagues();
    });

    const num = (id) => {
      $(id).addEventListener('change', () => {
        const v = Number($(id).value);
        if (!Number.isFinite(v)) return;
        if (id === 'cycleSec') window.api.setSettings({ cycleInterval: Math.max(2, v) * 1000 });
        else if (id === 'pollSec') window.api.setSettings({ pollInterval: Math.max(5, v) * 1000 });
        else if (id === 'statsSec') window.api.setSettings({ statsShowSec: Math.max(3, v) });
        else if (id === 'statsHalfSec') window.api.setSettings({ statsHalfShowSec: Math.max(3, v) });
        else if (id === 'scalePct') window.api.setSettings({ scale: Math.max(40, Math.min(200, v)) / 100 });
        else if (id === 'opacityPct')
          window.api.setSettings({ opacity: Math.max(10, Math.min(100, v)) / 100 });
      });
    };
    num('cycleSec');
    num('pollSec');
    num('statsSec');
    num('statsHalfSec');

    $('statsMins').addEventListener('change', () => {
      const arr = $('statsMins').value
        .split(',')
        .map((s) => parseInt(s, 10))
        .filter((n) => Number.isFinite(n) && n > 0 && n <= 120);
      if (arr.length) window.api.setSettings({ statsShowMinutes: arr });
    });
    num('scalePct');
    num('opacityPct');

    $('positionSel').addEventListener('change', (e) =>
      window.api.setSettings({ position: e.target.value }),
    );

    $('langSel').addEventListener('change', (e) =>
      window.api.setSettings({ language: e.target.value }),
    );

    $('showVersion').addEventListener('change', (e) =>
      window.api.setSettings({ showVersion: e.target.checked }),
    );

    $('versionPosSel').addEventListener('change', (e) =>
      window.api.setSettings({ versionPosition: e.target.value }),
    );

    $('overlayBtn').addEventListener('click', async () => {
      await window.api.toggleOverlay();
      const s = await window.api.getState();
      state = s;
      setLang();
      renderSettings();
    });

    $('clearBtn').addEventListener('click', () => window.api.setSelectedMatches([]));

    $('copyBtn').addEventListener('click', async () => {
      const url = $('obsUrl').value;
      if (!url) return;
      try {
        await navigator.clipboard.writeText(url);
        $('copyBtn').textContent = t('copied');
        setTimeout(() => ($('copyBtn').textContent = t('copy')), 1500);
      } catch (e) {
        const ta = document.createElement('textarea');
        ta.value = url;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
    });
  }

  // ---------- init ----------

  function applyState(s) {
    state = s;
    setLang();
    renderSettings();
    renderStatus();
    renderLeagues();

    if (!state.settings.selectedLeagueId && !autoSelected && state.competitions.length > 0) {
      autoSelected = true;
      const best = state.competitions
        .filter((c) => c.liveCount > 0)
        .sort((a, b) => b.liveCount - a.liveCount)[0];
      if (best) window.api.setLeague(best.id);
    }
    renderMatches();
  }

  async function init() {
    bindEvents();
    const base = await window.api.getServerUrl();
    $('obsUrl').value = `${base}/overlay`;
    const s = await window.api.getState();
    applyState(s);
    window.api.onState(applyState);
  }

  init();
})();
