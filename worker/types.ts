export type Source = { landing: string; pdf: string; version: string; note?: string };
export type Evidence = { asset: string; alt: string; page: number | null };
export type Section = Evidence & {
  heading: string; why: string; details: string[];
  background?: string; originalText?: string; translation?: string; passagePages?: string;
};
export type Formula = Evidence & {
  name: string; original: string; latex: string; symbols: [string, string][]; steps: string[]; scope: string;
  principle?: string; numericExample?: string;
};
export type Example = { title: string; setup: string; steps: { label: string; text: string; latex?: string }[]; takeaway: string };
export type Note = {
  title: string; category: string; venue: string; reason: string; tags: string[]; thesis: string;
  source: Source; sections: Section[]; formulas: Formula[]; example: Example; limits: string[];
  anchor?: string; age?: string; angle?: string; read?: string; reference?: string;
};
export type Paper = { id: string; data: Note; revision: number; updatedAt: string | null; deletedAt: string | null };
export type PaperChange = { id: string; data: string; revision: number; updated_at: string; deleted_at: string | null };
export type Category = { id: string; label: string; question: string; description: string };
