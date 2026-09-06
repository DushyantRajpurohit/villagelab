import { el, mount, stat, bar, table, empty, banner, icon, toast, fmtInt, fmtWhen, parseCocDate, debounce } from '../ui.js';
import * as api from '../api.js';
import { getState, setState } from '../store.js';

const ROLE = { leader: 'Leader', coLeader: 'Co-leader', admin: 'Elder', member: 'Member' };
const ROLE_RANK = { leader: 3, coLeader: 2, admin: 1, member: 0 };

const TABS = ['roster', 'war', 'log'];

/** The active tab lives in the hash (#/war/log) so views are shareable. */
function currentTab() {
  const sub = location.hash.split('/')[2];
  return TABS.includes(sub) ? sub : 'roster';
}
function setTab(id) {
  location.hash = '#/war' + (id === 'roster' ? '' : '/' + id);
}

export default async function warView(ctx) {
  const root = el('div');
  const s = getState();

  const input = el('input.mono', {
    placeholder: '#CLANTAG or clan name', value: s.clanTag, spellcheck: 'false',
    style: { width: '220px' },
    onkeydown: (e) => { if (e.key === 'Enter') go(input.value); },
    oninput: debounce(() => {
      const v = input.value.trim();
      if (v.length >= 3 && !v.startsWith('#')) runSearch(v); else mount(results, []);
    }, 350),
  });

  const results = el('div');
  const body = el('div');

  mount(root, [
    el('div.view-head', [
      el('div', [
        el('h1', 'Clan war room'),
        el('p', 'Roster health, live war progress and war history. Type a tag to load a clan directly, or type three or more letters to search by name.'),
      ]),
      el('div.spacer'),
      el('div.row', [input, el('button.btn.primary', { onclick: () => go(input.value) }, [icon('search', 'nav-icon'), 'Load'])]),
    ]),
    results,
    body,
  ]);

  async function runSearch(name) {
    try {
      const r = await api.searchClans(name, 8);
      mount(results, r.items?.length ? el('section.panel', { style: { marginBottom: '16px' } }, [
        el('div.panel-head', el('h2', `Clans matching “${name}”`)),
        el('div.panel-body.tight', table([
          { key: 'name', label: 'Clan', render: (c) => el('div.row', [el('b', c.name), el('code', { style: { color: 'var(--muted)' } }, c.tag)]) },
          { key: 'clanLevel', label: 'Level', num: true },
          { key: 'members', label: 'Members', num: true, render: (c) => el('span.num', `${c.members}/50`) },
          { key: 'clanPoints', label: 'Points', num: true, render: (c) => el('span.num', fmtInt(c.clanPoints)) },
          { key: 'warWins', label: 'War wins', num: true },
          { key: 'open', label: '', sortable: false, render: (c) => el('div.row', { style: { justifyContent: 'flex-end' } },
            el('button.btn.sm', { onclick: () => { input.value = c.tag; mount(results, []); go(c.tag); } }, 'Open')) },
        ], r.items, { sortKey: 'clanPoints' })),
      ]) : banner(`No clans found matching “${name}”.`));
    } catch (err) {
      mount(results, banner('Search failed: ' + err.message, 'bad'));
    }
  }

  async function go(raw) {
    const v = String(raw).trim();
    if (!v) return;
    if (!v.startsWith('#') && !/^[0289PYLQGRJCUV]{5,}$/i.test(v)) { runSearch(v); return; }
    const tag = api.normalizeTag(v);
    input.value = tag;
    mount(results, []);
    setState({ clanTag: tag });
    mount(body, el('div.row', { style: { padding: '40px', justifyContent: 'center' } }, el('span.spin')));

    // war log and current war can legitimately fail (private log, not in war)
    const [clan, war, log] = await Promise.allSettled([
      api.clan(tag), api.currentWar(tag), api.warLog(tag, 20),
    ]);

    if (clan.status === 'rejected') { mount(body, renderError(clan.reason, tag)); return; }
    mount(body, renderClan(ctx, clan.value,
      war.status === 'fulfilled' ? war.value : { _error: war.reason },
      log.status === 'fulfilled' ? log.value : { _error: log.reason }));
  }

  if (s.clanTag) await go(s.clanTag);
  else mount(body, empty('No clan loaded', 'Enter a clan tag, or search by name.'));

  return root;
}

