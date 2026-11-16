import type { Formula, Section } from "./types";

const sectionNumbers = (label: string) =>
  [...label.matchAll(/§\s*(\d+(?:\.\d+)*)/gu)].map((match) => match[1]);

function chapterForFormula(sections: readonly Section[], formula: Formula) {
  const references = sectionNumbers(formula.original);
  if (references.length) {
    const headings = sections.map(({ heading }) => sectionNumbers(heading));
    const matching = headings.flatMap((numbers, index) =>
      numbers.some((number) => references.includes(number)) ? [index] : []);
    if (matching.length === 1) return matching[0];
    if (!matching.length) {
      const parents = headings.flatMap((numbers, index) =>
        numbers.some((number) => references.some((reference) => reference.startsWith(number + "."))) ? [index] : []);
      return parents.length === 1 ? parents[0] : -1;
    }
  }

  if (sections.length === 1) return 0;
  if (formula.page == null) return -1;
  const page = formula.page;
  const candidates = sections.flatMap(({ page: start }, index) =>
    start != null && start <= page && page - start <= 3 ? [{ start, index }] : []);
  const nearest = Math.max(...candidates.map(({ start }) => start));
  const matching = candidates.filter(({ start }) => start === nearest);
  return matching.length === 1 ? matching[0].index : -1;
}

export function groupReadingFormulas(
  sections: readonly Section[],
  formulas: readonly Formula[],
  curatedChapters: readonly number[] = [],
) {
  const byChapter: Formula[][] = sections.map(() => []);
  const unassigned: Formula[] = [];
  for (const [index, formula] of formulas.entries()) {
    const curated = curatedChapters[index];
    const chapter = sections[curated] ? curated : chapterForFormula(sections, formula);
    (byChapter[chapter] ?? unassigned).push(formula);
  }

  const exampleChapters = byChapter.flatMap((group, index) => group.length ? [index] : []);
  const exampleChapter = !unassigned.length && exampleChapters.length === 1 ? exampleChapters[0] : -1;
  return { byChapter, unassigned, exampleChapter };
}
