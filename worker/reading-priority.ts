import initialPriorities from "../content/reading-priority.json";
import type { Category, Paper } from "./types";

const priorities: Record<string, number | undefined> = initialPriorities;

export function readingImportance(paper: Paper) {
  return paper.data.readingImportance ?? paper.data.recommendation?.importance ?? priorities[paper.id] ?? 0;
}

export function compareReadingPriority(a: Paper, b: Paper) {
  return readingImportance(b) - readingImportance(a)
    || (b.data.recommendation?.date ?? "").localeCompare(a.data.recommendation?.date ?? "")
    || a.data.title.localeCompare(b.data.title, "zh-CN")
    || a.id.localeCompare(b.id);
}

export function catalogueGroups(categories: Category[]) {
  const hasEmbodied = categories.some(({ id }) => id === "embodied-robotics");
  const drivingIds = categories.filter(({ label }) => label === "自动驾驶").map(({ id }) => id);
  return categories.filter(({ id }) => !(hasEmbodied && drivingIds.includes(id))).map(category => {
    if (category.id === "embodied-robotics") {
      return {
        ...category,
        label: "具身智能、自动驾驶与机器人",
        question: "机器人与驾驶系统有哪些值得读懂的关键进展？",
        description: "按实验决策价值、证据质量与长期阅读价值排序。",
        memberIds: [category.id, ...drivingIds],
      };
    }
    return {
      ...category,
      description: category.id === "large-models"
        ? "按实验决策价值、证据质量与长期阅读价值排序。" : category.description,
      memberIds: [category.id],
    };
  });
}
