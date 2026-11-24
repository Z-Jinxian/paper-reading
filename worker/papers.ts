import catalogue from "../content/catalogue.json";
import { checkReadingDraft } from "./reading-skill";
import type { Category, Formula, Note, Paper, PaperChange, PassageNote, ReadingRecommendation, Section, Source } from "./types";

const builtInTopics: Category[] = catalogue.categories;
const jsonNotes = import.meta.glob("../content/papers/*.json", { eager: true, import: "default" }) as unknown as Record<string, Note | undefined>;

export function blankNote(category = "extended"): Note {
  return {
    title: "", category, venue: "", reason: "", tags: [], thesis: "",
    source: { landing: "", pdf: "", version: "", note: "" },
    sections: [], formulas: [], example: { title: "", setup: "", steps: [], takeaway: "" }, limits: [],
  };
}

const seeds = new Map<string, Paper>(catalogue.papers.map((record) => {
  const note = jsonNotes["../content/papers/" + record.id + ".json"];
  if (!note) throw new Error("Missing paper note for " + record.id);
  const image = <T extends Section | Formula>(item: T): T => ({
    ...item, asset: item.asset ? "/assets/papers/" + record.id + "/" + item.asset : "",
  });
  const data = {
    ...note, ...record,
    sections: note.sections.map(image),
    formulas: note.formulas.map(image),
  };
  return [record.id, { id: record.id, data, revision: 0, updatedAt: null, deletedAt: null }];
}));

export const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const newIdPattern = /^user-[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
export const imageNamePattern = /^[0-9a-f-]{36}\.(png|jpg|webp)$/;
const maxImageBytes = 5 * 1024 * 1024;
export const maxBodyBytes = 22 * 1024 * 1024;

export class PaperError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export async function allTopics(db: D1Database): Promise<Category[]> {
  const stored = await db.prepare("SELECT id, name FROM paper_topics ORDER BY created_at, id")
    .all<{ id: string; name: string }>();
  return [
    ...builtInTopics,
    ...stored.results.map(({ id, name }) => ({ id, label: name, question: "", description: "" })),
  ];
}

const topicNameKey = (name: string) => name.normalize("NFKC").trim().replace(/\s+/gu, " ").toLowerCase();

export async function createTopic(db: D1Database, name: unknown): Promise<Category> {
  const label = typeof name === "string" ? name.trim().replace(/\s+/gu, " ") : "";
  if (!label || label.length > 40) throw new PaperError(422, "请输入 1 到 40 个字符的专题名称。");
  const key = topicNameKey(label);
  if (!key) throw new PaperError(422, "请输入专题名称。");
  if (builtInTopics.some((topic) => topicNameKey(topic.label) === key)) {
    throw new PaperError(409, "这个专题已存在。");
  }

  const id = "topic-" + crypto.randomUUID();
  const result = await db.prepare(
    "INSERT INTO paper_topics (id, name, name_key, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(name_key) DO NOTHING",
  ).bind(id, label, key, new Date().toISOString()).run();
  if (result.meta.changes !== 1) throw new PaperError(409, "这个专题已存在。");
  return { id, label, question: "", description: "" };
}

function fromRow(row: PaperChange): Paper {
  return {
    id: row.id, data: JSON.parse(row.data), revision: row.revision,
    updatedAt: row.updated_at, deletedAt: row.deleted_at,
  };
}

export async function allPapers(db: D1Database): Promise<Paper[]> {
  const stored = await db.prepare("SELECT id, data, revision, updated_at, deleted_at FROM paper_changes").all<PaperChange>();
  const papers = new Map(seeds);
  for (const row of stored.results) papers.set(row.id, fromRow(row));
  return [...papers.values()];
}

export async function paperById(db: D1Database, id: string): Promise<Paper | null> {
  const row = await db.prepare("SELECT id, data, revision, updated_at, deleted_at FROM paper_changes WHERE id = ?")
    .bind(id).first<PaperChange>();
  return row ? fromRow(row) : seeds.get(id) ?? null;
}

function clean(value: unknown, limit = 12000) {
  if (typeof value !== "string") return "";
  const result = value.trim();
  if (result.length > limit) throw new PaperError(422, "有一项内容超过可保存的长度，请适当缩短后再试。");
  return result;
}

function list<T>(value: unknown, parse: (value: any) => T, limit = 24): T[] {
  if (!Array.isArray(value)) return [];
  if (value.length > limit) throw new PaperError(422, "有一组条目过多，请拆分或精简后再试。");
  return value.map(parse);
}

function lines(value: unknown) {
  return list(value, (line) => clean(line)).filter(Boolean);
}

function url(value: unknown) {
  const str = clean(value, 2048);
  if (!str) return "";
  try {
    const parsed = new URL(str);
    if (parsed.protocol === "https:" && !parsed.username && !parsed.password) return parsed.href;
  } catch {
    // Return a field error for malformed source links.
  }
  throw new PaperError(422, "论文和 PDF 链接请填写完整的 HTTPS 地址。");
}

function pageNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const page = Number(value);
  if (Number.isInteger(page) && page >= 1 && page <= 100000) return page;
  throw new PaperError(422, "PDF 页码请填写从 1 开始的整数。");
}

