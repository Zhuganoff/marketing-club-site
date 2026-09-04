// Хранилище: каталог ролей из agents/, профили из projects/, состояние в runtime/<projectId>/state.json.
// Изоляция: все сущности живут внутри ProjectState; глобальных списков нет.
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from '../_shim/node.js';
import { fileURLToPath } from '../_shim/node.js';
import { dirname, join, resolve } from '../_shim/node.js';
             
                                                                                                                                        
                                                               
                    
import { DomainError, ROLE_ORDER } from './types.js?v=mtmm058h';
                                      
import { systemClock } from './ids.js?v=mtmm058h';
import { createConnectors } from './connectors.js?v=mtmm058h';
import { computeContentHash } from './hash.js?v=mtmm058h';
import { pushEvent } from './events.js?v=mtmm058h';
import { createTask } from './workflow.js?v=mtmm058h';
                                             
import { createProjectFiles, teamCoverage, validateProjectInput } from './project-factory.js?v=mtmm058h';
import { KIND_LABELS } from './workflow.js?v=mtmm058h';

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const TEAM_NAMES                         = { strategy: 'Strategy', content: 'Content', growth: 'Growth', control: 'Control', publishing: 'Publishing' };
export { ROLE_ORDER };
export const MODEL_LABELS                          = {"claude-fable-5.1": "Claude Fable 5.1", "claude-sonnet-5": "Claude Sonnet 5", "claude-haiku-4.5": "Claude Haiku 4.5", "gpt-5.6-sol": "GPT-5.6 Sol", "gpt-5.6-luna": "GPT-5.6 Luna", "gpt-5.6-terra": "GPT-5.6 Terra", "gpt-5.4-nano": "GPT-5.4 Nano", "gemini-3.7-flash": "Gemini 3.7 Flash", "deepseek-v4-flash": "DeepSeek V4 Flash", "glm-5.3-flash": "GLM-5.3 Flash"};
// Контрольный потолок расходов проекта по умолчанию (условные $, не разрешение на реальные траты).
export const DEFAULT_PROJECT_WEEKLY_LIMIT_USD = 60;
// Архив удалённых проектов: projects/_archive/<id>-<метка>/ (папки с «_» панель не загружает); хранится 30 дней.
export const ARCHIVE_DIR = '_archive';
export const ARCHIVE_TTL_DAYS = 30;
                            
                                                                                                   
                                                                                                
                                         
  

                           
                                                
                                                               
                                                                                       
                                                          
                               
  

                                                                                                                                                                                                                                                       

                                                                                                                                                   

export class Store {
  root        ;
  runtimeDir        ;
  persist         ;
  hideDemo         ;
  clock       ;
  catalog          = new Map();
  connectors                                         ;
          states = new Map                      ();

  constructor(options               = {}) {
    this.root = options.root ?? REPO_ROOT;
    this.runtimeDir = options.runtimeDir ?? join(this.root, 'runtime');
    this.persist = options.persist ?? true;
    this.hideDemo = options.hideDemo ?? false;
    this.clock = options.clock ?? systemClock;
    this.connectors = createConnectors({ delayMs: options.connectorDelayMs });
    this.loadCatalog();
    this.loadProjects();
  }

  now()         { return this.clock.now(); }

  // ---- каталог ролей ----
  loadCatalog() {
    const dir = join(this.root, 'agents');
    this.catalog = new Map();
    for (const name of readdirSync(dir).sort()) {
      const file = join(dir, name, 'contract.json');
      if (!existsSync(file)) continue;
      const def = JSON.parse(readFileSync(file, 'utf8'))                   ;
      const soul = join(dir, name, 'SOUL.md'); const rules = join(dir, name, 'RULES.md');
      def.soul = existsSync(soul) ? readFileSync(soul, 'utf8') : undefined;
      def.rules = existsSync(rules) ? readFileSync(rules, 'utf8') : undefined;
      this.catalog.set(def.id, def);
    }
    if (this.catalog.size === 0) throw new Error('Каталог ролей пуст: нет agents/*/contract.json');
  }

  definitions()                    { return [...this.catalog.values()].sort((a, b) => ROLE_ORDER.indexOf(a.id) - ROLE_ORDER.indexOf(b.id)); }

  // ---- проекты ----
  projectIds()           { return [...this.states.keys()]; }

