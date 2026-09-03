// Маршруты, оркестрация и mock-провайдер. См. docs/WORKFLOW_CATALOG.md и docs/ARCHITECTURE.md §5.
             
                                                                                                     
                                               
                    
import { DomainError } from './types.js?v=mtlq3kut';
import { computeContentHash, sha256 } from './hash.js?v=mtlq3kut';
import { nextId, taskId as makeTaskId } from './ids.js?v=mtlq3kut';
import { pushEvent } from './events.js?v=mtlq3kut';
import { buildQualityReport } from './quality.js?v=mtlq3kut';
import { getTask } from './approval.js?v=mtlq3kut';
import { ctaFromProfile, seoProfileBrief } from './seo.js?v=mtlq3kut';

export const ROUTES                             = {
  post: ['market-researcher', 'chief-editor', 'creative-director', 'channel-editor', 'quality-controller'],
  reels: ['brand-strategist', 'market-researcher', 'chief-editor', 'reels-producer', 'creative-director', 'channel-editor', 'quality-controller'],
  seo_page: ['seo-strategist', 'market-researcher', 'chief-editor', 'quality-controller'],
  weekly_report: ['funnel-analyst', 'marketing-director'],
};

export const KIND_LABELS                           = { post: 'Пост', reels: 'Reels', seo_page: 'SEO-страница', weekly_report: 'Недельный отчёт' };
export const BUSY_MS = 1400;

                                                   
                                                                                                                                                                          

function t(state              , ru        , en        )         {
  return state.project.language === 'en' ? en : ru;
}

function instance(state              , roleId        )                            {
  return state.agents.find((a) => a.roleId === roleId);
}

function charge(state              , now        , agent               , def                 , taskId        )         {
  const cost = def.isLlm ? def.budget.perTaskUsd : 0;
  if (agent.budget.spentUsd + cost > agent.budget.limitUsd) {
    agent.status = 'error';
    agent.errorMessage = `Лимит ${agent.budget.limitUsd.toFixed(2)} $/нед исчерпан (потрачено ${agent.budget.spentUsd.toFixed(2)} $)`;
    pushEvent(state, now, { kind: 'system' }, 'budget.exceeded', `${def.name}: ${agent.errorMessage}`, { taskId, roleId: agent.roleId }, 'error');
    throw new DomainError('BUDGET_EXCEEDED', agent.errorMessage);
  }
  const projectSpent = state.agents.reduce((sum, a) => sum + a.budget.spentUsd, 0);
  if (projectSpent + cost > state.project.weeklyLimitUsd) {
    const msg = `Контрольный потолок проекта ${state.project.weeklyLimitUsd.toFixed(2)} $/нед исчерпан (потрачено ${projectSpent.toFixed(2)} $)`;
    pushEvent(state, now, { kind: 'system' }, 'budget.project_exceeded', msg, { taskId, roleId: agent.roleId }, 'error');
    throw new DomainError('PROJECT_BUDGET_EXCEEDED', msg);
  }
  agent.budget.spentUsd = Math.round((agent.budget.spentUsd + cost) * 100) / 100;
  return cost;
}

function mockSources(state              , topic        )           {
  return [
    { title: t(state, `Отраслевой обзор по теме «${topic}» (mock)`, `Industry overview on “${topic}” (mock)`), url: 'https://example.invalid/industry-overview', checkedAt: state.project.currentWeek, mock: true },
    { title: t(state, 'Утверждённые факты проекта (shared/brand)', 'Approved project facts (shared/brand)'), mock: true },
  ];
}

// ---------- создание и планирование задачи ----------