function revisionNumber(value: unknown) {
  const rev = Number(value);
  if (value !== "" && value !== null && Number.isSafeInteger(rev) && rev >= 0) return rev;
  throw new PaperError(422, "缺少版本信息，请重新打开这篇论文。");
}

function evidence(input: any, knownAssets: Set<string>) {
  const asset = clean(input?.asset, 240);
  if (asset && !knownAssets.has(asset)) throw new PaperError(422, "有一张截图已变更，请重新打开编辑页。");
  return { asset, alt: clean(input?.alt, 260), page: pageNumber(input?.page) };
}

function passageNote(input: any): PassageNote {
  const page = pageNumber(input?.page);
  const from = pageNumber(input?.from);
  const to = pageNumber(input?.to);
  const summary = clean(input?.summary, 1400);
  if (!page || !summary || (from === null) !== (to === null) || (from !== null && to !== null && from > to)) {
    throw new PaperError(422, "段落导读须填写 PDF 页码、有效的行范围（如有）和中文解读。");
  }
  return { page, ...(from !== null && to !== null ? { from, to } : {}), summary };
}

function publicationDate(value: unknown): string {
  const text = clean(value, 10);
  const iso = text.length === 7 ? text + "-01" : text;
  const parsed = new Date(iso + "T00:00:00Z");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || !Number.isFinite(parsed.valueOf()) || parsed.toISOString().slice(0,10) !== iso) {
    throw new PaperError(422, "请填入核实的发表日期或月份。");
  }
  return text;
}

function readingRecommendation(value: any, previous?: ReadingRecommendation): ReadingRecommendation | undefined {
  if (value === undefined) return previous;
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value.date)
    || !Number.isFinite(value.importance) || value.importance < 0 || value.importance > 100) {
    throw new PaperError(422, "推荐须包含 YYYY-MM-DD 日期和 0 到 100 的重要度。");
  }
  publicationDate(value.date);
  return { date: value.date, importance: value.importance, evidence: clean(value.evidence, 12000) };
}

