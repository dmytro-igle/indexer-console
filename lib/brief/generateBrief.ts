import {
  Document,
  Packer,
  Table,
  TableRow,
  TableCell,
  Paragraph,
  TextRun,
  Header,
  WidthType,
  AlignmentType,
  BorderStyle,
} from "docx";
import type { IRunOptions } from "docx";
import type { DomainRow } from "@/lib/db/domains";
import type { SeoAuditRow } from "@/lib/db/seoAudits";
import { deriveBriefIssues, type BriefIssueRow } from "@/lib/seo/issues";

export { deriveBriefIssues, type BriefIssueRow };

const NAVY = "0F1B33";
const TAN = "FDECD1";
const WHITE = "FFFFFF";
const LABEL_BROWN = "8B6F2E";
const MUTED_GRAY = "6B7280";

// A clean, readable sans-serif — set as both the document default AND
// explicitly on every TextRun below (belt-and-suspenders: relying on only
// the document default risks the font silently not cascading in some
// renderers). Arial specifically, not Calibri: Calibri is a Microsoft-only
// font that isn't actually present unless Office is installed — confirmed
// by rendering this exact document on a plain macOS install, where
// Calibri silently fell back to a serif font. Arial ships with Windows,
// macOS, and is substituted with a metric-compatible font (Liberation
// Sans / Google's Arial-equivalent) everywhere else, so it's the safer
// universal choice for a document handed to other people.
const FONT_NAME = "Arial";
const BODY_SIZE = 22; // 11pt, in half-points
const LABEL_SIZE = 22;
const HEADER_SIZE = 26; // 13pt

// Table widths use DXA (twentieths of a point, i.e. twips) rather than
// WidthType.PERCENTAGE. Percentage widths are technically valid OOXML, but
// several real-world renderers (confirmed here: macOS QuickLook/Pages)
// don't honor them and fall back to an auto-fit that wraps every cell to
// one character per line. DXA is unambiguous and universally supported.
const PAGE_CONTENT_WIDTH_DXA = 9360; // US Letter, 1" margins each side
const LABEL_COL_DXA = 2340; // 25%
const VALUE_COL_DXA = PAGE_CONTENT_WIDTH_DXA - LABEL_COL_DXA;
const REF_COL_DXA = 3276; // 35%
const DESC_COL_DXA = PAGE_CONTENT_WIDTH_DXA - REF_COL_DXA;

// Breathing room inside every table cell — the default docx cell margins
// are quite tight, which was part of why the first version of this brief
// read as cramped.
const CELL_MARGINS = { top: 120, bottom: 120, left: 160, right: 160 };

export interface GenerateBriefInput {
  domain: DomainRow;
  seoAudit: SeoAuditRow | null;
  sitemapStatus: "success" | "partial" | "failed" | null;
  owner?: string;
  priority?: string;
  deadline?: string;
}

function run(text: string, opts: Partial<Omit<IRunOptions, "text">> = {}): TextRun {
  return new TextRun({ text, font: FONT_NAME, size: BODY_SIZE, ...opts });
}

function textParagraph(text: string, runOpts: Partial<Omit<IRunOptions, "text">> = {}): Paragraph {
  return new Paragraph({ children: [run(text, runOpts)] });
}

function pageHeader(host: string): Header {
  return new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun({
            text: `IGLE INDEXER  ·  ${host}`,
            font: FONT_NAME,
            size: 16,
            color: MUTED_GRAY,
            smallCaps: true,
          }),
        ],
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "D9D9D9", space: 4 } },
      }),
    ],
  });
}

function sectionHeaderTable(label: string): Table {
  return new Table({
    width: { size: PAGE_CONTENT_WIDTH_DXA, type: WidthType.DXA },
    columnWidths: [PAGE_CONTENT_WIDTH_DXA],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: PAGE_CONTENT_WIDTH_DXA, type: WidthType.DXA },
            shading: { fill: NAVY },
            margins: CELL_MARGINS,
            children: [textParagraph(label, { bold: true, color: WHITE, size: HEADER_SIZE })],
          }),
        ],
      }),
    ],
  });
}

function spacer(): Paragraph {
  return new Paragraph({ text: "", spacing: { before: 120, after: 120 } });
}

function requiredTemplateTable(input: GenerateBriefInput): Table {
  const { domain, owner, priority, deadline } = input;
  const rows: [string, string][] = [
    ["Task Title", `Fixing technical issues — ${domain.host}`],
    ["Priority", priority ?? "Medium"],
    ["Owner", owner ?? "Unassigned"],
    ["Deadline", deadline ?? "Not set"],
    ["Objective", `Fixing the technical SEO issues found on https://${domain.host}`],
  ];
  return new Table({
    width: { size: PAGE_CONTENT_WIDTH_DXA, type: WidthType.DXA },
    columnWidths: [LABEL_COL_DXA, VALUE_COL_DXA],
    rows: rows.map(
      ([label, value]) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: LABEL_COL_DXA, type: WidthType.DXA },
              shading: { fill: TAN },
              margins: CELL_MARGINS,
              children: [textParagraph(label, { bold: true, color: LABEL_BROWN, size: LABEL_SIZE })],
            }),
            new TableCell({
              width: { size: VALUE_COL_DXA, type: WidthType.DXA },
              margins: CELL_MARGINS,
              children: [textParagraph(value)],
            }),
          ],
        })
    ),
  });
}

