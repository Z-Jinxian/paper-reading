import initialPriorities from "../content/reading-priority.json";
import type { Category, Paper } from "./types";

const priorities: Record<string, number | undefined> = initialPriorities;

export function readingImportance(paper: Paper) {
  return paper.data.readingImportance ?? priorities[paper.id] ?? paper.data.recommendation?.importance ?? paper.data.technologyRecommendation?.importance ?? -1;
}

export function compareReadingPriority(a: Paper, b: Paper) {
  return readingImportance(b) - readingImportance(a)
    || (b.data.recommendation?.date ?? "").localeCompare(a.data.recommendation?.date ?? "")
    || a.data.title.localeCompare(b.data.title, "zh-CN")
    || a.id.localeCompare(b.id);
}

export function catalogueGroups(categories: Category[]) {
  return categories.map(category => ({
    ...category,
    description: category.id === "large-models" || category.id === "embodied-robotics" || category.label === "自动驾驶"
      ? "按范式贡献、实验证据与可迁移的阅读价值排序。" : category.description,
    memberIds: [category.id],
  }));
}