function normalizeNote(raw: any, topics: Category[], previous?: Note): Note {
  const knownAssets = new Set([
    ...(previous?.sections || []), ...(previous?.formulas || []),
  ].map((item) => item.asset));
  const title = clean(raw?.title, 600);
  if (!title) throw new PaperError(422, "请填写论文标题。");
  const category = clean(raw?.category, 70);
  if (!topics.some((item) => item.id === category)) throw new PaperError(422, "请选择一个专题。");
  const source: Source = {
    landing: url(raw.source?.landing),
    pdf: url(raw.source?.pdf),
    version: clean(raw.source?.version, 280),
    note: clean(raw.source?.note, 2400),
  };
  return {
    ...previous,
    title, category, source,
    readingImportance: raw.readingImportance === undefined ? previous?.readingImportance
      : Number.isFinite(raw.readingImportance) && raw.readingImportance >= 0 && raw.readingImportance <= 100
        ? raw.readingImportance : (() => { throw new PaperError(422, "阅读优先度须为 0 到 100。"); })(),
    additionalCategories: [...new Set(list(raw.additionalCategories ?? previous?.additionalCategories,
      (id) => clean(id, 70), 12))].filter((id) => id !== category && topics.some((topic) => topic.id === id)),
    frontier: raw.frontier ? {
      date: publicationDate(raw.frontier.date), firstPublic: clean(raw.frontier.firstPublic, 280),
      lesson: clean(raw.frontier.lesson), evidence: clean(raw.frontier.evidence),
    } : previous?.frontier,
    paradigm: raw.paradigm ? {
      name: clean(raw.paradigm.name, 160), meaning: clean(raw.paradigm.meaning),
      change: clean(raw.paradigm.change), evidence: clean(raw.paradigm.evidence),
      limit: clean(raw.paradigm.limit), source: url(raw.paradigm.source), date: publicationDate(raw.paradigm.date),
    } : previous?.paradigm,
    recommendation: readingRecommendation(raw.recommendation, previous?.recommendation),
    technologyRecommendation: readingRecommendation(raw.technologyRecommendation, previous?.technologyRecommendation),
    generatedFrom: raw.generatedFrom === "upload" || raw.generatedFrom === "link" ? raw.generatedFrom : previous?.generatedFrom,
    venue: clean(raw.venue, 280),
    reason: clean(raw.reason),
    thesis: clean(raw.thesis),
    tags: [...new Set(list(raw.tags, (tag) => clean(tag, 40), 12).filter(Boolean))],
    sections: list(raw.sections, (item): Section => ({
      heading: clean(item?.heading, 350),
      why: clean(item?.why),
      details: lines(item?.details),
      background: clean(item?.background, 1000),
      originalText: clean(item?.originalText),
      translation: clean(item?.translation),
      passagePages: clean(item?.passagePages, 200),
      passageNotes: list(item?.passageNotes, passageNote, 8),
      ...evidence(item, knownAssets),
    }), 12),
    formulas: list(raw.formulas, (item): Formula => ({
      name: clean(item?.name, 350),
      original: clean(item?.original, 350),
      latex: clean(item?.latex, 6000),
      symbols: list(item?.symbols, (pair): [string, string] => [clean(pair?.[0], 240), clean(pair?.[1], 2000)]).filter(([symbol, meaning]) => symbol || meaning),
      steps: lines(item?.steps),
      scope: clean(item?.scope),
      principle: clean(item?.principle),
      numericExample: clean(item?.numericExample),
      ...evidence(item, knownAssets),
    }), 12),
    example: {
      title: clean(raw.example?.title, 350),
      setup: clean(raw.example?.setup),
      steps: list(raw.example?.steps, (step) => ({
        label: clean(step?.label, 350), text: clean(step?.text), latex: clean(step?.latex, 6000),
      }), 24).filter((step) => step.label || step.text || step.latex),
      takeaway: clean(raw.example?.takeaway),
    },
    limits: lines(raw.limits),
  };
}

function fileType(data: Uint8Array) {
  if (data.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => data[index] === byte)) {
    return { mime: "image/png", ext: "png" };
  }
  if (data[0] === 255 && data[1] === 216 && data[2] === 255) {
    return { mime: "image/jpeg", ext: "jpg" };
  }
  if (data.length >= 12 && String.fromCharCode(...data.slice(0, 4)) === "RIFF" && String.fromCharCode(...data.slice(8, 12)) === "WEBP") {
    return { mime: "image/webp", ext: "webp" };
  }
  throw new PaperError(422, "原文截图支持 PNG、JPEG 或 WebP。");
}

