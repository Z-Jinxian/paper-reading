import { PaperError, paperById } from "./papers";

export const domains = { driving: "自动驾驶", models: "大模型", robotics: "具身智能与机器人" } as const;
export type Domain = keyof typeof domains;
export type SourceLink = { label: string; url: string };
export type IndustryEvent = {
  id: string; title: string; domains: Domain[]; kind: string; published: string;
  importance: number; major: boolean; summary: string; change: string; evidence: string;
  limit: string; why: string; sources: SourceLink[]; paperId?: string;
  revision: number; firstSeen: string; updatedAt: string;
};
export type IndustryCheck = { domain: Domain; checkedAt: string; sources: SourceLink[]; result: string };
export type IndustryState = { events: IndustryEvent[]; checks: IndustryCheck[] };
type EventRow = { id: string; data: string; revision: number; first_seen: string; updated_at: string };
const toEvent = (r: EventRow): IndustryEvent => ({
  ...JSON.parse(r.data), id: r.id, revision: r.revision, firstSeen: r.first_seen, updatedAt: r.updated_at,
});
const eventKinds = ["论文", "模型发布", "技术报告", "部署更新", "开放权重", "数据与评测", "开源实现", "独立验证"];

export function validDomain(x: unknown): x is Domain {
  return typeof x === "string" && Object.hasOwn(domains, x);
}
function field(x: unknown, label: string, max = 3000) {
  if (typeof x !== "string" || !x.trim() || x.trim().length > max) throw new PaperError(422, "请核对" + label + "。");
  return x.trim();
}
function links(raw: unknown) {
  if (!Array.isArray(raw) || !raw.length || raw.length > 12) throw new PaperError(422, "请提供可定位的原始来源。");
  return raw.map((x): SourceLink => {
    const label = field(x?.label, "来源名称", 100);
    let u: URL;
    try { u = new URL(field(x?.url, "来源地址", 1800)); } catch { throw new PaperError(422, "来源须为 HTTPS 网页。"); }
    if (u.protocol !== "https:" || u.username || u.password) throw new PaperError(422, "来源须为 HTTPS 网页。");
    for (const key of [...u.searchParams.keys()]) if (key.startsWith("utm_")) u.searchParams.delete(key);
    return { label, url: u.href };
  });
}
export function timeOf(s: string) {
  if (!s) return Number.NEGATIVE_INFINITY;
  if (/^\d{4}-\d\d(?:-\d\d)?$/.test(s)) return Date.parse((s.length === 7 ? s + "-01" : s) + "T00:00:00+08:00");
  return Date.parse(s);
}
function verifiedDate(value: unknown, allowDay: boolean, now: number) {
  const s = field(value, "来源日期", 40);
  const dayOnly = /^\d{4}-\d\d-\d\d$/.test(s);
  if (!(allowDay && dayOnly) && !/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{1,3})?)?(?:Z|[+-]\d\d:\d\d)$/.test(s)) {
    throw new PaperError(422, "有时刻的记录须包含时区；仅知发布日期时请只填年月日。");
  }
  const day = s.slice(0,10);
  const canonical = new Date(day + "T00:00:00Z");
  const t = timeOf(s);
  if (!Number.isFinite(t) || !Number.isFinite(canonical.getTime()) || canonical.toISOString().slice(0,10) !== day || t > now + 60_000) {
    throw new PaperError(422, "公开或核查时间无效。");
  }
  return dayOnly ? day : new Date(t).toISOString();
}
async function body(request: Request) {
  if (Number(request.headers.get("content-length")) > 50000) throw new PaperError(413, "记录过长。");
  const raw = await request.text();
  if (raw.length > 50000) throw new PaperError(413, "记录过长。");
  try { const obj = JSON.parse(raw); if (obj && typeof obj === "object" && !Array.isArray(obj)) return obj; } catch {}
  throw new PaperError(422, "请提交 JSON 记录。");
}
export async function industryState(db: D1Database): Promise<IndustryState> {
  const [events, checks] = await Promise.all([
    db.prepare("SELECT * FROM industry_events ORDER BY id").all<EventRow>(),
    db.prepare("SELECT domain, checked_at, data FROM industry_checks ORDER BY domain").all<{ domain: Domain; checked_at: string; data: string }>(),
  ]);
  return { events: events.results.map(toEvent), checks: checks.results.map(r => ({ ...JSON.parse(r.data), domain: r.domain, checkedAt: r.checked_at })) };
}
export async function saveEvent(request: Request, db: D1Database, id: string) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || id.length > 120) throw new PaperError(422, "事件 ID 无效。");
  const r = await body(request);
  if (!Array.isArray(r.domains) || !r.domains.length || !r.domains.every(validDomain)
    || !eventKinds.includes(r.kind) || typeof r.major !== "boolean"
    || !Number.isInteger(r.importance) || r.importance < 0 || r.importance > 100
    || !Number.isSafeInteger(r.revision) || r.revision < 0) throw new PaperError(422, "请核对领域、资料类型、重大标记、评分和版本。");
  const now = new Date();
  const sources = links(r.sources);
  const published = verifiedDate(r.published, true, now.valueOf());
  const data = {
    title: field(r.title, "事件名称", 240), domains: [...new Set<Domain>(r.domains)].sort(),
    kind: r.kind, published, importance: r.importance, major: r.major,
    summary: field(r.summary, "进展摘要"), change: field(r.change, "技术变化"), evidence: field(r.evidence, "核验依据"),
    limit: field(r.limit, "证据边界"), why: field(r.why, "影响与评级理由"), sources,
    ...(r.paperId ? { paperId: field(r.paperId, "关联精读", 140) } : {}),
  };
  if (data.paperId) {
    const paper = await paperById(db, data.paperId);
    if (!paper || paper.deletedAt) throw new PaperError(422, "关联的精读记录当前不可用。");
  }
  const encoded = JSON.stringify(data);
  const prior = await db.prepare("SELECT * FROM industry_events WHERE id = ?").bind(id).first<EventRow>();
  if (prior?.data === encoded) return toEvent(prior);
  if ((prior?.revision ?? 0) !== r.revision) throw new PaperError(409, "事件已更新，请回读合并。");
  // A stable event ID and a dated primary-source locator protect parallel discoveries by two scans.
  const sourceKey = new Date(timeOf(published) + 8 * 3600_000).toISOString().slice(0,10) + " " + sources[0].url;
  const iso = now.toISOString();
  const q = prior
    ? db.prepare("UPDATE OR IGNORE industry_events SET data=?, source_key=?, revision=revision+1, updated_at=? WHERE id=? AND revision=?").bind(encoded,sourceKey,iso,id,r.revision)
    : db.prepare("INSERT OR IGNORE INTO industry_events (id,source_key,data,revision,first_seen,updated_at) VALUES (?,?,?,1,?,?)").bind(id,sourceKey,encoded,iso,iso);
  const saved = await q.run();
  if (saved.meta.changes !== 1) throw new PaperError(409, "此来源已收录或事件已更新，请回读并复用原记录。");
  return { ...data, id, revision: r.revision + 1, firstSeen: prior?.first_seen ?? iso, updatedAt: iso };
}
export async function saveCheck(request: Request, db: D1Database, domain: string) {
  if (!validDomain(domain)) throw new PaperError(404, "找不到这个领域。");
  const r = await body(request);
  const checkedAt = verifiedDate(r.checkedAt, false, Date.now());
  const data = { sources: links(r.sources), result: field(r.result, "核查结果", 1600) };
  await db.prepare("INSERT INTO industry_checks (domain,checked_at,data) VALUES (?,?,?) ON CONFLICT(domain) DO UPDATE SET checked_at=excluded.checked_at,data=excluded.data WHERE excluded.checked_at > industry_checks.checked_at")
    .bind(domain, checkedAt, JSON.stringify(data)).run();
  const row = await db.prepare("SELECT checked_at, data FROM industry_checks WHERE domain=?").bind(domain).first<{checked_at: string; data: string}>();
  return { domain, checkedAt: row!.checked_at, ...JSON.parse(row!.data) };
}