export function createTask(state              , now        , catalog         , input              , actor       )       {
  if (!input.title?.trim()) throw new DomainError('TITLE_REQUIRED', 'Укажите название задачи');
  if (!ROUTES[input.kind]) throw new DomainError('UNKNOWN_KIND', `Неизвестный вид задачи: ${String(input.kind)}`);
  const task       = {
    id: makeTaskId(state, now), projectId: state.project.id, title: input.title.trim(), kind: input.kind,
    goal: input.goal?.trim() || input.title.trim(), column: 'ideas', route: [], stepIndex: 0, handoffs: [], artifactIds: [],
    risks: [], blockedReason: null, returnNotes: [], createdBy: actor.kind === 'human' ? actor.name : 'system',
    createdAt: now, updatedAt: now, primaryArtifactId: null, demo: input.demo,
    campaignId: input.campaignId ?? null, plannedAt: input.plannedAt ?? null,
  };
  if (task.campaignId && !state.campaigns.some((c) => c.id === task.campaignId)) throw new DomainError('CAMPAIGN_NOT_FOUND', `Кампания ${task.campaignId} не найдена в проекте`);
  state.tasks.unshift(task);
  pushEvent(state, now, actor, 'task.created', `Создана задача «${task.title}» (${KIND_LABELS[task.kind]})`, { taskId: task.id });
  if (!input.asIdea) planTask(state, now, catalog, task.id);
  return task;
}

export function planTask(state              , now        , catalog         , taskId        )       {
  const task = getTask(state, taskId);
  if (task.column !== 'ideas') throw new DomainError('WRONG_COLUMN', 'Планировать можно только задачу из колонки «Идеи»');
  const director = instance(state, 'marketing-director');
  const def = catalog.get('marketing-director');
  if (!director || !def || director.status === 'disabled') throw new DomainError('ROLE_DISABLED', 'В проекте не включён marketing-director');
  const route = ROUTES[task.kind];
  const missing = route.filter((r) => { const i = instance(state, r); return !i || i.status === 'disabled'; });
  if (missing.length) throw new DomainError('ROLE_DISABLED', `Для маршрута «${KIND_LABELS[task.kind]}» в проекте не включены роли: ${missing.join(', ')}`);

  charge(state, now, director, def, task.id);
  task.route = [...route];
  task.stepIndex = 0;
  task.column = 'planned';
  task.plan = {
    goal: task.goal,
    criteria: [
      t(state, 'каждый факт опирается на источник', 'every fact rests on a source'),
      t(state, 'нет категорических обещаний и персональных данных', 'no categorical promises, no personal data'),
      t(state, 'финальное решение — за человеком-согласующим', 'final decision by the human approver'),
    ],
    subtasks: route.map((r) => `${catalog.get(r)?.name ?? r}: ${catalog.get(r)?.output.artifactKind ?? ''}`),
  };
  const handoff               = {
    id: nextId(state, 'ho'), taskId: task.id, from: 'marketing-director', to: route[0], status: 'ready_for_review',
    summary: t(state, `Маршрут «${KIND_LABELS[task.kind]}»: ${route.join(' → ')} → согласование человеком. Роли вне маршрута не запускаются.`,
      `Route “${KIND_LABELS[task.kind]}”: ${route.join(' → ')} → human approval. Roles outside the route are not started.`),
    facts: [], sources: [], assumptions: [t(state, 'Цель сформулирована человеком и не требует уточнения', 'Goal was set by the human and needs no clarification')],
    risks: [t(state, 'Сроки: недельный план проекта', 'Timing: weekly project plan')], deliverableId: null, deliverableKind: 'task_plan',
    qualityChecks: [], requiresApproval: false, costUsd: def.budget.perTaskUsd, model: director.model, createdAt: now,
  };
  task.handoffs.push(handoff);
  director.runs += 1; director.lastRunAt = now; director.busyUntil = new Date(Date.parse(now) + BUSY_MS).toISOString();
  task.updatedAt = now;
  pushEvent(state, now, { kind: 'agent', roleId: 'marketing-director' }, 'task.planned', `Директор выбрал маршрут для «${task.title}»: ${route.join(' → ')}`, { taskId: task.id, roleId: 'marketing-director' });
  return task;
}

// ---------- выполнение шага маршрута ----------

