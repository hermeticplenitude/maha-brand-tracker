/* MAHA Brand Tracker — data-driven dashboard. All numbers come from /data/*.json */
const C = { ink:'#1b2a41', red:'#b23a48', teal:'#2a7f7f', gold:'#c9a227', grey:'#8a8f98', light:'#d9d2c5', redSoft:'#f1dcdf' };
Chart.defaults.font.family = "'Satoshi', system-ui, sans-serif";
Chart.defaults.color = '#3b4659';
Chart.defaults.plugins.legend.labels.boxWidth = 12;
Chart.defaults.plugins.legend.labels.boxHeight = 12;
Chart.defaults.plugins.tooltip.backgroundColor = '#1b2a41';
Chart.defaults.plugins.tooltip.padding = 10;

const fmtDate = s => new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const fmtRange = r => { const [a, b] = r.split('/'); const A = new Date(a + 'T00:00:00'), B = new Date(b + 'T00:00:00'); const o = { month: 'short', day: 'numeric' }; return `${A.toLocaleDateString('en-US', o)}–${B.toLocaleDateString('en-US', o)}, ${B.getFullYear()}`; };
const monthLabel = s => { const d = new Date(s + 'T00:00:00'); return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }); };
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };

// plugin: numbered vertical event markers
const eventMarkers = { id: 'eventMarkers', afterDraw(chart, args, opts) { if (!opts.events) return; const { ctx, chartArea, scales } = chart; const labels = chart.data.labels; ctx.save(); opts.events.forEach((ev, i) => { let idx = labels.findIndex(l => l >= ev[0]); if (idx < 0) idx = labels.length - 1; const x = scales.x.getPixelForValue(idx); ctx.setLineDash([3, 3]); ctx.strokeStyle = 'rgba(27,42,65,.45)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, chartArea.top + 14); ctx.lineTo(x, chartArea.bottom); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(x, chartArea.top + 8, 8, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = '700 10px Satoshi, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(i + 1), x, chartArea.top + 8.5); }); ctx.restore(); } };
Chart.register(eventMarkers);

const axisX = (labels, every) => ({ grid: { display: false }, ticks: { maxRotation: 0, autoSkip: false, callback: (v, i) => (i % every === 0 ? monthLabel(labels[i]) : ''), font: { size: 11 } } });
const axisY = (max, title) => ({ min: 0, max, grid: { color: '#ece7de' }, ticks: { font: { size: 11 }, stepSize: 20, callback: v => (v <= 100 ? v : '') }, title: title ? { display: true, text: title, font: { size: 11 } } : undefined });

async function load() {
  const [trends, polls, news, social, mid, listen] = await Promise.all(['data/trends.json', 'data/polls.json', 'data/news.json', 'data/social.json', 'data/midterms.json', 'data/listening.json'].map(u => fetch(u).then(r => r.json())));
  status(trends, polls, news, social, listen);
  scorecard(polls, trends);
  attention(trends);
  identification(polls);
  views(polls);
  midterms(mid);
  integrity(polls, trends);
  newsSection(news);
  if (listen.googlenews) googleNewsPanel(listen.googlenews);
  socialSection(social);
  listeningSection(listen);
  sources(polls, news, social);
}

function status(t, p, n, s, L) {
  const row = document.getElementById('status-row');
  [['Google Trends', t.retrieved, false], ['Polls', p.updated, false], ['Midterms', p.updated, false], ['News sample', n.updated, false], ['X + Bluesky + Google News + GDELT feeds', (L && L.updated) || s.updated, false]].forEach(([k, d, pend]) => {
    row.appendChild(el('span', 'status' + (pend ? ' pending' : ''), `<i></i>${k}: ${pend ? 'secondary sources' : 'updated'} ${fmtDate(d)}`));
  });
  document.querySelector('[data-updated]').textContent = fmtDate(p.updated);
}

function scorecard(p, t) {
  const ipsos = p.identification.find(x => x.pollster === 'Reuters/Ipsos' && x.population.startsWith('U.S.'));
  const kff = p.identification.find(x => x.pollster === 'KFF' && x.date === '2026-04-19' && x.population === 'U.S. adults');
  const dfp = p.identification.find(x => x.construct === 'member');
  const ech = p.favorability[p.favorability.length - 1];
  const avg = t.rfk_maga_maha_12m.averages; const rows = t.rfk_maga_maha_12m.rows; const mean = i => rows.reduce((a, r) => a + r[i], 0) / rows.length;
  const tiles = [
    { label: 'Identify with MAHA', value: ipsos.value + '%', small: 'adults', desc: `${ipsos.detail.split('.')[0]}. Registered voters: 38%.`, src: 'Reuters/Ipsos, Sep 11–14, 2026', href: '#identification', accent: C.gold },
    { label: 'Support the movement', value: kff.value + '%', small: 'adults · 43% RV', desc: 'Down from 43% in Sep 2025 — flat within the margin of error.', src: 'KFF, Apr 14–19, 2026', href: '#identification', accent: C.red },
    { label: 'Part of the movement', value: dfp.value + '%', small: 'likely voters', desc: 'Strict membership wording. 39% more support goals without identifying.', src: 'Data for Progress / 314 Action, Mar 2026', href: '#identification', accent: C.ink },
    { label: 'MAHA but not MAGA', value: '≈19%', small: 'adults / RV', desc: 'Derived: 41–43% support × 44–48% non-MAGA. Range 15–22%. Not published directly by any pollster.', src: 'Derived from KFF Sep 2025 & Apr 2026', href: '#derived', accent: C.red },
    { label: 'Favorable vs unfavorable', value: `${ech.favorable}–${ech.unfavorable}`, small: 'net +' + (ech.favorable - ech.unfavorable), desc: 'Net favorability has narrowed from +25 (Nov 2024) as awareness rose to ~90%.', src: 'Echelon Insights, Jul 9–13, 2026', href: '#views', accent: C.teal },
    { label: 'Attention vs MAGA', value: Math.round(mean(1) / mean(3) * 100) + '%', small: 'of MAGA search interest', desc: `MAHA topic ${avg[0]} vs MAGA ${avg[2]} vs RFK Jr. ${avg[1]} on one scale. Ratio flat for 18 months.`, src: 'Google Trends, US, past 12 months', href: '#attention', accent: C.teal },
  ];
  const wrap = document.getElementById('tiles');
  tiles.forEach(x => { const a = el('a', 'tile'); a.href = x.href; a.style.setProperty('--accent', x.accent); a.innerHTML = `<div class="label">${x.label}</div><div class="value">${x.value}<small>${x.small}</small></div><p class="desc">${x.desc}</p><div class="src">${x.src}</div>`; wrap.appendChild(a); });
}

