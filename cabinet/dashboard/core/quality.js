// Контролёр качества: семь проверок, вердикт pass | return | block. Демо-эвристика на словарях shared/quality/.
import { readFileSync } from '../_shim/node.js';
import { fileURLToPath } from '../_shim/node.js';
import { dirname, resolve } from '../_shim/node.js';
                                                                                                     
import { nextId } from './ids.js?v=mtmjsdom';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
                                                                 

let promiseMarkers                  = null;
let piiPatterns                                                       = null;

function loadDictionaries() {
  if (!promiseMarkers) {
    const p = JSON.parse(readFileSync(resolve(ROOT, 'shared/quality/promises.json'), 'utf8'))                         ;
    promiseMarkers = p.markers.map((m) => m.toLowerCase());
  }
  if (!piiPatterns) {
    const p = JSON.parse(readFileSync(resolve(ROOT, 'shared/quality/pii-patterns.json'), 'utf8'))                              ;
    piiPatterns = p.patterns.map((x) => ({ code: x.code, label: x.label, re: new RegExp(x.regex, 'iu') }));
  }
  return { promiseMarkers: promiseMarkers , piiPatterns: piiPatterns  };
}

function prose(a                 )         {
  const versions = (a.channelVersions ?? []).map((v) => v.body).join('\n');
  return [a.title, a.body, a.cta, versions].join('\n');
}

function normalizeTitle(t        )         {
  return t.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();
}

export function runQualityChecks(state              , a                 )                 {
  const { promiseMarkers, piiPatterns } = loadDictionaries();
  const text = prose(a);
  const lower = text.toLowerCase();
  const checks                 = [];

  // SOURCES — блокирует
  const hasSources = a.sources.length > 0;
  checks.push({ code: 'SOURCES', passed: hasSources, severity: hasSources ? 'info' : 'error',
    message: hasSources ? `Источников: ${a.sources.length}` : 'Нет ни одного источника — материал нельзя передать на согласование' });

  // PROMISES — блокирует
  const foundPromises = promiseMarkers.filter((m) => lower.includes(m));
  checks.push({ code: 'PROMISES', passed: foundPromises.length === 0, severity: foundPromises.length ? 'error' : 'info',
    message: foundPromises.length ? `Категорические обещания: ${foundPromises.map((m) => `«${m}»`).join(', ')}` : 'Категорических обещаний не найдено',
    evidence: foundPromises });

  // PII — блокирует
  const foundPii = piiPatterns.filter((p) => p.re.test(text)).map((p) => p.label);
  checks.push({ code: 'PII', passed: foundPii.length === 0, severity: foundPii.length ? 'error' : 'info',
    message: foundPii.length ? `Похоже на персональные данные: ${foundPii.join(', ')}` : 'Персональных данных не найдено (демо-эвристика)',
    evidence: foundPii });

  // UNVERIFIED_FACTS — возврат
  const unverified = a.facts.filter((f) => (f.type ?? 'fact') === 'fact' && !f.verified);
  checks.push({ code: 'UNVERIFIED_FACTS', passed: unverified.length === 0, severity: unverified.length ? 'warn' : 'info',
    message: unverified.length ? `Непроверенных фактов: ${unverified.length}` : 'Все факты проверены или отнесены к предположениям',
    evidence: unverified.map((f) => f.text) });

  // REPEAT_TOPIC — возврат
  const norm = normalizeTitle(a.title);
  const repeat = state.artifacts.find((x) => x.id !== a.id && x.kind === a.kind && x.status === 'PUBLISHED' && normalizeTitle(x.title) === norm);
  checks.push({ code: 'REPEAT_TOPIC', passed: !repeat, severity: repeat ? 'warn' : 'info',
    message: repeat ? `Тема уже публиковалась: ${repeat.id}` : 'Повторов темы среди опубликованного нет' });

  // STYLE — возврат: запрещённые формулировки проекта
  const forbidden = state.project.brand.forbiddenPhrases.filter((p) => lower.includes(p.toLowerCase()));
  checks.push({ code: 'STYLE', passed: forbidden.length === 0, severity: forbidden.length ? 'warn' : 'info',
    message: forbidden.length ? `Запрещённые формулировки проекта: ${forbidden.map((m) => `«${m}»`).join(', ')}` : 'Стиль соответствует правилам проекта',
    evidence: forbidden });

  // APPROVAL_MARK — материал не должен нести отметку одобрения до решения человека
  const preApproved = a.status === 'APPROVED' || a.status === 'PUBLISHED' || a.approvalId !== null;
  checks.push({ code: 'APPROVAL_MARK', passed: !preApproved, severity: preApproved ? 'error' : 'info',
    message: preApproved ? 'Материал уже несёт отметку согласования — проверка до решения человека невозможна' : 'Отметки согласования нет; решение — за человеком' });

  return checks;
}

export function buildQualityReport(state              , now        , a                 , by                   )                {
  const checks = runQualityChecks(state, a);
  const blocking = checks.filter((c) => !c.passed && c.severity === 'error');
  const returning = checks.filter((c) => !c.passed && c.severity === 'warn');
  const verdict = blocking.length ? 'block' : returning.length ? 'return' : 'pass';
  const reason = verdict === 'pass'
    ? 'Все проверки пройдены; материал передан в очередь согласования человека'
    : (blocking.length ? blocking : returning).map((c) => `${c.code}: ${c.message}`).join('; ');
  return { id: nextId(state, 'qr'), artifactId: a.id, artifactVersion: a.version, verdict, checks, reason, createdAt: now, by };
}
