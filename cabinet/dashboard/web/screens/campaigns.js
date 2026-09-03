// Кампании: цель, период, каналы, UTM, связанные задачи, материалы, публикации и агрегированные показатели.
                                     
import { api } from '../api.js';
import { h, badge, statusBadge, kindChip, modal, fmtDate, todayKey, KIND_LABEL, ART_KIND, COLUMN_LABEL, PLATFORM_LABEL } from '../ui.js';

const CAMPAIGN_STATUS                         = { planned: 'запланирована', active: 'идёт', finished: 'завершена' };

function campaignBadge(status        )              {
  return badge(CAMPAIGN_STATUS[status] ?? status, status === 'active' ? 'agent' : status === 'finished' ? '' : 'human');
}

function fmtPeriod(c     )         {
  const f = (k        ) => { const d = new Date(k + 'T00:00:00'); return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }); };
  return `${f(c.period.from)} — ${f(c.period.to)}`;
}

function newCampaignForm(app     , close            )              {
  const st = app.state; const p = st.project;
  const name = h('input', { placeholder: 'Название кампании', required: true })                    ;
  const goal = h('input', { placeholder: 'Цель' })                    ;
  const audience = h('input', { value: p.audience })                    ;
  const geography = h('input', { value: p.geography })                    ;
  const from = h('input', { type: 'date', value: todayKey() })                    ;
  const to = h('input', { type: 'date', value: todayKey() })                    ;
  const utmSource = h('input', { value: 'marketing-club' })                    ;
  const utmMedium = h('input', { value: 'social' })                    ;
  const channelBoxes = st.channels.map((c     ) => ({ c, box: h('input', { type: 'checkbox' })                     }));
  const submit = async () => {
    if (!name.value.trim()) { name.focus(); return; }
    let created      = null;
    const ok = await app.act(async () => {
      const out = await api.createCampaign(app.pid, {
        name: name.value, goal: goal.value, audience: audience.value, geography: geography.value, from: from.value, to: to.value,
        channelIds: channelBoxes.filter((x     ) => x.box.checked).map((x     ) => x.c.id), utmSource: utmSource.value, utmMedium: utmMedium.value,
      }, app.actor());
      created = out.campaign; return out;
    }, 'Кампания создана');
    if (ok && created) { close(); app.go('campaigns', { campaign: created.id }); }
  };
  return h('div', { class: 'form' },
    h('label', null, 'Название', name), h('label', null, 'Цель', goal),
    h('div', { class: 'grid two' }, h('label', null, 'Аудитория', audience), h('label', null, 'География', geography)),
    h('div', { class: 'grid two' }, h('label', null, 'Начало', from), h('label', null, 'Окончание', to)),
    h('div', null, h('div', { class: 'muted small', style: { marginBottom: '4px' } }, 'Каналы'),
      st.channels.length ? h('div', { class: 'cmp-channels' }, ...channelBoxes.map(({ c, box }     ) => h('label', { class: 'check' }, box, `${c.name} (${PLATFORM_LABEL[c.platform] ?? c.platform})`))) : h('div', { class: 'muted small' }, 'в проекте нет каналов')),
    h('div', { class: 'grid two' }, h('label', null, 'utm_source', utmSource), h('label', null, 'utm_medium', utmMedium)),
    h('div', { class: 'muted small' }, 'utm_campaign формируется из названия автоматически.'),
    h('div', { class: 'actions' }, h('button', { class: 'btn primary', onClick: submit }, 'Создать кампанию'), h('button', { class: 'btn', onClick: close }, 'Отмена')));
}

export function openCampaignModal(app     ) {
  const m = modal('Создать кампанию', h('div'));
  const body = document.querySelector('.modal-body') ;
  body.innerHTML = '';
  body.appendChild(newCampaignForm(app, m.close));
  (body.querySelector('input')                      )?.focus();
}

function utmBlock(app     , c     )              {
  const fallback = `utm_source=${encodeURIComponent(c.utm.source)}&utm_medium=${encodeURIComponent(c.utm.medium)}&utm_campaign=${encodeURIComponent(c.utm.campaign)}`;
  const query = h('code', { class: 'utm-query' }, fallback);
  api.campaign(app.pid, c.id).then((d     ) => { if (d?.utmQuery) query.textContent = d.utmQuery; }).catch(() => undefined);
  return h('div', { class: 'utm' },
    h('div', { class: 'meta-list' },
      h('div', null, h('b', null, 'utm_source: '), c.utm.source), h('div', null, h('b', null, 'utm_medium: '), c.utm.medium), h('div', null, h('b', null, 'utm_campaign: '), c.utm.campaign)),
    h('div', { class: 'muted small', style: { marginTop: '6px' } }, 'Готовая строка для ссылок:'), query);
}

