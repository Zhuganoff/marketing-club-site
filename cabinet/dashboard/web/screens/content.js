                                     
import { api } from '../api.js?v=mtlq3kut';
import { h, badge, statusBadge, kindChip, modal, fmtDate, short, ART_KIND, PLATFORMS, PLATFORM_LABEL, STATUS_LABEL } from '../ui.js?v=mtlq3kut';
import { previewTabs } from '../components/preview.js?v=mtlq3kut';

const STATUSES = ['DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'FAILED'];
const HISTORY_TYPES = /^(approval\.|artifact\.edited|artifact\.declined|artifact\.rescheduled)/;

function platformsOf(app     , a     )           {
  const set = new Set        ();
  const ch = a.channelId ? app.state.channels.find((c     ) => c.id === a.channelId) : null;
  if (ch) set.add(ch.platform);
  for (const v of a.channelVersions ?? []) set.add(v.platform);
  return [...set];
}

function filtered(app     )        {
  const st = app.state; const s = app.sel;
  const q = (s.q ?? '').toLowerCase().trim();
  return st.artifacts.filter((a     ) => {
    if (s.status && s.status !== 'all' && a.status !== s.status) return false;
    if (s.kind && s.kind !== 'all') { if (s.kind === 'primary' ? !(a.kind === 'draft' || a.kind === 'weekly_report') : a.kind !== s.kind) return false; }
    if (s.platform && s.platform !== 'all' && !platformsOf(app, a).includes(s.platform)) return false;
    if (s.campaign && s.campaign !== 'all') { if (s.campaign === 'none' ? a.campaignId : a.campaignId !== s.campaign) return false; }
    if (q && !(a.title.toLowerCase().includes(q) || a.body.toLowerCase().includes(q))) return false;
    return true;
  });
}

function contentWeek(app     )              {
  const st = app.state;
  const primary = st.artifacts.filter((a     ) => a.kind === 'draft' || a.kind === 'weekly_report');
  const planned = st.project.publishingRules?.frequencyPerWeek ?? 0;
  const inReview = primary.filter((a     ) => a.status === 'IN_REVIEW').length;
  const approved = primary.filter((a     ) => a.status === 'APPROVED' || a.status === 'SCHEDULED').length;
  const published = primary.filter((a     ) => a.status === 'PUBLISHED').length;
  return h('div', { class: 'card', style: { marginBottom: '14px' } },
    h('div', { class: 'head' },
      h('div', null, h('h2', null, `Контент-план · ${st.project.currentWeek}`),
        h('div', { class: 'sub' }, `План: ${planned} публикации в неделю · согласующая: ${st.project.approvers.join(', ')}`)),
      h('div', { class: 'row' }, badge(`на согласовании ${inReview}`, inReview ? 'human' : ''), badge(`одобрено ${approved}`, approved ? 'ok' : ''), badge(`опубликовано ${published}`))),
    primary.length ? h('div', { class: 'grid three' }, ...primary.map((a     ) => {
      const task = st.tasks.find((t     ) => t.id === a.taskId);
      const platforms = platformsOf(app, a);
      const qr = a.qualityReport;
      return h('div', { class: 'pane plan-card' },
        h('div', { class: 'row' }, task ? kindChip(task.kind) : null, statusBadge(a.status), qr ? badge(`контроль: ${STATUS_LABEL[qr.verdict] ?? qr.verdict}`, qr.verdict === 'pass' ? 'ok' : 'warn') : badge('без проверки', 'warn')),
        h('div', { class: 'plan-title', style: { marginTop: '8px' } }, a.title),
        h('div', { class: 'muted small' }, platforms.length ? platforms.map((p) => PLATFORM_LABEL[p] ?? p).join(' · ') : 'площадки не заданы'),
        h('div', { class: 'small', style: { marginTop: '8px' } }, `${a.sources?.length ?? 0} источника · ${a.facts?.filter((f     ) => f.verified).length ?? 0} проверенных факта`),
        h('div', { class: 'muted small', style: { marginTop: '6px' } }, a.cta || 'CTA не задан'),
        h('button', { class: 'btn ghost sm', style: { marginTop: '10px' }, onClick: () => app.go('content', { artifact: a.id }) }, 'Открыть материал'));
    })) : h('div', { class: 'empty' }, 'Материалов недели пока нет'));
}

function filters(app     )              {
  const s = app.sel; const st = app.state;
  const set = (k        , v        ) => app.go('content', { status: s.status ?? 'all', kind: s.kind ?? 'all', platform: s.platform ?? 'all', campaign: s.campaign ?? 'all', q: s.q ?? '', [k]: v });
  const sel = (k        , opts                    ) => h('select', { onChange: (e       ) => set(k, (e.target                     ).value) }, ...opts.map(([v, l]) => h('option', { value: v, selected: (s[k] ?? 'all') === v }, l)));
  const q = h('input', { placeholder: 'Поиск по названию и тексту', value: s.q ?? '', onKeyDown: (e               ) => { if (e.key === 'Enter') set('q', (e.target                    ).value); }, onChange: (e       ) => set('q', (e.target                    ).value) });
  return h('div', { class: 'filters' },
    sel('status', [['all', 'Статус: все'], ...STATUSES.map((x)                   => [x, STATUS_LABEL[x] ?? x])]),
    sel('kind', [['all', 'Тип: все'], ['primary', 'Публикуемые'], ...Object.entries(ART_KIND).map(([k, v])                   => [k, v])]),
    sel('platform', [['all', 'Площадка: все'], ...PLATFORMS.map((p)                   => [p, PLATFORM_LABEL[p]])]),
    sel('campaign', [['all', 'Кампания: все'], ['none', 'без кампании'], ...st.campaigns.map((c     )                   => [c.id, c.name])]),
    q);
}

function sideList(app     , list       , selected     )              {
  const st = app.state;
  if (!list.length) return h('div', { class: 'empty' }, 'Под фильтры ничего не попало');
  return h('div', { class: 'list' }, ...list.map((a     ) => {
    const cmp = a.campaignId ? st.campaigns.find((c     ) => c.id === a.campaignId) : null;
    return h('div', { class: `item${selected?.id === a.id ? ' selected' : ''}`, onClick: () => app.go('content', { artifact: a.id }) },
      h('div', { class: 'body' }, h('div', { class: 'title small' }, a.title), h('div', { class: 'sub' }, `${ART_KIND[a.kind] ?? a.kind} · v${a.version}${cmp ? ` · ${cmp.name}` : ''}`), h('div', { style: { marginTop: '4px' } }, statusBadge(a.status))));
  }));
}

function briefPane(app     , a     , task     )              {
  const handoffs        = task?.handoffs ?? [];
  const research = [...handoffs].reverse().find((x) => x.from === 'market-researcher');
  const risks = handoffs.flatMap((x) => x.risks ?? []);
  const facts = a.facts?.length ? a.facts : (research?.facts ?? []);
  const sources = a.sources?.length ? a.sources : (research?.sources ?? []);
  return h('div', { class: 'pane' }, h('h3', null, 'Бриф и факты'),
    h('div', { class: 'meta-list' },
      task ? h('div', null, h('b', null, 'Цель: '), task.goal) : h('div', { class: 'muted' }, 'задача не найдена'),
      task?.plan?.criteria?.length ? h('div', null, h('b', null, 'Критерии: '), task.plan.criteria.join('; ')) : null,
      research ? h('div', null, h('b', null, 'Исследование: '), research.summary) : null),
    h('h3', { style: { marginTop: '10px' } }, 'Факты'),
    facts.length ? h('ul', { class: 'small brief-list' }, ...facts.map((f     ) => h('li', null, badge(f.type ?? 'fact'), ' ', f.text, ' ', f.verified ? badge('проверено', 'ok') : badge('не проверено', 'warn')))) : h('div', { class: 'muted small' }, '—'),
    h('h3', { style: { marginTop: '10px' } }, 'Источники'),
    sources.length ? h('ul', { class: 'small brief-list' }, ...sources.map((sr     ) => h('li', null, sr.title, sr.url ? [' — ', h('span', { class: 'mono' }, sr.url)] : null, sr.mock ? ' (mock)' : ''))) : h('div', { class: 'callout err small' }, 'Источников нет'),
    h('h3', { style: { marginTop: '10px' } }, 'Риски'),
    risks.length ? h('ul', { class: 'small brief-list' }, ...risks.map((r        ) => h('li', null, r))) : h('div', { class: 'muted small' }, '—'),
    task?.returnNotes?.length ? [h('h3', { style: { marginTop: '10px' } }, 'Замечания и возвраты'), h('ul', { class: 'small brief-list' }, ...task.returnNotes.map((n        ) => h('li', null, n)))] : null);
}

function editorPane(app     , a     , approval     )              {
  const st = app.state; const actor = app.actor();
  const locked = a.status === 'PUBLISHING' || a.status === 'PUBLISHED';
  const title = h('input', { value: a.title, disabled: locked })                    ;
  const body = h('textarea', { disabled: locked, style: { minHeight: '220px' } }, a.body)                       ;
  const cta = h('input', { value: a.cta, disabled: locked })                    ;
  const tags = h('input', { value: (a.hashtags ?? []).join(', '), placeholder: '#тег1, #тег2', disabled: locked })                    ;
  const channel = h('select', { disabled: locked }, h('option', { value: '', selected: !a.channelId }, 'канал не выбран'), ...st.channels.map((c     ) => h('option', { value: c.id, selected: c.id === a.channelId }, `${c.name} (${PLATFORM_LABEL[c.platform] ?? c.platform})`)))                     ;
  const when = h('input', { type: 'datetime-local', value: a.scheduledAt ? String(a.scheduledAt).slice(0, 16) : '', disabled: locked })                    ;
  const willRevoke = a.status === 'APPROVED' || a.status === 'SCHEDULED';
  const save = async () => {
    const patch      = {};
    if (title.value !== a.title) patch.title = title.value;
    if (body.value !== a.body) patch.body = body.value;
    if (cta.value !== a.cta) patch.cta = cta.value;
    const newTags = tags.value.split(',').map((t) => t.trim()).filter(Boolean);
    if (newTags.join(' ') !== (a.hashtags ?? []).join(' ')) patch.hashtags = newTags;
    if ((channel.value || null) !== (a.channelId ?? null)) patch.channelId = channel.value || null;
    if ((when.value || null) !== (a.scheduledAt ? String(a.scheduledAt).slice(0, 16) : null)) patch.scheduledAt = when.value || null;
    if (!Object.keys(patch).length) { app.act(async () => ({ state: st }), 'Изменений нет'); return; }
    const doSave = () => app.act(() => api.edit(app.pid, a.id, patch, actor, 'правка в редакторе'), willRevoke ? 'Сохранено: согласование отозвано, материал на проверке' : 'Сохранено: новая версия', willRevoke ? 'human' : 'ok');
    if (!willRevoke) { await doSave(); return; }
    const m = modal('Отозвать согласование?', h('div', { class: 'stack' },
      h('p', null, `Сохранение отзовёт согласование ${approval?.id ?? ''} (${approval?.approvedBy ?? ''}) и вернёт материал на проверку контролёра. Публикация станет невозможной до повторного решения.`),
      h('div', { class: 'actions' }, h('button', { class: 'btn human', onClick: async () => { m.close(); await doSave(); } }, 'Сохранить и отозвать'), h('button', { class: 'btn', onClick: () => m.close() }, 'Отмена'))));
  };
  return h('div', { class: 'pane' }, h('h3', null, 'Материал'),
    h('div', { class: 'form' },
      h('label', null, 'Заголовок', title), h('label', null, 'Текст', body), h('label', null, 'CTA', cta), h('label', null, 'Хэштеги', tags),
      h('div', { class: 'grid two' }, h('label', null, 'Канал', channel), h('label', null, 'Время публикации', when)),
      locked ? h('div', { class: 'callout' }, `Материал в статусе ${STATUS_LABEL[a.status] ?? a.status} — правка невозможна; новая версия создаётся отдельным материалом.`)
        : willRevoke ? h('div', { class: 'callout human' }, h('b', null, 'Внимание: '), `сохранение отзовёт согласование ${approval?.id ?? ''} и вернёт материал на проверку контролёра.`)
        : h('div', { class: 'muted small' }, 'Правка создаёт новую версию и пересчитывает хэш содержания.'),
      h('div', { class: 'actions' }, h('button', { class: willRevoke ? 'btn human' : 'btn primary', disabled: locked, onClick: save }, 'Сохранить правку'))));
}

function qualityCard(a     )              {
  const r = a.qualityReport;
  return h('div', { class: 'card' }, h('h3', null, 'Замечания контролёра'),
    !r ? h('div', { class: 'muted small' }, 'Контролёр качества ещё не проверял этот материал') : [
      h('div', { class: `callout ${r.verdict === 'pass' ? 'ok' : r.verdict === 'block' ? 'err' : 'human'}`, style: { marginBottom: '8px' } }, h('b', null, `${STATUS_LABEL[r.verdict] ?? r.verdict} `), `(${r.by === 'system' ? 'системная проверка' : 'quality-controller'}, v${r.artifactVersion}): `, r.reason),
      h('div', null, ...r.checks.map((c     ) => h('div', { class: `check-line ${c.passed ? 'pass' : c.severity === 'error' ? 'fail' : 'warn'}` }, h('span', { class: 'code' }, `${c.passed ? '✓' : '✗'} ${c.code}`), h('span', null, c.message, c.evidence?.length ? h('span', { class: 'muted' }, ` — ${c.evidence.join(', ')}`) : null)))),
      r.artifactVersion !== a.version ? h('div', { class: 'callout human small', style: { marginTop: '8px' } }, `Проверка относится к v${r.artifactVersion}; текущая v${a.version} — требуется повторная проверка.`) : null,
      h('div', { class: 'muted small', style: { marginTop: '6px' } }, 'Демо-эвристика на словарях shared/quality/. Контролёр не правит и не одобряет.')]);
}

function historyCard(app     , a     )              {
  const st = app.state;
  const aps = st.approvals.filter((x     ) => x.artifactId === a.id);
  const evs = st.events.filter((e     ) => e.refs?.artifactId === a.id && HISTORY_TYPES.test(e.type)).slice(0, 12);
  const chName = (id        ) => st.channels.find((c     ) => c.id === id)?.name ?? id;
  return h('div', { class: 'card' }, h('h3', null, 'История согласований и версий'),
    aps.length || evs.length ? h('div', { class: 'tl' },
      ...aps.map((ap     ) => h('div', { class: 't' }, h('div', { class: 'when' }, `${fmtDate(ap.approvedAt)} · ${ap.id}`), h('div', null, h('b', null, ap.approvedBy), ` одобрил v${ap.artifactVersion} → ${chName(ap.channelId)} на ${ap.scheduledAt} (${ap.timezone}) `, statusBadge(ap.status)), ap.revokedReason ? h('div', { class: 'muted small' }, `отозвано ${fmtDate(ap.revokedAt)}: ${ap.revokedReason}`) : null, h('div', { class: 'hash' }, `hash ${short(ap.contentHash, 12)}`))),
      ...evs.map((e     ) => h('div', { class: 't' }, h('div', { class: 'when' }, `${fmtDate(e.ts)} · ${e.type}`), h('div', null, e.message), h('div', { class: 'muted small' }, e.actor.kind === 'human' ? e.actor.name : e.actor.kind === 'agent' ? e.actor.roleId : 'система'))))
      : h('div', { class: 'muted small' }, 'Решений человека по этому материалу ещё не было'),
    h('h3', { style: { marginTop: '12px' } }, 'Версии'),
    h('div', null, h('div', { class: 'ver' }, h('b', null, `v${a.version}`), h('span', { class: 'hash' }, short(a.contentHash, 12)), h('span', { class: 'muted' }, `текущая · ${fmtDate(a.updatedAt)}`)),
      ...[...a.versions].reverse().map((v     ) => h('div', { class: 'ver' }, h('b', null, `v${v.version}`), h('span', { class: 'hash' }, short(v.contentHash, 12)), h('span', { class: 'muted' }, `${v.reason} · ${fmtDate(v.savedAt)}`)))));
}

let previewPlatform = 'vk';

function detail(app     , a     )              {
  const st = app.state; const actor = app.actor();
  const task = st.tasks.find((t     ) => t.id === a.taskId);
  const approval = st.approvals.find((x     ) => x.id === a.approvalId);
  const cmp = a.campaignId ? st.campaigns.find((c     ) => c.id === a.campaignId) : null;
  const head = h('div', { class: 'head' },
    h('div', null, h('h2', null, a.title), h('div', { class: 'row', style: { marginTop: '4px' } },
      task ? kindChip(task.kind) : badge(ART_KIND[a.kind] ?? a.kind), badge(`v${a.version}`), statusBadge(a.status), h('span', { class: 'hash' }, `hash ${short(a.contentHash)}`),
      approval ? badge(`approval ${approval.id}: ${STATUS_LABEL[approval.status]}`, approval.status === 'active' ? 'ok' : 'err') : null,
      cmp ? kindChip('campaign', cmp.name) : null, task?.archived ? badge('отклонено', 'err') : null,
      h('span', { class: 'muted small mono' }, `${a.id} · ${ART_KIND[a.kind] ?? a.kind} · автор ${a.authorRoleId} · ${fmtDate(a.updatedAt)}`))));
  const actions = h('div', { class: 'actions', style: { marginBottom: '12px' } },
    a.status === 'IN_REVIEW' ? h('button', { class: 'btn human', onClick: () => app.go('approvals', { artifact: a.id }) }, 'К согласованию') : null,
    a.status === 'APPROVED' ? h('button', { class: 'btn human', onClick: () => app.act(() => api.publish(app.pid, a.id, actor), 'Задание поставлено в очередь') }, 'В очередь публикации') : null,
    a.status === 'FAILED' ? h('button', { class: 'btn', onClick: () => app.act(() => api.retry(app.pid, a.id, actor), 'Новое задание создано') }, 'Повторить по решению человека') : null,
    task ? h('button', { class: 'btn ghost', onClick: () => app.go('tasks', { task: task.id }) }, 'К задаче') : null);
  const previewHolder = h('div', { class: 'pane' }, h('h3', null, 'Предпросмотр'));
  const renderPreview = () => { while (previewHolder.childNodes.length > 1) previewHolder.lastChild .remove(); previewHolder.appendChild(previewTabs(app, a, previewPlatform, (p) => { previewPlatform = p; renderPreview(); })); };
  renderPreview();
  return h('div', { class: 'card' }, head, actions,
    h('div', { class: 'editor' }, briefPane(app, a, task), editorPane(app, a, approval), previewHolder),
    h('div', { class: 'grid two', style: { marginTop: '14px' } }, qualityCard(a), historyCard(app, a)));
}

export function render(app     )              {
  if (!app.sel.kind) app.sel.kind = 'primary';
  const st = app.state;
  const list = filtered(app);
  const selected = st.artifacts.find((a     ) => a.id === app.sel.artifact) ?? list[0] ?? null;
  return h('div', null,
    h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Контент'), h('div', { class: 'sub' }, `Библиотека материалов проекта: ${st.artifacts.length}, под фильтры: ${list.length}. Правка одобренного материала отзывает согласование.`))),
    contentWeek(app),
    filters(app),
    h('div', { class: 'split content-split' }, h('div', { class: 'card side-list' }, sideList(app, list, selected)), selected ? detail(app, selected) : h('div', { class: 'empty' }, 'Выберите материал')));
}
