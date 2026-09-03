// Форма создания задачи (идея / пост / Reels / SEO / отчёт) с кампанией и желаемой датой. Открывается модально.
                                     
import { api } from '../api.js';
import { h, modal, KIND_LABEL, todayKey } from '../ui.js';

export function taskForm(app     , preset                                                                                                                      = {})              {
  const title = h('input', { placeholder: 'Название', required: true, value: preset.presetTitle ?? '' })                    ;
  const kind = h('select', null, ...app.state.kinds.map((k     ) => h('option', { value: k.kind, selected: k.kind === (preset.kind ?? 'post') }, `${k.label} · ${k.route.length} шагов`)))                     ;
  const goal = h('input', { placeholder: 'Цель (необязательно)' })                    ;
  const campaign = h('select', null, h('option', { value: '' }, 'без кампании'), ...app.state.campaigns.map((c     ) => h('option', { value: c.id, selected: c.id === preset.campaignId }, c.name)))                     ;
  const planned = h('input', { type: 'datetime-local', value: `${todayKey()}T11:00` })                    ;
  const asIdea = h('input', { type: 'checkbox', checked: Boolean(preset.asIdea) })                    ;
  const noSources = h('input', { type: 'checkbox' })                    ;
  const promise = h('input', { type: 'checkbox' })                    ;
  const pii = h('input', { type: 'checkbox' })                    ;
  const submit = async (run         ) => {
    if (!title.value.trim()) { title.focus(); return; }
    let created      = null;
    const ok = await app.act(async () => {
      const out = await api.createTask(app.pid, { title: title.value, kind: kind.value, goal: goal.value, asIdea: asIdea.checked, campaignId: campaign.value || null, plannedAt: planned.value || null, demo: { noSources: noSources.checked, promise: promise.checked, pii: pii.checked } });
      created = out.task; return out;
    }, asIdea.checked ? 'Идея добавлена' : 'Задача создана');
    if (ok && created) { preset.onDone?.(created); if (run) app.runDemo(created.id); }
  };
  return h('div', { class: 'form' },
    h('label', null, 'Название', title), h('label', null, 'Тип и маршрут', kind), h('label', null, 'Цель', goal),
    h('div', { class: 'grid two' }, h('label', null, 'Кампания', campaign), h('label', null, 'Желаемая дата публикации', planned)),
    h('label', { class: 'check' }, asIdea, 'оставить в «Идеях» — без маршрута'),
    h('details', null, h('summary', { class: 'muted small' }, 'Демо-сценарии для контролёра качества'),
      h('label', { class: 'check' }, noSources, 'исследователь не найдёт источников'), h('label', { class: 'check' }, promise, 'редактор вставит категорическое обещание'), h('label', { class: 'check' }, pii, 'в тексте окажутся персональные данные')),
    h('div', { class: 'actions' }, h('button', { class: 'btn primary', onClick: () => submit(!asIdea.checked) }, asIdea.checked ? 'Добавить идею' : 'Создать и запустить'), h('button', { class: 'btn', onClick: () => submit(false) }, 'Только создать')));
}

export function openTaskModal(app     , kind        , asIdea = false, campaignId                = null, presetTitle         ) {
  const label = asIdea ? 'Новая идея' : `Создать: ${KIND_LABEL[kind] ?? kind}`;
  const m = modal(label, taskForm(app, { kind, asIdea, campaignId, presetTitle, onDone: (t) => { m.close(); app.go('tasks', { task: t.id }); } }));
}