function renderError(err, tag) {
  if (err.status === 404) return banner(`No clan found with tag ${tag}.`, 'warn');
  if (err.status === 403) return banner(el('div', [
    el('b', 'The Supercell API rejected the request. '),
    'The token in .env must be whitelisted for this server’s public IP.',
    err.reason ? el('code', ` (${err.reason})`) : null,
  ]), 'bad');
  return banner('Failed to load clan: ' + err.message, 'bad');
}

function renderClan(ctx, clan, war, log) {
  const members = clan.memberList || [];
  const active = currentTab();
  const tabs = [
    { id: 'roster', label: `Roster (${members.length})` },
    { id: 'war', label: 'Current war' },
    { id: 'log', label: 'War log' },
  ];

  const tabBar = el('div.row', { style: { gap: '6px', marginBottom: '16px' } }, tabs.map((t) =>
    el('button.btn' + (t.id === active ? '.primary' : '.ghost'), { onclick: () => setTab(t.id) }, t.label)));

  const content = active === 'roster' ? rosterPanel(ctx, clan, members)
    : active === 'war' ? warPanel(war)
    : logPanel(log);

  const winRate = clan.warWins + clan.warLosses + (clan.warTies || 0);
  return el('div.grid', { style: { gap: '16px' } }, [
    clan._mock ? banner(el('div', [el('b', 'Mock data. '), 'Generated from the tag so the war room is usable offline.']), 'warn') : null,
    clanHeader(clan, winRate),
    tabBar,
    content,
  ]);
}

function clanHeader(clan, totalWars) {
  const wr = totalWars ? (clan.warWins / totalWars) * 100 : 0;
  return el('section.panel', el('div.panel-body', [
    el('div.row.wrap', { style: { gap: '20px' } }, [
      el('div', [
        el('div.row', [el('h1', clan.name), el('span.tag.gold', 'Lv ' + clan.clanLevel), el('span.tag', clan.type)]),
        el('div.row', { style: { marginTop: '4px', color: 'var(--muted)' } }, [
          el('code', clan.tag),
          el('span', `· ${clan.members}/50 members`),
          el('span', `· requires TH${clan.requiredTownhallLevel || 1} / ${fmtInt(clan.requiredTrophies)} cups`),
        ]),
        clan.description ? el('p', { style: { color: 'var(--muted)', maxWidth: '70ch', marginTop: '8px' } }, clan.description) : null,
      ]),
      el('div.spacer'),
      el('div.row', { style: { gap: '26px' } }, [
        stat('Clan points', fmtInt(clan.clanPoints)),
        stat('War record', `${clan.warWins}–${clan.warLosses}${clan.warTies ? '–' + clan.warTies : ''}`, `${wr.toFixed(0)}% win rate`),
        stat('Win streak', String(clan.warWinStreak ?? 0)),
      ]),
    ]),
  ]));
}

/* ------------------------------------------------------------------ roster */