export type DigestReceipt = {day: string; through: string; messageId: string};
export async function digestReceipts(db: D1Database) {
  return (await db.prepare("SELECT day, through, message_id AS messageId FROM frontier_digests ORDER BY through DESC LIMIT 2")
    .all<DigestReceipt>()).results;
}
export async function recordDelivery(request: Request, db: D1Database, day: string) {
  if (!/^\d{4}-\d\d-\d\d$/.test(day)) throw new PaperError(422, "日报日期无效。");
  const r = await body(request);
  const through = verifiedDate(r.through, false, Date.now());
  const localDay = new Date(Date.parse(through) + 8 * 3600_000).toISOString().slice(0,10);
  if (day !== localDay) throw new PaperError(422, "回执的内容截止时间须与日报日期一致。");
  const messageId = field(r.messageId, "邮件提供方回执", 500);
  await db.prepare("INSERT OR IGNORE INTO frontier_digests (day,through,message_id) VALUES (?,?,?)").bind(day,through,messageId).run();
  const saved = await db.prepare("SELECT day, through, message_id AS messageId FROM frontier_digests WHERE day=?").bind(day).first<DigestReceipt>();
  if (saved?.messageId !== messageId || saved.through !== through) throw new PaperError(409, "当日报告已有回执，请核对已发送邮件。");
  return saved;
}
