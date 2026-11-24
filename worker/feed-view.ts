import { domains, timeOf, type DigestReceipt, type IndustryCheck, type IndustryState } from "./industry";
import { buildFeeds, eventItem, type FeedItem } from "./feeds";
import type { Category, Paper } from "./types";
import { shanghaiDate } from "./frontier";

const esc = (v: string | number) => String(v).replace(/[&<>"']/g,c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
const red = "color:#a3182c;font-weight:700";
const majorText = "重大进展";
export function displayTime(s: string) {
  if (!s) return "日期待核";
  if (s.length === 7) return s + "（仅核到月）";
  if (s.length === 10) return s;
  return new Intl.DateTimeFormat("sv-SE", { timeZone:"Asia/Shanghai",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23" }).format(new Date(s));
}
function links(item: FeedItem) {
  return item.sources.map(s => '<a href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">' + esc(s.label) + '</a>').join(" · ");
}
function evidenceRows(item: FeedItem) {
  const rows = [["技术变化",item.change],["原始证据",item.evidence],["证据边界",item.limit],["入选理由",item.why]];
  return rows.filter(([,v]) => !!v).map(([k,v]) => '<p><strong>' + k + '</strong>　' + esc(v) + '</p>').join("");
}
function meta(item: FeedItem) {
  return [item.kind, ...item.domains, item.published ? (item.kind === "技术范式" ? "证据 " : "公开 ") + displayTime(item.published) : "",
    item.selected ? "选读 " + item.selected : "", "重要度 " + item.score + "/100"].filter(Boolean).join(" · ");
}
function card(item: FeedItem, section: string) {
  const isDaily = section === "daily-recommendations";
  const cls = isDaily ? "recommendation daily-recommendation" : "technology-note";
  const marker = item.major ? '<strong class="frontier-alert" style="' + red + '">' + majorText + '</strong> ' : "";
  const title = '<a href="' + esc(item.href) + '">' + esc(item.title) + '</a>';
  return '<article class="' + cls + (item.major ? ' is-major' : '') + '" data-frontier-id="' + esc(item.id)
    + '"' + (item.paperId ? ' data-technology-paper-id="' + esc(item.paperId) + '"' : '') + '><div class="paper-meta">'
    + marker + esc(meta(item)) + '</div><h3>' + (item.major ? '<strong>' + title + '</strong>' : title) + '</h3><p class="reading-text">'
    + esc(item.summary) + '</p><details class="daily-evidence"><summary>技术变化、证据与来源</summary>' + evidenceRows(item)
    + '<p>' + links(item) + (item.paperId ? ' · <a href="/papers/' + esc(item.paperId) + '.html">阅读论文精读</a>' : '') + '</p></details></article>';
}
function reviewStatus(checks: IndustryCheck[]) {
  return '<details class="frontier-checks"><summary>三个领域的最近核查时间（北京时间）</summary>' + Object.entries(domains).map(([key,label]) => {
    const check = checks.find(c => c.domain === key);
    return '<p><strong>' + label + '</strong>　' + (check ? esc(displayTime(check.checkedAt)) + '　' + esc(check.result) : '尚无核查记录') + '</p>';
  }).join("") + '</details>';
}
export function feedSections(papers: Paper[],topics: Category[], state: IndustryState, latest: boolean) {
  const feeds = buildFeeds(papers, topics, state, new Date(), latest);
  function section(id: string,title: string,detail: string,list: FeedItem[]) {
    const nav = '<nav class="feed-order" aria-label="' + title + '排序"><a' + (!latest ? ' aria-current="true"' : '')
      + ' href="?order=impact#' + id + '">综合优先</a><a' + (latest ? ' aria-current="true"' : '')
      + ' href="?order=time#' + id + '">发布时间</a></nav>';
    return '<section class="page-section" id="' + id + '"><header class="section-heading"><h2>' + title + '</h2><p>' + detail
      + ' · ' + list.length + ' 条</p>' + nav + '</header>'
      + (id === "daily-recommendations" ? reviewStatus(feeds.checks) : '')
      + list.map(i => card(i,id)).join("") + '</section>';
  }
  return section("daily-recommendations","每日推荐","跟进自动驾驶、大模型与具身智能的重要论文和发布。重大进展同时进入两栏。",feeds.daily)
    + section("latest-technology","最新技术",'按领域影响与实际公开时间排序。时间均为北京时间。<a href="/skills/technology-updates">收录规则</a>',feeds.technology);
}
export function eventPage(e: IndustryState["events"][number]) {
  const i = eventItem(e);
  return '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(i.title)
    + '</title><link rel="stylesheet" href="/notebook.css"><main class="shell page-section frontier-detail"><a href="/#latest-technology">返回最新技术</a><p class="edition">'
    + esc(meta(i)) + '（北京时间）</p><h1>' + (i.major ? '<strong style="' + red + '">重大进展 · ' + esc(i.title) + '</strong>' : esc(i.title))
    + '</h1><p>' + esc(i.summary) + '</p>' + evidenceRows(i) + '<p>' + links(i) + '</p>'
    + (i.paperId ? '<p><a href="/papers/' + esc(i.paperId) + '.html">打开论文精读</a></p>' : '') + '</main></html>';
}
export function makeDigest(papers: Paper[], topics: Category[], state: IndustryState, origin: string, receipts: DigestReceipt[], now = new Date()) {
  const feeds = buildFeeds(papers, topics, state, now);
  const day = shanghaiDate(now);
  const prior = receipts.find(r => r.day < day);
  const current = receipts.find(r => r.day === day);
  const through = current?.through ?? now.toISOString();
  const end = Date.parse(through);
  const begin = prior ? Date.parse(prior.through) : Number.NEGATIVE_INFINITY;
  const seen = new Set<string>();
  const unique = [...feeds.daily,...feeds.technology].filter(i => {
    const stamp = i.updatedAt ? Date.parse(i.updatedAt) : 0;
    const eventDue = Boolean(i.updatedAt) && stamp > begin && stamp <= end;
    const key = i.paperId ? "paper/" + i.paperId : i.id;
    if ((!eventDue && i.selected !== day) || seen.has(key)) return false;
    seen.add(key); return true;
  }).sort((a,b) => Number(b.major)-Number(a.major) || b.score-a.score);
  const absolute = (href:string) => new URL(href,origin).href;
  const render = (i:FeedItem) => '<p>' + (i.major ? '<strong style="' + red + '">【重大进展】' : '<strong>')
    + '<a style="' + (i.major ? red : "color:#183e65") + '" href="' + esc(absolute(i.href)) + '">' + esc(i.title) + '</a></strong><br>'
    + esc(meta(i)) + '<br>' + esc(i.summary) + (i.major ? '<br>证据边界：' + esc(i.limit) : '') + '</p>';
  const html = '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>' + day + ' 行业前沿日报</title><body><h1>行业前沿日报 · '
    + day + '</h1>' + (unique.length ? unique.map(render).join("") : '<p>本期暂无新增或实质修订。</p>')
    + '<p><a href="' + esc(absolute("/#daily-recommendations")) + '">每日推荐</a> · <a href="' + esc(absolute("/#latest-technology")) + '">最新技术</a></p></body></html>';
  return { day, through, subject: "行业前沿日报 · " + day, majorCount: unique.filter(i => i.major).length,
    items: unique.map(i => ({id:i.id, title:i.title, major:i.major})), html, receipt: current ?? null };

}

export function domainEvents(state: IndustryState, category: Category, papers: Paper[]) {
  const key = category.id === "large-models" ? "models" : category.id === "embodied-robotics" ? "robotics"
    : category.label === "自动驾驶" ? "driving" : undefined;
  if (!key) return "";
  const records = state.events.filter(e => e.domains.includes(key) && (!e.paperId || papers.some(p => p.id === e.paperId && !p.deletedAt)))
    .sort((a,b) => timeOf(b.published) - timeOf(a.published) || a.id.localeCompare(b.id));
  if (!records.length) return "";
  return '<details class="daily-evidence"><summary>本领域的近期发布（' + records.length + '）</summary><ul>'
    + records.map(e => '<li><a href="/frontier/' + esc(e.id) + '">' + (e.major ? '<strong style="' + red + '">【重大进展】' + esc(e.title) + '</strong>' : esc(e.title))
      + '</a> · ' + esc(displayTime(e.published)) + '</li>').join("") + '</ul></details>';
}
