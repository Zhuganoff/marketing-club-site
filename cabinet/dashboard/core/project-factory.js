// Создание нового проекта из мастера: проверка ввода и запись projects/<id>/ (project.json, seed.json, brand.md, README.md).
// Локальная операция: только файлы внутри projects/. Никаких ключей, аккаунтов, ссылок и сетевых вызовов — поля с такими именами отклоняются.
import { existsSync, mkdirSync, rmSync, writeFileSync } from '../_shim/node.js';
import { join, resolve, sep } from '../_shim/node.js';
                                                                                            
import { DomainError, ROLE_ORDER } from './types.js?v=mtmlkoru';
                                             
import { KIND_LABELS, ROUTES } from './workflow.js?v=mtmlkoru';

const byOrder = (a        , b        ) => ROLE_ORDER.indexOf(a) - ROLE_ORDER.indexOf(b);
const orderedRoles = (catalog         )           => [...catalog.keys()].sort(byOrder);

// ---- Состав команды проекта ----
// Стартовые наборы описываются видами задач; роли выводятся из ROUTES и обязательных ролей, а не перечисляются здесь.
                                                                   
                                                                               
export const TEAM_PRESETS               = [
  { id: 'minimal', name: 'Минимальный', kinds: ['post'] },
  { id: 'social', name: 'Социальные сети', kinds: ['post', 'weekly_report'] },
  { id: 'reels', name: 'Reels', kinds: ['post', 'reels', 'weekly_report'] },
  { id: 'full', name: 'Полный', kinds: ['post', 'reels', 'seo_page', 'weekly_report'] },
];
                                                                                                              

// Обязательные роли ∪ роли маршрутов набора, в порядке каталога.
export function presetRoles(preset            , catalog         )           {
  const wanted = new Set        (LOCKED_ROLES);
  for (const kind of preset.kinds) for (const roleId of ROUTES[kind]) wanted.add(roleId);
  return orderedRoles(catalog).filter((roleId) => wanted.has(roleId));
}

// Какие маршруты доступны составу: маршрут доступен, если все его роли в составе (planTask требует того же).
export function teamCoverage(roles                   )               {
  const have = new Set(roles);
  const availableKinds             = [];
  const missingByKind                                      = {};
  for (const kind of Object.keys(ROUTES)              ) {
    const missing = ROUTES[kind].filter((roleId) => !have.has(roleId));
    if (missing.length) missingByKind[kind] = missing; else availableKinds.push(kind);
  }
  return { availableKinds, missingByKind };
}

                                                                                           
                               
                                                                                       
                                                              
                                                                    
                                                               
                                                     
  

export const ID_RULE = /^[a-z][a-z0-9-]{1,40}$/;
export const RESERVED_IDS = ['api', 'runtime', 'template', 'new', 'catalog'];
export const LOCKED_ROLES           = ['marketing-director', 'publisher-executor'];
// Площадка → mock-коннектор по умолчанию. Только площадки, для которых есть mock-коннектор.
export const DEFAULT_CONNECTOR                                         = { vk: 'native-vk', telegram: 'postu', facebook: 'meta', instagram: 'meta', tiktok: 'tiktok', dzen: 'wumu', ok: 'wumu', rutube: 'wumu' };
export const CONNECTOR_PLATFORMS                                  = {
  'wumu': ['vk', 'telegram', 'facebook', 'instagram', 'tiktok', 'dzen', 'ok', 'rutube'], 'postu': ['vk', 'telegram', 'facebook', 'instagram'],
  'native-vk': ['vk'], 'meta': ['facebook', 'instagram'], 'tiktok': ['tiktok'],
};
export const PROJECT_DEFAULTS = { language: 'ru'         , timezone: 'Europe/Moscow', weeklyLimitUsd: 60, approvers: ['Владелец проекта'], frequencyPerWeek: 3, preferredHours: ['11:00', '19:00'] };
// Имена полей, которые мастер никогда не принимает: секреты и учётные записи не хранятся в проекте.
const FORBIDDEN_KEY = /(token|secret|password|passwd|api[_-]?key|oauth|cookie|credential|bearer|login|account[_-]?id|phone|email)/i;
const URL_OR_HANDLE = /(https?:\/\/|www\.|\bt\.me\/|@[a-z0-9_]{3,})/i;
const TIMEZONE_RULE = /^[A-Za-z_]+(\/[A-Za-z_+-]+){1,2}$/;
const HOUR_RULE = /^([01]\d|2[0-3]):[0-5]\d$/;

