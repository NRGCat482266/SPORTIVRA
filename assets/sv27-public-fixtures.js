/* Informational fixtures from the CC0 openfootball/football.json and openfootball/europe datasets.
 * The source publishes season files, not a live scoreboard. These rows have no betting-market IDs.
 */
(() => {
  'use strict';
  const sport = 'Piłka nożna';
  const sourceUrl = 'https://github.com/openfootball/football.json';
  const raw = 'https://raw.githubusercontent.com/openfootball';
  const groups = [
    ['Włochy', 'Europe/Rome', 'it', ['Serie A', 'Serie B']],
    ['Polska', 'Europe/Warsaw', 'pl', ['Ekstraklasa', 'I Liga']],
    ['Anglia', 'Europe/London', 'en', ['Premier League', 'Championship', 'League One', 'League Two']],
    ['Niemcy', 'Europe/Berlin', 'de', ['Bundesliga', '2. Bundesliga', '3. Liga']],
    ['Hiszpania', 'Europe/Madrid', 'es', ['LaLiga', 'LaLiga 2']],
    ['Francja', 'Europe/Paris', 'fr', ['Ligue 1', 'Ligue 2']],
    ['Holandia', 'Europe/Amsterdam', 'nl', ['Eredivisie']],
    ['Portugalia', 'Europe/Lisbon', 'pt', ['Primeira Liga']],
    ['Belgia', 'Europe/Brussels', 'be', ['Belgian Pro League']],
    ['Austria', 'Europe/Vienna', 'at', ['Bundesliga', '2. Liga']],
    ['Grecja', 'Europe/Athens', 'gr', ['Super League Greece']],
    ['Szkocja', 'Europe/London', 'sco', ['Scottish Premiership']],
    ['Turcja', 'Europe/Istanbul', 'tr', ['Süper Lig']],
  ];
  const catalog = groups.flatMap(([country, zone, code, leagues]) => leagues.map((league, index) =>
    ({sport, country, tier: index + 1, league, zone, code: code + '.' + (index + 1)})));
  const normalize = value => String(value ?? '').toLowerCase().normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, ' ').trim();
  const aliases = {
    soccer: 'pilka nozna', football: 'pilka nozna', italy: 'wlochy', italia: 'wlochy', germany: 'niemcy',
    england: 'anglia', spain: 'hiszpania', france: 'francja', netherlands: 'holandia', poland: 'polska',
    belgium: 'belgia', portugal: 'portugalia', greece: 'grecja', scotland: 'szkocja', turkey: 'turcja',
    'la liga': 'laliga', 'la liga 2': 'laliga 2', 'english premier league': 'premier league',
    'italian serie a': 'serie a', 'italian serie b': 'serie b', 'polish ekstraklasa': 'ekstraklasa'
  };
  function key(value) { const text = normalize(value); return aliases[text] || text; }
  const labelSeason = year => year + '-' + String(year + 1).slice(-2);
  const seasonYear = date => Number(date.slice(0, 4)) - (Number(date.slice(5, 7)) < 7 ? 1 : 0);
  const dayFormats = new Map(), offsetFormats = new Map();
  function dayAt(instant, zone) {
    if (!dayFormats.has(zone)) dayFormats.set(zone, new Intl.DateTimeFormat('sv-SE', {
      timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit'
    }));
    return dayFormats.get(zone).format(instant);
  }
  function utcKickoff(day, time, zone) {
    const parts = /^(\d{1,2}):([0-5]\d)(?::([0-5]\d))?$/.exec(String(time || '').trim());
    if (!parts || Number(parts[1]) > 23) return null;
    time = parts[1].padStart(2,'0') + ':' + parts[2] + ':' + (parts[3] || '00');
    if (!offsetFormats.has(zone)) offsetFormats.set(zone, new Intl.DateTimeFormat('en', {
      timeZone: zone, timeZoneName: 'shortOffset'
    }));
    const wall = Date.parse(day + 'T' + time + 'Z');
    let guess = wall;
    for (let step = 0; step < 2; step++) {
      const name = offsetFormats.get(zone).formatToParts(guess).find(part => part.type === 'timeZoneName').value;
      const offset = /GMT([+-])(\d+)(?::(\d+))?/.exec(name);
      const minutes = offset ? (Number(offset[2]) * 60 + Number(offset[3] || 0)) * (offset[1] === '-' ? -1 : 1) : 0;
      const corrected = wall - minutes * 60000;
      if (corrected === guess) break;
      guess = corrected;
    }
    return new Date(guess).toISOString();
  }
  function parsePoland(text, year) {
    const months = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');
    const matches = [];
    let date = '';
    for (const line of text.split(/\r?\n/)) {
      const header = /^\s*(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun) ([A-Z][a-z]{2}) (\d{1,2})(?: (\d{4}))?\s*$/.exec(line);
      if (header) {
        const month = months.indexOf(header[1]) + 1;
        date = month ? [header[3] || year + (month < 7 ? 1 : 0), String(month).padStart(2, '0'), header[2].padStart(2, '0')].join('-') : '';
        continue;
      }
      const match = /^\s*(?:(\d{1,2}:\d\d)\s+)?(.+?)\s+v\s+(.+?)\s*(?:\s+(\d+)-(\d+)(?:\s+\([^)]*\))?)?\s*$/.exec(line);
      if (match && date) matches.push({date, time: match[1]?.padStart(5, '0'), team1: match[2], team2: match[3],
        score: match[4] === undefined ? null : [Number(match[4]), Number(match[5])]});
    }
    return matches;
  }
  function toRows(matches, entry) {
    if (!Array.isArray(matches)) throw Error('Nieprawidłowy plik sezonu');
    const rows = [];
    for (const m of matches) {
      const home = typeof m.team1 === 'string' ? m.team1 : m.team1?.name;
      const away = typeof m.team2 === 'string' ? m.team2 : m.team2?.name;
      if (!home || !away || !/^\d{4}-\d{2}-\d{2}$/.test(m.date) || !Number.isFinite(Date.parse(m.date))) continue;
      const starts = utcKickoff(m.date, m.time, entry.zone);
      const score = m.score?.ft || m.score;
      const finished = Array.isArray(score) && score.length === 2 && score.every(n => Number.isInteger(n) && n >= 0);
      rows.push({id: [entry.code, m.date, home, away].join('/'), sport, country: entry.country,
        tier: entry.tier, league: entry.league, home, away, starts_at: starts, date_only: starts ? null : m.date,
        source_provider: 'openfootball', betting_enabled: false,
        score_home: finished ? score[0] : null, score_away: finished ? score[1] : null});
    }
    return rows;
  }

  async function withTimeout(url, timeout, parse) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      return await parse(await fetch(url, {signal: controller.signal, credentials: 'omit'}));
    } finally { clearTimeout(timer); }
  }
  async function fetchSeason(entry, year) {
    const isPolish = entry.code.startsWith('pl.');
    const season = labelSeason(year);
    const url = isPolish
      ? raw + '/europe/master/poland/' + season + '_pl' + entry.tier + '.txt'
      : raw + '/football.json/master/' + season + '/' + entry.code + '.json';
    return withTimeout(url, 4000, async reply => {
      if (reply.status === 404) return {missing: true, rows: []};
      if (!reply.ok) throw Error('HTTP ' + reply.status);
      const matches = isPolish ? parsePoland(await reply.text(), year) : (await reply.json()).matches;
      return {rows: toRows(matches, entry)};
    });
  }

  // Include queued and active requests in the cache so UI changes and polling can share a download.
  const cache = new Map(), queue = [];
  let activeDownloads = 0;
  async function runNext() {
    if (!queue.length || activeDownloads >= 4) return;
    activeDownloads++;
    const {entry, year, resolve, item} = queue.shift();
    try {
      const result = await fetchSeason(entry, year);
      item.expires = Date.now() + 600000;
      resolve(result);
    } catch {
      item.expires = Date.now() + 60000;
      resolve({failed: true, rows: []});
    } finally {
      activeDownloads--;
      runNext();
    }
  }
  function enqueue(entry, year) {
    const id = labelSeason(year) + '/' + entry.code;
    const previous = cache.get(id);
    if (previous?.expires > Date.now()) return previous.promise;
    if (cache.size > 150) for (const [key, item] of cache) if (item.expires <= Date.now()) cache.delete(key);
    const item = {expires: Infinity};
    item.promise = new Promise(resolve => { queue.push({entry, year, resolve, item}); });
    cache.set(id, item);
    runNext();
    return item.promise;
  }

  const localRows = new Map();
  const archiveUrl = typeof document !== 'undefined' && document.currentScript?.src
    ? new URL('sv27-public-fixtures-archive.json', document.currentScript.src).href
    : './assets/sv27-public-fixtures-archive.json';
  let archiveRequest;
  function loadArchive() {
    if (!archiveRequest) archiveRequest = withTimeout(archiveUrl, 1800, async reply => {
      if (!reply.ok) throw Error('HTTP ' + reply.status);
      const data = await reply.json();
      if (data.version !== 1 || !data.seasons || !/^\d{4}-\d{2}-\d{2}$/.test(data.retrieved)) throw Error('Błąd kopii');
      return data;
    }).catch(() => { archiveRequest = null; return null; });
    return archiveRequest;
  }
  function snapshotResult(archive, job) {
    const file = archive?.seasons[job.id];
    if (!file) return null;
    if (!localRows.has(job.id)) {
      const matches = file.fixtures.map(([date, time, home, away, ...score]) => ({
        date, time, team1: file.teams[home], team2: file.teams[away], score
      }));
      localRows.set(job.id, toRows(matches, job.entry));
    }
    return {rows: localRows.get(job.id), snapshotDate: archive.retrieved};
  }
  // A search over many leagues should not wait for each external request on a slow connection.
  async function resultsFor(jobs) {
    if (!jobs.length) return [];
    const remote = Promise.all(jobs.map(job => enqueue(job.entry, job.year).then(result => {job.result = result;})));
    const archive = loadArchive();
    let timer;
    try {
      await Promise.race([remote, new Promise(resolve => { timer = setTimeout(resolve, 1600); })]);
    } finally { clearTimeout(timer); }
    if (jobs.every(job => job.result && !job.result.missing && !job.result.failed)) return jobs.map(job => job.result);
    const data = await archive;
    return jobs.map(job => {
      if (job.result && !job.result.missing && !job.result.failed) return job.result;
      return snapshotResult(data, job) || job.result || {pending: true, rows: []};
    });
  }
  const openLigaCodes = {'de.1':'bl1', 'de.2':'bl2', 'de.3':'bl3', 'en.1':'pl'};
  const openLigaCache = new Map();
  async function openLiga(entry, year) {
    const code = openLigaCodes[entry.code];
    if (!code) return [];
    const id = code + '/' + year;
    const previous = openLigaCache.get(id);
    if (previous && previous.expires > Date.now()) return previous.promise;
    const item = {expires: Date.now() + 600000};
    item.promise = withTimeout('https://api.openligadb.de/getmatchdata/' + id, 4000, async response => {
      if (!response.ok) throw Error('OpenLigaDB HTTP ' + response.status);
      const rows = await response.json();
      if (!Array.isArray(rows)) throw Error('Niepoprawne dane OpenLigaDB');
      return rows.filter(row => row.team1?.teamName && row.team2?.teamName
        && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(row.matchDateTimeUTC || '')
        && Number.isFinite(Date.parse(row.matchDateTimeUTC)));
    }).catch(() => { item.expires = Date.now() + 60000; return []; });
    openLigaCache.set(id, item);
    return item.promise;
  }
  async function enrichTimes(jobs, results) {
    const eligible = jobs.filter((job, i) => openLigaCodes[job.entry.code]
      && results[i].rows.some(row => !row.starts_at));
    let changed = false;
    await Promise.all(eligible.map(async job => {
      const index = jobs.indexOf(job), rows = results[index].rows;
      const remote = await openLiga(job.entry, job.year);
      const pair = (home, away) => normalize(home) + '|' + normalize(away);
      const pairs = new Map(), counts = new Map();
      for (const item of remote) {
        const key = pair(item.team1.teamName, item.team2.teamName);
        pairs.set(key, [...(pairs.get(key) || []), item]);
      }
      for (const row of rows) {
        const key = pair(row.home, row.away);
        counts.set(key, (counts.get(key) || 0) + 1);
      }
      results[index] = {...results[index], rows: rows.map(row => {
        if (row.starts_at) return row;
        const key = pair(row.home, row.away), candidates = pairs.get(key) || [];
        if (counts.get(key) !== 1 || candidates.length !== 1) return row;
        const candidate = candidates[0];
        const date = dayAt(Date.parse(candidate.matchDateTimeUTC), job.entry.zone);
        if (date !== row.date_only) return row;
        changed = true;
        return {...row, starts_at: candidate.matchDateTimeUTC, date_only: null,
          kickoff_source: 'OpenLigaDB (ODbL)'};
      })};
    }));
    return changed;
  }
  async function search({start, end, tz = 'UTC', sport: selectedSport, country, tier, league, search: term = '', status = 'all', page = 0, anyDate = false, timedOnly = false}) {
    const since = new Date(start), until = new Date(end);
    if (!Number.isFinite(+since) || !Number.isFinite(+until) || until <= since || until - since > 366 * 86400000)
      throw Error('Nieprawidłowy zakres dat terminarza.');
    const startDay = dayAt(since, tz), lastDay = dayAt(+until - 1, tz);
    const years = new Set([seasonYear(startDay), seasonYear(lastDay)]);
    if (anyDate) years.add(seasonYear(startDay) - 1);
    const selected = catalog.filter(entry => (!selectedSport || key(selectedSport) === key(sport))
      && (!country || key(country) === key(entry.country)) && (!league || key(league) === key(entry.league))
      && (!tier || +tier === entry.tier));
    const requests = [];
    const requestedYears = new Set(years);
    for (const entry of selected) {
      const entryYears = new Set(years);
      // The published Polish CC0 archive has no newer seasons at present.
      if (anyDate && entry.code.startsWith('pl.') && seasonYear(startDay) >= 2024) {
        entryYears.add(2024);
        if (entry.tier === 1) entryYears.add(2023);
      }
      for (const year of entryYears) {
        requests.push({entry, year, id: labelSeason(year) + '/' + entry.code});
        requestedYears.add(year);
      }
    }
    const results = await resultsFor(requests);
    const extraTimes = await enrichTimes(requests, results);
    const now = Date.now(), today = dayAt(now, tz), days = {}, all = [];
    const words = normalize(term).split(' ').filter(Boolean);
    for (const result of results) for (const row of result.rows) {
      if (timedOnly && !row.starts_at) continue;
      const day = row.date_only || dayAt(Date.parse(row.starts_at), tz);
      if (!anyDate && (row.date_only
        ? day < startDay || day > lastDay
        : Date.parse(row.starts_at) < +since || Date.parse(row.starts_at) >= +until)) continue;
      const elapsed = row.starts_at ? Date.parse(row.starts_at) <= now : day < today;
      const phase = row.score_home !== null ? 'finished' : elapsed ? 'awaiting' : 'scheduled';
      if (status && status !== 'all' && status !== phase) continue;
      const haystack = normalize([row.home, row.away, row.league, row.country].join(' '));
      if (!words.every(word => haystack.includes(word))) continue;
      all.push({...row, display_status: phase});
      days[day] = (days[day] || 0) + 1;
    }
    const stamp = row => Date.parse(row.starts_at || row.date_only);
    all.sort((a, b) => (anyDate ? Math.abs(stamp(a) - +since) - Math.abs(stamp(b) - +since) : stamp(a) - stamp(b))
      || a.id.localeCompare(b.id));
    const failure = results.some(r => r.failed), missing = results.some(r => r.missing);
    const pending = results.some(r => r.pending);
    const supported = results.some(r => !r.failed && !r.missing && !r.pending);
    const snapshotDate = results.find(r => r.snapshotDate)?.snapshotDate;
    const dates = [...requestedYears].sort().map(labelSeason).join(', ');
    const notice = !selected.length ? 'OpenFootball nie obejmuje wybranych rozgrywek.'
      : 'OpenFootball · sezony ' + dates + '.' +
        (extraTimes ? ' Część godzin: OpenLigaDB (ODbL), openligadb.de. Terminy mogą się zmienić.' : '') +
        (snapshotDate ? ' Część danych pochodzi z kopii z ' + snapshotDate + '.' : '') +
        (pending ? ' Pozostałe ligi są wczytywane. Lista odświeży się automatycznie.' : '') +
        (failure ? ' Część plików dostawcy jest teraz niedostępna.' : '') +
        (missing ? (supported ? ' Pokazano ligi z opublikowanym terminarzem.' : ' Dostawca nie opublikował terminarza dla tego wyboru.') : '');
    const offset = Math.max(0, Math.trunc(+page || 0)) * 50;
    return {sourceUrl, notice, days, total: all.length, rows: all.slice(offset, offset + 50),
      unavailable: failure && !supported, partial: failure || missing || pending};
  }
  window.SV27PublicFixtures = Object.freeze({catalog, search});
})();