function rosterPanel(ctx, clan, members) {
  const donationRatio = (m) => (m.donationsReceived ? m.donations / m.donationsReceived : m.donations ? Infinity : 0);
  const totalDon = members.reduce((a, m) => a + m.donations, 0);

  const thSpread = members.reduce((a, m) => { a[m.townHallLevel] = (a[m.townHallLevel] || 0) + 1; return a; }, {});
  const spread = Object.entries(thSpread).map(([th, n]) => [Number(th), n]).sort((a, b) => b[0] - a[0]);

  return el('div.grid', { style: { gap: '16px' } }, [
    el('div.grid.g4', [
      tile(stat('Members', `${members.length}/50`)),
      tile(stat('Total donations', fmtInt(totalDon), `${Math.round(totalDon / Math.max(1, members.length))} avg`)),
      tile(stat('Freeloaders', String(members.filter((m) => donationRatio(m) < 0.35).length), 'give under a third of what they take', 'warn')),
      tile(stat('Top Town Hall', 'TH' + Math.max(...members.map((m) => m.townHallLevel)), `${spread.length} different levels`)),
    ]),

    el('section.panel', [
      el('div.panel-head', el('h2', 'Town Hall spread')),
      el('div.panel-body', el('div.grid', { style: { gap: '6px' } }, spread.map(([th, n]) =>
        el('div.row', [
          el('div', { style: { width: '54px', fontSize: '12px', color: 'var(--muted)' } }, 'TH' + th),
          el('div', { style: { flex: 1 } }, bar((n / members.length) * 100)),
          el('div.num', { style: { width: '32px', textAlign: 'right', fontSize: '12px' } }, String(n)),
        ])))),
    ]),

    el('section.panel', [
      el('div.panel-head', [el('h2', 'Roster'), el('div.spacer'), el('span.tag', 'click a column to sort')]),
      el('div.panel-body.tight', table([
        { key: 'clanRank', label: '#', num: true, render: (m) => el('span.num', { style: { color: 'var(--faint)' } }, String(m.clanRank)) },
        { key: 'name', label: 'Player', render: (m) => el('div.row', [
          el('span', m.name),
          el('span.tag' + (m.role === 'leader' ? '.gold' : ''), ROLE[m.role] || m.role),
        ]) },
        { key: 'townHallLevel', label: 'TH', num: true },
        { key: 'trophies', label: 'Trophies', num: true, render: (m) => el('span.num', fmtInt(m.trophies)) },
        { key: 'donations', label: 'Given', num: true, render: (m) => el('span.num', { style: { color: 'var(--ok)' } }, fmtInt(m.donations)) },
        { key: 'donationsReceived', label: 'Taken', num: true, render: (m) => el('span.num', { style: { color: 'var(--muted)' } }, fmtInt(m.donationsReceived)) },
        { key: 'ratio', label: 'Ratio', num: true, sort: (m) => (donationRatio(m) === Infinity ? 9999 : donationRatio(m)),
          render: (m) => {
            const r = donationRatio(m);
            const txt = r === Infinity ? '∞' : r.toFixed(2);
            return el('span.num', { style: { color: r >= 1 ? 'var(--ok)' : r >= 0.35 ? 'var(--warn)' : 'var(--bad)' } }, txt);
          } },
        { key: 'open', label: '', sortable: false, render: (m) => el('div.row', { style: { justifyContent: 'flex-end' } },
          el('button.btn.sm.ghost', { title: 'Open in the player dashboard', onclick: () => { setState({ playerTag: m.tag }); ctx.navigate('player'); } }, '→')) },
      ], members, { sortKey: 'trophies' })),
    ]),
  ]);
}

/* -------------------------------------------------------------- current war */

