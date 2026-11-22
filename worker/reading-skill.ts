import technologySkill from "../skills/technology-updates/SKILL.md?raw";
import skill from "../skills/paper-reading/SKILL.md?raw";

export const technologySkillMarkdown = technologySkill;
export const technologySkillBody = technologySkill.replace(/^---\r?\n[\s\S]*?\r?\n---\s*/u, "").trim();
export const readingSkillPath = "/skills/paper-reading";
export const readingSkillFilePath = readingSkillPath + "/SKILL.md";
export const readingSkill = skill;
export const readingSkillBody = skill.replace(/^---\r?\n[\s\S]*?\r?\n---\s*/u, "").trim();

type DraftSection = {
  heading?: unknown;
  background?: unknown;
  originalText?: unknown;
  translation?: unknown;
  passageNotes?: unknown;
  details?: unknown;
};

type DraftFormula = {
  name?: unknown;
  original?: unknown;
  latex?: unknown;
  symbols?: unknown;
  principle?: unknown;
  numericExample?: unknown;
  scope?: unknown;
};

type ReviewDraft = {
  sections: DraftSection[];
  formulas: DraftFormula[];
  example?: { setup?: unknown; steps?: unknown; takeaway?: unknown };
  limits?: unknown;
};

const hasText = (value: unknown): value is string => typeof value === "string" && Boolean(value.trim());
const paragraphCount = (value: unknown) => hasText(value) ? value.trim().split(/\n\s*\n/u).length : 0;
const countText = (value: unknown) => Array.isArray(value) ? value.filter(hasText).length : 0;
const title = (value: unknown, fallback: string) => hasText(value) ? value.trim().slice(0, 80) : fallback;

export function checkReadingDraft(draft: ReviewDraft, suppliedPdf: boolean): string[] {
  const issues: string[] = [];

  let hasBilingualExcerpt = false;
  draft.sections.forEach((section, index) => {
    const missing: string[] = [];
    if (!hasText(section.heading)) missing.push("节号与标题");
    if (!hasText(section.background)) missing.push("段落背景");
    if (!Array.isArray(section.passageNotes) || section.passageNotes.length < 2) {
      missing.push("至少两处有原文定位的逐段中文导读");
    }
    if (countText(section.details) < 2) missing.push("具体原理解读");
    const originals = paragraphCount(section.originalText);
    const translations = paragraphCount(section.translation);
    if (originals > 0 && originals === translations) hasBilingualExcerpt = true;
    if (originals !== translations || (suppliedPdf && originals === 0)) {
      missing.push("可定位的英中段落");
    }
    if (missing.length) issues.push(title(section.heading, "重点章节 " + (index + 1)) + "待补 " + missing.join("、"));
  });
  if (!suppliedPdf && !hasBilingualExcerpt) issues.push("待补一条可定位的英文短摘录及对应译文");

  draft.formulas.forEach((formula, index) => {
    const missing: string[] = [];
    if (!hasText(formula.name)) missing.push("公式名称");
    if (!hasText(formula.original) || !hasText(formula.latex)) missing.push("原文编号与公式");
    if (!Array.isArray(formula.symbols) || !formula.symbols.length
      || !formula.symbols.every((pair) => Array.isArray(pair) && hasText(pair[0]) && hasText(pair[1]))) {
      missing.push("公式符号");
    }
    if (!hasText(formula.principle)) missing.push("数学原理");
    if (!hasText(formula.scope)) missing.push("使用条件");
    if (!hasText(formula.numericExample) || (formula.numericExample.match(/\p{Nd}+/gu)?.length ?? 0) < 2) {
      missing.push("可手算的数值例子");
    }
    if (missing.length) issues.push(title(formula.name, "核心公式 " + (index + 1)) + "待补 " + missing.join("、"));
  });

  const { setup, steps, takeaway } = draft.example ?? {};
  const stepCount = Array.isArray(steps) ? steps.filter((step) => hasText(step?.text)).length : 0;
  if (!hasText(setup) || stepCount < 3 || !hasText(takeaway)) issues.push("详细算例待补设定、至少三步计算或结论");
  if (!countText(draft.limits)) issues.push("待补实验适用范围与证据限制");

  return issues;
}

