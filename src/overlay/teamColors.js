'use strict';

(function (global) {
  function norm(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/ı/g, 'i')
      .replace(/ş/g, 's')
      .replace(/ç/g, 'c')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ö/g, 'o')
      .replace(/İ/g, 'i')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  // Mackolik team IDs (stable lookup when names vary)
  const BY_ID = {
    dpsnqu7pd2b0shfzjyn5j1znf: { abbrev: 'SAM', color: '#c8102e', text: '#ffffff' },
    cjbaf8s09qoa1n11r33gc560x: { abbrev: 'GOZ', color: '#b01020', text: '#ffd100' },
  };

  const TEAMS = [
    { match: 'galatasaray', abbrev: 'GAL', color: '#8b1020', text: '#ffb800' },
    { match: 'fenerbahce', abbrev: 'FEN', color: '#002d72', text: '#ffed00' },
    { match: 'besiktas', abbrev: 'BJK', color: '#111111', text: '#ffffff' },
    { match: 'trabzonspor', abbrev: 'TS', color: '#6b0018', text: '#ffffff' },
    { match: 'basaksehir', abbrev: 'BAS', color: '#003087', text: '#ffed00' },
    { match: 'konyaspor', abbrev: 'KON', color: '#006b3a', text: '#ffffff' },
    { match: 'samsunspor', abbrev: 'SAM', color: '#c8102e', text: '#ffffff' },
    { match: 'antalyaspor', abbrev: 'ANT', color: '#b01020', text: '#ffffff' },
    { match: 'alanyaspor', abbrev: 'ALA', color: '#008f4c', text: '#ffffff' },
    { match: 'sivasspor', abbrev: 'SIV', color: '#b01020', text: '#ffffff' },
    { match: 'kasimpasa', abbrev: 'KAS', color: '#003087', text: '#ffffff' },
    { match: 'gaziantep', abbrev: 'GFK', color: '#b01020', text: '#ffd100' },
    { match: 'adanademir', abbrev: 'ADS', color: '#003087', text: '#ffffff' },
    { match: 'rizespor', abbrev: 'RZS', color: '#006b3a', text: '#ffffff' },
    { match: 'kayserispor', abbrev: 'KAY', color: '#b01020', text: '#ffd100' },
    { match: 'goztepe', abbrev: 'GOZ', color: '#b01020', text: '#ffd100' },
    { match: 'eyupspor', abbrev: 'EYP', color: '#4a2d7a', text: '#ffd100' },
    { match: 'bodrumspor', abbrev: 'BOD', color: '#006b6b', text: '#ffffff' },
    { match: 'hatayspor', abbrev: 'HAT', color: '#b01020', text: '#ffffff' },
    { match: 'pendikspor', abbrev: 'PEN', color: '#003087', text: '#ffffff' },
    { match: 'karagumruk', abbrev: 'KRG', color: '#111111', text: '#ffffff' },
    { match: 'kocaelispor', abbrev: 'KOC', color: '#006b3a', text: '#ffffff' },
    { match: 'boluspor', abbrev: 'BOL', color: '#b01020', text: '#ffffff' },
    { match: 'genclerbirligi', abbrev: 'GEN', color: '#b01020', text: '#ffffff' },
    { match: 'erzurumspor', abbrev: 'ERZ', color: '#003087', text: '#ffffff' },
    { match: 'ankaragucu', abbrev: 'AGU', color: '#b01020', text: '#ffd100' },
    { match: 'manchesterunited', abbrev: 'MUN', color: '#b01020', text: '#ffd100' },
    { match: 'mancity', abbrev: 'MCI', color: '#6cabdd', text: '#ffffff' },
    { match: 'liverpool', abbrev: 'LIV', color: '#b01020', text: '#ffffff' },
    { match: 'arsenal', abbrev: 'ARS', color: '#9c0018', text: '#ffffff' },
    { match: 'chelsea', abbrev: 'CHE', color: '#003087', text: '#ffffff' },
    { match: 'tottenham', abbrev: 'TOT', color: '#111111', text: '#ffffff' },
    { match: 'newcastle', abbrev: 'NEW', color: '#111111', text: '#ffffff' },
    { match: 'realmadrid', abbrev: 'RMA', color: '#ffffff', text: '#111111' },
    { match: 'barcelona', abbrev: 'BAR', color: '#8b0018', text: '#ffd100' },
    { match: 'atleticomadrid', abbrev: 'ATM', color: '#b01020', text: '#ffffff' },
    { match: 'bayern', abbrev: 'BAY', color: '#b01020', text: '#ffffff' },
    { match: 'dortmund', abbrev: 'BVB', color: '#ffd100', text: '#111111' },
    { match: 'juventus', abbrev: 'JUV', color: '#111111', text: '#ffffff' },
    { match: 'acmilan', abbrev: 'MIL', color: '#b01020', text: '#ffffff' },
    { match: 'intermilan', abbrev: 'INT', color: '#003087', text: '#ffffff' },
    { match: 'psg', abbrev: 'PSG', color: '#003087', text: '#ffffff' },
    { match: 'parissaintgermain', abbrev: 'PSG', color: '#003087', text: '#ffffff' },
  ];

  function findTeam(name, id) {
    if (id && BY_ID[id]) return BY_ID[id];
    const key = norm(name);
    if (!key) return null;
    for (const t of TEAMS) {
      if (key.includes(t.match)) return t;
    }
    return null;
  }

  function hashHue(s) {
    let h = 0;
    for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h) % 360;
  }

  function teamAbbrev(name, id) {
    const hit = findTeam(name, id);
    if (hit) return hit.abbrev;
    const parts = String(name || '')
      .replace(/[^a-zA-Z\s]/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (parts.length >= 2) {
      return parts
        .slice(0, 3)
        .map((p) => p[0])
        .join('')
        .toUpperCase()
        .slice(0, 3);
    }
    const clean = String(name || '')
      .replace(/[^a-zA-Z]/g, '')
      .toUpperCase();
    return (clean.slice(0, 3) || '?').padEnd(3, '?');
  }

  function teamColors(name, id) {
    const hit = findTeam(name, id);
    if (hit) return { color: hit.color, text: hit.text };
    const key = norm(name);
    const hue = hashHue(key || String(id || 'team'));
    const color = `hsl(${hue}, 55%, 32%)`;
    return {
      color,
      text: hue > 40 && hue < 190 ? '#111111' : '#ffffff',
    };
  }

  global.TeamColors = { teamAbbrev, teamColors, norm, findTeam };
})(typeof window !== 'undefined' ? window : globalThis);