  loadProjects() {
    const dir = join(this.root, 'projects');
    for (const id of readdirSync(dir).sort()) {
      if (id.startsWith('_')) continue; // шаблоны не загружаются как проекты
      // Панель без демо (указание владельца 04.09): demo-* остаются в репозитории для
      // тестов и публичной витрины, но в рабочую панель не загружаются.
      if (this.hideDemo && id.startsWith('demo-')) continue;
      const file = join(dir, id, 'project.json');
      if (!existsSync(file)) continue;
      const runtimeFile = join(this.runtimeDir, id, 'state.json');
      if (this.persist && existsSync(runtimeFile)) {
        try {
          const state = JSON.parse(readFileSync(runtimeFile, 'utf8'))                ;
          // Мягкая миграция runtime, созданного до появления личного порядка согласований.
          if (!Array.isArray(state.reviewDeferrals)) state.reviewDeferrals = [];
          // Миграция моделей (аудит 2026-09-04): устаревшие id заменяются утверждёнными из каталога.
          for (const agent of state.agents) {
            if (agent.model && !(agent.model in MODEL_LABELS)) {
              agent.model = this.catalog.get(agent.roleId)?.modelPolicy.primary ?? null;
            }
          }
          for (const er of state.project.enabledRoles ?? []) {
            if (er.model && !(er.model in MODEL_LABELS)) er.model = this.catalog.get(er.roleId)?.modelPolicy.primary ?? null;
          }
          this.states.set(id, state);
          continue;
        } catch { /* повреждённое состояние — пересоздаём из сидов */ }
      }
      this.states.set(id, this.buildFromSeed(id));
      this.save(id);
    }
  }

  buildFromSeed(id        )               {
    const dir = join(this.root, 'projects', id);
    const project = JSON.parse(readFileSync(join(dir, 'project.json'), 'utf8'))           ;
    if (typeof project.weeklyLimitUsd !== 'number' || !(project.weeklyLimitUsd > 0)) project.weeklyLimitUsd = DEFAULT_PROJECT_WEEKLY_LIMIT_USD;
    const seed = JSON.parse(readFileSync(join(dir, 'seed.json'), 'utf8'))               ;
    const now = this.now();
    const agents                  = project.enabledRoles.map((r, i) => ({
      id: `${id}-${r.roleId}`, projectId: id, roleId: r.roleId, model: r.model,
      budget: { limitUsd: r.weeklyLimitUsd, spentUsd: 0, period: 'week' }, status: 'idle', currentTaskId: null,
      lastRunAt: null, busyUntil: null, runs: 0,
    }));
    const teams         = (Object.keys(TEAM_NAMES)            ).map((teamId) => ({
      id: teamId, projectId: id, name: TEAM_NAMES[teamId],
      roleIds: project.enabledRoles.map((r) => r.roleId).filter((roleId) => this.catalog.get(roleId)?.team === teamId),
    }));
    const state               = {
      project, teams, agents, channels: seed.channels.map((c) => ({ ...c, projectId: id })),
      tasks: [], artifacts: [], approvals: [], reviewDeferrals: [], jobs: [], campaigns: (seed.campaigns ?? []).map((c) => ({ ...c, projectId: id, createdAt: now })), events: [], analytics: seed.analytics, counters: {},
    };
    pushEvent(state, now, { kind: 'system' }, 'project.loaded', `Проект «${project.name}» загружен из сидов; внешние интеграции выключены`);
    for (const pub of seed.published) {
      const a                  = {
        id: `art-seed-${state.artifacts.length + 1}`, projectId: id, taskId: 'seed', kind: 'draft', version: 1, title: pub.title, body: pub.body, cta: pub.cta,
        hashtags: [], media: [], channelId: pub.platformChannelId, scheduledAt: now, timezone: project.timezone,
        sources: [{ title: 'Утверждённые материалы проекта (seed)', mock: true }], facts: [], status: 'PUBLISHED', contentHash: '', approvalId: null, campaignId: null,
        authorRoleId: 'chief-editor', qualityReport: null, versions: [], failedAttempts: 0, createdAt: now, updatedAt: now,
      };
      a.contentHash = computeContentHash(a);
      state.artifacts.push(a);
    }
    for (const idea of seed.ideas) createTask(state, now, this.catalog, { ...idea, asIdea: true }, { kind: 'human', name: project.approvers[0] ?? 'owner' });
    return state;
  }

  // Новый проект из мастера: проверка ввода → запись projects/<id>/ → загрузка как изолированного состояния.
  addProject(raw         , actorName        )               {
    const input = validateProjectInput(raw, this.catalog);
    if (this.states.has(input.id)) throw new DomainError('PROJECT_EXISTS', `Проект ${input.id} уже загружен`);
    createProjectFiles(this.root, input, this.catalog, this.now());
    const state = this.buildFromSeed(input.id);
    const coverage = teamCoverage(input.roles);
    pushEvent(state, this.now(), { kind: 'human', name: actorName }, 'project.created', `Проект «${input.name}» создан мастером в локальном mock-режиме: ${input.channels.length} mock-каналов, ролей ${input.roles.length} (${input.roles.join(', ')}), доступные маршруты: ${coverage.availableKinds.map((k) => KIND_LABELS[k]).join(', ') || 'нет'}, потолок $${input.weeklyLimitUsd}/нед`);
    this.states.set(input.id, state);
    this.save(input.id);
    return state;
  }