export function advanceTask(state              , now        , catalog         , taskId        )                                        {
  const task = getTask(state, taskId);
  if (task.archived) throw new DomainError('ARCHIVED', 'Задача отклонена и архивирована');
  if (task.column === 'ideas') throw new DomainError('NOT_PLANNED', 'Задача ещё не запланирована директором');
  if (task.blockedReason) throw new DomainError('BLOCKED', `Задача заблокирована контролёром: ${task.blockedReason}`);
  if (task.column === 'in_review' || task.column === 'approved' || task.column === 'published') {
    throw new DomainError('WAITING_HUMAN', 'Задача ждёт решения человека — агенты не продолжают работу');
  }
  if (task.stepIndex >= task.route.length) throw new DomainError('ROUTE_DONE', 'Маршрут выполнен');

  const roleId = task.route[task.stepIndex];
  const agent = instance(state, roleId);
  const def = catalog.get(roleId);
  if (!agent || !def || agent.status === 'disabled') throw new DomainError('ROLE_DISABLED', `Роль ${roleId} не включена в проекте`);
  const cost = charge(state, now, agent, def, task.id);

  agent.status = 'working';
  agent.currentTaskId = task.id;
  agent.busyUntil = new Date(Date.parse(now) + BUSY_MS).toISOString();
  agent.runs += 1;
  agent.lastRunAt = now;
  if (task.column === 'planned') task.column = 'in_progress';

  const nextRole                            = task.stepIndex + 1 < task.route.length ? task.route[task.stepIndex + 1] : 'approval_queue';
  const produced = produce(state, now, catalog, task, roleId, nextRole);
  produced.handoff.costUsd = cost;
  produced.handoff.model = agent.model;
  task.handoffs.push(produced.handoff);
  task.stepIndex += 1;
  task.updatedAt = now;
  agent.status = 'idle';
  agent.currentTaskId = null;

  pushEvent(state, now, { kind: 'agent', roleId }, 'handoff', `${def.name} → ${nextRole === 'approval_queue' ? 'очередь согласования' : catalog.get(nextRole)?.name}: ${produced.handoff.summary.slice(0, 120)}`, { taskId: task.id, roleId, artifactId: produced.handoff.deliverableId ?? undefined }, produced.handoff.status === 'blocked' ? 'error' : 'info');

  if (roleId === 'quality-controller') {
    applyVerdict(state, now, task, produced.handoff);
  } else if (nextRole === 'approval_queue') {
    // маршрут без контролёра (недельный отчёт): системная проверка теми же правилами
    const primary = state.artifacts.find((a) => a.id === task.primaryArtifactId);
    if (primary) {
      primary.qualityReport = buildQualityReport(state, now, primary, 'system');
      pushEvent(state, now, { kind: 'system' }, 'quality.system', `Системная проверка качества «${primary.title}»: ${primary.qualityReport.verdict} — ${primary.qualityReport.reason.slice(0, 140)}`, { taskId: task.id, artifactId: primary.id }, primary.qualityReport.verdict === 'pass' ? 'info' : 'warn');
      if (primary.qualityReport.verdict === 'pass') { primary.status = 'IN_REVIEW'; task.column = 'in_review'; }
      else { task.blockedReason = primary.qualityReport.reason; task.column = 'quality_control'; }
    }
  } else if (nextRole === 'quality-controller') {
    task.column = 'quality_control';
  }
  return { task, handoff: produced.handoff };
}