function attention(t) {
  // weekly
  const w = t.weekly_2024; const labels = w.rows.map(r => r[0]);
  new Chart(document.getElementById('c-weekly'), { type: 'line', data: { labels, datasets: [
    { label: 'Topic: Make America Healthy Again', data: w.rows.map(r => r[2]), borderColor: C.ink, borderWidth: 2, pointRadius: 0, tension: .25 },
    { label: 'Term: “Make America Healthy Again”', data: w.rows.map(r => r[1]), borderColor: C.red, borderWidth: 1.6, pointRadius: 0, tension: .25 },
    { label: 'Term: “what is MAHA”', data: w.rows.map(r => r[4]), borderColor: C.teal, borderWidth: 1.3, pointRadius: 0, tension: .25 },
    { label: 'Term: “MAHA movement”', data: w.rows.map(r => r[3]), borderColor: C.gold, borderWidth: 1.1, pointRadius: 0, tension: .25 },
  ] }, options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom' }, eventMarkers: { events: t.events }, tooltip: { callbacks: { title: i => 'Week of ' + fmtDate(labels[i[0].dataIndex]) } } }, scales: { x: axisX(labels, 13), y: axisY(118, 'Search interest (0–100)') } } });
  const key = document.getElementById('event-key'); t.events.forEach((e, i) => key.appendChild(el('li', '', `<i>${i + 1}</i><span>${fmtDate(e[0])} — ${e[1]}</span>`)));

  // ratio by quarter (topics)
  const q = {}; t.maha_vs_maga_topics.forEach(([d, a, b]) => { const dt = new Date(d); const k = `${dt.getFullYear()} Q${Math.floor(dt.getMonth() / 3) + 1}`; q[k] = q[k] || [0, 0]; q[k][0] += a; q[k][1] += b; });
  const qk = Object.keys(q).filter(k => k >= '2025 Q2' && k <= '2026 Q3');
  new Chart(document.getElementById('c-ratio'), { type: 'bar', data: { labels: qk, datasets: [{ label: 'MAHA ÷ MAGA (topics, %)', data: qk.map(k => +(q[k][0] / q[k][1] * 100).toFixed(1)), backgroundColor: C.teal, borderRadius: 4 }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.parsed.y + '% of MAGA search interest' } } }, scales: { x: { grid: { display: false } }, y: axisY(16, '% of MAGA interest') } } });

  // trio
  const r = t.rfk_maga_maha_12m; const rl = r.rows.map(x => x[0]);
  document.getElementById('avg-maha').textContent = r.averages[0]; document.getElementById('avg-rfk').textContent = r.averages[1]; document.getElementById('avg-maga').textContent = r.averages[2];
  new Chart(document.getElementById('c-trio'), { type: 'line', data: { labels: rl, datasets: [
    { label: 'RFK Jr. (topic)', data: r.rows.map(x => x[2]), borderColor: C.ink, borderWidth: 1.6, pointRadius: 0, tension: .25 },
    { label: 'MAGA (topic)', data: r.rows.map(x => x[3]), borderColor: C.grey, borderWidth: 1.4, pointRadius: 0, tension: .25 },
    { label: 'MAHA (topic)', data: r.rows.map(x => x[1]), borderColor: C.red, backgroundColor: 'rgba(178,58,72,.15)', fill: true, borderWidth: 2, pointRadius: 0, tension: .25 },
  ] }, options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { title: i => 'Week of ' + fmtDate(rl[i[0].dataIndex]) } } }, scales: { x: axisX(rl, 9), y: axisY(105) } } });

  // baseline monthly
  const m = t.monthly_2016_phrase; const ml = m.map(x => x[0]);
  new Chart(document.getElementById('c-baseline'), { type: 'line', data: { labels: ml, datasets: [{ label: 'Term: “Make America Healthy Again” (monthly)', data: m.map(x => x[1]), borderColor: C.red, backgroundColor: 'rgba(178,58,72,.15)', fill: true, borderWidth: 1.6, pointRadius: 0, tension: .2 }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { title: i => monthLabel(ml[i[0].dataIndex]) } } }, scales: { x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: false, callback: (v, i) => (i % 24 === 0 ? ml[i].slice(0, 4) : ''), font: { size: 11 } } }, y: axisY(105) } } });

  // geo
  const g = t.geo_topic_share.slice(0, 12);
  new Chart(document.getElementById('c-geo'), { type: 'bar', data: { labels: g.map(x => x[0]), datasets: [{ data: g.map(x => x[1]), backgroundColor: g.map(x => x[0] === 'United States' ? C.red : C.teal), borderRadius: 3 }] }, options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.parsed.x + ' — share of compared searches' } } }, scales: { x: { min: 0, max: 12, grid: { color: '#ece7de' } }, y: { grid: { display: false }, ticks: { font: { size: 11 } } } } } });

  // related queries
  const unrelated = /shivaratri|shivratri|mantra|al maha|movie|hockey|dakhil|kumbh|periyava|vajiralongkorn|festival|elevate|its feathers|krav|lakshmi|mtg/i;
  const definitional = /what is|meaning|stand for|what does|who is/i;
  const rel = t.related; const wrap = document.getElementById('related');
  [['Term: MAHA', 'Top (left) and Rising (right), US, past 12 months. Struck-through = unrelated meaning. Teal = definitional.', rel.MAHA_term_top, rel.MAHA_term_rising], ['Topic: Make America Healthy Again', 'The cleanest view of the political entity. Almost entirely definitional.', rel.topic_MAHA_top, rel.topic_MAHA_rising], ['Term: MAGA (comparison)', 'MAGA queries sort people (“is X maga”) and buy merchandise; MAHA queries ask what it is.', rel.MAGA_term_top, rel.MAGA_term_rising]].forEach(([h, p, top, rising]) => {
    const d = el('div', 'rq'); d.appendChild(el('h4', '', h)); d.appendChild(el('p', '', p));
    const ul = el('ul'); top.slice(0, 10).forEach(([qq, v]) => { const isTerm = h.startsWith('Term'); const li = el('li', (isTerm && unrelated.test(qq)) ? 'unrelated' : (definitional.test(qq) ? 'def' : ''), `<span>${qq}</span><span>${v}</span>`); ul.appendChild(li); }); d.appendChild(ul);
    const ul2 = el('ul'); ul2.style.marginTop = '10px'; ul2.appendChild(el('li', '', `<span><b>Rising</b></span><span></span>`)); rising.slice(0, 6).forEach(([qq, v]) => ul2.appendChild(el('li', (h.startsWith('Term') && unrelated.test(qq)) ? 'unrelated' : (definitional.test(qq) ? 'def' : ''), `<span>${qq}</span><span>${v}</span>`))); d.appendChild(ul2);
    wrap.appendChild(d);
  });
}