async function uploadImages(form: FormData, note: Note, id: string, bucket?: R2Bucket) {
  const uploads = [];
  let bytes = 0;
  for (const [key, file] of form.entries()) {
    if (key === "note" || key === "revision") continue;
    const match = /^(section|formula)-([0-9]+)$/.exec(key);
    const evidenceList = match?.[1] === "section" ? note.sections : note.formulas;
    const item = match && evidenceList[Number(match[2])];
    if (!item || !(file instanceof File)) throw new PaperError(422, "截图与笔记条目不匹配，请重选文件。");
    bytes += file.size;
    if (!file.size || file.size > maxImageBytes || bytes > maxBodyBytes - 1024 * 1024) {
      throw new PaperError(413, "单张截图最大 5 MB，一次保存的截图总大小最多 21 MB。");
    }
    const data = new Uint8Array(await file.arrayBuffer());
    const type = fileType(data);
    const digest = await crypto.subtle.digest("SHA-256", data);
    const hex = Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
    const name = [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20, 32)].join("-") + "." + type.ext;
    uploads.push({ data, type, name, item });
  }
  if (uploads.length && !bucket) throw new PaperError(503, "截图暂时无法保存，请稍后重试。");
  for (const { data, type, name, item } of uploads) {
    await bucket!.put("papers/" + id + "/" + name, data, {
      httpMetadata: { contentType: type.mime },
    });
    item.asset = "/paper-media/" + id + "/" + name;
  }
}

function removeEmptyBlocks(note: Note) {
  note.sections = note.sections.filter((item) => item.heading || item.why || item.details.length || item.asset || item.page || item.background || item.originalText || item.translation || item.passageNotes?.length);
  note.formulas = note.formulas.filter((item) => item.name || item.original || item.latex || item.symbols.length || item.steps.length || item.asset || item.page || item.scope || item.principle || item.numericExample);
}

const conflict = () => new PaperError(409, "这篇论文已在另一页面更新。请保留当前输入，再重新打开最新版本。");

async function storeChange(db: D1Database, paper: Paper, expected: number, newRecommendationDate?: string, newTechnologyDate?: string) {
  // D1 evaluates the write and this date claim in the same SQLite statement.
  const dateGuard = (newRecommendationDate
    ? " AND NOT EXISTS (SELECT 1 FROM paper_changes WHERE deleted_at IS NULL AND json_extract(data, '$.recommendation.date') = ? AND id <> ?)"
    : "") + (newTechnologyDate
    ? " AND NOT EXISTS (SELECT 1 FROM paper_changes WHERE deleted_at IS NULL AND json_extract(data, '$.technologyRecommendation.date') = ? AND id <> ?)"
    : "");
  const claim = [...(newRecommendationDate ? [newRecommendationDate, paper.id] : []),
    ...(newTechnologyDate ? [newTechnologyDate, paper.id] : [])];
  const data = JSON.stringify(paper.data);
  const result = expected === 0
    ? await db.prepare(
        "INSERT OR IGNORE INTO paper_changes (id, data, revision, updated_at, deleted_at) SELECT ?, ?, 1, ?, ? WHERE 1" + dateGuard
      ).bind(paper.id, data, paper.updatedAt, paper.deletedAt, ...claim).run()
    : await db.prepare(
        "UPDATE paper_changes SET data = ?, revision = revision + 1, updated_at = ?, deleted_at = ? WHERE id = ? AND revision = ?" + dateGuard
      ).bind(data, paper.updatedAt, paper.deletedAt, paper.id, expected, ...claim).run();
  if (result.meta.changes !== 1) throw conflict();
  return { ...paper, revision: expected + 1 };
}