function detail(app     , c     )              {
  const st = app.state;
  const tasks = st.tasks.filter((t     ) => t.campaignId === c.id);
  const artifacts = st.artifacts.filter((a     ) => a.campaignId === c.id);
  const artIds = new Set(artifacts.map((a     ) => a.id));
  const jobs = st.jobs.filter((j     ) => artIds.has(j.artifactId));
  const s = c.summary ?? { tasks: tasks.length, artifacts: artifacts.length, published: jobs.filter((j     ) => j.status === 'PUBLISHED').length, failed: jobs.filter((j     ) => j.status === 'FAILED').length, inReview: artifacts.filter((a     ) => a.status === 'IN_REVIEW').length };
  const stat = (n                 , l        , cls = '') => h('div', { class: `stat ${cls}` }, h('div', { class: 'n' }, String(n)), h('div', { class: 'l' }, l));
  const channels = c.channelIds.map((id        ) => st.channels.find((x     ) => x.id === id)).filter(Boolean);

  return h('div', { class: 'stack', style: { gap: '14px' } },
    h('div', { class: 'card' },
      h('div', { class: 'head' }, h('div', null, h('div', { class: 'row' }, kindChip('campaign', c.name), campaignBadge(c.status)), h('div', { class: 'muted small mono', style: { marginTop: '4px' } }, `${c.id} · ${fmtPeriod(c)} · создана ${fmtDate(c.createdAt)}`)),
        h('button', { class: 'btn primary sm', onClick: () => app.newTask('post', false, c.id) }, 'Создать задачу в кампании')),
      h('div', { class: 'row', style: { marginBottom: '6px' } }, h('h3', null, 'Показатели'), h('span', { class: 'mock-tag' }, 'mock, агрегированные')),
      h('div', { class: 'stat-row' }, stat(c.metrics.visits, 'переходы'), stat(c.metrics.leads, 'заявки'), stat(c.metrics.consultations, 'консультации'), stat(c.metrics.contracts, 'договоры')),
      h('h3', { style: { marginTop: '12px' } }, 'В работе'),
      h('div', { class: 'stat-row' }, stat(s.tasks, 'задачи'), stat(s.artifacts, 'материалы'), stat(s.inReview, 'на согласовании', s.inReview ? 'warn' : ''), stat(s.published, 'опубликовано'), stat(s.failed, 'ошибки', s.failed ? 'err' : ''))),
    h('div', { class: 'grid two' },
      h('div', { class: 'card' }, h('h3', null, 'Профиль кампании'), h('div', { class: 'meta-list' },
        h('div', null, h('b', null, 'Цель: '), c.goal || h('span', { class: 'muted' }, 'не указана')), h('div', null, h('b', null, 'Аудитория: '), c.audience), h('div', null, h('b', null, 'География: '), c.geography),
        h('div', null, h('b', null, 'Период: '), `${c.period.from} — ${c.period.to}`),
        h('div', { class: 'row' }, h('b', null, 'Каналы: '), channels.length ? channels.map((ch     ) => badge(`${ch.name} · ${PLATFORM_LABEL[ch.platform] ?? ch.platform}`)) : h('span', { class: 'muted' }, 'не выбраны')))),
      h('div', { class: 'card' }, h('h3', null, 'UTM'), utmBlock(app, c))),
    h('div', { class: 'grid two' },
      h('div', { class: 'card' }, h('div', { class: 'head' }, h('h3', null, 'Задачи кампании'), badge(String(tasks.length))),
        tasks.length ? h('div', { class: 'list' }, ...tasks.map((t     ) => h('div', { class: 'item' }, h('div', { class: 'body' },
          h('a', { href: '#', onClick: (e       ) => { e.preventDefault(); app.go('tasks', { task: t.id }); } }, t.title), ' ', kindChip(t.kind), ' ', badge(COLUMN_LABEL[t.column] ?? t.column, t.column === 'in_review' || t.column === 'approved' ? 'human' : ''), t.archived ? [' ', badge('отклонено', 'err')] : null, t.blockedReason ? [' ', badge('блок', 'err')] : null,
          h('div', { class: 'sub' }, t.plannedAt ? `план: ${t.plannedAt.replace('T', ' ')}` : 'дата не задана', t.route.length ? ` · ${Math.min(t.stepIndex, t.route.length)}/${t.route.length}` : '')))))
          : h('div', { class: 'empty' }, 'Задач в кампании нет — создайте первую')),
      h('div', { class: 'card' }, h('div', { class: 'head' }, h('h3', null, 'Материалы'), badge(String(artifacts.length))),
        artifacts.length ? h('div', { class: 'list' }, ...artifacts.map((a     ) => h('div', { class: 'item' }, h('div', { class: 'body' },
          h('a', { href: '#', onClick: (e       ) => { e.preventDefault(); app.go('content', { artifact: a.id }); } }, a.title), ' ', badge(ART_KIND[a.kind] ?? a.kind), ' ', statusBadge(a.status),
          h('div', { class: 'sub' }, `v${a.version} · источников ${a.sources.length}`, a.scheduledAt ? ` · ${a.scheduledAt.replace('T', ' ')}` : '')))))
          : h('div', { class: 'empty' }, 'Материалов пока нет'))),
    h('div', { class: 'card' }, h('div', { class: 'head' }, h('h3', null, 'Публикации'), badge(String(jobs.length))),
      jobs.length ? h('table', { class: 'table' }, h('thead', null, h('tr', null, h('th', null, 'Задание'), h('th', null, 'Материал'), h('th', null, 'Канал'), h('th', null, 'Статус'), h('th', null, 'Попытка'), h('th', null, 'Результат'))),
        h('tbody', null, ...jobs.map((j     ) => { const a = st.artifacts.find((x     ) => x.id === j.artifactId); const ch = st.channels.find((x     ) => x.id === j.channelId); return h('tr', null,
          h('td', { class: 'mono' }, j.id), h('td', null, a?.title ?? j.artifactId), h('td', null, ch?.name ?? j.channelId), h('td', null, statusBadge(j.status)), h('td', { class: 'mono' }, String(j.attempt)),
          h('td', { class: 'small' }, j.result ? (j.result.ok ? `опубликовано (mock), id ${j.result.externalId}` : `${j.result.code}: ${j.result.message}`) : '—')); })))
        : h('div', { class: 'empty' }, 'Публикаций по кампании ещё не было')));
}