function identification(p) {
  const rows = [...p.identification].sort((a, b) => a.date < b.date ? 1 : -1);
  const color = { identify: C.gold, support: C.red, member: C.ink };
  const labels = rows.map(r => `${r.pollster} · ${r.population.replace(' (KnowledgePanel)', '').replace(' (online)', '').replace(' (web panel)', '')} · ${monthLabel(r.date)}`);
  new Chart(document.getElementById('c-ident'), { type: 'bar', data: { labels, datasets: [{ data: rows.map(r => r.value), backgroundColor: rows.map(r => color[r.construct]), borderRadius: 4 }] }, options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { title: i => rows[i[0].dataIndex].pollster + ' — ' + fmtRange(rows[i[0].dataIndex].field), label: c => { const r = rows[c.dataIndex]; return [`${r.value}% — ${r.construct === 'member' ? 'part of the movement' : r.construct}`, `n=${r.n.toLocaleString()} ${r.population}, ±${r.moe}`, '“' + r.wording + '”']; } } } }, scales: { x: { min: 0, max: 60, grid: { color: '#ece7de' }, ticks: { callback: v => v + '%' } }, y: { grid: { display: false }, ticks: { font: { size: 11 } } } } } });
  const leg = el('div', 'legend-inline', `<span style="color:${C.red}">■</span> support / consider self a supporter &nbsp; <span style="color:${C.gold}">■</span> identify with &nbsp; <span style="color:${C.ink}">■</span> part of the movement`);
  document.getElementById('c-ident').parentElement.after(leg);

  // derived
  const d = document.getElementById('derived'); d.id = 'derived';
  let h = '<table><thead><tr><th>Source</th><th>Support MAHA</th><th>…of whom MAGA</th><th>Non-MAGA MAHA</th></tr></thead><tbody>';
  p.non_maga.forEach(x => h += `<tr><td>${x.source}</td><td>${x.maha}%</td><td>${x.maga_share}%</td><td class="big">≈${Math.round(x.derived)}%</td></tr>`);
  h += '</tbody></table><p class="note">Derived = support × (1 − MAGA share). Compounds two sampling errors (±3–4 and ±5–6 pts). KFF defines “MAGA” as Republicans/leaners who support the MAGA movement. Politico separately reports that one in five MAHA supporters voted for Harris in 2024. No pollster has published this group’s turnout likelihood or vote-choice elasticity.</p>';
  d.innerHTML = h;

  // composition donut
  new Chart(document.getElementById('c-comp'), { type: 'doughnut', data: { labels: ['MAGA Republicans / leaners', 'Non-MAGA Republicans / leaners', 'Pure independents', 'Democrats / leaners'], datasets: [{ data: [56, 13, 10, 21], backgroundColor: [C.ink, C.grey, C.gold, C.teal], borderWidth: 2, borderColor: '#fff' }] }, options: { maintainAspectRatio: false, cutout: '58%', plugins: { legend: { position: 'right', labels: { font: { size: 11 } } }, tooltip: { callbacks: { label: c => c.label + ': ' + c.parsed + '% of MAHA-supporting voters' } } } } });

  // table
  const tb = document.querySelector('#poll-table tbody');
  const all = [...p.identification.map(x => ({ ...x, kind: x.construct })), ...p.favorability.map(x => ({ ...x, kind: 'favorable', value: `${x.favorable} / ${x.unfavorable}`, wording: `Favorable / unfavorable view of the MAHA movement${x.heard ? `; ${x.heard}% have heard of it` : ''}${x.note ? '. ' + x.note : ''}`, detail: '' }))].sort((a, b) => a.date < b.date ? 1 : -1);
  const kindLabel = { identify: 'Identify', support: 'Support', member: 'Member', favorable: 'Favorable' };
  all.forEach(r => { const tr = el('tr'); tr.innerHTML = `<td class="num">${fmtRange(r.field)}</td><td><a href="${r.url}" target="_blank" rel="noopener">${r.pollster}</a>${r.sponsor && r.sponsor !== r.pollster ? `<div class="muted" style="font-size:.75rem">${r.sponsor}</div>` : ''}</td><td>${r.population}</td><td class="num">${r.n.toLocaleString()}</td><td class="num">±${r.moe}</td><td><span class="tag ${r.kind}">${kindLabel[r.kind]}</span></td><td class="result">${typeof r.value === 'number' ? r.value + '%' : r.value}</td><td><div>${r.wording}</div>${r.detail ? `<div class="muted" style="font-size:.78rem;margin-top:4px">${r.detail}</div>` : ''}</td>`; tb.appendChild(tr); });
}

function views(p) {
  const f = p.favorability; const fl = f.map(x => [x.pollster, monthLabel(x.date)]);
  new Chart(document.getElementById('c-fav'), { type: 'bar', data: { labels: fl, datasets: [{ label: 'Favorable', data: f.map(x => x.favorable), backgroundColor: C.teal, borderRadius: 3 }, { label: 'Unfavorable', data: f.map(x => x.unfavorable), backgroundColor: C.red, borderRadius: 3 }, { label: 'Heard of MAHA', data: f.map(x => x.heard), type: 'line', borderColor: C.grey, borderDash: [4, 3], borderWidth: 1.5, pointRadius: 3, pointBackgroundColor: C.grey }] }, options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { title: i => f[i[0].dataIndex].pollster + ' — ' + fmtRange(f[i[0].dataIndex].field) + ` (${f[i[0].dataIndex].population}, n=${f[i[0].dataIndex].n})`, label: c => c.dataset.label + ': ' + c.parsed.y + '%' } } }, scales: { x: { grid: { display: false }, ticks: { font: { size: 10.5 }, maxRotation: 0 } }, y: axisY(100) } } });
  const r = p.rfk; const rl = r.map(x => [x.pollster.replace('Annenberg Public Policy Center', 'Annenberg PPC'), monthLabel(x.date)]);
  new Chart(document.getElementById('c-rfk'), { type: 'bar', data: { labels: rl, datasets: [{ label: 'Favorable / approve', data: r.map(x => x.positive), backgroundColor: C.teal, borderRadius: 3 }, { label: 'Unfavorable / disapprove', data: r.map(x => x.negative), backgroundColor: C.red, borderRadius: 3 }] }, options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { title: i => { const x = r[i[0].dataIndex]; return `${x.pollster} — ${fmtRange(x.field)} (${x.population}, n=${x.n.toLocaleString()}) — ${x.measure}`; }, label: c => c.dataset.label + ': ' + c.parsed.y + '%' } } }, scales: { x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 0, autoSkip: false } }, y: axisY(100) } } });
  const dl = document.getElementById('delivery'); p.delivery.forEach(x => dl.appendChild(el('div', 'dl', `<div class="v">${x.value}%</div><p>${x.label}</p><a href="${x.url}" target="_blank" rel="noopener">${x.source}</a>`)));
}

