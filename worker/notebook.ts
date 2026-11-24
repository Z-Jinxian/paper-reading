import { digestReceipts, industryState, recordDelivery, saveCheck, saveEvent } from "./industry";
import { buildFeeds } from "./feeds";
import { makeDigest, eventPage, feedSections } from "./feed-view";
import updateSkillMarkdown from "../skills/paper-updates/SKILL.md?raw";
import screeningSkillMarkdown from "../skills/paper-screening/SKILL.md?raw";
import { frontierLibrary } from "./frontier";
import { technologySkillMarkdown } from "./reading-skill";
import { analyzePdf, deleteModel, models, researchPdf, saveModel } from "./research";
import { allPapers, allTopics, blankNote, changePaperStatus, createTopic, idPattern, imageNamePattern, PaperError, paperById, savePaper } from "./papers";
import { editorPage, homepage, managementPage, messagePage, modelsPage, readingPage, readingSkillPage } from "./render";
import { readingSkill, readingSkillFilePath, readingSkillPath } from "./reading-skill";

const headers = { "cache-control": "no-store", "x-content-type-options": "nosniff" };
const html = (page: string, status = 200) => new Response(page, {
  status, headers: { ...headers, "content-type": "text/html; charset=utf-8" },
});
const json = (data: unknown, status = 200) => Response.json(data, { status, headers });

function checkMutation(request: Request, url: URL) {
  // Keep browser writes same-origin and require a non-simple header.
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  if (request.headers.get("x-notebook-request") !== "1" || (origin && origin !== url.origin) || site === "cross-site") {
    throw new PaperError(403, "请从论文阅读网站操作。");
  }
}

