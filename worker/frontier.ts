import initialParadigms from "../content/paradigms.json";
import type { Category, Paper, Paradigm } from "./types";
import { compareReadingPriority } from "./reading-priority";

export function shanghaiDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

export function windowStart(day: string) {
  const date = new Date(day + "T00:00:00Z");
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 5, 0)).getUTCDate();
  date.setUTCMonth(date.getUTCMonth() - 6, Math.min(date.getUTCDate(), lastDay));
  return date.toISOString().slice(0, 10);
}

type Technology = Paradigm & { paperId?: string; paperTitle?: string; recommendedOn?: string; importance?: number };

export function frontierLibrary(papers: Paper[], topics: Category[], today = shanghaiDate()) {
  const start = windowStart(today);
  const drivingTopic = topics.find((topic) => topic.label === "自动驾驶")?.id;
  const models: Paper[] = [];
  const embodied: Paper[] = [];
  const robotics: Paper[] = [];
  const driving: Paper[] = [];
  const technologies = new Map<string, Technology>((initialParadigms as Paradigm[]).map(item => [item.name, item]));
  for (const paper of papers) {
    if (paper.deletedAt) continue;
    const { frontier, category, additionalCategories = [], paradigm } = paper.data;
    if (paradigm) {
      const current = technologies.get(paradigm.name);
      const recommendedOn = paper.data.technologyRecommendation?.date;
      if (!current || (current.recommendedOn ?? current.date) <= (recommendedOn ?? paradigm.date)) {
        technologies.set(paradigm.name, { ...paradigm, paperId: paper.id, paperTitle: paper.data.title,
          recommendedOn, importance: paper.data.technologyRecommendation?.importance });
      }
    }
    if (!frontier) continue;
    const day = frontier.date.length === 7 ? frontier.date + "-01" : frontier.date;
    if (day < start || day > today) continue;
    const categories = [category, ...additionalCategories];
    if (categories.includes("large-models")) models.push(paper);
    const isRobotics = categories.includes("embodied-robotics");
    const isDriving = Boolean(drivingTopic && categories.includes(drivingTopic));
    if (isRobotics) robotics.push(paper);
    if (isDriving) driving.push(paper);
    // Retain the combined list for existing API clients.
    if (isRobotics || isDriving) embodied.push(paper);
  }
  return { today, start, robotics: robotics.sort(compareReadingPriority), driving: driving.sort(compareReadingPriority), models: models.sort(compareReadingPriority), embodied: embodied.sort(compareReadingPriority),
    technologies: [...technologies.values()].sort((a,b) => (b.recommendedOn ?? b.date).localeCompare(a.recommendedOn ?? a.date) || (b.importance ?? 0) - (a.importance ?? 0)) };
}