function taskDescriptionBullets(issues: BriefIssueRow[]): Paragraph[] {
  if (issues.length === 0) {
    return [textParagraph("No outstanding issues were detected in the most recent audit.")];
  }
  return issues.map(
    (issue) =>
      new Paragraph({
        bullet: { level: 0 },
        spacing: { after: 80 },
        children: [run(issue.action)],
      })
  );
}

function referenceTable(issues: BriefIssueRow[]): Table {
  const headerRow = new TableRow({
    children: [
      new TableCell({
        width: { size: REF_COL_DXA, type: WidthType.DXA },
        shading: { fill: NAVY },
        margins: CELL_MARGINS,
        children: [textParagraph("Reference", { bold: true, color: WHITE })],
      }),
      new TableCell({
        width: { size: DESC_COL_DXA, type: WidthType.DXA },
        shading: { fill: NAVY },
        margins: CELL_MARGINS,
        children: [textParagraph("Description", { bold: true, color: WHITE })],
      }),
    ],
  });

  if (issues.length === 0) {
    return new Table({
      width: { size: PAGE_CONTENT_WIDTH_DXA, type: WidthType.DXA },
      columnWidths: [REF_COL_DXA, DESC_COL_DXA],
      rows: [
        headerRow,
        new TableRow({
          children: [
            new TableCell({
              width: { size: REF_COL_DXA, type: WidthType.DXA },
              shading: { fill: TAN },
              margins: CELL_MARGINS,
              children: [textParagraph("—")],
            }),
            new TableCell({
              width: { size: DESC_COL_DXA, type: WidthType.DXA },
              shading: { fill: TAN },
              margins: CELL_MARGINS,
              children: [textParagraph("No outstanding issues were detected.")],
            }),
          ],
        }),
      ],
    });
  }

  return new Table({
    width: { size: PAGE_CONTENT_WIDTH_DXA, type: WidthType.DXA },
    columnWidths: [REF_COL_DXA, DESC_COL_DXA],
    rows: [
      headerRow,
      ...issues.map(
        (issue) =>
          new TableRow({
            children: [
              new TableCell({
                width: { size: REF_COL_DXA, type: WidthType.DXA },
                shading: { fill: TAN },
                margins: CELL_MARGINS,
                children: [textParagraph(`•  ${issue.reference}`, { bold: true, color: LABEL_BROWN })],
              }),
              new TableCell({
                width: { size: DESC_COL_DXA, type: WidthType.DXA },
                shading: { fill: TAN },
                margins: CELL_MARGINS,
                children: [textParagraph(issue.description)],
              }),
            ],
          })
      ),
    ],
  });
}

function additionalNotesParagraphs(input: GenerateBriefInput): Paragraph[] {
  const { seoAudit } = input;
  const lines = [
    seoAudit
      ? `SEO audit performed at: ${seoAudit.checked_at}.`
      : "No SEO audit has been run yet for this domain — only the sitemap status is reflected above.",
    "Method notes: checks are lightweight HTTP/regex-based, not a full page-speed or mobile-UX audit.",
    'The "viewport meta tag" check is a proxy for mobile-friendliness only — it does not measure real page load speed or true mobile usability (font sizes, tap-target spacing). A tool such as Lighthouse or PageSpeed Insights would be needed for that.',
    "Hreflang and meta description checks confirm presence only — not correctness or completeness of the markup.",
  ];
  return lines.map((line) => new Paragraph({ spacing: { after: 120 }, children: [run(line, { color: MUTED_GRAY })] }));
}

export async function generateBriefDocx(input: GenerateBriefInput): Promise<Buffer> {
  const issues = deriveBriefIssues(input);

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: FONT_NAME, size: BODY_SIZE },
        },
      },
    },
    sections: [
      {
        headers: { default: pageHeader(input.domain.host) },
        children: [
          sectionHeaderTable("Required Template"),
          requiredTemplateTable(input),
          spacer(),
          sectionHeaderTable("Task Description"),
          ...taskDescriptionBullets(issues),
          spacer(),
          sectionHeaderTable("Reference / Description"),
          referenceTable(issues),
          spacer(),
          sectionHeaderTable("Additional Notes"),
          ...additionalNotesParagraphs(input),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}
