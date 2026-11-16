const assetBase = "/pdf-engine/";

function collectLines(items, viewport, transform) {
  const fragments = [];
  for (const item of items) {
    const text = item.str?.replace(/\s+/g, " ").trim();
    if (!text || !item.transform) continue;
    const m = transform(viewport.transform, item.transform);
    const size = Math.hypot(m[2], m[3]) || item.height || 9;
    const x = m[4];
    const y = m[5];
    const right = x + Math.max(item.width, size * 0.3);
    if (right < 0 || x > viewport.width || y < 0 || y > viewport.height + size) continue;
    fragments.push({ text, x, right, y, size, spaceBefore: /^\s/.test(item.str), spaceAfter: /\s$/.test(item.str), top: y - size, bottom: y + size * 0.35 });
  }
  fragments.sort((a, b) => a.y - b.y || a.x - b.x);
  const bands = [];
  for (const item of fragments) {
    const last = bands.at(-1);
    if (last && item.y - last.y <= Math.min(3.2, item.size * 0.31)) {
      last.parts.push(item);
    } else {
      bands.push({ y: item.y, parts: [item] });
    }
  }
  const lines = [];
  for (const { parts } of bands) {
    parts.sort((a, b) => a.x - b.x);
    let line = null;
    for (const part of parts) {
      const gap = line ? part.x - line.right : Infinity;
      if (line && gap <= Math.max(12, Math.min(16, part.size * 1.15))) {
        line.text += (gap < 0.7 && !line.spaceAfter && !part.spaceBefore ? "" : " ") + part.text;
        line.spaceAfter = part.spaceAfter;
        line.right = Math.max(line.right, part.right);
        line.top = Math.min(line.top, part.top);
        line.bottom = Math.max(line.bottom, part.bottom);
      } else {
        line = { ...part };
        lines.push(line);
      }
    }
  }
  return readingOrder(lines, viewport.width).map((line, index) => ({ ...line, id: index + 1 }));
}

function readingOrder(lines, width) {
  const middle = width / 2;
  const gap = width * .012;
  const leftOf = (line) => line.right <= middle - gap;
  const rightOf = (line) => line.x >= middle + gap;
  const spans = (line) => line.x < middle - gap && line.right > middle + gap;
  const fullLines = lines.filter((line) => line.right - line.x > width * .23);
  const left = fullLines.filter(leftOf);
  const right = fullLines.filter(rightOf);
  if (left.length < 6 || right.length < 6) return lines;
  const overlap = Math.min(left.at(-1).y, right.at(-1).y) - Math.max(left[0].y, right[0].y);
  if (overlap < 60) return lines;

  const ordered = [];
  let columns = [[], []];
  for (const line of lines) {
    if (spans(line)) {
      ordered.push(...columns[0], ...columns[1], line);
      columns = [[], []];
    } else {
      columns[Number(line.x >= middle)].push(line);
    }
  }
  return ordered.concat(...columns);
}

function pageIndices(length, selection) {
  if (selection) {
    const pages = new Set();
    for (const part of selection.split(/[,，、]/u)) {
      const match = /^\s*(\d+)(?:\s*[-–—]\s*(\d+))?\s*$/u.exec(part);
      const from = Number(match?.[1]);
      const to = Number(match?.[2] ?? from);
      if (!match || from < 1 || to < from || to > length || to - from >= 38) {
        throw new Error("请填写有效的 PDF 页码，例如 3-5,8，最多选 38 页。");
      }
      for (let page = from; page <= to; page++) pages.add(page);
    }
    if (pages.size > 38) throw new Error("每次最多选择 38 页，请缩小精读范围。");
    return [...pages].sort((a, b) => a - b);
  }
  if (length <= 38) return Array.from({ length }, (_, i) => i + 1);
  const first = Array.from({ length: 30 }, (_, i) => i + 1);
  const appendix = Array.from({ length: 8 }, (_, i) => length - 7 + i);
  return [...first, ...appendix];
}

export async function openPaper(data, onPage = () => {}, selection = "") {
  const library = await import(assetBase + "pdf.mjs");
  library.GlobalWorkerOptions.workerSrc = assetBase + "pdf.worker.mjs";
  const job = library.getDocument({
    data, cMapUrl: assetBase + "cmaps/", cMapPacked: true,
    standardFontDataUrl: assetBase + "standard_fonts/", wasmUrl: assetBase + "wasm/",
    isEvalSupported: false, enableXfa: false,
  });
  try {
    const document = await job.promise;
    const pages = [];
    const geometry = new Map();
    const indices = pageIndices(document.numPages, selection);
    const limit = Math.floor(105000 / indices.length);
    let truncated = false;
    for (const number of indices) {
      onPage(number, document.numPages);
      const page = await document.getPage(number);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const lines = collectLines(content.items, viewport, library.Util.transform);
      const filtered = lines.filter((line) => line.text).slice(0, 360);
      truncated ||= filtered.length < lines.length;
      const used = [];
      let characters = 0;
      for (const line of filtered) {
        if (characters + line.text.length > limit) {
          truncated = true;
          break;
        }
        used.push([line.id, line.text]);
        characters += line.text.length;
      }
      if (used.length) {
        pages.push({ page: number, lines: used });
        geometry.set(number, { viewport, lines: new Map(lines.map((line) => [line.id, line])) });
      }
    }
    if (!pages.length) throw new Error("这个 PDF 没有可定位的文字。请换成文字可选择的原文版本。");
    return { job, document, pages, geometry, pageCount: document.numPages, truncated };
  } catch (error) {
    await job.destroy();
    throw error;
  }
}

export async function originalClip(paper, evidence, kind) {
  const { page: number, lines: ids } = evidence;
  const layout = paper.geometry.get(number);
  const lines = ids.map((id) => layout?.lines.get(id));
  if (!layout || lines.some((line) => !line)) {
    throw new Error("模型返回了无法定位的截图位置。");
  }
  const { viewport } = layout;
  const top = Math.min(...lines.map((line) => line.top));
  const bottom = Math.max(...lines.map((line) => line.bottom));
  const left = Math.min(...lines.map((line) => line.x));
  const right = Math.max(...lines.map((line) => line.right));
  const equation = kind === "formula";
  if (bottom - top > (equation ? 120 : 65) || right - left > viewport.width * 0.94) {
    throw new Error("有一处截图跨越了多个区域。请重试或改用另一模型。");
  }
  const padY = equation ? 9 : 5;
  const padX = equation ? 16 : 8;
  const rect = {
    left: Math.max(0, Math.floor(left - padX)),
    right: Math.min(viewport.width, Math.ceil(right + padX)),
    top: Math.max(0, Math.floor(top - padY)),
    bottom: Math.min(viewport.height, Math.ceil(bottom + padY)),
  };
  const width = rect.right - rect.left;
  const height = rect.bottom - rect.top;
  if (width < 3 || height < 3) throw new Error("原文裁图区域过小。");
  const scale = Math.min(3, 1800 / width);
  const page = await paper.document.getPage(number);
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width * scale);
  canvas.height = Math.ceil(height * scale);
  await page.render({
    canvas, canvasContext: canvas.getContext("2d"), viewport: page.getViewport({ scale }),
    transform: [1, 0, 0, 1, -rect.left * scale, -rect.top * scale],
    background: "rgb(255, 255, 255)",
  }).promise;
  const image = await new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("生成原文截图失败。")), "image/png");
  });
  canvas.width = 0;
  canvas.height = 0;
  return image;
}
