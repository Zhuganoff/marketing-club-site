// SEO-модуль, этап 1 (решение владельца 2026-09-03): история аудитов сайта и сравнение
// с прошлой проверкой. Сам аудит выполняется в dashboard/api/site-audit.ts (сеть только там);
// сюда приходит готовый результат — ядро остаётся без сетевого доступа.
                                                                                 
import { DomainError } from './types.js?v=mtmlkoru';
import { pushEvent } from './events.js?v=mtmlkoru';

export const SEO_AUDIT_KEEP = 20;

export function recordSeoAudit(state              , now        , audit                           , actor       )                {
  if (actor.kind !== 'human') throw new DomainError('HUMAN_REQUIRED', 'Аудит сайта запускает человек');
  const entry                = { at: now, url: audit.url, score: audit.score, okCount: audit.okCount, warnCount: audit.warnCount, errCount: audit.errCount, platform: audit.platform, checks: audit.checks.map((c) => ({ ...c })) };
  state.seoAudits = [entry, ...(state.seoAudits ?? [])].slice(0, SEO_AUDIT_KEEP);
  const prev = state.seoAudits[1] ?? null;
  const delta = prev ? entry.score - prev.score : null;
  pushEvent(state, now, actor, 'seo.audit', `Аудит сайта ${entry.url}: ${entry.score}/100${delta === null ? '' : delta === 0 ? ' (без изменений)' : ` (${delta > 0 ? '+' : ''}${delta} к прошлой проверке)`}`, undefined, entry.errCount ? 'warn' : 'info');
  return entry;
}

// Что изменилось между двумя аудитами: исправленные и новые замечания по ключу «группа/имя».
export function seoAuditDiff(prev                      , cur               )                                                                        {
  if (!prev) return { fixed: [], appeared: [] };
  const key = (c                                 ) => `${c.group}/${c.name}`;
  const prevBad = new Map(prev.checks.filter((c) => c.status !== 'ok').map((c) => [key(c), c]));
  const curBad = new Map(cur.checks.filter((c) => c.status !== 'ok').map((c) => [key(c), c]));
  const fixed = cur.checks.filter((c) => c.status === 'ok' && prevBad.has(key(c)));
  const appeared = [...curBad.values()].filter((c) => !prevBad.has(key(c)));
  return { fixed, appeared };
}

// ===== SEO-анкета и контакты (решение владельца 03.09, по образцу анкеты OptiAI) =====

const SEG_LABEL                         = { economy: 'эконом', mid: 'средний', premium: 'премиум' };
const AUD_LABEL                         = { b2c: 'частные клиенты', b2b: 'бизнес', both: 'частные клиенты и бизнес' };
const MOB_LABEL                         = { near: 'клиент выбирает рядом с домом', cross_city: 'клиент готов ехать через весь город', onsite: 'выезжаем к клиенту' };

const line = (s         , max        ) => String(s ?? '').trim().slice(0, max);
const lines = (v         , maxItems        , maxLen        )           =>
  (Array.isArray(v) ? v : String(v ?? '').split('\n')).map((x) => String(x).trim().slice(0, maxLen)).filter(Boolean).slice(0, maxItems);

export function saveSeoProfile(state              , now        , input     , actor       )             {
  if (actor.kind !== 'human') throw new DomainError('HUMAN_REQUIRED', 'Анкету SEO заполняет человек');
  const pick =                   (v         , allowed     )           => (allowed.includes(v     ) ? (v     ) : null);
  const profile             = {
    keywords: lines(input.keywords, 30, 80),
    cities: lines(input.cities, 30, 60),
    allRussia: Boolean(input.allRussia),
    mobility: pick(input.mobility, ['near', 'cross_city', 'onsite']),
    metro: line(input.metro, 60),
    district: line(input.district, 80),
    segment: pick(input.segment, ['economy', 'mid', 'premium']),
    audience: pick(input.audience, ['b2c', 'b2b', 'both']),
    urgent: Boolean(input.urgent),
    authorName: line(input.authorName, 80),
    authorTitle: line(input.authorTitle, 120),
    contacts: {
      phone: line(input.contacts?.phone, 30),
      email: line(input.contacts?.email, 80),
      telegram: line(input.contacts?.telegram, 60),
      whatsapp: line(input.contacts?.whatsapp, 30),
      vk: line(input.contacts?.vk, 80),
    },
    updatedAt: now,
    updatedBy: actor.name ?? 'owner',
  };
  state.seoProfile = profile;
  pushEvent(state, now, actor, 'seo.profile', `Анкета SEO обновлена: ${profile.keywords.length} ключей, ${profile.allRussia ? 'вся Россия' : `${profile.cities.length} городов`}${profile.urgent ? ', срочная услуга' : ''}`);
  return profile;
}

// Строка анкеты для брифа SEO-стратега: только заполненные поля, честно и коротко.
export function seoProfileBrief(profile            )         {
  const parts           = [];
  if (profile.keywords.length) parts.push(`ключи — ${profile.keywords.slice(0, 8).join(', ')}${profile.keywords.length > 8 ? '…' : ''}`);
  parts.push(profile.allRussia ? 'география — вся Россия' : profile.cities.length ? `города — ${profile.cities.slice(0, 5).join(', ')}` : '');
  if (profile.metro) parts.push(`метро — ${profile.metro}`);
  if (profile.district) parts.push(`район — ${profile.district}`);
  if (profile.mobility) parts.push(MOB_LABEL[profile.mobility]);
  if (profile.segment) parts.push(`сегмент — ${SEG_LABEL[profile.segment]}`);
  if (profile.audience) parts.push(`аудитория — ${AUD_LABEL[profile.audience]}`);
  if (profile.urgent) parts.push('срочная услуга (24/7) — добавить «срочно», «круглосуточно»');
  if (profile.authorName) parts.push(`автор статей — ${profile.authorName}${profile.authorTitle ? ` (${profile.authorTitle})` : ''}`);
  return parts.filter(Boolean).join('; ');
}

// CTA-блок для конца статьи по формуле «призыв → чем занимаемся → регион → контакты».
// Шаблон без модели: владелец правит текст на согласовании как любой материал.
export function ctaFromProfile(state              )                {
  const profile = state.seoProfile;
  if (!profile) return null;
  const c = profile.contacts;
  const contactBits = [
    c.phone ? `Телефон: ${c.phone}` : '',
    c.telegram ? `Telegram: ${c.telegram.startsWith('@') || c.telegram.startsWith('http') ? c.telegram : '@' + c.telegram}` : '',
    c.whatsapp ? `WhatsApp: ${c.whatsapp}` : '',
    c.email ? `Почта: ${c.email}` : '',
    c.vk ? `ВКонтакте: ${c.vk}` : '',
  ].filter(Boolean);
  if (!contactBits.length) return null;
  // Без склонения городов: имена в исходной форме, чтобы не писать «в Омск».
  const geo = profile.allRussia ? ' Работаем по всей России.' : profile.cities.length ? ` Работаем: ${profile.cities.slice(0, 3).join(', ')}.` : '';
  const first = `Оставьте заявку — ${state.project.name}.${geo} Ответим на вопросы и подскажем, с чего начать${profile.urgent ? ' — в любое время, работаем срочно' : ''}.`;
  return `${first}\n${contactBits.join(' · ')}`;
}