function bad(code        , message        )        { throw new DomainError(code, message); }
function str(v         , max = 2000)         { return typeof v === 'string' ? v.trim().slice(0, max) : v === undefined || v === null ? '' : String(v).trim().slice(0, max); }
function list(v         , max = 30)           {
  if (v === undefined || v === null) return [];
  if (typeof v === 'string') v = v.split(/\n|,|;/);
  if (!Array.isArray(v)) bad('BAD_LIST', 'Ожидался список строк');
  return [...new Set(v.map((x) => str(x, 300)).filter(Boolean))].slice(0, max);
}

function scanKeys(value         , path        ) {
  if (Array.isArray(value)) { value.forEach((v, i) => scanKeys(v, `${path}[${i}]`)); return; }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value                           )) {
      if (FORBIDDEN_KEY.test(k)) bad('FORBIDDEN_FIELD', `Поле «${path ? path + '.' : ''}${k}» не принимается: ключи, учётные записи и контакты в проекте не хранятся`);
      scanKeys(v, path ? `${path}.${k}` : k);
    }
  }
}

// Приводит сырой ввод мастера к строгому NewProjectInput или бросает DomainError с точной причиной.
export function validateProjectInput(raw         , catalog         )                  {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) bad('BAD_INPUT', 'Ожидался объект с полями проекта');
  scanKeys(raw, '');
  const r = raw                           ;
  const id = str(r.id, 60);
  if (!ID_RULE.test(id) || id.startsWith('_')) bad('BAD_ID', 'id: латиница в нижнем регистре, цифры и дефис (2–41 символа), первый символ — буква, не начинается с «_»');
  if (RESERVED_IDS.includes(id)) bad('BAD_ID', `id «${id}» зарезервирован`);
  const name = str(r.name, 120);
  if (!name) bad('BAD_NAME', 'Укажите название проекта');
  const language = r.language === undefined || r.language === '' ? PROJECT_DEFAULTS.language : r.language;
  if (language !== 'ru' && language !== 'en') bad('BAD_LANGUAGE', 'Язык: ru или en');
  const timezone = str(r.timezone, 60) || PROJECT_DEFAULTS.timezone;
  if (!TIMEZONE_RULE.test(timezone)) bad('BAD_TIMEZONE', 'Часовой пояс в формате Region/City, например Europe/Moscow');
  const goals = list(r.goals, 10);
  const channels                 = [];
  if (r.channels !== undefined) {
    if (!Array.isArray(r.channels)) bad('BAD_CHANNELS', 'Каналы — список {platform, name}');
    for (const c of r.channels                             ) {
      const platform = str(c?.platform, 20)            ;
      const def = DEFAULT_CONNECTOR[platform];
      if (!def) bad('BAD_PLATFORM', `Площадка «${platform || '?'}» не поддерживается mock-коннекторами (доступны: ${Object.keys(DEFAULT_CONNECTOR).join(', ')})`);
      const cname = str(c?.name, 80);
      if (!cname) bad('BAD_CHANNEL_NAME', 'У каждого канала должно быть название');
      if (URL_OR_HANDLE.test(cname)) bad('BAD_CHANNEL_NAME', `Канал «${cname}»: ссылки и имена учётных записей не вводятся — только рабочее название`);
      const connectorId = (str(c?.connectorId, 20) || def)               ;
      if (!CONNECTOR_PLATFORMS[connectorId]) bad('BAD_CONNECTOR', `Неизвестный коннектор ${connectorId}`);
      if (!CONNECTOR_PLATFORMS[connectorId].includes(platform)) bad('BAD_CONNECTOR', `Коннектор ${connectorId} не поддерживает площадку ${platform}`);
      if (channels.length >= 12) bad('BAD_CHANNELS', 'Не больше 12 каналов');
      channels.push({ platform, name: cname, connectorId });
    }
  }
  // Состав команды передаётся явно и создаётся ровно таким: сервер не добавляет роли скрыто.
  if (r.roles === undefined) bad('TEAM_REQUIRED', 'Укажите состав команды (roles): выберите стартовый набор или роли по одной');
  const roleInput = list(r.roles, 20);
  for (const roleId of roleInput) if (!catalog.has(roleId          )) bad('ROLE_UNKNOWN', `Неизвестная роль ${roleId}`);
  const missingLocked = LOCKED_ROLES.filter((roleId) => !roleInput.includes(roleId));
  if (missingLocked.length) bad('TEAM_REQUIRED_ROLE', `В составе нет обязательных ролей: ${missingLocked.join(', ')}. Сервер не добавляет их сам — включите их в состав`);
  const roles = orderedRoles(catalog).filter((roleId) => roleInput.includes(roleId));
  // Проект без единого доступного маршрута бесполезен: ни одну задачу нельзя запланировать (planTask → ROLE_DISABLED).
  const coverage = teamCoverage(roles);
  if (!coverage.availableKinds.length) {
    const hint = (Object.keys(coverage.missingByKind)              ).map((kind) => `${KIND_LABELS[kind]}: ${coverage.missingByKind[kind] .join(', ')}`).join('; ');
    bad('TEAM_NO_ROUTES', `С этим составом нельзя запустить ни один маршрут. Не хватает — ${hint}`);
  }
  const weeklyLimitUsd = r.weeklyLimitUsd === undefined || r.weeklyLimitUsd === '' ? PROJECT_DEFAULTS.weeklyLimitUsd : Number(r.weeklyLimitUsd);
  if (!Number.isFinite(weeklyLimitUsd) || weeklyLimitUsd < 0 || weeklyLimitUsd > 100000) bad('BAD_LIMIT', 'Лимит проекта — число от 0 до 100000');
  const approvers = r.approvers === undefined ? [...PROJECT_DEFAULTS.approvers] : list(r.approvers, 10);
  if (!approvers.length) bad('BAD_APPROVERS', 'Нужен хотя бы один согласующий человек');
  const frequencyPerWeek = r.frequencyPerWeek === undefined || r.frequencyPerWeek === '' ? PROJECT_DEFAULTS.frequencyPerWeek : Number(r.frequencyPerWeek);
  if (!Number.isInteger(frequencyPerWeek) || frequencyPerWeek < 0 || frequencyPerWeek > 50) bad('BAD_FREQUENCY', 'Частота публикаций — целое число от 0 до 50 в неделю');
  const preferredHours = r.preferredHours === undefined ? [...PROJECT_DEFAULTS.preferredHours] : list(r.preferredHours, 12);
  for (const hh of preferredHours) if (!HOUR_RULE.test(hh)) bad('BAD_HOUR', `Время «${hh}» — нужен формат ЧЧ:ММ`);
  return {
    id, name, language, timezone, geography: str(r.geography, 200), goals, audience: str(r.audience), channels,
    tone: str(r.tone), forbiddenPhrases: list(r.forbiddenPhrases, 50), evidenceRules: list(r.evidenceRules, 20),
    roles, weeklyLimitUsd: Math.round(weeklyLimitUsd * 100) / 100, approvers, frequencyPerWeek, preferredHours,
  };
}