function applyVerdict(state              , now        , task      , handoff              ) {
  const primary = state.artifacts.find((a) => a.id === task.primaryArtifactId);
  if (!primary || !primary.qualityReport) return;
  const verdict = primary.qualityReport.verdict;
  if (verdict === 'pass') {
    primary.status = 'IN_REVIEW';
    task.column = 'in_review';
    const author = instance(state, primary.authorRoleId);
    if (author) { author.status = 'waiting_approval'; author.currentTaskId = task.id; }
    pushEvent(state, now, { kind: 'agent', roleId: 'quality-controller' }, 'quality.pass', `«${primary.title}» v${primary.version} передан в очередь согласования человека`, { taskId: task.id, artifactId: primary.id });
  } else if (verdict === 'return') {
    // Лимит возвратов (решение владельца 03.09, из анализа SMM-модуля): контролёр
    // возвращает материал автору не более 2 раз; третий подряд — блокировка и решение человека.
    const priorReturns = task.returnNotes.filter((n) => n.startsWith('quality-controller:')).length;
    if (priorReturns >= 2) {
      task.blockedReason = `Третий возврат контролёра подряд — решение передано человеку: ${primary.qualityReport.reason}`;
      task.column = 'quality_control';
      primary.status = 'DRAFT';
      handoff.status = 'blocked';
      pushEvent(state, now, { kind: 'agent', roleId: 'quality-controller' }, 'quality.block', `«${primary.title}» ЗАБЛОКИРОВАН после ${priorReturns} возвратов: ${primary.qualityReport.reason}`, { taskId: task.id, artifactId: primary.id }, 'error');
      return;
    }
    task.column = 'in_progress';
    task.stepIndex = Math.max(task.route.indexOf('chief-editor'), 0);
    task.returnNotes.push(`quality-controller: ${primary.qualityReport.reason}`);
    primary.status = 'DRAFT';
    pushEvent(state, now, { kind: 'agent', roleId: 'quality-controller' }, 'quality.return', `«${primary.title}» возвращён редактору: ${primary.qualityReport.reason}`, { taskId: task.id, artifactId: primary.id }, 'warn');
  } else {
    task.blockedReason = primary.qualityReport.reason;
    task.column = 'quality_control';
    primary.status = 'DRAFT';
    handoff.status = 'blocked';
    pushEvent(state, now, { kind: 'agent', roleId: 'quality-controller' }, 'quality.block', `«${primary.title}» ЗАБЛОКИРОВАН: ${primary.qualityReport.reason}`, { taskId: task.id, artifactId: primary.id }, 'error');
  }
}

// Человек снимает блокировку: задача возвращается редактору, демо-дефекты считаются устранёнными в брифе.
export function unblockTask(state              , now        , taskId        , actor       , note        )       {
  const task = getTask(state, taskId);
  if (actor.kind !== 'human') throw new DomainError('HUMAN_REQUIRED', 'Снять блокировку может только человек');
  if (!task.blockedReason) throw new DomainError('NOT_BLOCKED', 'Задача не заблокирована');
  task.returnNotes.push(`${actor.name}: ${note || 'снять блокировку, переработать'}`);
  task.blockedReason = null;
  task.demo = {};
  task.column = 'in_progress';
  const editorIdx = task.route.indexOf('chief-editor');
  task.stepIndex = editorIdx >= 0 ? editorIdx : 0;
  task.updatedAt = now;
  pushEvent(state, now, actor, 'task.unblocked', `Блокировка снята, задача «${task.title}» возвращена на доработку`, { taskId: task.id }, 'warn');
  return task;
}

// ---------- mock-провайдер ----------

function baseHandoff(state              , task      , from        , to                           , kind              , now        )               {
  return {
    id: nextId(state, 'ho'), taskId: task.id, from, to, status: 'ready_for_review', summary: '', facts: [], sources: [], assumptions: [], risks: [],
    deliverableId: null, deliverableKind: kind, qualityChecks: [], requiresApproval: to === 'approval_queue', costUsd: 0, model: null, createdAt: now,
  };
}

function newArtifact(state              , now        , task      , kind              , author        , title        , body        , extra                           = {})                  {
  const a                  = {
    id: nextId(state, 'art'), projectId: state.project.id, taskId: task.id, kind, version: 1, title, body, cta: '', hashtags: [], media: [],
    channelId: null, scheduledAt: (kind === 'draft' || kind === 'weekly_report') ? task.plannedAt : null, timezone: state.project.timezone, sources: [], facts: [], status: 'DRAFT', contentHash: '',
    approvalId: null, authorRoleId: author, qualityReport: null, versions: [], failedAttempts: 0, createdAt: now, updatedAt: now, campaignId: task.campaignId ?? null, ...extra,
  };
  a.contentHash = computeContentHash(a);
  state.artifacts.unshift(a);
  task.artifactIds.push(a.id);
  return a;
}

function lastHandoffOf(task      , role        )                           {
  return [...task.handoffs].reverse().find((h) => h.from === role);
}

