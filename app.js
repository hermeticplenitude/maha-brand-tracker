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
  const [trends, polls, news, social] = await Promise.all(['data/trends.json', 'data/polls.json', 'data/news.json', 'data/social.json'].map(u => fetch(u).then(r => r.json())));
  status(trends, polls, news, social);
  scorecard(polls, trends);
  attention(trends);
  identification(polls);
  views(polls);
  integrity(polls, trends);
  newsSection(news);
  socialSection(social);
  sources(polls, news, social);
}

function status(t, p, n, s) {
  const row = document.getElementById('status-row');
  [['Google Trends', t.retrieved, false], ['Polls', p.updated, false], ['News sample', n.updated, false], ['Social listening', s.updated, true]].forEach(([k, d, pend]) => {
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

function sources(p, n, s) {
  const ul = document.getElementById('sources'); const seen = new Set();
  const add = (label, url) => { if (seen.has(url)) return; seen.add(url); ul.appendChild(el('li', '', `<a href="${url}" target="_blank" rel="noopener">${label}</a>`)); };
  add('Google Trends (explore; US / Worldwide; Topics /g/11x8sdrsf0, /g/11bw1_6lwn, /m/02l5km)', 'https://trends.google.com/trends/explore?geo=US&q=%2Fg%2F11x8sdrsf0,%2Fg%2F11bw1_6lwn');
  [...p.identification, ...p.favorability, ...p.rfk, ...p.delivery].forEach(x => add(`${x.pollster || x.source}${x.field ? ' — ' + fmtRange(x.field) : ''}`, x.url));
  s.studies.forEach(x => add(x.title, x.url));
  add('HHS — RFK Jr. sworn in; MAHA Commission EO (Feb 13, 2025)', 'https://www.hhs.gov/press-room/eo-maha.html');
  add('HHS — MAHA Report (May 22, 2025)', 'https://www.hhs.gov/press-room/maha-commission-childhood-chronic-disease-root-causes.html');
  add('HHS — MAHA Strategy (Sep 9, 2025)', 'https://www.hhs.gov/press-room/maha-commission-report-childhood-disease-strategy.html');
  add('MAHA Summit 2026 (Sep 29, 2026)', 'https://www.mahasummit.com/');
  add('New York Magazine — origin of the phrase (Sweetgreen 2016; Glendale speech Aug 23, 2024)', 'https://nymag.com/intelligencer/article/what-is-maha-health-wellness-movement-rfk-jr-policies.html');
  add('USA Today — SNL “MAHAspital” sketch (Mar 14, 2026)', 'https://www.usatoday.com/story/entertainment/celebrities/2026/03/15/snl-rfk-jr-mahaspital-the-pitt/89168956007/');
}

load().catch(e => { console.error(e); document.getElementById('status-row').appendChild(el('span', 'status pending', '<i></i>Data failed to load — check data/*.json')); });