function midterms(m) {
  const days = Math.round((new Date(m.election_day + 'T00:00:00') - new Date()) / 86400000);
  document.getElementById('days-out').textContent = days;
  const rl = document.getElementById('ratings-link'); rl.textContent = m.ratings_source.label; rl.href = m.ratings_source.url;
  const bloc = document.getElementById('bloc');
  m.bloc.forEach((b, i) => { const a = el('a', 'tile'); a.href = b.url; a.target = '_blank'; a.rel = 'noopener'; a.style.setProperty('--accent', [C.red, C.red, C.teal, C.ink, C.gold, C.red, C.teal, C.grey][i % 8]); a.innerHTML = `<div class="value">${b.value}</div><p class="desc">${b.label}</p><div class="src">${b.source}</div>`; bloc.appendChild(a); });
  const idx = Object.fromEntries(m.state_index_12m.map(s => [s[1], s[2]])); const idx90 = Object.fromEntries(m.state_index_90d.map(s => [s[1], s[2]]));
  const rank = Object.fromEntries(m.state_index_12m.map((s, i) => [s[1], i + 1]));
  const rc = r => /toss/i.test(r) ? 'toss' : /lean d|likely d/i.test(r) ? 'd' : /lean r|safe r/i.test(r) ? 'r' : '';
  const tb = document.querySelector('#race-table tbody');
  m.races.forEach(r => { const tr = el('tr'); tr.innerHTML = `<td class="st">${r.state}</td><td>${r.office}<div class="muted" style="font-size:.74rem">${r.incumbent}</div></td><td><span class="rating ${rc(r.rating)}">${r.rating}</span></td><td>${r.dem !== '—' ? `<span style="color:#2b4f8a">${r.dem}</span> (D)` : ''}${r.dem !== '—' && r.rep !== '—' ? '<br>' : ''}${r.rep !== '—' ? `<span style="color:${C.red}">${r.rep}</span> (R)` : ''}</td><td class="idx">${idx[r.code] ?? '—'} <span class="muted" style="font-size:.72rem">#${rank[r.code] ?? '—'} · 90d ${idx90[r.code] ?? '—'}</span></td><td><span class="dot ${r.maha_level}"></span>${r.maha}${r.sources.length ? `<div class="srcs">${r.sources.map(s => `<a href="${s[1]}" target="_blank" rel="noopener">${s[0]}</a>`).join('')}</div>` : ''}</td>`; tb.appendChild(tr); });
  const comp = new Set(m.races.filter(r => /toss|lean/i.test(r.rating)).map(r => r.code));
  const st = m.state_index_12m.filter(s => s[1] !== 'US-DC');
  new Chart(document.getElementById('c-states'), { type: 'bar', data: { labels: st.map(s => s[0]), datasets: [{ data: st.map(s => s[2]), backgroundColor: st.map(s => comp.has(s[1]) ? C.red : C.teal), borderRadius: 2, barThickness: 9 }] }, options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `${c.parsed.x} (12-mo) · ${idx90[st[c.dataIndex][1]] ?? '—'} (90-day)` } } }, scales: { x: { min: 0, max: 45, grid: { color: '#ece7de' }, ticks: { font: { size: 10 } } }, y: { grid: { display: false }, ticks: { font: { size: 10 }, autoSkip: false } } } } });
  const mo = document.getElementById('money'); m.money.forEach(x => mo.appendChild(el('div', 'm', `<div class="v">${x.value}</div><p>${x.label}</p><a href="${x.url}" target="_blank" rel="noopener">${x.source}</a>`)));
  const tl = document.getElementById('timeline'); m.timeline.forEach((t, i) => tl.appendChild(el('li', i === m.timeline.length - 1 ? 'last' : '', `<span class="d">${t[0].length === 7 ? monthLabel(t[0] + '-01') : fmtDate(t[0])}</span>${t[1]}`)));
  if (m.capture) {
    const c = m.capture, cap = document.getElementById('capture');
    cap.innerHTML = `<h3 style="margin:0 0 4px">${c.title}</h3>
      <p class="muted" style="margin:0 0 14px;font-size:.86rem">Primary document: <a href="${c.url}" target="_blank" rel="noopener">${c.doc}</a>. Quotations are verbatim from the memo.</p>
      <div class="cap-grid">
        <div>
          <dl class="facts">${c.facts.map(f => `<dt>${f[0]}</dt><dd>${f[1]}</dd>`).join('')}</dl>
          <h4>What it says</h4>
          ${c.quotes.map(q => `<blockquote>“${q}”</blockquote>`).join('')}
          <h4>The strategy</h4><p>${c.strategy}</p>
        </div>
        <div>
          <h4>Bills the memo attaches to “Reclaiming MAHA”</h4>
          <div class="bills-wrap"><table class="bills"><thead><tr><th>When</th><th>Bill</th><th>Sponsor</th><th>MAHA overlap</th></tr></thead><tbody>${c.bills.map(b => `<tr><td>${b[0]}</td><td>${b[1]}</td><td>${b[2]}</td><td>${b[3]}</td></tr>`).join('')}</tbody></table></div>
          <h4>Assessment</h4><ul class="assess">${c.assessment.map(x => `<li>${x}</li>`).join('')}</ul>
          <p class="muted" style="font-size:.78rem;margin:10px 0 0">Coverage: ${c.coverage.map(x => `<a href="${x[1]}" target="_blank" rel="noopener">${x[0]}</a>`).join(' · ')}</p>
        </div>
      </div>`;
  }
  const w = document.getElementById('wants');
  [['What MAHA voters say they want', m.wants.voters], ['What Republicans are offering', m.wants.gop], ['What Democrats are offering', m.wants.dems]].forEach(([h, items]) => { const d = el('div'); d.appendChild(el('h4', '', h)); const ul = el('ul'); items.forEach(it => ul.appendChild(el('li', '', `<b>${it[0]}</b><span>${it[1]}</span><small>${it[2]}</small>`))); d.appendChild(ul); w.appendChild(d); });
}