export async function serveNotebook(request: Request, env: Cloudflare.Env): Promise<Response | undefined> {
  const url = new URL(request.url);
  const path = url.pathname;
  const extraSkill = [
    { path: "/skills/paper-updates", title: "定期论文推荐", markdown: updateSkillMarkdown },
    { path: "/skills/paper-screening", title: "论文筛选 Skill", markdown: screeningSkillMarkdown },
  ].find(item => path === item.path || path === item.path + "/" || path === item.path + "/SKILL.md");
  const research = path === "/api/research/pdf" || path === "/api/research/analyze";
  const modelRoute = path === "/api/models" || path.startsWith("/api/models/");
  const topicsRoute = path === "/api/topics";
  const libraryRoute = path === "/api/library";
  const feedApi = path === "/api/frontier" || path.startsWith("/api/frontier/");
  const api = feedApi || libraryRoute || research || modelRoute || topicsRoute || path.startsWith("/api/papers/");
  const media = path.startsWith("/paper-media/");
  const technologySkill = path === "/skills/technology-updates" || path === "/skills/technology-updates/" || path === "/skills/technology-updates/SKILL.md";
  const skillPage = technologySkill || path === readingSkillPath || path === readingSkillPath + "/";
  const skillDownload = path === readingSkillFilePath || path === "/skills/technology-updates/SKILL.md";
  const feedPage = path.startsWith("/frontier/") || path === "/frontier-digest" || path === "/frontier-feed";
  const sitePage = feedPage || Boolean(extraSkill) || path === "/" || path === "/index.html" || path === "/models" || path === "/manage" || path.startsWith("/manage/") || path.startsWith("/papers/") || skillPage || skillDownload;
  if (!api && !media && !sitePage) return;

  try {
    if (extraSkill) {
      if (request.method !== "GET" && request.method !== "HEAD") return new Response(null, {status:405,headers});
      const markdown = path.endsWith("/SKILL.md");
      return new Response(request.method === "HEAD" ? null : markdown ? extraSkill.markdown : readingSkillPage(false,extraSkill),
        {headers:{...headers,"content-type":markdown ? "text/markdown; charset=utf-8" : "text/html; charset=utf-8"}});
    }
    if (skillPage || skillDownload) {
      const { method } = request;
      if (method !== "GET" && method !== "HEAD") {
        return new Response(null, { status: 405, headers: { ...headers, allow: "GET, HEAD" } });
      }
      if (skillDownload) {
        return new Response(method === "HEAD" ? null : (technologySkill ? technologySkillMarkdown : readingSkill), {
          headers: { ...headers, "content-type": "text/markdown; charset=utf-8", "content-disposition": 'attachment; filename="SKILL.md"' },
        });
      }
      return new Response(method === "HEAD" ? null : readingSkillPage(technologySkill), {
        headers: { ...headers, "content-type": "text/html; charset=utf-8" },
      });
    }

    if (media) {
      if (request.method !== "GET" && request.method !== "HEAD") return new Response(null, { status: 405, headers });
      const [, , id, name, ...rest] = path.split("/");
      if (!idPattern.test(id) || !imageNamePattern.test(name || "") || rest.length || !env.BUCKET) {
        return new Response(null, { status: 404, headers });
      }
      const key = "papers/" + id + "/" + name;
      const file = request.method === "HEAD" ? await env.BUCKET.head(key) : await env.BUCKET.get(key);
      if (!file) return new Response(null, { status: 404, headers });
      const metadata = new Headers(headers);
      file.writeHttpMetadata(metadata);
      metadata.set("content-security-policy", "default-src 'none'; sandbox");
      return new Response("body" in file ? (file as R2ObjectBody).body : null, { headers: metadata });
    }

    if (!env.DB) throw new PaperError(503, "论文库暂时无法连接，请稍后刷新。");
    if (api) {
      checkMutation(request, url);
      if (feedApi) {
        if (path === "/api/frontier/digest" && request.method === "GET") {
          const [papers,topics,state,receipts] = await Promise.all([allPapers(env.DB),allTopics(env.DB),industryState(env.DB),digestReceipts(env.DB)]);
          return json(makeDigest(papers,topics,state,url.origin,receipts));
        }
        const receipt = /^\/api\/frontier\/deliveries\/(\d{4}-\d\d-\d\d)$/.exec(path);
        if (receipt && request.method === "PUT") return json(await recordDelivery(request,env.DB,receipt[1]));
        if (path === "/api/frontier" && request.method === "GET") {
          const [papers,topics,state] = await Promise.all([allPapers(env.DB),allTopics(env.DB),industryState(env.DB)]);
          const feeds = buildFeeds(papers, topics, state, new Date(), url.searchParams.get("order") === "time");
          return json({ ...state, daily: feeds.daily, technology: feeds.technology });
        }
        const change = /^\/api\/frontier\/(events|checks)\/([a-z0-9-]+)$/.exec(path);
        if (!change) throw new PaperError(404, "找不到这个前沿记录。");
        if (request.method !== "PUT") return json({ error: "请使用 PUT。" }, 405);
        return json(change[1] === "events" ? await saveEvent(request, env.DB, change[2]) : await saveCheck(request, env.DB, change[2]));
      }
      if (libraryRoute) {
        if (request.method !== "GET") return json({ error: "这个请求方式不可用。" }, 405);
        const [papers, topics, state] = await Promise.all([allPapers(env.DB), allTopics(env.DB), industryState(env.DB)]);
        const { start, today, models, embodied, robotics, driving } = frontierLibrary(papers, topics);
        const feeds = buildFeeds(papers, topics, state, new Date(), url.searchParams.get("order") === "time");
        const technologies = feeds.technology.map(i => ({ name:i.title, meaning:i.summary, change:i.change,
          evidence:i.evidence, limit:i.limit, source:i.sources[0]?.url, date:i.published, importance:i.score,
          paperId:i.paperId, paperTitle:papers.find(p => p.id === i.paperId)?.data.title, recommendedOn:i.selected,
          id:i.id, major:i.major, href:i.href, kind:i.kind }));
        return json({ papers, topics, frontier: { start, today, models:models.map(p => p.id), embodied:embodied.map(p => p.id),
          robotics:robotics.map(p => p.id), driving:driving.map(p => p.id), technologies, daily:feeds.daily, checks:state.checks } });
      }
      if (topicsRoute) {
        if (request.method !== "POST") return json({ error: "这个请求方式不可用。" }, 405);
        const data = await request.json<{ name?: unknown }>().catch(() => null);
        return json(await createTopic(env.DB, data?.name), 201);
      }
      if (research && request.method === "POST") {
        if (path.endsWith("/pdf")) return await researchPdf(request);
        return json(await analyzePdf(request, env.DB, env.NOTEBOOK_CREDENTIAL_KEY));
      }
      if (modelRoute) {
        if (path === "/api/models" && request.method === "POST") {
          return json(await saveModel(request, env.DB, env.NOTEBOOK_CREDENTIAL_KEY));
        }
        const id = /^\/api\/models\/([0-9a-f-]+)$/.exec(path)?.[1];
        if (id && request.method === "DELETE") {
          await deleteModel(env.DB, id);
          return json({ ok: true });
        }
        return json({ error: "这个请求方式不可用。" }, 405);
      }
      const [, , , id, action, ...rest] = path.split("/");
      if (!idPattern.test(id) || rest.length || (action && action !== "restore")) {
        throw new PaperError(404, "找不到这篇论文。");
      }
      const method = request.method;
      if (!action && method === "PUT") {
        const paper = await savePaper(request, env.DB, env.BUCKET, id);
        return json({ id: paper.id, revision: paper.revision, url: "/papers/" + paper.id + ".html?saved=1" });
      }
      if ((!action && method === "DELETE") || (action === "restore" && method === "POST")) {
        await changePaperStatus(request, env.DB, id, method === "DELETE");
        return json({ ok: true });
      }
      return json({ error: "这个请求方式不可用。" }, 405);
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return html(messagePage("无法打开页面", "请从论文库导航进入。"), 405);
    }
    if (feedPage || path === "/" || path === "/index.html") {
      const [papers,topics,state] = await Promise.all([allPapers(env.DB), allTopics(env.DB), industryState(env.DB)]);
      const latest = url.searchParams.get("order") === "time";
      if (path === "/frontier-digest") return html(makeDigest(papers,topics,state,url.origin,await digestReceipts(env.DB)).html);
      if (path === "/frontier-feed") return html(feedSections(papers,topics,state,latest));
      if (path.startsWith("/frontier/")) {
        const item = state.events.find(e => e.id === path.slice(10));
        if (!item || (item.paperId && !papers.some(p => p.id === item.paperId && !p.deletedAt))) {
          return html(messagePage("找不到这条进展", "可查看最新技术。","/#latest-technology","最新技术"),404);
        }
        return html(eventPage(item));
      }
      return html(homepage(papers,topics,url.searchParams.get("notice"),state,latest));
    }
    if (path === "/manage" || path === "/manage/") {
      const [papers, topics] = await Promise.all([allPapers(env.DB), allTopics(env.DB)]);
      return html(managementPage(papers, topics, url.searchParams.get("view") === "trash", url.searchParams.get("notice")));
    }
    if (path === "/models") return html(modelsPage(await models(env.DB)));
    if (path === "/manage/new") {
      const [topics, profiles] = await Promise.all([allTopics(env.DB), models(env.DB)]);
      const selected = topics.find((topic) => topic.id === url.searchParams.get("topic"));
      return html(editorPage({
        id: "user-" + crypto.randomUUID(), data: blankNote(selected?.id),
        revision: 0, updatedAt: null, deletedAt: null,
      }, profiles, topics));
    }

    const edit = /^\/manage\/([a-z0-9-]+)\/?$/.exec(path);
    const read = /^\/papers\/([a-z0-9-]+)\.html$/.exec(path);
    const id = edit?.[1] ?? read?.[1];
    const paper = id && idPattern.test(id) ? await paperById(env.DB, id) : null;
    if (!paper) return html(messagePage("找不到这篇论文", "可以在管理页查看当前论文库。"), 404);
    if (paper.deletedAt) return html(messagePage("论文在回收站", "恢复后可继续阅读和编辑。", "/manage?view=trash", "查看回收站"), 410);
    const topics = await allTopics(env.DB);
    return html(edit ? editorPage(paper, await models(env.DB), topics) : readingPage(paper, topics, url.searchParams.get("saved") === "1"));
  } catch (error) {
    if (!(error instanceof PaperError)) {
      console.error("Paper notebook request failed", error instanceof Error ? error.name : "unknown");
    }
    const status = error instanceof PaperError ? error.status : 500;
    const message = error instanceof PaperError ? error.message : "论文库暂时无法完成操作，请稍后重试。";
    return api ? json({ error: message }, status) : html(messagePage("暂时无法打开", message), status);
  }
}