function warPanel(war) {
  if (war._error) {
    if (war._error.status === 403) return banner('This clan’s war log is private, so the current war cannot be read.', 'warn');
    return banner('Could not load the current war: ' + war._error.message, 'bad');
  }
  if (!war || war.state === 'notInWar') return empty('Not in a war right now', 'When a war starts, attacks and missed hits appear here.');
  if (war.state === 'preparation') {
    return el('div.grid', { style: { gap: '16px' } }, [
      banner(`Preparation day — battle starts ${fmtWhen(war.startTime)}.`),
      matchupPanel(war),
    ]);
  }

  const us = war.clan, them = war.opponent;
  const maxStars = war.teamSize * 3;
  const usedUs = us.members.reduce((a, m) => a + m.attacks.length, 0);
  const totalAttacks = war.teamSize * (war.attacksPerMember || 2);
  const missing = us.members
    .map((m) => ({ ...m, left: (war.attacksPerMember || 2) - m.attacks.length }))
    .filter((m) => m.left > 0)
    .sort((a, b) => b.left - a.left || a.mapPosition - b.mapPosition);

  const winning = us.stars > them.stars || (us.stars === them.stars && us.destructionPercentage > them.destructionPercentage);

  return el('div.grid', { style: { gap: '16px' } }, [
    el('div.grid.g4', [
      tile(stat('Stars', `${us.stars} – ${them.stars}`, winning ? 'ahead' : us.stars === them.stars && us.destructionPercentage === them.destructionPercentage ? 'level' : 'behind', winning ? 'ok' : 'bad')),
      tile(stat('Destruction', `${us.destructionPercentage.toFixed(1)}%`, `opponent ${them.destructionPercentage.toFixed(1)}%`)),
      tile(stat('Attacks used', `${usedUs}/${totalAttacks}`, `${totalAttacks - usedUs} remaining`)),
      tile(stat('War ends', fmtWhen(war.endTime), `${war.teamSize} v ${war.teamSize}`)),
    ]),

    matchupPanel(war),

    missing.length ? el('section.panel', [
      el('div.panel-head', [el('h2', 'Attacks not used'), el('div.spacer'),
        el('span.tag.bad', `${missing.reduce((a, m) => a + m.left, 0)} hits outstanding`)]),
      el('div.panel-body.tight', table([
        { key: 'mapPosition', label: '#', num: true },
        { key: 'name', label: 'Player' },
        { key: 'townhallLevel', label: 'TH', num: true },
        { key: 'left', label: 'Unused', num: true, render: (m) => el('span.num', { style: { color: 'var(--bad)' } }, String(m.left)) },
      ], missing, { sortKey: 'left' })),
    ]) : banner('Every attack has been used. Nothing outstanding.', ''),

    el('section.panel', [
      el('div.panel-head', el('h2', 'Our attacks')),
      el('div.panel-body.tight', table([
        { key: 'mapPosition', label: '#', num: true },
        { key: 'name', label: 'Player' },
        { key: 'townhallLevel', label: 'TH', num: true },
        { key: 'stars', label: 'Stars', num: true, sort: (m) => m.attacks.reduce((a, x) => a + x.stars, 0),
          render: (m) => el('span', { style: { color: 'var(--gold)' } }, m.attacks.length ? m.attacks.map((a) => '★'.repeat(a.stars) + '☆'.repeat(3 - a.stars)).join('  ') : '—') },
        { key: 'dest', label: 'Best %', num: true, sort: (m) => Math.max(0, ...m.attacks.map((a) => a.destructionPercentage)),
          render: (m) => el('span.num', m.attacks.length ? Math.max(...m.attacks.map((a) => a.destructionPercentage)) + '%' : '—') },
        { key: 'def', label: 'Defended', num: true, sort: (m) => -(m.bestOpponentAttack?.stars ?? -1),
          render: (m) => el('span.num', { style: { color: 'var(--muted)' } },
            m.bestOpponentAttack ? `${m.bestOpponentAttack.stars}★ / ${m.bestOpponentAttack.destructionPercentage}%` : 'clean') },
      ], us.members, { sortKey: 'mapPosition', sortDir: 1 })),
    ]),
  ]);
}

function matchupPanel(war) {
  const bothSides = (a, b) => el('div.row', { style: { gap: '16px' } }, [
    el('div', { style: { flex: 1 } }, [el('h3', 'Us'), a]),
    el('div', { style: { flex: 1 } }, [el('h3', 'Them'), b]),
  ]);
  return el('section.panel', [
    el('div.panel-head', [el('h2', `${war.clan.name} vs ${war.opponent.name}`), el('div.spacer'),
      el('span.tag', war.state)]),
    el('div.panel-body', bothSides(
      thBreakdown(war.clan.members), thBreakdown(war.opponent.members))),
  ]);
}

function thBreakdown(members) {
  const spread = members.reduce((a, m) => { a[m.townhallLevel] = (a[m.townhallLevel] || 0) + 1; return a; }, {});
  const rows = Object.entries(spread).map(([th, n]) => [Number(th), n]).sort((a, b) => b[0] - a[0]);
  return el('div.grid', { style: { gap: '5px', marginTop: '8px' } }, rows.map(([th, n]) => el('div.row', [
    el('div', { style: { width: '48px', fontSize: '12px', color: 'var(--muted)' } }, 'TH' + th),
    el('div', { style: { flex: 1 } }, bar((n / members.length) * 100)),
    el('div.num', { style: { width: '28px', textAlign: 'right', fontSize: '12px' } }, String(n)),
  ])));
}