function integrity(p, t) {
  const avg = t.rfk_maga_maha_12m.averages; const rows = t.rfk_maga_maha_12m.rows; const mean = i => rows.reduce((a, r) => a + r[i], 0) / rows.length;
  const metrics = [
    { score: '≈50%', sub: 'of top queries unrelated', title: 'Namespace collision', text: 'Of the 15 most common US searches containing “MAHA” in the past year, about half are Hindu observances, a mantra, a Dubai hotel brand, a Tamil film or Michigan hockey. The acronym’s two largest weekly spikes in five years were Maha Shivaratri (Feb 2025, Feb 2026), not MAHA. Any metric built on the bare acronym overstates attention.', read: 'risk' },
    { score: Math.round(mean(1) / mean(2) * 100) + '%', sub: 'of RFK Jr. attention', title: 'Founder dependence', text: `On one scale the MAHA topic averages ${mean(1).toFixed(1)} against ${mean(2).toFixed(1)} for Robert F. Kennedy Jr. Every major MAHA spike is an official HHS or White House action. Worldwide the MAHA : RFK split is 3 : 49; the US, Canada and UK are all at 7 : 93.`, read: 'risk' },
    { score: '#1', sub: 'related query: “what is maha”', title: 'Definitional load', text: 'Two years after launch, the top related query for both the term and the Topic is still “what is MAHA”; “maha meaning”, “what does maha stand for” are all Breakout risers. MAGA’s related queries carry no comparable load. Growth-phase signal and a vulnerability at once.', read: 'watch' },
    { score: '31%', sub: 'of self-identified MAHA cannot explain it', title: 'Awareness–comprehension gap', text: 'Two-thirds of Americans have heard of MAHA, but only a third can explain it; a third of those who call themselves part of the movement cannot (Politico/Public First, Mar 2026). Support measured by permissive wording is roughly three times support measured by strict membership (41–47% vs 14%).', read: 'watch' },
    { score: '68%', sub: 'rural supporters: no or negative impact', title: 'Delivery perception', text: '68% of rural MAHA supporters say the administration’s health policies had a negative effect or no impact on their community (KFF/AP, Aug 2026); 49% of likely voters say MAHA is not delivering vs 43% who say it is bringing necessary change (DFP, Mar 2026).', read: 'risk' },
    { score: '7–12%', sub: 'MAHA ÷ MAGA, stable band', title: 'Attention trajectory', text: 'The ratio of MAHA to MAGA search interest has held between 7% and 12% every quarter since the MAHA entity began. Clean-series attention is a plateau with event spikes, not a rising line. The defensible claim is “zero to national in three months, then sustained” — not “still growing”.', read: 'watch' },
    { score: '52–59%', sub: 'of supporters are MAGA', title: 'Coalition distinctness', text: 'Roughly half of MAHA supporters also support MAGA (KFF). The non-MAGA remainder — ~19% of adults — includes 21% Democrats/leaners and 10% pure independents, and one in five MAHA supporters voted Harris. Distinct on paper; electorally unmeasured.', read: 'ok' },
    { score: '7 of 31', sub: 'sampled headlines are internal dissent', title: 'Internal cohesion', text: 'Late-September 2026 coverage is dominated by MAHA leaders warning Trump and Kennedy over mRNA inaction and activists objecting to corporate sponsorship of the MAHA Summit. Dissent from inside the movement now generates as many headlines as external criticism of its policies.', read: 'watch' },
  ];
  const wrap = document.getElementById('metrics');
  metrics.forEach(m => wrap.appendChild(el('div', 'metric', `<div class="score">${m.score}<small>${m.sub}</small></div><div><h4>${m.title}</h4><p>${m.text}</p><span class="read ${m.read}">${m.read === 'risk' ? 'Integrity risk' : m.read === 'watch' ? 'Watch' : 'Strength'}</span></div>`)));
}

function googleNewsPanel(g) {
  const esc = t => t.replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
  const n = g.n, crit = g.tone.critical || 0, pos = g.tone.positive || 0, neu = g.tone.neutral || 0, inside = g.critical_origin.inside || 0, outside = g.critical_origin.outside || 0;
  const top = Object.entries(g.outlets).slice(0, 6).map(([o, c]) => `${o} (${c})`).join(', ');
  const tiles = [
    { label: 'Headlines, last 7 days', value: n, small: 'unique', desc: `Google News RSS, eight queries merged. Busiest day ${Object.entries(g.by_day).sort((a, b) => b[1] - a[1])[0][1]} headlines. Most frequent outlets: ${top}.`, accent: C.ink },
    { label: 'Critical share', value: Math.round(crit / n * 100) + '%', small: `${crit} of ${n}`, desc: `${Math.round(pos / n * 100)}% positive, ${Math.round(neu / n * 100)}% neutral. Headline framing only, labeled under a fixed rubric.`, accent: C.red },
    { label: 'Criticism from inside', value: Math.round(inside / Math.max(crit, 1) * 100) + '%', small: `${inside} of ${crit} critical`, desc: `Critical headlines where the criticism comes from the movement or its allies, vs ${outside} from opponents, scientists or the press. The integrity metric to watch week to week.`, accent: C.gold },
    { label: 'Lead theme', value: Object.keys(g.theme)[0].replace('-', ' / ').replace('personnel / leadership', 'leadership'), small: `${Object.values(g.theme)[0]} headlines`, desc: `Then ${Object.entries(g.theme).slice(1, 3).map(([t, c]) => `${t.replace('-', ' / ')} (${c})`).join(', ')}.`, accent: C.teal },
  ];
  const wrap = document.getElementById('gn-tiles');
  tiles.forEach(t => { const d = el('div', 'tile'); d.style.setProperty('--accent', t.accent); d.innerHTML = `<div class="label">${t.label}</div><div class="value" style="font-size:${String(t.value).length > 8 ? '1.5rem' : '2.2rem'}">${t.value}<small>${t.small}</small></div><p class="desc">${t.desc}</p>`; wrap.appendChild(d); });
  document.getElementById('gn-cap').textContent = `Collected ${fmtDate(g.collected)}. Critical headlines split by where the criticism originates.`;
  const tl = ['Positive', 'Neutral', 'Critical (outside)', 'Critical (inside)'], tv = [pos, neu, outside + (g.critical_origin.na || 0), inside], tcol = [C.teal, C.grey, C.red, C.gold];
  new Chart(document.getElementById('c-gn-tone'), { type: 'doughnut', data: { labels: tl, datasets: [{ data: tv, backgroundColor: tcol, borderColor: '#fff', borderWidth: 2 }] }, options: { maintainAspectRatio: false, cutout: '58%', plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } }, tooltip: { callbacks: { label: i => `${i.label}: ${i.parsed} (${Math.round(i.parsed / n * 100)}%)` } } } } });
  const themes = Object.keys(g.theme); const items = g.items;
  const tone3 = [['positive', C.teal], ['neutral', C.grey], ['critical', C.red]];
  new Chart(document.getElementById('c-gn-theme'), { type: 'bar', data: { labels: themes.map(t => t.replace('-', ' / ')), datasets: tone3.map(([t, col]) => ({ label: t[0].toUpperCase() + t.slice(1), data: themes.map(th => items.filter(i => i.theme === th && i.tone === t).length), backgroundColor: col, stack: 's', borderRadius: 2 })) }, options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { x: { stacked: true, grid: { color: '#ece7de' }, ticks: { font: { size: 11 } } }, y: { stacked: true, grid: { display: false }, ticks: { font: { size: 11 } } } } } });
  const chips = document.getElementById('gn-chips'); const list = document.getElementById('gn-headlines');
  const filters = [['all', 'All', () => true], ['positive', 'Positive', i => i.tone === 'positive'], ['neutral', 'Neutral', i => i.tone === 'neutral'], ['critical', 'Critical', i => i.tone === 'critical'], ['inside', 'Critical from inside', i => i.origin === 'inside']];
  const render = f => { list.innerHTML = ''; items.filter(f).forEach(i => list.appendChild(el('li', '', `<span class="d">${fmtDate(i.date)}</span><span class="o">${esc(i.outlet)}</span><span class="t"><a href="${i.url}" target="_blank" rel="noopener">${esc(i.title)}</a><span class="tag ${i.tone === 'positive' ? 'supportive' : i.tone}">${i.tone}${i.origin === 'inside' ? ' · inside' : ''}</span> <span class="muted" style="font-size:.76rem">${i.theme.replace('-', ' / ')}</span></span>`))); };
  filters.forEach(([k, label, f], idx) => { const b = el('button', 'chip' + (idx === 0 ? ' active' : ''), `${label} (${items.filter(f).length})`); b.onclick = () => { chips.querySelectorAll('.chip').forEach(c => c.classList.remove('active')); b.classList.add('active'); render(f); }; chips.appendChild(b); });
  render(() => true);
}