  // ---- архив и выгрузка ----
          archiveRoot()         { return join(this.root, 'projects', ARCHIVE_DIR); }

  // Удаление проекта = перенос projects/<id>/ и runtime/<id>/ в архив на 30 дней; проект выгружается из памяти.
  archiveProject(projectId        , actorName        )               {
    const state = this.get(projectId);
    if (this.states.size <= 1) throw new DomainError('LAST_PROJECT', 'Последний проект удалить нельзя — сначала создайте другой');
    if (state.jobs.some((j) => j.status === 'PUBLISHING')) throw new DomainError('PUBLISHING_IN_PROGRESS', 'Идёт публикация — дождитесь её завершения');
    const now = this.now();
    const stamp = now.replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
    let name = `${projectId}-${stamp}`;
    const rootDir = this.archiveRoot();
    mkdirSync(rootDir, { recursive: true });
    for (let n = 2; existsSync(join(rootDir, name)); n++) name = `${projectId}-${stamp}-${n}`;
    const dir = join(rootDir, name);
    const srcProject = join(this.root, 'projects', projectId);
    const srcRuntime = join(this.runtimeDir, projectId);
    mkdirSync(dir);
    renameSync(srcProject, join(dir, 'project'));
    const hasRuntime = existsSync(srcRuntime);
    if (hasRuntime) {
      try { renameSync(srcRuntime, join(dir, 'runtime')); }
      catch (e) { renameSync(join(dir, 'project'), srcProject); rmSync(dir, { recursive: true, force: true }); throw e; }
    }
    const entry               = {
      name, id: projectId, projectName: state.project.name, archivedAt: now,
      expiresAt: new Date(Date.parse(now) + ARCHIVE_TTL_DAYS * 86400000).toISOString(), by: actorName,
      counts: { tasks: state.tasks.length, artifacts: state.artifacts.length, approvals: state.approvals.length, jobs: state.jobs.length, events: state.events.length },
      hasRuntime,
    };
    writeFileSync(join(dir, 'ARCHIVED.json'), JSON.stringify(entry, null, 2) + '\n', 'utf8');
    this.states.delete(projectId);
    return entry;
  }

  listArchives()                 {
    const rootDir = this.archiveRoot();
    if (!existsSync(rootDir)) return [];
    const nowMs = Date.parse(this.now());
    const out                 = [];
    for (const name of readdirSync(rootDir).sort()) {
      const file = join(rootDir, name, 'ARCHIVED.json');
      if (!existsSync(file)) continue;
      try {
        const e = JSON.parse(readFileSync(file, 'utf8'))                ;
        out.push({ ...e, name, daysLeft: Math.max(0, Math.ceil((Date.parse(e.expiresAt) - nowMs) / 86400000)) });
      } catch { /* повреждённая запись архива пропускается */ }
    }
    return out.sort((a, b) => b.archivedAt.localeCompare(a.archivedAt));
  }

  // Возврат проекта из архива: папки переносятся обратно, состояние грузится из runtime или пересоздаётся из сидов.
  restoreArchive(name        )               {
    const dir = join(this.archiveRoot(), name);
    const file = join(dir, 'ARCHIVED.json');
    if (!/^[a-z][a-z0-9-]*$/.test(name) || !existsSync(file)) throw new DomainError('NOT_FOUND', `Архив ${name} не найден`);
    const entry = JSON.parse(readFileSync(file, 'utf8'))                ;
    const dstProject = join(this.root, 'projects', entry.id);
    if (this.states.has(entry.id) || existsSync(dstProject)) throw new DomainError('PROJECT_EXISTS', `Проект ${entry.id} уже есть — сначала удалите или переименуйте его`);
    renameSync(join(dir, 'project'), dstProject);
    const archivedRuntime = join(dir, 'runtime');
    if (existsSync(archivedRuntime)) { mkdirSync(this.runtimeDir, { recursive: true }); rmSync(join(this.runtimeDir, entry.id), { recursive: true, force: true }); renameSync(archivedRuntime, join(this.runtimeDir, entry.id)); }
    rmSync(dir, { recursive: true, force: true });
    const runtimeFile = join(this.runtimeDir, entry.id, 'state.json');
    let state                      = null;
    if (existsSync(runtimeFile)) { try { state = JSON.parse(readFileSync(runtimeFile, 'utf8'))                ; if (!Array.isArray(state.reviewDeferrals)) state.reviewDeferrals = []; } catch { state = null; } }
    if (!state) state = this.buildFromSeed(entry.id);
    this.states.set(entry.id, state);
    this.save(entry.id);
    return state;
  }