/* ----------------------------------------------------------------- war log */

function logPanel(log) {
  if (log._error) {
    if (log._error.status === 403) return banner('This clan keeps its war log private.', 'warn');
    return banner('Could not load the war log: ' + log._error.message, 'bad');
  }
  const items = log.items || [];
  if (!items.length) return empty('No war history', 'Nothing recorded for this clan yet.');

  const wins = items.filter((i) => i.result === 'win').length;
  const losses = items.filter((i) => i.result === 'lose').length;
  const ties = items.length - wins - losses;
  const avgStars = items.reduce((a, i) => a + i.clan.stars, 0) / items.length;
  const avgDest = items.reduce((a, i) => a + i.clan.destructionPercentage, 0) / items.length;

  const strip = el('div.row', { style: { gap: '3px', flexWrap: 'wrap' } }, items.map((i) =>
    el('div', {
      title: `${i.result} vs ${i.opponent.name} — ${i.clan.stars}★ vs ${i.opponent.stars}★`,
      style: {
        width: '22px', height: '22px', borderRadius: '4px', display: 'grid', placeItems: 'center',
        fontSize: '11px', fontWeight: 700,
        background: i.result === 'win' ? 'rgba(61,220,132,.15)' : i.result === 'lose' ? 'rgba(255,95,86,.15)' : 'var(--panel-3)',
        color: i.result === 'win' ? 'var(--ok)' : i.result === 'lose' ? 'var(--bad)' : 'var(--muted)',
        border: '1px solid ' + (i.result === 'win' ? '#1d6b41' : i.result === 'lose' ? '#7a2b28' : 'var(--line)'),
      },
    }, i.result === 'win' ? 'W' : i.result === 'lose' ? 'L' : 'T')));

  return el('div.grid', { style: { gap: '16px' } }, [
    el('div.grid.g4', [
      tile(stat('Record', `${wins}–${losses}${ties ? '–' + ties : ''}`, `last ${items.length} wars`)),
      tile(stat('Win rate', ((wins / items.length) * 100).toFixed(0) + '%')),
      tile(stat('Avg stars', avgStars.toFixed(1))),
      tile(stat('Avg destruction', avgDest.toFixed(1) + '%')),
    ]),
    el('section.panel', [
      el('div.panel-head', [el('h2', 'Recent form'), el('div.spacer'), el('span.tag', 'newest first')]),
      el('div.panel-body', strip),
    ]),
    el('section.panel', [
      el('div.panel-head', el('h2', 'War history')),
      el('div.panel-body.tight', table([
        { key: 'result', label: 'Result', render: (i) => el('span.tag' + (i.result === 'win' ? '.ok' : i.result === 'lose' ? '.bad' : ''), i.result) },
        { key: 'opp', label: 'Opponent', sort: (i) => i.opponent.name, render: (i) => el('div.row', [el('span', i.opponent.name), el('code', { style: { color: 'var(--faint)' } }, i.opponent.tag || '')]) },
        { key: 'teamSize', label: 'Size', num: true, render: (i) => el('span.num', `${i.teamSize}v${i.teamSize}`) },
        { key: 'stars', label: 'Stars', num: true, sort: (i) => i.clan.stars, render: (i) => el('span.num', `${i.clan.stars} – ${i.opponent.stars}`) },
        { key: 'dest', label: 'Destruction', num: true, sort: (i) => i.clan.destructionPercentage,
          render: (i) => el('span.num', `${i.clan.destructionPercentage.toFixed(1)}% – ${i.opponent.destructionPercentage.toFixed(1)}%`) },
        { key: 'endTime', label: 'Ended', num: true, sort: (i) => parseCocDate(i.endTime)?.getTime() ?? 0,
          render: (i) => el('span.num', { style: { color: 'var(--muted)' } }, fmtWhen(i.endTime)) },
      ], items, { sortKey: 'endTime' })),
    ]),
  ]);
}

function tile(inner) { return el('section.panel', el('div.panel-body', inner)); }