export function render(app     )              {
  const st = app.state;
  if (app.sel.new === '1') { app.sel.new = null; setTimeout(() => openCampaignModal(app), 0); }
  const selected = st.campaigns.find((c     ) => c.id === app.sel.campaign) ?? st.campaigns[0] ?? null;
  const head = h('div', { class: 'page-head' },
    h('div', null, h('h1', null, 'Кампании'), h('div', { class: 'sub' }, 'Цель, период, каналы и UTM; задачи и материалы кампании наследуют её привязку. Показатели — демонстрационные.')),
    h('button', { class: 'btn primary', onClick: () => openCampaignModal(app) }, 'Создать кампанию'));
  if (!st.campaigns.length) return h('div', null, head, h('div', { class: 'empty' }, 'Кампаний пока нет. Создайте первую, чтобы связать задачи, материалы и публикации.'));
  const side = h('div', { class: 'card side-list' }, h('div', { class: 'list' }, ...st.campaigns.map((c     ) => h('div', { class: `item${selected?.id === c.id ? ' selected' : ''}`, onClick: () => app.go('campaigns', { campaign: c.id }) },
    h('div', { class: 'body' }, h('div', { class: 'title small' }, c.name), h('div', { class: 'sub' }, fmtPeriod(c)),
      h('div', { class: 'row', style: { marginTop: '4px' } }, campaignBadge(c.status), h('span', { class: 'muted small mono' }, `задач ${c.summary?.tasks ?? 0} · материалов ${c.summary?.artifacts ?? 0} · опубл. ${c.summary?.published ?? 0}`)))))));
  return h('div', null, head, h('div', { class: 'split' }, side, selected ? detail(app, selected) : h('div', { class: 'empty' }, 'Выберите кампанию')));
}
