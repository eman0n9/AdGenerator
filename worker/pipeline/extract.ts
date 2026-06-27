

export interface ExtractedContent {
  title: string;
  description: string;
  siteName: string;
  ogImage: string | null;
  themeColor: string | null;

  colorHints: string[];

  stylesheets: string[];
  headings: string[];
  paragraphs: string[];
  rawImages: { src: string; alt: string | null }[];
  styleText: string;

  textLength: number;
}

const MAX_HEADINGS = 25;
const MAX_PARAGRAPHS = 40;
const MAX_PARAGRAPH_LEN = 600;
const MAX_IMAGES = 60;
const MAX_STYLE_LEN = 200_000;

class TextList {
  items: string[] = [];
  private current: string | null = null;
  private readonly limit: number;
  private readonly maxLen: number;

  constructor(limit: number, maxLen = 2000) {
    this.limit = limit;
    this.maxLen = maxLen;
  }

  open() {
    if (this.items.length < this.limit) this.current = "";
    else this.current = null;
  }
  append(t: string) {
    if (this.current !== null && this.current.length < this.maxLen) this.current += t;
  }
  close() {
    if (this.current !== null) {
      const v = this.current.trim().replace(/\s+/g, " ");
      if (v) this.items.push(v);
    }
    this.current = null;
  }
}

export async function extractContent(html: string): Promise<ExtractedContent> {
  let title = "";
  let description = "";
  let siteName = "";
  let ogImage: string | null = null;
  let themeColor: string | null = null;
  const colorHints: string[] = [];
  const stylesheets: string[] = [];
  const rawImages: { src: string; alt: string | null }[] = [];
  let styleText = "";

  const headings = new TextList(MAX_HEADINGS, 300);
  const paragraphs = new TextList(MAX_PARAGRAPHS, MAX_PARAGRAPH_LEN);
  const titleBuf = new TextList(1, 300);
  const styleBuf = new TextList(50, MAX_STYLE_LEN / 50);

  const rewriter = new HTMLRewriter()
    .on("title", {
      element: () => titleBuf.open(),
      text: (t) => titleBuf.append(t.text),
    })
    .on("meta", {
      element: (el) => {
        const name = (el.getAttribute("name") || "").toLowerCase();
        const prop = (el.getAttribute("property") || "").toLowerCase();
        const content = el.getAttribute("content") || "";
        if (!content) return;
        if (name === "description" || prop === "og:description") {
          if (!description) description = content;
        } else if (prop === "og:site_name") {
          siteName = content;
        } else if (prop === "og:image" && !ogImage) {
          ogImage = content;
        } else if (name === "theme-color" && !themeColor) {
          themeColor = content;
        } else if (name === "msapplication-tilecolor") {
          colorHints.push(content);
        }
      },
    })
    .on("link", {
      element: (el) => {
        const rel = (el.getAttribute("rel") || "").toLowerCase();
        const href = el.getAttribute("href") || "";
        if (!href) return;
        if (rel.includes("stylesheet") && stylesheets.length < 6) {
          stylesheets.push(href);
        } else if (rel.includes("mask-icon")) {
          const color = el.getAttribute("color");
          if (color) colorHints.push(color);
        }
      },
    })
    .on("h1, h2, h3", {
      element: (el) => {
        headings.open();
        el.onEndTag(() => headings.close());
      },
      text: (t) => headings.append(t.text),
    })
    .on("p, li", {
      element: (el) => {
        paragraphs.open();
        el.onEndTag(() => paragraphs.close());
      },
      text: (t) => paragraphs.append(t.text),
    })
    .on("style", {
      element: (el) => {
        styleBuf.open();
        el.onEndTag(() => styleBuf.close());
      },
      text: (t) => styleBuf.append(t.text),
    })
    .on("img", {
      element: (el) => {
        if (rawImages.length >= MAX_IMAGES) return;
        const src =
          el.getAttribute("src") ||
          el.getAttribute("data-src") ||
          el.getAttribute("data-lazy-src") ||
          "";
        if (src) rawImages.push({ src, alt: el.getAttribute("alt") });
      },
    });

  await rewriter.transform(new Response(html)).arrayBuffer();

  title = titleBuf.items[0] || "";
  styleText = styleBuf.items.join("\n").slice(0, MAX_STYLE_LEN);

  const textLength =
    title.length +
    description.length +
    headings.items.join(" ").length +
    paragraphs.items.join(" ").length;

  return {
    title,
    description,
    siteName,
    ogImage,
    themeColor,
    colorHints,
    stylesheets,
    headings: headings.items,
    paragraphs: paragraphs.items,
    rawImages,
    styleText,
    textLength,
  };
}