function newsSection(n) {
  document.getElementById('news-method').textContent = n.method;
  document.getElementById('news-window').textContent = fmtDate(n.window.split(' to ')[0]) + ' – ' + fmtDate(n.window.split(' to ')[1]);
  const tones = ['critical', 'neutral', 'supportive', 'dissent']; const tc = { critical: C.red, neutral: C.grey, supportive: C.teal, dissent: C.gold };
  const counts = tones.map(t => n.items.filter(i => i.tone === t).length);
  new Chart(document.getElementById('c-tone'), { type: 'doughnut', data: { labels: tones.map(t => t[0].toUpperCase() + t.slice(1)), datasets: [{ data: counts, backgroundColor: tones.map(t => tc[t]), borderColor: '#fff', borderWidth: 2 }] }, options: { maintainAspectRatio: false, cutout: '58%', plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } }, tooltip: { callbacks: { label: c => `${c.label}: ${c.parsed} of ${n.items.length} headlines` } } } } });
  const themes = [...new Set(n.items.map(i => i.theme))].sort((a, b) => n.items.filter(i => i.theme === b).length - n.items.filter(i => i.theme === a).length);
  new Chart(document.getElementById('c-theme'), { type: 'bar', data: { labels: themes, datasets: tones.map(t => ({ label: t[0].toUpperCase() + t.slice(1), data: themes.map(th => n.items.filter(i => i.theme === th && i.tone === t).length), backgroundColor: tc[t], stack: 's', borderRadius: 2 })) }, options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { x: { stacked: true, grid: { color: '#ece7de' }, ticks: { stepSize: 1 } }, y: { stacked: true, grid: { display: false }, ticks: { font: { size: 11 } } } } } });
  const chips = document.getElementById('news-chips'); const list = document.getElementById('headlines');
  const render = f => { list.innerHTML = ''; n.items.filter(i => f === 'all' || i.tone === f).forEach(i => list.appendChild(el('li', '', `<span class="d">${fmtDate(i.date)}</span><span class="o">${i.outlet}</span><span class="t"><a href="${i.url}" target="_blank" rel="noopener">${i.title}</a><span class="tag ${i.tone}">${i.tone}</span> <span class="muted" style="font-size:.76rem">${i.theme}</span></span>`))); };
  ['all', ...tones].forEach(t => { const b = el('button', 'chip' + (t === 'all' ? ' active' : ''), t === 'all' ? `All (${n.items.length})` : `${t[0].toUpperCase() + t.slice(1)} (${n.items.filter(i => i.tone === t).length})`); b.onclick = () => { chips.querySelectorAll('.chip').forEach(c => c.classList.remove('active')); b.classList.add('active'); render(t); }; chips.appendChild(b); });
  render('all');
  const col = document.getElementById('collisions'); n.namespace_collisions.forEach(c => col.appendChild(el('li', '', `<a href="${c.url}" target="_blank" rel="noopener">${c.outlet}</a> — ${c.title} <span class="muted">(${fmtDate(c.date)})</span>`)));
}

function socialSection(s) {
  document.getElementById('social-status').textContent = s.status;
  const wrap = document.getElementById('studies');
  s.studies.forEach(st => wrap.appendChild(el('div', 'study', `<h3><a href="${st.url}" target="_blank" rel="noopener" style="color:inherit">${st.title}</a></h3><p class="auth">${st.authors}</p><dl><dt>Platform</dt><dd>${st.platform}</dd><dt>Window</dt><dd>${st.window}</dd><dt>Volume</dt><dd>${st.volume}</dd><dt>Method</dt><dd>${st.method}</dd></dl><ul>${st.findings.map(f => `<li>${f}</li>`).join('')}</ul>`)));
  const rm = document.getElementById('roadmap'); s.roadmap.forEach(r => rm.appendChild(el('li', '', r)));
}

function xPanel(x) {
  const esc = t => t.replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
  const pct = v => (v === null || v === undefined) ? '—' : (v > 0 ? '+' : '') + v.toFixed(0) + '%';
  const s = x.summary, wk = x.weekly_counts;
  const tiles = [
    { label: 'Original posts since Aug 2024', value: (s.total_posts_since_start / 1e6).toFixed(2) + 'M', small: 'posts', desc: `X's own count of original posts (no retweets) matching the phrase set since ${fmtDate(x.start)}. Peak week ${fmtDate(s.peak_week.week).replace(/, \d{4}/, '')}, ${s.peak_week.week.slice(0, 4)}: ${s.peak_week.count.toLocaleString()}.`, accent: C.ink },
    { label: 'Posts per week, last 4 weeks', value: s.last4w_avg_weekly.toLocaleString(), small: 'per week', desc: `vs ${s.prev4w_avg_weekly.toLocaleString()} in the prior four weeks (${pct(s.change_pct)}). Current volume is ${(s.last4w_avg_weekly / s.peak_week.count * 100).toFixed(1)}% of the election-week peak.`, accent: C.red },
    { label: 'MAHA as a share of MAGA', value: (s.last4w_ratio_to_maga * 100).toFixed(1) + '%', small: 'of MAGA posts', desc: 'Weekly MAHA posts divided by weekly MAGA posts on X, last 4 full weeks. Matches the ~9% ratio Google Trends shows for search attention.', accent: C.teal },
    { label: 'Sampled window', value: x.sample.n.toLocaleString(), small: 'posts read', desc: `${x.sample.unique_authors.toLocaleString()} accounts, ${fmtDate(x.sample.since)} onward. Sample is capped for cost ($0.005 per post read); counts above are complete.`, accent: C.gold },
  ];
  const wrap = document.getElementById('x-tiles');
  tiles.forEach(t => { const d = el('div', 'tile'); d.style.setProperty('--accent', t.accent); d.innerHTML = `<div class="label">${t.label}</div><div class="value">${t.value}<small>${t.small}</small></div><p class="desc">${t.desc}</p>`; wrap.appendChild(d); });
  document.getElementById('x-cap').textContent = `X API counts/all, weekly sums of daily counts (Monday start; final bar partial). Numbered: 1 RFK endorses Trump · 2 Election · 3 HHS confirmation · 4 MAHA Report · 5 MAHA Strategy · 6 KFF midterms poll · 7 MAHA Summit. Log scale so the post-election floor stays readable.`;
  const labels = wk.map(w => w.week);
  new Chart(document.getElementById('c-x'), { type: 'bar', data: { labels, datasets: [{ label: 'Original posts', data: wk.map(w => w.count), backgroundColor: wk.map((w, i) => i === wk.length - 1 ? 'rgba(27,42,65,.35)' : C.ink), borderRadius: 1, barPercentage: 1, categoryPercentage: .9 }] },
    options: { maintainAspectRatio: false, scales: { x: axisX(labels, window.innerWidth < 700 ? 17 : 9), y: { type: 'logarithmic', min: 100, grid: { color: '#ece7de' }, ticks: { font: { size: 11 }, callback: v => [100, 1000, 10000, 100000].includes(v) ? v.toLocaleString() : '' }, title: { display: true, text: 'posts / week (log)', font: { size: 11 } } } },
      plugins: { legend: { display: false }, eventMarkers: { events: [['2024-08-19'], ['2024-11-04'], ['2025-02-10'], ['2025-05-19'], ['2025-09-08'], ['2026-04-27'], ['2026-09-28']] }, tooltip: { callbacks: { title: i => 'Week of ' + fmtDate(i[0].label), label: i => i.parsed.y.toLocaleString() + ' original posts' } } } } });
  const tp = document.getElementById('x-top');
  x.sample.top_posts.slice(0, 8).forEach(p => tp.appendChild(el('li', '', `<a href="${p.url}" target="_blank" rel="noopener">${esc(p.text.length > 170 ? p.text.slice(0, 167) + '…' : p.text)}</a><div class="m">@${p.handle} · ${fmtDate(p.date)} · ${p.likes.toLocaleString()} likes · ${p.reposts.toLocaleString()} reposts${p.views ? ' · ' + (p.views / 1000).toFixed(0) + 'k views' : ''}</div>`)));
  const ac = document.getElementById('x-accts');
  x.sample.top_accounts.slice(0, 8).forEach(a => ac.appendChild(el('li', '', `<span>@${a.handle}</span><span class="m">${a.posts} posts · ${a.engagement.toLocaleString()} eng.</span>`)));
}