export function isoWeek(iso        )         {
  const d = new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

const todo = (v        , hint        ) => v || `TODO: ${hint}`;

// Собирает содержимое файлов проекта. Модели и лимиты ролей — из каталога (agents/<роль>/contract.json), не из кода.
export function buildProjectFiles(input                 , catalog         , now        ) {
  const enabledRoles = input.roles.map((roleId) => { const def = catalog.get(roleId) ; return { roleId, model: def.modelPolicy.primary                  , weeklyLimitUsd: def.budget.perWeekUsd }; });
  const project          = {
    id: input.id, name: input.name, goals: input.goals.length ? input.goals : ['TODO: цель проекта'], audience: todo(input.audience, 'аудитория'), geography: todo(input.geography, 'география'),
    language: input.language, timezone: input.timezone,
    brand: { tone: todo(input.tone, 'тон общения'), forbiddenPhrases: input.forbiddenPhrases, proofs: [], evidenceRules: input.evidenceRules, visual: 'TODO: визуальная система' },
    enabledRoles, approvers: input.approvers,
    publishingRules: { frequencyPerWeek: input.frequencyPerWeek, preferredHours: input.preferredHours, autoPublish: false, autoRetry: false },
    weeklyLimitUsd: input.weeklyLimitUsd, currentWeek: isoWeek(now),
  };
  const counts                                    = {};
  const channels = input.channels.map((c) => {
    const n = (counts[c.platform] = (counts[c.platform] ?? 0) + 1);
    return { id: `${input.id}-${c.platform}${n > 1 ? `-${n}` : ''}`, platform: c.platform, name: c.name, connectorId: c.connectorId ?? DEFAULT_CONNECTOR[c.platform] , timezone: input.timezone, mockMode: 'success'         , status: 'mock_ready'          };
  });
  const seed = { channels, ideas: [], published: [], analytics: { mock: true, week: project.currentWeek, sources: [], funnel: [], weekly: [], modelSpend: [], approvalShare: [] }, campaigns: [] };
  const lines = (xs          , hint        ) => xs.length ? xs.map((x) => `  - ${x}`).join('\n') : `  - TODO: ${hint}`;
  const brand = `# Брендбук: ${input.name}\n\nЗаполняется вручную владельцем или после его проверки. Только утверждённые публичные сведения; без персональных данных, клиентских документов, токенов и материалов других проектов. Порядок переноса — \`docs/TRANSFER_CHECKLIST.md\`.\n\n- Тон: ${project.brand.tone}\n- Запрещённые формулировки:\n${lines(input.forbiddenPhrases, 'формулировки, которые контролёр должен возвращать')}\n- Правила доказательств:\n${lines(input.evidenceRules, 'какие факты и источники допустимы')}\n- Доказательства доверия (проверяемые факты): TODO\n- Визуальная система: TODO\n`;
  const readme = `# Проект «${input.name}» (\`${input.id}\`)\n\nСоздан мастером панели ${now.slice(0, 10)} в локальном mock-режиме: каналы — только описания для mock-коннекторов, без аккаунтов, токенов и сети.\n\n- \`project.json\` — профиль (источник правды), \`seed.json\` — каналы и стартовые данные (пусто), \`brand.md\` — брендбук.\n- Материалы добавляются только вручную и только утверждённые публичные — по чек-листу \`docs/TRANSFER_CHECKLIST.md\`.\n- Переносить данные из других проектов и папок запрещено (\`docs/DATA_BOUNDARY.md\`).\n`;
  return { project, seed, brand, readme };
}

// Записывает projects/<id>/. Проверяет, что путь остаётся внутри projects/, и удаляет свою папку при ошибке записи.
export function createProjectFiles(root        , input                 , catalog         , now        )                                    {
  const projectsDir = resolve(root, 'projects');
  const dir = resolve(projectsDir, input.id);
  if (!dir.startsWith(projectsDir + sep)) bad('BAD_ID', 'Недопустимый путь проекта');
  if (existsSync(dir)) bad('PROJECT_EXISTS', `Проект уже существует: projects/${input.id}`);
  const files = buildProjectFiles(input, catalog, now);
  mkdirSync(dir);
  try {
    writeFileSync(join(dir, 'project.json'), JSON.stringify(files.project, null, 2) + '\n', 'utf8');
    writeFileSync(join(dir, 'seed.json'), JSON.stringify(files.seed, null, 2) + '\n', 'utf8');
    writeFileSync(join(dir, 'brand.md'), files.brand, 'utf8');
    writeFileSync(join(dir, 'README.md'), files.readme, 'utf8');
  } catch (e) {
    rmSync(dir, { recursive: true, force: true });
    throw e;
  }
  return { dir, project: files.project };
}

// Описание для мастера: значения по умолчанию, площадки, роли с назначением, моделями и лимитами из каталога,
// стартовые наборы (роли вычислены из маршрутов) и сами маршруты — чтобы панель ничего не дублировала.
export function wizardTemplate(catalog         , modelLabels                                   = {}) {
  const kinds = Object.keys(ROUTES)              ;
  return {
    mode: 'local-mock', defaults: PROJECT_DEFAULTS, idRule: ID_RULE.source, lockedRoles: LOCKED_ROLES, defaultPreset: 'minimal'                ,
    platforms: Object.entries(DEFAULT_CONNECTOR).map(([platform, connectorId]) => ({ platform, connectorId, connectors: (Object.keys(CONNECTOR_PLATFORMS)                 ).filter((c) => CONNECTOR_PLATFORMS[c].includes(platform            )) })),
    roles: orderedRoles(catalog).map((id) => catalog.get(id) ).map((d) => ({
      id: d.id, name: d.name, team: d.team, isLlm: d.isLlm, purpose: d.purpose, model: d.modelPolicy.primary, modelLabel: d.modelPolicy.primary ? modelLabels[d.modelPolicy.primary] ?? d.modelPolicy.primary : null,
      weeklyLimitUsd: d.budget.perWeekUsd, locked: LOCKED_ROLES.includes(d.id),
    })),
    presets: TEAM_PRESETS.map((p) => { const roles = presetRoles(p, catalog); return { id: p.id, name: p.name, kinds: p.kinds, kindLabels: p.kinds.map((k) => KIND_LABELS[k]), roles, coverage: teamCoverage(roles) }; }),
    routes: kinds.map((kind) => ({ kind, label: KIND_LABELS[kind], roles: ROUTES[kind] })),
  };
}