  // Окончательное удаление одной записи архива (кнопка «Удалить…», указание владельца 2026-09-03).
  // Необратимо: папка projects/_archive/<name> стирается. Подтверждение — на стороне интерфейса.
  deleteArchive(name        )               {
    if (!/^[a-z][a-z0-9-]*$/.test(name)) throw new DomainError('NOT_FOUND', `Архив ${name} не найден`);
    const dir = join(this.archiveRoot(), name);
    const file = join(dir, 'ARCHIVED.json');
    if (!existsSync(file)) throw new DomainError('NOT_FOUND', `Архив ${name} не найден`);
    const entry = JSON.parse(readFileSync(file, 'utf8'))                ;
    rmSync(dir, { recursive: true, force: true });
    return { ...entry, name };
  }

  // Удаляет только записи архива с истёкшим сроком. Не вызывается конструктором — сервер вызывает явно при старте.
  purgeArchives()           {
    const nowMs = Date.parse(this.now());
    const removed           = [];
    for (const e of this.listArchives()) {
      if (Date.parse(e.expiresAt) <= nowMs) { rmSync(join(this.archiveRoot(), e.name), { recursive: true, force: true }); removed.push(e.name); }
    }
    return removed;
  }

  // Полная выгрузка проекта в один JSON: файлы профиля и всё состояние. Секретов в проекте нет по конструкции.
  exportProject(projectId        ) {
    const state = this.get(projectId);
    const dir = join(this.root, 'projects', projectId);
    const text = (f        ) => (existsSync(join(dir, f)) ? readFileSync(join(dir, f), 'utf8') : null);
    const json = (f        ) => { const t = text(f); return t ? JSON.parse(t) : null; };
    return {
      format: 'marketing-club-export/1', exportedAt: this.now(), projectId,
      files: { 'project.json': json('project.json'), 'seed.json': json('seed.json'), 'brand.md': text('brand.md'), 'README.md': text('README.md') },
      state,
      note: 'Локальная выгрузка Marketing Club: профиль проекта и полное состояние (задачи, материалы, согласования, задания, события, кампании). Ключей, аккаунтов и персональных данных не содержит по правилам проекта.',
    };
  }

  get(projectId        )               {
    const s = this.states.get(projectId);
    if (!s) throw new DomainError('PROJECT_NOT_FOUND', `Проект ${projectId} не найден`);
    return s;
  }