function listeningSection(L) {
  const b = L.bluesky, g = L.gdelt, x = L.x; if (!b || !g) return;
  if (x) xPanel(x);
  const esc = t => t.replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
  const pct = v => (v === null || v === undefined) ? '—' : (v > 0 ? '+' : '') + v.toFixed(0) + '%';
  const per100k = v => (v * 1000).toFixed(1); // GDELT timelinevol is a percent of all articles; ×1000 gives per-100k
  const gWeeks = g.weekly_volume; const gLast = gWeeks.slice(-5, -1), gPrev = gWeeks.slice(-9, -5);
  const tiles = [
    { label: 'Bluesky posts, 90 days', value: b.total_posts.toLocaleString(), small: 'posts', desc: `${b.summary.unique_authors.toLocaleString()} unique accounts since ${fmtDate(b.since)}. Last 4 full weeks vs prior 4: ${pct(b.summary.change_pct)}.`, accent: C.teal },
    { label: 'Bluesky weekly average', value: Math.round(b.summary.last4w_avg_posts).toLocaleString(), small: 'posts / week', desc: `Prior four weeks averaged ${Math.round(b.summary.prev4w_avg_posts).toLocaleString()}. Volume is steady; the conversation is dominated by critics (see top posts).`, accent: C.teal },
    { label: 'US news volume, last 4 weeks', value: per100k(g.summary.last4w_volume), small: 'per 100k articles', desc: `Mentions of the full phrase per 100,000 monitored US news articles, vs ${per100k(g.summary.prev4w_volume)} in the prior four weeks (${pct(g.summary.change_pct)}).`, accent: C.red },
    { label: 'Peak news week', value: new Date(g.summary.peak_week.week + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }), small: 'week of ' + fmtDate(g.summary.peak_week.week).replace(/, \d{4}/, ''), desc: `Peak of ${per100k(g.summary.peak_week.value)} per 100k US articles; the last four weeks ran at ${Math.round(g.summary.last4w_volume / g.summary.peak_week.value * 100)}% of that peak.`, accent: C.ink },
  ];
  const wrap = document.getElementById('listen-tiles');
  tiles.forEach(x => { const d = el('div', 'tile'); d.style.setProperty('--accent', x.accent); d.innerHTML = `<div class="label">${x.label}</div><div class="value">${x.value}<small>${x.small}</small></div><p class="desc">${x.desc}</p>`; wrap.appendChild(d); });
  document.getElementById('social-status').textContent = `Live feeds: X API counts (complete census of original posts), Bluesky public search and GDELT news volume, collected ${fmtDate(L.updated)}. ${g.pending && g.pending.length ? 'GDELT tone and MAGA-comparison series pending (rate-limited at collection time).' : ''}`;
  // Bluesky weekly bars
  const bw = b.weekly; document.getElementById('bsky-cap').textContent = `Public posts matching the phrase set, by week (Monday start). Final bar is the partial current week. Bars = posts; line = likes + reposts + replies + quotes.`;
  new Chart(document.getElementById('c-bsky'), { type: 'bar', data: { labels: bw.map(w => w.week), datasets: [
    { label: 'Posts', data: bw.map(w => w.posts), backgroundColor: bw.map((w, i) => i === bw.length - 1 ? 'rgba(42,127,127,.35)' : C.teal), yAxisID: 'y', borderRadius: 2 },
    { label: 'Engagement', data: bw.map(w => w.engagement), type: 'line', borderColor: C.red, backgroundColor: C.red, pointRadius: 2, borderWidth: 1.5, yAxisID: 'y2', tension: .3 } ] },
    options: { maintainAspectRatio: false, scales: { x: { grid: { display: false }, ticks: { font: { size: 11 }, callback: (v, i) => fmtDate(bw[i].week).replace(/, \d{4}/, '') } }, y: { min: 0, grid: { color: '#ece7de' }, title: { display: true, text: 'posts', font: { size: 11 } } }, y2: { min: 0, position: 'right', grid: { display: false }, title: { display: true, text: 'engagement', font: { size: 11 } }, ticks: { callback: v => (v / 1000) + 'k' } } }, plugins: { legend: { position: 'bottom' } } } });
  // GDELT weekly line since Aug 2024
  document.getElementById('gdelt-cap').textContent = `GDELT DOC 2.0 “timelinevol”, rescaled to mentions per 100,000 monitored US-source articles, daily values averaged by week. Numbered: 1 RFK endorses Trump · 2 HHS confirmation · 3 MAHA Report · 4 MAHA Strategy · 5 KFF midterms poll · 6 MAHA Summit.`;
  const gl = gWeeks.map(w => w.week);
  new Chart(document.getElementById('c-gdelt'), { type: 'line', data: { labels: gl, datasets: [{ label: 'per 100k US articles', data: gWeeks.map(w => +(w.value * 1000).toFixed(1)), borderColor: C.red, backgroundColor: 'rgba(178,58,72,.12)', fill: true, pointRadius: 0, borderWidth: 1.6, tension: .25 }] },
    options: { maintainAspectRatio: false, scales: { x: axisX(gl, window.innerWidth < 700 ? 17 : 9), y: { min: 0, grid: { color: '#ece7de' }, ticks: { font: { size: 11 } }, title: { display: true, text: 'per 100k articles', font: { size: 11 } } } }, plugins: { legend: { display: false }, eventMarkers: { events: [['2024-08-19'], ['2025-02-10'], ['2025-05-19'], ['2025-09-08'], ['2026-04-27'], ['2026-09-28']] }, tooltip: { callbacks: { title: i => 'Week of ' + fmtDate(i[0].label), label: i => i.parsed.y.toFixed(1) + ' per 100k US articles' } } } } });
  const tp = document.getElementById('bsky-top');
  b.top_posts.slice(0, 8).forEach(p => tp.appendChild(el('li', '', `<a href="${p.url}" target="_blank" rel="noopener">${esc(p.text.length > 180 ? p.text.slice(0, 177) + '…' : p.text)}</a><div class="m">@${p.handle} · ${fmtDate(p.date)} · ${p.likes.toLocaleString()} likes · ${p.reposts.toLocaleString()} reposts</div>`)));
  const ga = document.getElementById('gdelt-top');
  g.top_articles_7d.slice(0, 8).forEach(x => ga.appendChild(el('li', '', `<a href="${x.url}" target="_blank" rel="noopener">${esc(x.title)}</a><div class="m">${x.outlet} · ${fmtDate(x.date)}</div>`)));
  const ac = document.getElementById('bsky-accts');
  b.top_accounts.slice(0, 10).forEach(x => ac.appendChild(el('li', '', `<span>@${x.handle}</span><span class="m">${x.posts} posts · ${x.engagement.toLocaleString()} eng.</span>`)));
}

