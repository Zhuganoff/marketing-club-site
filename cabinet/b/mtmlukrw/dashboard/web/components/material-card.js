// Крупная карточка материала: текст, медиа-заглушка, площадки, время, риски, комментарий контролёра, решения человека.
                                     
import { api } from '../api.js?v=mtmlukrw';
import { h, badge, statusBadge, kindChip, modal, fmtDate, short, todayKey, PLATFORM_LABEL, STATUS_LABEL, ART_KIND } from '../ui.js?v=mtmlukrw';

                                   
                    
                    
                     
                               
                                  
  

function uniq(list          )           { return Array.from(new Set(list.filter(Boolean))); }

function platformsOf(app     , a     )           {
  const st = app.state;
  const channel = st.channels.find((c     ) => c.id === a.channelId);
  return uniq([channel?.platform, ...((a.channelVersions ?? []).map((v     ) => v.platform))]);
}

function risksOf(app     , a     )           {
  const task = app.state.tasks.find((t     ) => t.id === a.taskId);
  if (!task) return [];
  const risks = [...task.handoffs].reverse().flatMap((ho     ) => ho.risks ?? []);
  return uniq(risks).slice(0, 4);
}

function noteModal(title        , placeholder        , submitLabel        , kind        , onSubmit                                    )       {
  const ta = h('textarea', { placeholder, rows: 4 })                       ;
  const m = modal(title, h('div', { class: 'form' },
    h('label', null, 'Комментарий', ta),
    h('div', { class: 'actions' },
      h('button', { class: `btn ${kind}`, onClick: async () => { if (await onSubmit(ta.value.trim())) m.close(); } }, submitLabel),
      h('button', { class: 'btn ghost', onClick: () => m.close() }, 'Отмена'))));
}

function decisionForm(app     , a     , opts                     )              {
  const st = app.state; const actor = app.actor();
  const channelSel = h('select', null, ...st.channels.map((c     ) => h('option', { value: c.id, selected: c.id === a.channelId }, `${c.name} (${PLATFORM_LABEL[c.platform] ?? c.platform})`)))                     ;
  const defaultWhen = a.scheduledAt ? String(a.scheduledAt).slice(0, 16) : `${todayKey()}T11:00`;
  const when = h('input', { type: 'datetime-local', value: defaultWhen })                    ;
  const decide = async (fn                    , message        , kind = 'human') => {
    const ok = await app.act(fn, message, kind);
    if (ok) opts.onAfterDecision?.();
    return ok;
  };
  const reviewLater = async () => {
    const ok = await app.act(() => api.reviewLater(app.pid, a.id, actor), 'Оставили на потом — покажем снова после остальных', 'human');
    if (ok) opts.onAfterReviewLater?.();
  };
  return h('div', { class: 'decision-form' },
    h('div', { class: 'decision-settings' },
      h('label', null, h('span', null, 'Где опубликовать'), channelSel),
      h('label', null, h('span', null, 'Когда'), when)),
    h('div', { class: 'decision-main-actions', 'aria-label': 'Решение по материалу' },
      h('button', { class: 'btn human', onClick: () => decide(() => api.approve(app.pid, a.id, { actor, channelId: channelSel.value, scheduledAt: when.value }), 'Материал утверждён') }, 'Утвердить'),
      h('button', { class: 'btn', onClick: () => noteModal(`Вернуть «${a.title}» на правку`, 'Коротко напишите, что нужно исправить', 'Вернуть на правку', 'human', (note) => decide(() => api.reject(app.pid, a.id, note || 'нужно исправить материал', actor), 'Материал возвращён на правку')) }, 'Вернуть на правку'),
      h('button', { class: 'btn later', onClick: reviewLater }, 'Решить позже')),
    h('div', { class: 'decision-secondary' },
      h('span', { class: 'muted small' }, `Решение принимает ${actor}.`),
      h('button', { class: 'btn danger ghost sm', onClick: () => noteModal(`Отклонить «${a.title}»`, 'Причина отклонения. Материал будет снят с работы', 'Отклонить материал', 'danger', (note) => decide(() => api.decline(app.pid, a.id, note || 'без комментария', actor), 'Материал отклонён')) }, 'Отклонить материал')));
}

