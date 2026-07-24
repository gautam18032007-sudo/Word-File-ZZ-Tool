import { PDFDocument, PDFFont, PDFPage, rgb, RGB } from 'pdf-lib';

/**
 * Minimal paginated text writer for pdf-lib — wraps long clause/paragraph
 * text to a fixed width and automatically starts a new A4 page when the
 * current one runs out of vertical space. Used by the native (Gotenberg-free)
 * PDF fallbacks for Employee, Brand, and PI documents.
 */
export class PagedWriter {
  doc: PDFDocument;
  page: PDFPage;
  width: number;
  height: number;
  marginX: number;
  marginTop: number;
  marginBottom: number;
  y: number;

  constructor(doc: PDFDocument, opts: { width?: number; height?: number; marginX?: number; marginTop?: number; marginBottom?: number } = {}) {
    this.doc = doc;
    this.width = opts.width ?? 595.28; // A4 pt
    this.height = opts.height ?? 841.89;
    this.marginX = opts.marginX ?? 50;
    this.marginTop = opts.marginTop ?? 50;
    this.marginBottom = opts.marginBottom ?? 50;
    this.page = doc.addPage([this.width, this.height]);
    this.y = this.height - this.marginTop;
  }

  newPage() {
    this.page = this.doc.addPage([this.width, this.height]);
    this.y = this.height - this.marginTop;
  }

  ensureSpace(lineHeight: number) {
    if (this.y - lineHeight < this.marginBottom) {
      this.newPage();
    }
  }

  gap(amount: number) {
    this.y -= amount;
  }

  private wrapLine(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  /** Draws a wrapped paragraph, auto-paginating. Returns the y after drawing. */
  drawParagraph(text: string, opts: { font: PDFFont; size?: number; color?: RGB; lineHeight?: number; indent?: number; gapAfter?: number }) {
    const size = opts.size ?? 10.5;
    const lineHeight = opts.lineHeight ?? size * 1.45;
    const indent = opts.indent ?? 0;
    const color = opts.color ?? rgb(0.1, 0.1, 0.1);
    const maxWidth = this.width - this.marginX * 2 - indent;

    const lines = this.wrapLine(text, opts.font, size, maxWidth);
    for (const line of lines) {
      this.ensureSpace(lineHeight);
      this.page.drawText(line, {
        x: this.marginX + indent,
        y: this.y,
        size,
        font: opts.font,
        color,
      });
      this.y -= lineHeight;
    }
    if (opts.gapAfter) this.y -= opts.gapAfter;
  }

  /** Draws a single-line heading/label without wrapping. */
  drawLine(text: string, opts: { font: PDFFont; size?: number; color?: RGB; x?: number; gapAfter?: number }) {
    const size = opts.size ?? 12;
    this.ensureSpace(size * 1.4);
    this.page.drawText(text, {
      x: opts.x ?? this.marginX,
      y: this.y,
      size,
      font: opts.font,
      color: opts.color ?? rgb(0.1, 0.1, 0.1),
    });
    this.y -= size * 1.4;
    if (opts.gapAfter) this.y -= opts.gapAfter;
  }
}