  save(projectId        ) {
    if (!this.persist) return;
    const dir = join(this.runtimeDir, projectId);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'state.json'), JSON.stringify(this.get(projectId), null, 2), 'utf8');
  }

  reset(projectId        )               {
    this.get(projectId);
    const fresh = this.buildFromSeed(projectId);
    this.states.set(projectId, fresh);
    this.save(projectId);
    return fresh;
  }

  // Настройки проекта, изменяемые из панели (mock-редактирование профиля). Хранятся в runtime/, файл project.json не переписывается.
  updateSettings(projectId        , patch               , actorName        ) {
    return this.mutate(projectId, (state, now) => {
      const p = state.project; const changes           = [];
      if (patch.weeklyLimitUsd !== undefined) {
        const v = Number(patch.weeklyLimitUsd);
        if (!Number.isFinite(v) || v < 0 || v > 100000) throw new DomainError('BAD_LIMIT', 'Лимит проекта — число от 0 до 100000');
        const before = p.weeklyLimitUsd; p.weeklyLimitUsd = Math.round(v * 100) / 100;
        pushEvent(state, now, { kind: 'human', name: actorName }, 'settings.limit', `Контрольный потолок проекта изменён: $${before} → $${p.weeklyLimitUsd} в неделю`);
      }
      if (patch.name !== undefined) { if (!String(patch.name).trim()) throw new DomainError('BAD_NAME', 'Название не может быть пустым'); changes.push('название'); p.name = String(patch.name).trim(); }
      if (patch.language !== undefined) { if (patch.language !== 'ru' && patch.language !== 'en') throw new DomainError('BAD_LANGUAGE', 'Язык: ru или en'); changes.push('язык'); p.language = patch.language; }
      if (patch.timezone !== undefined) { if (!/^[A-Za-z_]+\/[A-Za-z_]+$/.test(String(patch.timezone))) throw new DomainError('BAD_TIMEZONE', 'Часовой пояс в формате Region/City'); changes.push('пояс'); p.timezone = String(patch.timezone); }
      if (patch.audience !== undefined) { changes.push('аудитория'); p.audience = String(patch.audience); }
      if (patch.tone !== undefined) { changes.push('стиль'); p.brand.tone = String(patch.tone); }
      if (patch.forbiddenPhrases !== undefined) { changes.push('запреты'); p.brand.forbiddenPhrases = patch.forbiddenPhrases.map((x) => String(x).trim()).filter(Boolean); }
      if (patch.roles !== undefined) {
        for (const [roleId, enabled] of Object.entries(patch.roles)) {
          const def = this.catalog.get(roleId          );
          if (!def) throw new DomainError('ROLE_UNKNOWN', `Неизвестная роль ${roleId}`);
          let inst = state.agents.find((a) => a.roleId === roleId);
          if (enabled && !inst) {
            inst = { id: `${projectId}-${roleId}`, projectId, roleId: def.id, model: def.modelPolicy.primary, budget: { limitUsd: def.budget.perWeekUsd, spentUsd: 0, period: 'week' }, status: 'idle', currentTaskId: null, lastRunAt: null, busyUntil: null, runs: 0 };
            state.agents.push(inst);
            p.enabledRoles.push({ roleId: def.id, model: def.modelPolicy.primary, weeklyLimitUsd: def.budget.perWeekUsd });
            changes.push(`включена роль ${roleId}`);
          } else if (enabled && inst && inst.status === 'disabled') { inst.status = 'idle'; changes.push(`включена роль ${roleId}`); }
          else if (!enabled && inst && inst.status !== 'disabled') {
            if (inst.currentTaskId) throw new DomainError('ROLE_BUSY', `Роль ${roleId} сейчас занята задачей ${inst.currentTaskId}`);
            inst.status = 'disabled'; changes.push(`выключена роль ${roleId}`);
          }
        }
        for (const t of state.teams) t.roleIds = state.agents.filter((a) => a.status !== 'disabled' && this.catalog.get(a.roleId)?.team === t.id).map((a) => a.roleId);
      }
      if (patch.channels !== undefined) {
        for (const [channelId, mode] of Object.entries(patch.channels)) {
          const c = state.channels.find((x) => x.id === channelId);
          if (!c) throw new DomainError('NOT_FOUND', `Канал ${channelId} не найден`);
          c.mockMode = mode; c.status = mode === 'success' || mode === 'delay' ? 'mock_ready' : 'mock_disconnected'; changes.push(`канал ${c.name}: ${mode}`);
        }
      }
      if (changes.length) pushEvent(state, now, { kind: 'human', name: actorName }, 'settings.updated', `Настройки проекта изменены: ${changes.join('; ')}`);
      return state.project;
    });
  }

  // Транзакция: мутация + сохранение.
  mutate   (projectId        , fn                                         )    {
    const state = this.get(projectId);
    const result = fn(state, this.now());
    this.save(projectId);
    return result;
  }

  async mutateAsync   (projectId        , fn                                     )             {
    const state = this.get(projectId);
    const result = await fn(state);
    this.save(projectId);
    return result;
  }

  // Представление агентов с вычисленным «занят» и сведениями каталога.
  agentsView(projectId        ) {
    const state = this.get(projectId);
    const nowMs = Date.parse(this.now());
    return state.agents.map((a) => {
      const def = this.catalog.get(a.roleId);
      const busy = a.busyUntil !== null && Date.parse(a.busyUntil) > nowMs;
      const status = a.status === 'idle' && busy ? 'working' : a.status;
      const lastTask = busy ? [...state.tasks].sort((x, y) => y.updatedAt.localeCompare(x.updatedAt)).find((t) => t.handoffs.some((h) => h.from === a.roleId)) : null;
      return {
        ...a, status, currentTaskId: a.currentTaskId ?? (busy ? lastTask?.id ?? null : null),
        name: def?.name ?? a.roleId, team: def?.team ?? 'strategy', purpose: def?.purpose ?? '', isLlm: def?.isLlm ?? true,
        modelLabel: a.model ? MODEL_LABELS[a.model] : '—', modelOrigin: def?.modelPolicy.origin ?? 'none',
        avatar: def?.avatar ?? { initials: '??', hue: 0 }, access: { externalIntegrations: 'disabled', network: 'disabled', keys: 'none', tools: def?.allowedTools ?? [] },
      };
    });
  }
}
