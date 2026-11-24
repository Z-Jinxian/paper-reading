import { frontierLibrary } from "./frontier";
import { domains, timeOf, type IndustryEvent, type IndustryState, type SourceLink } from "./industry";
import { readingImportance } from "./reading-priority";
import type { Category, Paper } from "./types";

export type FeedItem = {
  id: string; title: string; kind: string; domains: string[]; published: string; selected?: string;
  score: number; summary: string; change: string; evidence: string; limit: string; why: string;
  sources: SourceLink[]; href: string; major: boolean; paperId?: string; firstSeen?: string; updatedAt?: string;
};
export const minimumFeed = 10;
const dayMs = 86_400_000;

export function rankValue(item: FeedItem, now: number) {
  const age = Math.max(0, (now - timeOf(item.published)) / dayMs);
  return .84 * item.score + 16 * 2 ** (-age / 7);
}
export function ordered(list: FeedItem[], now: number, latest = false) {
  return [...list].sort((a,b) => {
    const byDate = timeOf(b.published) - timeOf(a.published) || 0;
    const byImpact = rankValue(b, now) - rankValue(a, now);
    return (latest ? byDate || byImpact : byImpact || byDate) || b.score - a.score || a.id.localeCompare(b.id);
  });
}
function paperItem(p: Paper, topics: Category[]): FeedItem {
  const n = p.data;
  const f = n.frontier;
  const first = f?.firstPublic?.match(/^(\d{4}-\d\d(?:-\d\d)?)(?!\d)/)?.[1];
  const score = Math.max(0, readingImportance(p));
  return {
    id: p.id, paperId: p.id, title: n.title, kind: "论文", major: false, score,
    domains: topics.filter(t => [n.category,...(n.additionalCategories ?? [])].includes(t.id)).map(t => t.label),
    published: first ?? f?.date ?? "", selected: n.recommendation?.date, href: "/papers/" + p.id + ".html",
    summary: n.reason || f?.lesson || n.thesis, change: f?.lesson || n.thesis,
    evidence: f?.evidence || n.recommendation?.evidence || "", limit: n.limits[0] || "", why: n.recommendation?.evidence || "",
    sources: n.source.landing ? [{ label: "论文出处", url: n.source.landing }] : [],
  };
}
export function eventItem(e: IndustryEvent): FeedItem {
  return {
    ...e, kind: e.kind, domains: e.domains.map(d => domains[d]), score: e.importance, href: "/frontier/" + e.id,
  };
}
function unique(items: FeedItem[]) {
  const found = new Set<string>();
  return items.filter(x => {
    const keys = [x.id, ...(x.paperId ? ["paper/" + x.paperId] : [])];
    if (keys.some(k => found.has(k))) return false;
    keys.forEach(k => found.add(k)); return true;
  });
}
export function buildFeeds(papers: Paper[], topics: Category[], state: IndustryState, now = new Date(), latest = false) {
  const archive = frontierLibrary(papers, topics);
  const active = papers.filter(p => !p.deletedAt);
  const activeIds = new Set(active.map(p => p.id));
  const papersByUrl = new Map(papers.filter(p => p.data.source.landing).map(p => [p.data.source.landing.replace(/\/$/,""),p]));
  const events = state.events.filter(e => !e.paperId || activeIds.has(e.paperId)).map(eventItem);
  const notes = active.map(p => paperItem(p,topics));
  const byId = new Map(notes.map(item => [item.id,item]));
  const paradigms: FeedItem[] = [];
  for (const t of archive.technologies) {
    const p = t.paperId ? papers.find(p => p.id === t.paperId) : papersByUrl.get(t.source.replace(/\/$/,""));
    if (p?.deletedAt) continue;
    const n = p && byId.get(p.id);
    paradigms.push({ id: "tech-" + t.name, paperId: p?.id, title: t.name, kind: "技术范式", major: false,
      domains: n?.domains ?? [], score: t.importance ?? n?.score ?? 0, selected: t.recommendedOn,
      published: t.date, href: n?.href ?? t.source, summary: t.meaning, change: t.change, evidence: t.evidence,
      limit: t.limit, why: "", sources: [{ label: p?.data.title || "原始技术资料", url: t.source }] });
  }
  const evidencePool = notes.filter(x => x.sources.length && x.published && x.evidence && x.change && x.score > 0);
  const fallback = ordered(evidencePool,now.valueOf());
  function feed(primary: FeedItem[]) {
    const entries = unique(primary);
    if (entries.length < minimumFeed) {
      for (const item of unique([...entries,...fallback]).slice(entries.length,minimumFeed)) {
        entries.push({ ...item, kind: "往期精选" });
      }
    }
    return ordered(entries, now.valueOf(), latest);
  }
  const dailyPapers = active.filter(p => p.data.recommendation).map(p => ({
    ...byId.get(p.id)!, score: p.data.recommendation!.importance,
  }));
  return {
    daily: feed([...events.filter(e => e.major), ...dailyPapers]),
    technology: feed([...events, ...paradigms]),
    checks: state.checks,
  };
}
