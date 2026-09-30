// 将 tiptap（ProseMirror）JSON 文档转换为 docx 并触发浏览器下载。
// 仅在客户端使用（依赖编辑器已有的 JSON 内容）。
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ExternalHyperlink,
  HeadingLevel,
  AlignmentType,
  LevelFormat,
} from "docx";

// tiptap JSON 节点的宽松类型
interface PMMark {
  type: string;
  attrs?: Record<string, unknown>;
}
interface PMNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: PMNode[];
  text?: string;
  marks?: PMMark[];
}

const NUMBERING_REF = "ordered-list";

function alignOf(node: PMNode): (typeof AlignmentType)[keyof typeof AlignmentType] | undefined {
  const a = node.attrs?.textAlign as string | undefined;
  switch (a) {
    case "center":
      return AlignmentType.CENTER;
    case "right":
      return AlignmentType.RIGHT;
    case "justify":
      return AlignmentType.JUSTIFIED;
    case "left":
      return AlignmentType.LEFT;
    default:
      return undefined;
  }
}

// 文本节点 + marks -> TextRun / ExternalHyperlink
function buildRuns(node: PMNode): (TextRun | ExternalHyperlink)[] {
  if (node.type !== "text" || !node.text) return [];
  const marks = node.marks ?? [];
  const has = (t: string) => marks.some((m) => m.type === t);
  const color = marks.find((m) => m.type === "textStyle")?.attrs?.color as
    | string
    | undefined;
  const highlight = has("highlight");
  const isCode = has("code");

  const run = new TextRun({
    text: node.text,
    bold: has("bold"),
    italics: has("italic"),
    underline: has("underline") ? {} : undefined,
    strike: has("strike"),
    color: color ? color.replace("#", "") : undefined,
    highlight: highlight ? "yellow" : undefined,
    font: isCode ? "Consolas" : undefined,
  });

  const link = marks.find((m) => m.type === "link");
  if (link && typeof link.attrs?.href === "string") {
    return [new ExternalHyperlink({ children: [run], link: link.attrs.href })];
  }
  return [run];
}

function inlineRuns(nodes: PMNode[] | undefined): (TextRun | ExternalHyperlink)[] {
  if (!nodes) return [];
  return nodes.flatMap(buildRuns);
}

interface ListCtx {
  ordered: boolean;
  level: number;
}

// 递归把块级节点转成 Paragraph 列表
function buildBlocks(node: PMNode, list?: ListCtx): Paragraph[] {
  switch (node.type) {
    case "paragraph":
      return [
        new Paragraph({
          alignment: alignOf(node),
          children: inlineRuns(node.content),
          ...(list
            ? list.ordered
              ? { numbering: { reference: NUMBERING_REF, level: list.level } }
              : { bullet: { level: list.level } }
            : {}),
        }),
      ];

    case "heading": {
      const level = (node.attrs?.level as number) ?? 1;
      const map: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
        1: HeadingLevel.HEADING_1,
        2: HeadingLevel.HEADING_2,
        3: HeadingLevel.HEADING_3,
        4: HeadingLevel.HEADING_4,
        5: HeadingLevel.HEADING_5,
        6: HeadingLevel.HEADING_6,
      };
      return [
        new Paragraph({
          heading: map[level] ?? HeadingLevel.HEADING_1,
          alignment: alignOf(node),
          children: inlineRuns(node.content),
        }),
      ];
    }

    case "bulletList":
    case "orderedList": {
      const ordered = node.type === "orderedList";
      const level = list ? list.level + 1 : 0;
      return (node.content ?? []).flatMap((li) =>
        (li.content ?? []).flatMap((child) =>
          buildBlocks(child, { ordered, level })
        )
      );
    }

    case "taskList":
      return (node.content ?? []).flatMap((item) => {
        const checked = item.attrs?.checked ? "\u2611 " : "\u2610 ";
        return (item.content ?? []).flatMap((child, idx) => {
          const blocks = buildBlocks(child);
          // 在首段前加上勾选框标记
          if (idx === 0 && blocks[0]) {
            blocks[0] = new Paragraph({
              children: [new TextRun(checked), ...inlineRuns(child.content)],
            });
          }
          return blocks;
        });
      });

    case "blockquote":
      return (node.content ?? []).map(
        (child) =>
          new Paragraph({
            children: inlineRuns(child.content),
            indent: { left: 480 },
            border: {
              left: { style: "single", size: 12, space: 12, color: "CCCCCC" },
            },
          })
      );

    case "codeBlock":
      return [
        new Paragraph({
          children: [
            new TextRun({
              text: (node.content ?? []).map((n) => n.text ?? "").join(""),
              font: "Consolas",
            }),
          ],
          shading: { type: "clear", fill: "F5F5F5" },
        }),
      ];

    case "horizontalRule":
      return [
        new Paragraph({
          border: {
            bottom: { style: "single", size: 6, space: 1, color: "999999" },
          },
          children: [],
        }),
      ];

    default:
      // 其它容器：递归其子节点
      if (node.content) return node.content.flatMap((c) => buildBlocks(c, list));
      return [];
  }
}

/** 把 tiptap JSON 文档转成 docx Blob */
export async function tiptapJsonToDocxBlob(doc: PMNode): Promise<Blob> {
  const children = (doc.content ?? []).flatMap((n) => buildBlocks(n));
  const document = new Document({
    numbering: {
      config: [
        {
          reference: NUMBERING_REF,
          levels: Array.from({ length: 6 }, (_, i) => ({
            level: i,
            format: LevelFormat.DECIMAL,
            text: `%${i + 1}.`,
            alignment: AlignmentType.LEFT,
          })),
        },
      ],
    },
    sections: [{ children: children.length ? children : [new Paragraph({})] }],
  });
  return Packer.toBlob(document);
}

/** 生成 docx 并触发浏览器下载 */
export async function exportDocxFromJson(doc: PMNode, filename: string) {
  const blob = await tiptapJsonToDocxBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".docx") ? filename : `${filename}.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
