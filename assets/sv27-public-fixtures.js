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
  const otherCatalog = [
    {sport:'Koszykówka',country:'USA',tier:1,league:'NBA',provider:'espn',code:'basketball/nba'},
    {sport:'Koszykówka',country:'USA',tier:1,league:'WNBA',provider:'espn',code:'basketball/wnba'},
    {sport:'Koszykówka',country:'USA',tier:2,league:'NCAA',provider:'espn',code:'basketball/mens-college-basketball'},
    {sport:'Koszykówka',country:'USA',tier:2,league:'NBA G League',provider:'espn',code:'basketball/nba-development'},
    {sport:'Formuła 1',country:'Świat',tier:1,league:'Formula 1',provider:'jolpica',code:'f1'},
  ];
  catalog.push(...otherCatalog);
  const sports=[sport,'Koszykówka','Siatkówka','Piłka ręczna','Esport','Formuła 1','Tenis','Narty'];
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
  let otherCatalogPromise=null;
  const otherCache=new Map();
  async function cachedJson(keyName,url,ttl=300000){
    const cached=otherCache.get(keyName);if(cached&&cached.until>Date.now())return cached.data;
    const data=await withTimeout(url,9000,async response=>{if(!response.ok)throw Error('HTTP '+response.status);return response.json()});
    otherCache.set(keyName,{until:Date.now()+ttl,data});return data;
  }
  const providerSportFor={
    'koszykowka':'Basketball','siatkowka':'Volleyball','pilka reczna':'Handball',
    'esport':'Esports','tenis':'Tennis','narty':'Skiing'
  };
  async function loadOtherCatalog(providerSport){
    if(!otherCatalogPromise)otherCatalogPromise=cachedJson('thesportsdb-catalog','https://www.thesportsdb.com/api/v1/json/123/all_leagues.php',600000)
      .then(json=>{
        const labels={basketball:'Koszykówka',volleyball:'Siatkówka',handball:'Piłka ręczna',esports:'Esport',tennis:'Tenis',skiing:'Narty'};
        const rows=(json.leagues||[]).filter(x=>x?.strLeague&&x?.strSport&&labels[key(x.strSport)]).map(x=>({
          sport:labels[key(x.strSport)],country:x.strCountry||'Świat',tier:1,league:x.strLeague,
          provider:'thesportsdb',providerSport:x.strSport,providerLeagueId:String(x.idLeague||'')
        }));
        catalog.push(...rows.filter(r=>!catalog.some(c=>key(c.sport)===key(r.sport)&&key(c.league)===key(r.league))));
        return rows;
      }).catch(error=>{otherCatalogPromise=null;throw error});
    const rows=await otherCatalogPromise;
    return rows.filter(x=>key(x.providerSport)===key(providerSport));
  }
  const espnCode={
    'NBA':'basketball/nba','WNBA':'basketball/wnba','NCAA':'basketball/mens-college-basketball',
    'NBA G League':'basketball/nba-development'
  };
  function inCalendarWindow(date,since,until,anyDate){const t=Date.parse(date);return Number.isFinite(t)&&(anyDate||(t>=+since&&t<+until))}
  function filterOtherRows(rows,{since,until,tz,selectedSport,country,tier,league,term,status,page,anyDate,timedOnly}){
    const words=normalize(term).split(' ').filter(Boolean),days={},filtered=[];
    for(const row of rows){
      if(timedOnly&&!row.starts_at)continue;
      const eventDate=row.starts_at||row.date_only;
      if(!inCalendarWindow(eventDate,since,until,anyDate))continue;
      if(country&&key(row.country)!==key(country))continue;
      if(tier&&Number(row.tier)!==Number(tier))continue;
      if(league&&key(row.league)!==key(league))continue;
      const phase=['live','finished','cancelled','postponed'].includes(row.source_status)?row.source_status:
        row.score_home!==null&&row.score_away!==null?'finished':Date.parse(eventDate)<=Date.now()?'awaiting':'scheduled';
      if(status&&status!=='all'&&status!==phase)continue;
      if(!words.every(word=>normalize([row.home,row.away,row.league,row.country].join(' ')).includes(word)))continue;
      const normalized={...row,sport:selectedSport,display_status:phase};filtered.push(normalized);
      const day=row.date_only||dayAt(Date.parse(row.starts_at),tz);days[day]=(days[day]||0)+1;
    }
    filtered.sort((a,b)=>Date.parse(a.starts_at||a.date_only)-Date.parse(b.starts_at||b.date_only)||a.id.localeCompare(b.id));
    const offset=Math.max(0,Math.trunc(+page||0))*50;
    const scoped=catalog.filter(c=>key(c.sport)===key(selectedSport)&&(!country||key(c.country)===key(country))&&(!tier||Number(c.tier)===Number(tier)));
    return {sourceUrl:'',notice:'Terminarz informacyjny ze źródeł publicznych; bez kursów i bez typowania.',days,total:filtered.length,
      rows:filtered.slice(offset,offset+50),sports:[...new Set(catalog.map(x=>x.sport))],countries:[...new Set(scoped.map(x=>x.country))],
      leagues:[...new Set(scoped.map(x=>x.league))],league_catalog:scoped,unavailable:false,partial:false};
  }
  async function searchOtherSport(args){
    const {since,until,tz,selectedSport}=args,sportKey=key(selectedSport),rows=[];let providerError='';
    if(sportKey==='formula 1'||sportKey==='f1'){
      const years=new Set([since.getUTCFullYear(),until.getUTCFullYear()]);
      const schedules=await Promise.allSettled([...years].map(year=>cachedJson('jolpica-f1-'+year,`https://api.jolpi.ca/ergast/f1/${year}.json?limit=100`,3600000)));
      for(const result of schedules){if(result.status==='rejected'){providerError='Jolpica F1 chwilowo niedostępne.';continue}
        for(const race of result.value?.MRData?.RaceTable?.Races||[]){
          const add=(label,session)=>{if(!session?.date)return;const stamp=session.date+'T'+(session.time||'12:00:00Z');rows.push({id:'jolpica:'+race.round+':'+label,sport:selectedSport,country:'Świat',tier:1,league:'Formula 1',home:race.raceName,away:label,starts_at:new Date(stamp).toISOString(),source_provider:'Jolpica',betting_enabled:false,score_home:null,score_away:null})};
          add('Kwalifikacje',race.Qualifying);add('Sprint',race.Sprint);add('Wyścig',race);
        }
      }
    }else if(sportKey==='koszykowka'){
      const entries=catalog.filter(c=>key(c.sport)===sportKey&&c.provider==='espn'&&(!args.league||key(c.league)===key(args.league))&&(!args.country||key(c.country)===key(args.country)));
      const rangeStart=args.anyDate?new Date(Date.now()-180*86400000):since;
      const rangeEnd=args.anyDate?new Date(Date.now()+180*86400000):until;
      const dateRange=`${rangeStart.toISOString().slice(0,10).replaceAll('-','')}-${rangeEnd.toISOString().slice(0,10).replaceAll('-','')}`;
      const results=await Promise.allSettled(entries.map(async entry=>{
        const url=`https://site.api.espn.com/apis/site/v2/sports/${entry.code}/scoreboard?dates=${dateRange}&limit=500`;
        return {entry,json:await cachedJson('espn:'+entry.code+':'+dateRange,url,120000)};
      }));
      for(const result of results){if(result.status==='rejected'){providerError='Publiczny terminarz ESPN chwilowo niedostępny.';continue}
        const {entry,json}=result.value;
        for(const event of json.events||[]){const competition=event.competitions?.[0],home=competition?.competitors?.find(c=>c.homeAway==='home'),away=competition?.competitors?.find(c=>c.homeAway==='away');
          if(!home||!away||!event.date)continue;const ended=event.status?.type?.completed===true;
          const state=String(event.status?.type?.name||'').toLowerCase();
          const source_status=event.status?.type?.completed?'finished':/in progress|halftime|live/.test(state)?'live':/postponed/.test(state)?'postponed':/cancel/.test(state)?'cancelled':'scheduled';
          rows.push({id:'espn:'+entry.code+':'+event.id,sport:selectedSport,country:entry.country,tier:entry.tier,league:entry.league,
            home:home.team?.displayName||home.team?.name||'Gospodarze',away:away.team?.displayName||away.team?.name||'Goście',starts_at:event.date,
            source_provider:'ESPN',source_status,betting_enabled:false,score_home:ended&&home.score!=null?Number(home.score):null,score_away:ended&&away.score!=null?Number(away.score):null});
        }
      }
    }else{
      const providerSport=providerSportFor[sportKey];
      if(!providerSport)return {sourceUrl:'',notice:'Brak skonfigurowanego publicznego źródła dla tego sportu. Dodaj terminarz do SPORTIVRA przez panel ADMIN.',days:{},total:0,rows:[],sports:[...new Set(catalog.map(x=>x.sport))],countries:[],leagues:[],league_catalog:[],unavailable:true,partial:false};
      try{
        const all=await loadOtherCatalog(providerSport);
        const entries=all.filter(entry=>entry.providerLeagueId&&(!args.country||key(entry.country)===key(args.country))&&(!args.tier||Number(entry.tier)===Number(args.tier))&&(!args.league||key(entry.league)===key(args.league)));
        if(!entries.length){providerError='Wybrana liga nie występuje w publicznym katalogu dostawcy.';}
        const eventLimit=args.allMode?2:18;
        const eventResults=await Promise.allSettled(entries.slice(0,args.league?3:eventLimit).map(async entry=>{
          if(!entry.providerLeagueId)return {entry,events:[]};
          const seasonYear=since.getUTCFullYear(),season=seasonYear+'-'+(seasonYear+1);
          let events=[];
          try{const json=await cachedJson('thesportsdb-season:'+entry.providerLeagueId+':'+season,'https://www.thesportsdb.com/api/v1/json/123/eventsseason.php?id='+encodeURIComponent(entry.providerLeagueId)+'&s='+encodeURIComponent(season),600000);events=json.events||[]}catch{}
          if(!events.length){const json=await cachedJson('thesportsdb-events:'+entry.providerLeagueId,'https://www.thesportsdb.com/api/v1/json/123/eventsnextleague.php?id='+encodeURIComponent(entry.providerLeagueId),120000);events=json.events||[]}
          return {entry,events};
        }));
        for(const result of eventResults){if(result.status==='rejected'){providerError='TheSportsDB nie zwrócił danych dla części lig.';continue}
          const {entry,events}=result.value;for(const event of events){
            const kickoff=event.strTimestamp&&Number.isFinite(Date.parse(event.strTimestamp))?new Date(event.strTimestamp).toISOString():null;
            const dateOnly=!kickoff&&/^\d{4}-\d{2}-\d{2}$/.test(String(event.dateEvent||''))?event.dateEvent:null;
            if(!kickoff&&!dateOnly)continue;
            const hs=/^\d+$/.test(String(event.intHomeScore??''))?Number(event.intHomeScore):null,as=/^\d+$/.test(String(event.intAwayScore??''))?Number(event.intAwayScore):null;
            rows.push({id:'thesportsdb:'+event.idEvent,sport:selectedSport,country:entry.country,tier:entry.tier,league:entry.league,
              home:event.strHomeTeam||event.strEvent||'Wydarzenie',away:event.strAwayTeam||'',starts_at:kickoff,date_only:dateOnly,
              source_provider:'TheSportsDB',betting_enabled:false,score_home:hs,score_away:as});
          }
        }
      }catch(error){providerError='Publiczny katalog TheSportsDB jest niedostępny: '+(error?.message||String(error));}
    }
    const result=filterOtherRows(rows,args);
    result.notice=providerError?providerError+' Wyświetlam też mecze zapisane przez ADMINA.':result.notice;
    result.unavailable=!rows.length&&!!providerError;return result;
  }
  async function searchAllSports(args){
    const since=new Date(args.start),until=new Date(args.end),tz=args.tz||'UTC';
    const names=sports.filter(name=>name!==sport);
    const soccer=search({...args,sport,page:0});
    const others=names.map(selectedSport=>searchOtherSport({...args,term:args.search||'',since,until,tz,selectedSport,page:0,allMode:true}));
    const settled=await Promise.allSettled([soccer,...others]);
    const results=settled.filter(x=>x.status==='fulfilled').map(x=>x.value);
    const failures=settled.filter(x=>x.status==='rejected').map(x=>x.reason?.message||String(x.reason));
    const all=results.flatMap(x=>x.rows||[]).sort((a,b)=>Date.parse(a.starts_at||a.date_only)-Date.parse(b.starts_at||b.date_only)||String(a.id).localeCompare(String(b.id)));
    const days={};for(const result of results)for(const [day,count] of Object.entries(result.days||{}))days[day]=(days[day]||0)+Number(count||0);
    const uniqueCatalog=new Map();for(const entry of catalog)uniqueCatalog.set([key(entry.sport),key(entry.country),key(entry.league)].join('|'),entry);
    const offset=Math.max(0,Math.trunc(+args.page||0))*50;
    return {sourceUrl:'',notice:[...new Set(results.map(x=>x.notice).filter(Boolean)),...failures].join(' '),
      days,total:results.reduce((n,x)=>n+Number(x.total||0),0),rows:all.slice(offset,offset+50),
      sports,countries:[...new Set([...uniqueCatalog.values()].map(x=>x.country).filter(Boolean))],
      leagues:[...new Set([...uniqueCatalog.values()].map(x=>x.league).filter(Boolean))],
      league_catalog:[...uniqueCatalog.values()],unavailable:all.length===0&&results.every(x=>x.unavailable),partial:failures.length>0||results.some(x=>x.partial)};
  }
  async function search({start, end, tz = 'UTC', sport: selectedSport, country, tier, league, search: term = '', status = 'all', page = 0, anyDate = false, timedOnly = false}) {
    const since = new Date(start), until = new Date(end);
    if (!Number.isFinite(+since) || !Number.isFinite(+until) || until <= since || until - since > 366 * 86400000)
      throw Error('Nieprawidłowy zakres dat terminarza.');
    if (!selectedSport) return searchAllSports({start,end,tz,country,tier,league,search:term,status,page,anyDate,timedOnly});
    if (selectedSport && key(selectedSport) !== key(sport))
      return searchOtherSport({since,until,tz,selectedSport,country,tier,league,term,status,page,anyDate,timedOnly});
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
  window.SV27PublicFixtures = Object.freeze({catalog, sports, search});
})();
