import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFile } from "node:fs/promises";
import { createServer } from "vite";

const vite = await createServer({configFile:false,server:{middlewareMode:true,hmr:false},appType:"custom",logLevel:"error"});
const sql = new DatabaseSync(":memory:");
const db = {
  prepare(query) {
    const stmt = sql.prepare(query);
    const binding = (params=[]) => ({
      bind: (...args) => binding(args),
      run: async () => ({meta:{changes:stmt.run(...params).changes}}),
      all: async () => ({results:stmt.all(...params)}),
      first: async () => stmt.get(...params) ?? null,
    });
    return binding();
  },
};
try {
  for (const path of ["0000_moaning_aaron_stack","0002_paper_topics","0003_industry_frontier","0004_frontier_digest_receipts"]) {
    sql.exec(await readFile("drizzle/" + path + ".sql","utf8"));
  }
  const {saveEvent,saveCheck,industryState,recordDelivery,digestReceipts} = await vite.ssrLoadModule("/worker/industry.ts");
  const {buildFeeds,rankValue} = await vite.ssrLoadModule("/worker/feeds.ts");
  const {feedSections,makeDigest} = await vite.ssrLoadModule("/worker/feed-view.ts");
  const {blankNote} = await vite.ssrLoadModule("/worker/papers.ts");
  const {serveNotebook} = await vite.ssrLoadModule("/worker/notebook.ts");
  const req = (obj) => new Request("https://example.org/api/frontier",{method:"PUT",body:JSON.stringify(obj)});
  const old = new Date(Date.now()-7*86400000).toISOString();
  const level = {revision:0,title:"Trial <model>",domains:["models"],kind:"模型发布",published:old,importance:95,major:true,
    summary:"Released for research use",change:"Published weights",evidence:"Model card and weights available",
    limit:"Producer evaluation",why:"Researchers can now reproduce this capability",sources:[{label:"Model card",url:"https://example.org/weights"}]};
  const release = await saveEvent(req(level),db,"example-model");
  assert.equal((await saveEvent(req(level),db,release.id)).revision,1);
  await assert.rejects(saveEvent(req(level),db,"same-model-alias"),{status:409});
  await assert.rejects(saveEvent(req({...level,published:"2024-02-31"}),db,"invalid-date"),{status:422});
  await assert.rejects(saveEvent(req({...level,sources:[{label:"bad",url:"javascript:alert(1)"}]}),db,"bad-source"),{status:422});
  await saveEvent(req({...level,domains:["robotics"],title:"Robot policy",sources:[{label:"Card",url:"https://example.org/robot"}]}),db,"robot");
  await saveEvent(req({...level,major:false,domains:["driving"],title:"Incremental rollout",sources:[{label:"Notes",url:"https://example.org/rollout"}]}),db,"rollout");
  const wait = await Promise.allSettled(["a","b"].map(change => saveEvent(req({...level,revision:1,change}),db,release.id)));
  assert.equal(wait.filter(r => r.status === "fulfilled").length,1);
  const check = {checkedAt:new Date(Date.now()-3600000).toISOString(),sources:level.sources,result:"checked"};
  await saveCheck(req(check),db,"models");
  await saveCheck(req({...check,checkedAt:old}),db,"models");
  const state = await industryState(db);
  assert.equal(state.checks.length,1);
  assert.equal(state.checks[0].checkedAt,check.checkedAt);
  const topics = [{id:"large-models",label:"大模型",question:"",description:""}];
  const now = new Date();
  const notes = Array.from({length:15},(_,k) => ({id:"sample-"+k,revision:0,updatedAt:null,deletedAt:k===0?old:null,data:{
    ...blankNote("large-models"),title:"Study "+k,readingImportance:89-k,source:{landing:"https://example.org/study/"+k,pdf:"",version:"1"},
    frontier:{date:"2025-03-01",firstPublic:"2025-02-20",lesson:"method",evidence:"trial"},
  }}));
  const feeds = buildFeeds(notes,topics,state,now);
  for (const list of [feeds.daily,feeds.technology]) {
    assert.ok(list.length >= 10);
    assert.equal(new Set(list.map(i=>i.id)).size,list.length);
    assert.ok(list.some(i=>i.id === release.id && i.major));
    assert.ok(list.some(i=>i.id === "robot" && i.major));
    assert.ok(!list.some(i=>i.id === "sample-0"));
    assert.ok(list.every((v,i,a) => !i || rankValue(a[i-1],now.valueOf()) >= rankValue(v,now.valueOf())));
  }
  assert.ok(!feeds.daily.some(i=>i.id === "rollout"));
  assert.ok(feeds.technology.some(i=>i.id === "rollout"));
  const time = buildFeeds(notes,topics,state,now,true);
  assert.ok(time.technology[0].published >= time.technology.at(-1).published);
  const html = feedSections(notes,topics,state,false);
  assert.equal(html.split('data-frontier-id="example-model"').length-1,2);
  assert.ok(!html.includes("<model>") && html.includes("&lt;model&gt;") && html.includes("is-major"));
  const digest = makeDigest(notes,topics,state,"https://example.org",[],now);
  assert.equal(digest.majorCount,2);
  assert.equal(digest.html.split("【重大进展】").length-1,2);
  assert.match(digest.html,/strong style="color:#a3182c;font-weight:700"/);
  assert.match(digest.html,/https:\/\/example.org\/frontier\/example-model/);
  const receipt = {through:digest.through,messageId:"test-provider-reference"};
  await recordDelivery(req(receipt),db,digest.day);
  await recordDelivery(req(receipt),db,digest.day);
  await assert.rejects(recordDelivery(req({...receipt,messageId:"second"}),db,digest.day),{status:409});
  const receipts = await digestReceipts(db);
  const tomorrow = new Date(now.valueOf()+86400000);
  assert.equal(makeDigest(notes,topics,state,"https://example.org",receipts,tomorrow).majorCount,0);
  const late = structuredClone(state);
  late.events[0].major = true;
  late.events[0].updatedAt = new Date(now.valueOf()+60000).toISOString();
  assert.equal(makeDigest(notes,topics,late,"https://example.org",receipts,tomorrow).majorCount,1);
  const env = {DB:db};
  for (const url of ["/frontier/example-model","/","/frontier-feed?order=time","/frontier-digest","/api/frontier","/api/library"]) {
    const r = await serveNotebook(new Request("https://example.org"+url,{headers:{"x-notebook-request":"1"}}),env);
    assert.equal(r.status,200,url);
  }
  assert.equal((await serveNotebook(new Request("https://example.org/frontier/missing"),env)).status,404);
  console.log("Passed: multi-domain release intake, concurrent writes, retries, dates, ten-item coverage, both orderings, alerts, digest recovery and live route contracts.");
} finally {
  sql.close();
  await vite.close();
}