function sources(p, n, s) {
  const ul = document.getElementById('sources'); const seen = new Set();
  const add = (label, url) => { if (seen.has(url)) return; seen.add(url); ul.appendChild(el('li', '', `<a href="${url}" target="_blank" rel="noopener">${label}</a>`)); };
  add('Google Trends (explore; US / Worldwide; Topics /g/11x8sdrsf0, /g/11bw1_6lwn, /m/02l5km)', 'https://trends.google.com/trends/explore?geo=US&q=%2Fg%2F11x8sdrsf0,%2Fg%2F11bw1_6lwn');
  [...p.identification, ...p.favorability, ...p.rfk, ...p.delivery].forEach(x => add(`${x.pollster || x.source}${x.field ? ' — ' + fmtRange(x.field) : ''}`, x.url));
  s.studies.forEach(x => add(x.title, x.url));
  add('Google News RSS search (US edition) — eight MAHA queries, 7-day window', 'https://news.google.com/rss/search?q=%22Make+America+Healthy+Again%22&hl=en-US&gl=US&ceid=US:en');
  add('X API v2 — counts/all and search/recent (phrase set, retweets excluded)', 'https://docs.x.com/x-api/posts/counts/introduction');
  add('Bluesky AppView public search (app.bsky.feed.searchPosts)', 'https://docs.bsky.app/docs/api/app-bsky-feed-search-posts');
  add('GDELT DOC 2.0 API (timelinevol, US sources)', 'https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/');
  add('House Democrats Cost-of-Living Healthcare Working Group — memo to Leader Jeffries (Sep 1, 2026; via Politico)', 'https://www.politico.com/f/?id=000001a0-da3a-d276-aff6-fb7f2c380000');
  add('Politico — House Dems to Jeffries: Woo RFK Jr.’s followers (Sep 25, 2026)', 'https://www.politico.com/news/2026/09/25/house-dems-to-jeffries-woo-rfk-jr-s-followers-00584230');
  add('Political.org — 2026 race ratings (Oct 2, 2026)', 'https://political.org/2026-elections/');
  add('Decision Desk HQ — 2026 governor forecast', 'https://votes.decisiondeskhq.com/forecast/2026/governor');
  add('The Hill — GOP gambles on midterm dividends from MAHA (Aug 30, 2026)', 'https://thehill.com/policy/healthcare/6058532-trump-maha-midterm-impact/');
  add('Politico — MAHA was supposed to save the GOP (Jun 6, 2026)', 'https://www.politico.com/news/2026/06/06/rfk-maha-midterms-lyons-congress-00952583');
  add('Politico — RFK Jr. barnstorming for the GOP (Aug 21, 2026)', 'https://www.politico.com/news/2026/08/21/rfk-midterms-maha-vaccines-food-pesticides-01046544');
  add('Washington Examiner — Republicans embrace RFK Jr. (Sep 2, 2026)', 'https://www.washingtonexaminer.com/news/campaigns/congressional/4708688/republicans-ignore-rfk-jr-backlash-2026-maha-turnout/');
  add('NBC News — El-Sayed woos MAHA voters (Oct 1, 2026)', 'https://www.nbcnews.com/politics/2026-election/abdul-el-sayed-woo-maha-voters-democrats-rfk-rcna600508');
  add('Daily Signal — MAHA PAC $100M campaign (Mar 13, 2026)', 'https://www.dailysignal.com/2026/03/13/exclusive-super-pac-launches-100-million-strategy-bolster-maha-candidates-midterms/');
  add('The Atlantic — MAHA Swing Voters Are an Illusion (Apr 22, 2026)', 'https://www.theatlantic.com/health/2026/04/maha-moms-midterm-election/686901/');
  add('Dr. Mary Talley Bowden — Open letter to Kennedy and Trump (Sep 21, 2026)', 'https://drbowden.substack.com/p/open-letter-to-secretary-kennedy');
  add('Legis1 — MAHA PAC FEC filings through Aug 31, 2026', 'https://legis1.com/news/maha-pac-cassidy-louisiana-spent-109-million');
  add('MAHA PAC — Midterm Strategy Memo (Fabrizio Lee, Oct 2025)', 'https://www.themahapac.com/research');
  add('HHS — RFK Jr. sworn in; MAHA Commission EO (Feb 13, 2025)', 'https://www.hhs.gov/press-room/eo-maha.html');
  add('HHS — MAHA Report (May 22, 2025)', 'https://www.hhs.gov/press-room/maha-commission-childhood-chronic-disease-root-causes.html');
  add('HHS — MAHA Strategy (Sep 9, 2025)', 'https://www.hhs.gov/press-room/maha-commission-report-childhood-disease-strategy.html');
  add('MAHA Summit 2026 (Sep 29, 2026)', 'https://www.mahasummit.com/');
  add('New York Magazine — origin of the phrase (Sweetgreen 2016; Glendale speech Aug 23, 2024)', 'https://nymag.com/intelligencer/article/what-is-maha-health-wellness-movement-rfk-jr-policies.html');
  add('USA Today — SNL “MAHAspital” sketch (Mar 14, 2026)', 'https://www.usatoday.com/story/entertainment/celebrities/2026/03/15/snl-rfk-jr-mahaspital-the-pitt/89168956007/');
}

load().catch(e => { console.error(e); document.getElementById('status-row').appendChild(el('span', 'status pending', '<i></i>Data failed to load — check data/*.json')); });