export function materialCard(app     , a     , opts                      = {})              {
  const st = app.state; const actor = app.actor();
  const task = st.tasks.find((t     ) => t.id === a.taskId);
  const campaign = a.campaignId ? st.campaigns.find((c     ) => c.id === a.campaignId) : null;
  const approval = a.approvalId ? st.approvals.find((x     ) => x.id === a.approvalId) : null;
  const channel = st.channels.find((c     ) => c.id === a.channelId);
  const platforms = platformsOf(app, a);
  const risks = risksOf(app, a);
  const qr = a.qualityReport;
  const failedChecks = qr ? qr.checks.filter((c     ) => !c.passed) : [];

  const head = h('div', { class: 'head' },
    h('div', null,
      h('div', { class: 'row' }, h('h2', null, a.title), opts.deferred ? badge('На потом', 'human') : null, task ? kindChip(task.kind) : badge(ART_KIND[a.kind] ?? a.kind), badge(`версия ${a.version}`), statusBadge(a.status)),
      h('div', { class: 'muted small' }, campaign ? [h('span', null, `кампания «${campaign.name}»`), ' · '] : null, `подготовлено командой · обновлено ${fmtDate(a.updatedAt)}`)),
    h('button', { class: 'btn ghost sm', onClick: () => app.go('content', { artifact: a.id }) }, 'Открыть полностью'));

  // Честная пометка (вопрос владельца 03.09 «что я здесь должен утвердить?»):
  // модель-писатель не подключена, тексты — заготовки для проверки маршрута и решений.
  const draftNote = a.kind === 'draft' || a.kind === 'channel_versions'
    ? (a.generatedBy === 'model'
      ? h('div', { class: 'callout human', style: { marginBottom: '8px' } }, h('b', null, 'Написано моделью. '), 'Текст подготовила настоящая модель по брифу команды, проверен контролёром — решение за вами.')
      : h('div', { class: 'callout', style: { marginBottom: '8px' } }, h('b', null, 'Это заготовка. '), 'Текст собран из шаблона (модель была недоступна) — команда показывает, как пойдёт работа. Правится как обычный материал.'))
    : null;
  const excerpt = h('div', { class: 'excerpt' }, a.body, a.cta ? `\n\n${a.cta}` : '', a.hashtags?.length ? `\n${a.hashtags.join(' ')}` : '');
  const media = h('div', { class: 'media-ph' }, a.media?.length ? `${a.media[0].kind}: ${a.media[0].description}` : 'медиа не задано');
  const meta = h('div', { class: 'meta-list' },
    h('div', null, h('b', null, 'Площадки: '), platforms.length ? h('span', { class: 'chips' }, ...platforms.map((p) => badge(PLATFORM_LABEL[p] ?? p))) : h('span', { class: 'muted' }, 'не заданы')),
    h('div', null, h('b', null, 'Канал: '), channel ? channel.name : h('span', { class: 'muted' }, 'не выбран')),
    h('div', null, h('b', null, 'Время: '), a.scheduledAt ? `${String(a.scheduledAt).replace('T', ' ')} ${a.timezone}` : h('span', { class: 'muted' }, 'не задано')),
    h('div', null, h('b', null, 'Риски: '), risks.length ? h('ul', { class: 'risk-list' }, ...risks.map((r) => h('li', null, r))) : h('span', { class: 'muted' }, 'не отмечены')),
    h('div', null, h('b', null, 'Проверка перед публикацией: '), qr
      ? [badge(STATUS_LABEL[qr.verdict] ?? qr.verdict, qr.verdict === 'pass' ? 'ok' : qr.verdict === 'block' ? 'err' : 'warn'), ' ', h('span', null, qr.reason),
        failedChecks.length ? h('ul', { class: 'risk-list' }, ...failedChecks.map((c     ) => h('li', null, h('span', { class: 'mono' }, c.code), ' — ', c.message))) : null]
      : h('span', { class: 'muted' }, 'проверка ещё не проводилась')),
    approval ? h('div', null, h('b', null, 'Согласование: '), badge(STATUS_LABEL[approval.status] ?? approval.status, approval.status === 'active' ? 'ok' : 'err'), ` ${approval.approvedBy} · ${fmtDate(approval.approvedAt)} · хэш ${short(approval.contentHash)}`, approval.revokedReason ? h('div', { class: 'muted small' }, `отозвано: ${approval.revokedReason}`) : null) : null,
    a.status === 'FAILED' ? h('div', null, h('b', null, 'Публикация: '), badge(`неудачных попыток: ${a.failedAttempts}`, 'err'), ' автоповтора нет') : null);

  const actions = opts.actions ? h('div', { class: 'card-actions' },
    a.status === 'IN_REVIEW' ? decisionForm(app, a, opts) : null,
    a.status === 'APPROVED' ? h('div', { class: 'actions' }, h('button', { class: 'btn human', onClick: () => app.act(() => api.publish(app.pid, a.id, actor), 'Задание поставлено в очередь') }, 'В очередь публикации')) : null,
    a.status === 'FAILED' ? h('div', { class: 'actions' }, h('button', { class: 'btn', onClick: () => app.act(() => api.retry(app.pid, a.id, actor), 'Новое задание создано') }, 'Повторить по решению человека')) : null,
  ) : null;

  if (opts.compact) {
    return h('div', { class: `bigcard compact${opts.deferred ? ' deferred' : ''}` }, head,
      h('div', { class: 'compact-meta muted small' },
        platforms.length ? platforms.map((p) => PLATFORM_LABEL[p] ?? p).join(', ') : 'площадки не заданы', ' · ',
        a.scheduledAt ? String(a.scheduledAt).replace('T', ' ') : 'время не задано', ' · ',
        qr ? `проверка: ${STATUS_LABEL[qr.verdict] ?? qr.verdict}` : 'без проверки',
        risks.length ? ` · рисков: ${risks.length}` : ''),
      actions);
  }
  return h('div', { class: `bigcard${opts.deferred ? ' deferred' : ''}` }, head, draftNote, h('div', { class: 'grid-3' }, excerpt, media, meta), actions);
}