function produce(state              , now        , catalog         , task      , role        , to                           )                            {
  const p = state.project;
  const def = catalog.get(role) ;
  const h = baseHandoff(state, task, role, to, def.output.artifactKind, now);
  const topic = task.title;
  const primary = state.artifacts.find((a) => a.id === task.primaryArtifactId) ?? null;

  switch (role) {
    case 'brand-strategist': {
      const body = t(state,
        `Позиционирование: ${p.name} — ${p.brand.tone}.\nСегменты: ${p.audience}.\nКлючевое сообщение: польза без обещаний результата.\nДоказательства: ${p.brand.proofs.join('; ')}.\nОтличие: конкретика вместо общих слов.`,
        `Positioning: ${p.name} — ${p.brand.tone}.\nSegments: ${p.audience}.\nKey message: value without promised outcomes.\nProofs: ${p.brand.proofs.join('; ')}.\nDifference: specifics instead of generic claims.`);
      const a = newArtifact(state, now, task, 'strategy_brief', role, t(state, `Стратегический бриф: ${topic}`, `Strategy brief: ${topic}`), body, { sources: mockSources(state, topic).slice(1) });
      h.deliverableId = a.id; h.summary = t(state, 'Стратегический бриф: позиционирование, сегменты, сообщения и доказательства', 'Strategy brief: positioning, segments, messages, proofs');
      h.sources = a.sources; h.assumptions = [t(state, 'Брендбук проекта актуален', 'Project brand book is current')];
      break;
    }
    case 'market-researcher': {
      const noSources = Boolean(task.demo?.noSources);
      const facts         = noSources
        ? [{ text: t(state, `Аудитория интересуется темой «${topic}»`, `Audience is interested in “${topic}”`), verified: false, type: 'fact' }]
        : [
          { text: t(state, `Тема «${topic}» входит в число частых вопросов аудитории (${p.audience})`, `“${topic}” is among frequent audience questions (${p.audience})`), source: 'https://example.invalid/industry-overview', verified: true, type: 'fact' },
          { text: t(state, 'Конкуренты чаще обещают результат, чем объясняют процесс', 'Competitors promise outcomes more often than they explain the process'), verified: true, source: 'https://example.invalid/industry-overview', type: 'fact' },
          { text: t(state, 'Формат «разбор типичной ошибки» соберёт больше сохранений', 'A “typical mistake breakdown” format will get more saves'), verified: false, type: 'hypothesis' },
        ];
      const sources = noSources ? [] : mockSources(state, topic);
      const a = newArtifact(state, now, task, 'research_brief', role, t(state, `Исследовательский бриф: ${topic}`, `Research brief: ${topic}`),
        facts.map((f) => `[${f.type}] ${f.text}${f.source ? ` — ${f.source}` : ''}`).join('\n'), { sources, facts });
      h.deliverableId = a.id; h.facts = facts; h.sources = sources;
      h.summary = noSources
        ? t(state, 'Бриф без подтверждённых источников (демо-сценарий): только наблюдения', 'Brief without confirmed sources (demo scenario): observations only')
        : t(state, `Найдено ${facts.length} утверждений, ${sources.length} источника (mock), 1 гипотеза`, `${facts.length} statements, ${sources.length} sources (mock), 1 hypothesis`);
      h.risks = [t(state, 'Источники — демонстрационные, реальный поиск не подключён', 'Sources are demo placeholders; real search is not connected')];
      h.assumptions = [t(state, 'География и язык — из профиля проекта', 'Geography and language come from the project profile')];
      break;
    }
    case 'seo-strategist': {
      let body = t(state, `Семантика: «${topic}», «${topic} цена», «${topic} как выбрать».\nКонтент-гэп: нет страницы с разбором процесса.\nСтруктура: H1 → проблема → процесс → доказательства → CTA.\nЧек-лист индексации: title, description, внутренние ссылки.`,
        `Semantics: “${topic}”, “${topic} price”, “how to choose ${topic}”.\nContent gap: no page explaining the process.\nStructure: H1 → problem → process → proofs → CTA.\nIndexing checklist: title, description, internal links.`);
      // Анкета SEO проекта (решение владельца 03.09): заполненные владельцем ключи и гео попадают в бриф.
      if (state.seoProfile) {
        const briefLine = seoProfileBrief(state.seoProfile);
        if (briefLine) body += t(state, `\nАнкета проекта: ${briefLine}.`, `\nProject questionnaire: ${briefLine}.`);
      }
      const a = newArtifact(state, now, task, 'seo_task', role, t(state, `SEO-задание: ${topic}`, `SEO task: ${topic}`), body, { sources: mockSources(state, topic).slice(0, 1) });
      h.deliverableId = a.id; h.sources = a.sources; h.summary = t(state, 'SEO-задание редактору: семантика, структура, чек-лист', 'SEO task for the editor: semantics, structure, checklist');
      h.assumptions = [t(state, 'Структура сайта — mock', 'Site structure is mock')];
      break;
    }
    case 'chief-editor': {
      const research = lastHandoffOf(task, 'market-researcher');
      const facts = research?.facts ?? [];
      const sources = research?.sources ?? [];
      const proof = p.brand.proofs[0] ?? '';
      let body = t(state,
        `${topic}: разбираем без обещаний.\n\nЧто важно знать: ${facts[0]?.text ?? 'тема требует спокойного объяснения'}.\nКак мы работаем: объясняем процесс, показываем, что проверить самому.\nДоказательство: ${proof}.\n\nАльтернативный хук: «Ошибка, которую совершают до первой консультации».`,
        `${topic}: explained without promises.\n\nWhat matters: ${facts[0]?.text ?? 'the topic needs a calm explanation'}.\nHow we work: we explain the process and show what to check yourself.\nProof: ${proof}.\n\nAlternative hook: “The mistake people make before the first consultation.”`);
      if (task.demo?.promise) body += t(state, '\n\nГарантируем результат — 100% успех в каждом случае.', '\n\nWe guarantee results — 100% success in every case.');
      if (task.demo?.pii) body += t(state, '\n\nОтзыв: Петров И. С., тел. +7 999 123-45-67.', '\n\nReview: Petrov I. S., phone +7 999 123-45-67.');
      // CTA-блок из анкеты (решение владельца 03.09): для SEO-страниц — формула
      // «призыв → чем занимаемся → регион → контакты»; правится на согласовании как любой текст.
      const profileCta = task.kind === 'seo_page' ? ctaFromProfile(state) : null;
      const cta = profileCta ?? t(state, 'Задайте вопрос — ответим спокойно и по делу.', 'Ask a question — we answer calmly and to the point.');
      const hashtags = [`#${p.id.replace(/[^a-z0-9]/gi, '')}`, t(state, '#разбор', '#explained')];
      if (primary && primary.kind === 'draft') {
        primary.versions.push({ version: primary.version, title: primary.title, body: primary.body, cta: primary.cta, hashtags: [...primary.hashtags], contentHash: primary.contentHash, savedAt: now, reason: 'доработка редактором' });
        primary.body = body; primary.cta = cta; primary.hashtags = hashtags; primary.version += 1; primary.sources = sources; primary.facts = facts;
        primary.status = 'DRAFT'; primary.contentHash = computeContentHash(primary); primary.updatedAt = now;
        h.deliverableId = primary.id;
        h.summary = t(state, `Черновик переработан (v${primary.version}) с учётом замечаний: ${task.returnNotes.at(-1) ?? ''}`, `Draft reworked (v${primary.version}) per notes: ${task.returnNotes.at(-1) ?? ''}`);
      } else {
        const a = newArtifact(state, now, task, 'draft', role, topic, body, { cta, hashtags, sources, facts });
        task.primaryArtifactId = a.id;
        h.deliverableId = a.id;
        h.summary = t(state, 'Основной вариант + альтернативный хук; факты со ссылками; формулировки для проверки отмечены', 'Main version + alternative hook; facts with sources; phrases to verify marked');
      }
      h.facts = facts; h.sources = sources;
      h.assumptions = [t(state, 'Тон — из брендбука проекта', 'Tone per the project brand book')];
      h.risks = task.demo?.promise ? [t(state, 'В тексте есть категорическое обещание (демо-сценарий)', 'Text contains a categorical promise (demo scenario)')] : [t(state, 'Формулировку доказательства проверить у владельца', 'Verify the proof wording with the owner')];
      break;
    }
    case 'reels-producer': {
      const body = t(state,
        `Хук 0–2 с: «${topic}? Сначала проверьте одно».\n0–2 с — крупный план, текст на экране: «Одна проверка».\n2–10 с — процесс, субтитры: что происходит на первой консультации.\n10–25 с — доказательство: ${p.brand.proofs[0] ?? ''}.\n25–30 с — CTA: «Напишите нам».\nМонтаж: 30 с, вертикаль 9:16, субтитры обязательны.`,
        `Hook 0–2s: “${topic}? Check one thing first.”\n0–2s — close-up, on-screen text: “One check”.\n2–10s — process, captions: what happens at the first consultation.\n10–25s — proof: ${p.brand.proofs[0] ?? ''}.\n25–30s — CTA: “Message us”.\nEdit: 30s, vertical 9:16, captions required.`);
      const a = newArtifact(state, now, task, 'reel_brief', role, t(state, `Раскадровка Reels: ${topic}`, `Reels storyboard: ${topic}`), body, { sources: primary?.sources ?? [] });
      h.deliverableId = a.id; h.sources = a.sources; h.summary = t(state, 'Раскадровка 30 с: хук, кадры, текст на экране, субтитры, CTA, ТЗ на монтаж', '30s storyboard: hook, shots, on-screen text, captions, CTA, edit brief');
      h.risks = [t(state, 'Съёмка и монтаж — вне первого релиза', 'Shooting and editing are outside release 1')];
      break;
    }
    case 'creative-director': {
      const body = t(state, `Вердикт: характер есть — спокойная экспертность вместо агрессии.\nВизуальный крючок: крупный план детали и одна строка текста.\nКомпозиция: центр, много воздуха; настроение: ${p.brand.visual}.\nОграничения: без стоковых улыбок, без «AI-глянца».`,
        `Verdict: it has character — calm expertise instead of aggression.\nVisual hook: close-up detail and a single line of text.\nComposition: centred, lots of air; mood: ${p.brand.visual}.\nLimits: no stock smiles, no “AI gloss”.`);
      const a = newArtifact(state, now, task, 'creative_concept', role, t(state, `Визуальная концепция: ${topic}`, `Visual concept: ${topic}`), body);
      if (primary && primary.status === 'DRAFT') {
        const desc = t(state, 'Крупный план детали, одна строка текста', 'Close-up detail, single text line');
        primary.media = [{ id: `${primary.id}-img1`, kind: 'image', description: desc, hash: sha256(desc).slice(0, 16) }];
        primary.contentHash = computeContentHash(primary); primary.updatedAt = now;
      }
      h.deliverableId = a.id; h.summary = t(state, 'Идея принята: есть визуальный крючок; описание референса и ограничения бренда переданы', 'Idea accepted: visual hook exists; reference description and brand limits handed over');
      h.assumptions = [t(state, 'Изображения не генерируются в первом релизе', 'No image generation in release 1')];
      break;
    }
    case 'channel-editor': {
      const platforms = Array.from(new Set(state.channels.map((c) => c.platform)));
      if (primary && primary.status === 'DRAFT') {
        primary.channelVersions = platforms.map((platform) => ({ platform, body: adapt(state, platform, primary.body, primary.cta) }));
        primary.updatedAt = now;
      }
      const a = newArtifact(state, now, task, 'channel_versions', role, t(state, `Версии под каналы: ${topic}`, `Channel versions: ${topic}`), platforms.map((pl) => `— ${pl}: ${t(state, 'адаптировано по формату и длине', 'adapted to format and length')}`).join('\n'), { sources: primary?.sources ?? [] });
      h.deliverableId = a.id; h.sources = a.sources; h.summary = t(state, `Подготовлены версии для: ${platforms.join(', ')}; смысл и факты базовой версии не менялись`, `Versions prepared for: ${platforms.join(', ')}; meaning and facts unchanged`);
      break;
    }
    case 'quality-controller': {
      if (!primary) throw new DomainError('NO_PRIMARY', 'Нет основного материала для проверки');
      primary.qualityReport = buildQualityReport(state, now, primary, 'quality-controller');
      const report = newArtifact(state, now, task, 'quality_report', role, t(state, `Отчёт контролёра: ${topic}`, `Quality report: ${topic}`),
        primary.qualityReport.checks.map((c) => `${c.passed ? '✓' : '✗'} ${c.code}: ${c.message}`).join('\n') + `\n\n${t(state, 'Вердикт', 'Verdict')}: ${primary.qualityReport.verdict} — ${primary.qualityReport.reason}`,
        { sources: primary.sources });
      h.deliverableId = report.id; h.qualityChecks = primary.qualityReport.checks; h.sources = primary.sources; h.facts = primary.facts;
      h.summary = `${primary.qualityReport.verdict.toUpperCase()}: ${primary.qualityReport.reason}`;
      h.status = primary.qualityReport.verdict === 'block' ? 'blocked' : 'ready_for_review';
      h.risks = [t(state, 'Контролёр не правит и не одобряет; решение — за человеком', 'The controller neither edits nor approves; decision is human')];
      break;
    }
    case 'funnel-analyst': {
      const an = state.analytics;
      const last = an.weekly.at(-1);
      const body = t(state,
        `Неделя ${an.week} (mock, агрегированные данные).\nПереходы: ${last?.visits ?? 0}, заявки: ${last?.leads ?? 0}, консультации: ${last?.consultations ?? 0}, договоры: ${last?.contracts ?? 0}.\nЧто сработало: источник «${an.sources[0]?.name ?? '—'}» дал больше всего заявок.\nЧто проверить: долю материалов, застрявших на согласовании.\nСледующая гипотеза: формат «разбор ошибки» повысит сохранения.`,
        `Week ${an.week} (mock, aggregated).\nVisits: ${last?.visits ?? 0}, leads: ${last?.leads ?? 0}, consultations: ${last?.consultations ?? 0}, contracts: ${last?.contracts ?? 0}.\nWhat worked: source “${an.sources[0]?.name ?? '—'}” brought the most leads.\nWhat to check: share of materials stuck in review.\nNext hypothesis: “mistake breakdown” format lifts saves.`);
      const a = newArtifact(state, now, task, 'weekly_report', role, t(state, `Недельный отчёт ${an.week}`, `Weekly report ${an.week}`), body,
        { sources: [{ title: t(state, 'Агрегированная аналитика проекта (mock)', 'Aggregated project analytics (mock)'), mock: true, checkedAt: now }],
          facts: [{ text: t(state, `Заявок за неделю: ${last?.leads ?? 0}`, `Leads this week: ${last?.leads ?? 0}`), verified: true, source: 'analytics:mock', type: 'fact' }] });
      task.primaryArtifactId = a.id;
      h.deliverableId = a.id; h.sources = a.sources; h.facts = a.facts;
      h.summary = t(state, 'Недельный отчёт: что сработало, что проверить, следующая гипотеза', 'Weekly report: what worked, what to check, next hypothesis');
      h.assumptions = [t(state, 'Только агрегированные обезличенные показатели', 'Aggregated, anonymised metrics only')];
      break;
    }
    case 'marketing-director': {
      if (primary) {
        primary.body += t(state, '\n\nРешение директора: гипотезу на следующую неделю принять; отчёт передан владельцу на утверждение.', '\n\nDirector decision: adopt the hypothesis for next week; report handed to the owner for approval.');
        primary.contentHash = computeContentHash(primary); primary.updatedAt = now;
        h.deliverableId = primary.id; h.sources = primary.sources; h.facts = primary.facts;
      }
      h.summary = t(state, 'Сводка результатов и решение по следующему тесту; передано человеку', 'Results summary and decision on the next test; handed to the human');
      break;
    }
    default:
      throw new DomainError('ROLE_NOT_RUNNABLE', `Роль ${role} не выполняется как шаг маршрута`);
  }
  return { handoff: h };
}

function adapt(state              , platform          , body        , cta        )         {
  const short = body.split('\n')[0];
  switch (platform) {
    case 'telegram': return `${body}\n\n${cta}`;
    case 'vk': return `${body}\n\n${cta}`;
    case 'instagram': return `${short}\n\n${cta}`;
    case 'facebook': return `${body}\n\n${cta}`;
    case 'tiktok': return t(state, `Текст на экране: ${short}`, `On-screen text: ${short}`);
    case 'youtube': return t(state, `Описание: ${short}`, `Description: ${short}`);
    case 'site': return `${body}`;
    default: return body;
  }
}
