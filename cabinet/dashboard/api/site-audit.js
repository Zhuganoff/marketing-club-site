import { __webFetch } from '../_shim/node.js';
// Анализ сайта для мастера проекта. Единственное место с сетевым доступом в панели —
// разрешено владельцем 2026-09-03 (в диалоге: «да, всё делай по очереди» на предложение
// «подключай анализ сайта по сети»). Только чтение публичных страниц: без входов, форм,
// сбора персональных данных и обхода защит. Ядро (dashboard/core) сети не касается.
import { lookup } from '../_shim/node.js';
import { isIP } from '../_shim/node.js';
import { DomainError } from '../core/types.js';

const MAX_BYTES = 1_500_000;
const TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 3;

                                         
                                                                                              
                                                                             
                         
                                                               
                                                       
                      
                                
                                                                                                        
  

// Определение платформы сайта (решение владельца 03.09): подсказывает, каким способом
// SEO-модуль сможет публиковать статьи, когда интеграции будут разрешены. Только чтение
// следов в HTML — ничего не подключается. Порядок важен: первые — более однозначные следы.
const PLATFORM_SIGNS                                                                    = [
  { id: 'wordpress', name: 'WordPress', publishNote: 'статьи публикуются через официальный REST API', test: /wp-content\/|wp-includes\/|wp-json|generator["'][^>]*WordPress/i },
  { id: 'bitrix', name: '1С-Битрикс', publishNote: 'публикация через REST API Битрикса', test: /\/bitrix\/|generator["'][^>]*Bitrix/i },
  { id: 'tilda', name: 'Тильда', publishNote: 'прямого API публикации нет — возможен импорт через RSS-поток, с ограничениями', test: /tildacdn\.|tilda-blocks|generator["'][^>]*Tilda/i },
  { id: 'modx', name: 'MODX', publishNote: 'потребуется модуль для MODX Revolution', test: /generator["'][^>]*MODX|assets\/components\//i },
  { id: 'flexbe', name: 'Flexbe', publishNote: 'своего API блога нет — обычно добавляют WordPress-блог на поддомене', test: /flexbe|generator["'][^>]*Flexbe/i },
  { id: 'wix', name: 'Wix', publishNote: 'публикация через API Wix — потребует отдельного изучения', test: /wixstatic\.com|parastorage\.com|generator["'][^>]*Wix/i },
  { id: 'joomla', name: 'Joomla', publishNote: 'публикация возможна через веб-сервисы Joomla — потребует отдельного изучения', test: /generator["'][^>]*Joomla|\/media\/jui\//i },
  { id: 'shopify', name: 'Shopify', publishNote: 'публикация в блог через Admin API', test: /cdn\.shopify\.com|generator["'][^>]*Shopify/i },
  { id: 'ucoz', name: 'uCoz/uKit', publishNote: 'официального API публикации нет — потребует отдельного изучения', test: /ucoz\.|ukit\./i },
];

export function detectPlatform(html        )                      {
  const sample = html.slice(0, 600_000);
  for (const p of PLATFORM_SIGNS) {
    if (p.test.test(sample)) return { id: p.id, name: p.name, publishNote: p.publishNote };
  }
  return null;
}

function isPrivateHost(host        )          {
  const h = host.toLowerCase();
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (isIP(h)) return isPrivateIp(h);
  return false;
}
function isPrivateIp(ip        )          {
  if (ip === '::1' || ip === '0.0.0.0') return true;
  if (/^127\./.test(ip) || /^10\./.test(ip) || /^192\.168\./.test(ip) || /^169\.254\./.test(ip)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  if (/^f[cd]/i.test(ip) || /^fe80/i.test(ip)) return true; // приватные/линк-локальные IPv6
  return false;
}
async function assertPublicHost(host        )                {
  if (isPrivateHost(host)) throw new DomainError('PRIVATE_HOST', 'Локальные и внутренние адреса не анализируются');
  if (!isIP(host)) {
    try {
      const addrs = await lookup(host, { all: true });
      if (addrs.some((a) => isPrivateIp(a.address))) throw new DomainError('PRIVATE_HOST', 'Адрес сайта указывает во внутреннюю сеть');
    } catch (e) {
      if (e instanceof DomainError) throw e;
      throw new DomainError('DNS_FAILED', `Не удалось найти сайт «${host}»`);
    }
  }
}

async function fetchLimited(url        )                                                                                {
  let current = url;
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const u = new URL(current);
    await assertPublicHost(u.hostname);
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    let res          ;
    try {
      res = await __webFetch(current, { redirect: 'manual', signal: ctl.signal, headers: { 'user-agent': 'MarketingClub-SiteCheck/1.0 (local; owner-initiated)' } });
    } finally { clearTimeout(timer); }
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      current = new URL(res.headers.get('location') , current).toString();
      continue;
    }
    const reader = res.body?.getReader();
    let body = '';
    if (reader) {
      const decoder = new TextDecoder();
      let got = 0;
      while (got < MAX_BYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        got += value.byteLength;
        body += decoder.decode(value, { stream: true });
      }
      void reader.cancel().catch(() => undefined);
    }
    return { res, body, finalUrl: current, redirects: i };
  }
  throw new DomainError('TOO_MANY_REDIRECTS', 'Слишком много перенаправлений');
}

async function statusOf(url        )                         {
  try {
    const u = new URL(url);
    await assertPublicHost(u.hostname);
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    try {
      const res = await __webFetch(url, { redirect: 'follow', signal: ctl.signal, headers: { 'user-agent': 'MarketingClub-SiteCheck/1.0 (local; owner-initiated)' } });
      void res.body?.cancel().catch(() => undefined);
      return res.status;
    } finally { clearTimeout(timer); }
  } catch { return null; }
}

const NAMED_ENTITY                         = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', laquo: '«', raquo: '»', mdash: '—', ndash: '–', hellip: '…', copy: '©' };
const decodeEntities = (s        ) => s
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&([a-z]+);/gi, (m, name) => NAMED_ENTITY[name.toLowerCase()] ?? m);
const strip = (s        ) => decodeEntities(s.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
const attr = (tag        , name        ) => { const v = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1]; return v == null ? null : decodeEntities(v); };

export async function analyzeSite(rawUrl        )                     {
  const started = Date.now();
  let input = rawUrl.trim();
  if (!input) throw new DomainError('URL_REQUIRED', 'Укажите адрес сайта');
  if (!/^https?:\/\//i.test(input)) input = `https://${input}`;
  let u     ;
  try { u = new URL(input); } catch { throw new DomainError('URL_INVALID', 'Это не похоже на адрес сайта'); }
  if (!/^https?:$/.test(u.protocol)) throw new DomainError('URL_INVALID', 'Разрешены только адреса http и https');

  let page                                          ;
  try { page = await fetchLimited(u.toString()); }
  catch (e) {
    if (e instanceof DomainError) throw e;
    throw new DomainError('FETCH_FAILED', `Сайт не ответил: ${e instanceof Error ? e.message : String(e)}`);
  }
  const { res, body, finalUrl, redirects } = page;
  const finalU = new URL(finalUrl);
  const checks              = [];
  const add = (group        , name        , status             , message        ) => checks.push({ group, name, status, message });

  // HTTPS и доступность
  add('HTTPS и доступность', 'HTTPS', finalU.protocol === 'https:' ? 'ok' : 'warn', finalU.protocol === 'https:' ? 'Сайт работает по защищённому протоколу' : 'Сайт открылся без защищённого протокола (http)');
  add('HTTPS и доступность', 'HTTP-статус', res.status === 200 ? 'ok' : res.status < 500 ? 'warn' : 'err', `${res.status} ${res.statusText || ''}`.trim());
  add('HTTPS и доступность', 'Редиректы', redirects <= 1 ? 'ok' : 'warn', redirects === 0 ? 'Лишних редиректов нет' : `Перенаправлений по пути: ${redirects}`);

  // Мета-теги и структура
  const head = body.slice(0, 300_000);
  const title = strip(head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '');
  if (!title) add('Мета-теги и структура', 'Title', 'err', 'Заголовок страницы (title) не найден');
  else add('Мета-теги и структура', 'Title', title.length >= 15 && title.length <= 70 ? 'ok' : 'warn', `${title.length} символов: «${title.slice(0, 70)}${title.length > 70 ? '…' : ''}»`);
  const metaTags = head.match(/<meta[^>]+>/gi) ?? [];
  const descTag = metaTags.find((t) => /name\s*=\s*["']description["']/i.test(t));
  const desc = descTag ? (attr(descTag, 'content') ?? '') : '';
  if (!desc) add('Мета-теги и структура', 'Meta Description', 'warn', 'Описание страницы отсутствует');
  else add('Мета-теги и структура', 'Meta Description', desc.length <= 170 ? 'ok' : 'warn', desc.length <= 170 ? `${desc.length} символов` : `Слишком длинное: ${desc.length} символов (обрезается в выдаче)`);
  const h1 = strip(body.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '');
  add('Мета-теги и структура', 'H1', h1 ? 'ok' : 'warn', h1 ? `«${h1.slice(0, 80)}»` : 'Главный заголовок H1 не найден');
  const h2Count = (body.match(/<h2[\s>]/gi) ?? []).length;
  add('Мета-теги и структура', 'H2', h2Count ? 'ok' : 'warn', h2Count ? `Найдено ${h2Count} подзаголовков H2` : 'Подзаголовков H2 нет');
  add('Мета-теги и структура', 'Canonical', /<link[^>]+rel\s*=\s*["']canonical["']/i.test(head) ? 'ok' : 'warn', /<link[^>]+rel\s*=\s*["']canonical["']/i.test(head) ? 'Тег canonical на месте' : 'Тег canonical отсутствует');
  const robotsTag = metaTags.find((t) => /name\s*=\s*["']robots["']/i.test(t));
  add('Мета-теги и структура', 'Meta Robots', robotsTag ? (/(noindex|nofollow)/i.test(robotsTag) ? 'warn' : 'ok') : 'ok', robotsTag ? (/(noindex|nofollow)/i.test(robotsTag) ? 'Стоит ограничение индексации — проверьте, так ли задумано' : 'Тег на месте') : 'Тег отсутствует (по умолчанию index, follow)');
  const ogMissing = ['og:title', 'og:description', 'og:image'].filter((p) => !metaTags.some((t) => new RegExp(`property\\s*=\\s*["']${p}["']`, 'i').test(t)));
  add('Мета-теги и структура', 'Open Graph', ogMissing.length ? 'warn' : 'ok', ogMissing.length ? `Отсутствуют: ${ogMissing.join(', ')} — ссылки в соцсетях будут без карточки` : 'Карточка для соцсетей заполнена');

  // Изображения
  const imgs = body.match(/<img[^>]*>/gi) ?? [];
  const noAlt = imgs.filter((t) => !/alt\s*=\s*["'][^"']+["']/i.test(t)).length;
  if (!imgs.length) add('Изображения', 'Изображения', 'ok', 'Изображений на странице нет');
  else add('Изображения', 'Alt-подписи', noAlt ? 'warn' : 'ok', noAlt ? `Без подписи alt: ${noAlt} из ${imgs.length}` : `Все ${imgs.length} изображений с подписями`);

  // Ссылки
  const anchors = body.match(/<a\s[^>]*href\s*=\s*["'][^"']+["'][^>]*>[\s\S]*?<\/a>/gi) ?? [];
  let internal = 0; let external = 0; let empty = 0;
  for (const a of anchors) {
    const href = attr(a, 'href') ?? '';
    if (/^https?:\/\//i.test(href)) { try { new URL(href).hostname === finalU.hostname ? internal++ : external++; } catch { /* мусорная ссылка */ } }
    else if (!href.startsWith('#') && !/^(mailto|tel|javascript):/i.test(href)) internal++;
    if (!strip(a) && !/<img/i.test(a) && !/aria-label/i.test(a)) empty++;
  }
  add('Ссылки', 'Внутренние ссылки', internal ? 'ok' : 'warn', `Найдено ${internal} внутренних ссылок`);
  add('Ссылки', 'Внешние ссылки', 'ok', `Найдено ${external} внешних ссылок`);
  add('Ссылки', 'Ссылки без текста', empty ? 'warn' : 'ok', empty ? `Без текста и подписи: ${empty}` : 'Все ссылки имеют анкорный текст');

  // Платформа сайта — информационная строка, на оценку не влияет
  const platform = detectPlatform(body);
  add('Платформа', 'Платформа сайта', 'ok', platform ? `${platform.name} — ${platform.publishNote} (когда подключим публикацию)` : 'Не распознана по странице — определим при подключении публикации');

  // robots.txt и sitemap
  const robotsStatus = await statusOf(`${finalU.origin}/robots.txt`);
  add('robots.txt', 'robots.txt', robotsStatus === 200 ? 'ok' : 'err', robotsStatus === 200 ? 'Файл на месте' : 'Файл недоступен — поисковикам не хватает инструкций');
  const sitemapStatus = await statusOf(`${finalU.origin}/sitemap.xml`);
  add('Sitemap', 'sitemap.xml', sitemapStatus === 200 ? 'ok' : 'warn', sitemapStatus === 200 ? 'Карта сайта найдена' : 'Карта сайта не найдена по /sitemap.xml');

  const okCount = checks.filter((c) => c.status === 'ok').length;
  const warnCount = checks.filter((c) => c.status === 'warn').length;
  const errCount = checks.filter((c) => c.status === 'err').length;
  const score = Math.max(5, Math.min(100, 100 - errCount * 12 - warnCount * 4));
  const nameFromTitle = title ? title.split(/[—|–-]/)[0].trim().slice(0, 60) : null;
  return {
    url: u.toString(), finalUrl, score, tookMs: Date.now() - started,
    okCount, warnCount, errCount, checks, platform,
    suggest: { name: nameFromTitle || (h1 ? h1.slice(0, 60) : null), title: title || null, h1: h1 || null, description: desc || null },
  };
}