export async function savePaper(request: Request, db: D1Database, bucket: R2Bucket | undefined, id: string) {
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) {
    throw new PaperError(415, "请从论文编辑表单保存。");
  }
  if (Number(request.headers.get("content-length")) > maxBodyBytes) {
    throw new PaperError(413, "一次保存的内容超过 22 MB，请压缩截图后重试。");
  }
  const form = await request.formData().catch(() => { throw new PaperError(422, "无法读取表单。"); });
  const expected = revisionNumber(form.get("revision"));
  const previous = await paperById(db, id);
  if (!previous && !newIdPattern.test(id)) throw new PaperError(404, "找不到这篇论文。");
  if (previous?.deletedAt) throw new PaperError(409, "请先从回收站恢复这篇论文。");
  if ((previous?.revision ?? 0) !== expected) throw conflict();
  const body = form.get("note");
  if (typeof body !== "string" || body.length > 500000) throw new PaperError(422, "论文笔记过长，请拆分后重试。");
  let raw;
  try {
    raw = JSON.parse(body);
  } catch {
    throw new PaperError(422, "无法读取论文笔记。");
  }
  const topics = await allTopics(db);
  const data = normalizeNote(raw, topics, previous?.data);
  const claim = data.recommendation?.date !== previous?.data.recommendation?.date ? data.recommendation?.date : undefined;
  if (claim) {
    publicationDate(claim);
    const domainIds = topics.filter(topic => topic.id === "large-models" || topic.id === "embodied-robotics" || topic.label === "自动驾驶").map(topic => topic.id);
    if (![data.category, ...(data.additionalCategories ?? [])].some(id => domainIds.includes(id))) {
      throw new PaperError(422, "每日推荐须同时归入至少一个领域板块。");
    }
    const library = await allPapers(db);
    if (library.some(p => p.id !== id && !p.deletedAt && p.data.recommendation?.date === claim)) {
      throw new PaperError(409, "该日已有推荐，请回读并继续维护精选。");
    }
  }
  const technologyClaim = data.technologyRecommendation?.date !== previous?.data.technologyRecommendation?.date
    ? data.technologyRecommendation?.date : undefined;
  if (data.technologyRecommendation && (!data.paradigm || !data.paradigm.name || !data.paradigm.meaning
    || !data.paradigm.change || !data.paradigm.evidence || !data.paradigm.limit || !data.paradigm.source)) {
    throw new PaperError(422, "最新技术须补齐技术名称、原理、进展、证据、边界和一手来源。");
  }
  if (technologyClaim) {
    const library = await allPapers(db);
    if (library.some(p => p.id !== id && !p.deletedAt && p.data.technologyRecommendation?.date === technologyClaim)) {
      throw new PaperError(409, "该日已有最新技术论文，请回读并继续补充该记录。");
    }
  }

  await uploadImages(form, data, id, bucket);
  removeEmptyBlocks(data);
  return storeChange(db, { id, data, revision: expected, updatedAt: new Date().toISOString(), deletedAt: null }, expected, claim, technologyClaim);
}

export async function changePaperStatus(request: Request, db: D1Database, id: string, remove: boolean) {
  const paper = await paperById(db, id);
  if (!paper) throw new PaperError(404, "找不到这篇论文。");
  let raw: { revision?: unknown };
  try {
    raw = await request.json();
  } catch {
    throw new PaperError(422, "缺少版本信息。");
  }
  const expected = revisionNumber(raw?.revision);
  if (paper.revision !== expected) throw conflict();
  if (Boolean(paper.deletedAt) === remove) return paper;
  const now = new Date().toISOString();
  return storeChange(db, { ...paper, updatedAt: now, deletedAt: remove ? now : null }, expected,
    remove ? undefined : paper.data.recommendation?.date, remove ? undefined : paper.data.technologyRecommendation?.date);
}

export function isComplete(note: Note) {
  const section = note.sections.length > 0 && note.sections.every((item) => item.heading && item.why && item.details.length && item.asset && item.page);
  const formula = note.formulas.length > 0 && note.formulas.every((item) => item.name && item.latex && item.steps.length && item.asset && item.page);
  const example = note.example;
  const generatedComplete = !note.generatedFrom || !checkReadingDraft(note, note.generatedFrom === "upload").length;
  return Boolean(section && formula && example.title && example.setup && example.steps.length >= 2 && example.takeaway && generatedComplete);
}


