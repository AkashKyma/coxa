/**
 * Generate CDP & Data Intelligence Plan v2 as branded DOCX.
 * Each chapter is a separate Word section (clean page breaks).
 * Usage: node scripts/generate-cdp-plan-docx.cjs
 */
const {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, HeadingLevel, AlignmentType, ShadingType, SectionType,
} = require("docx");
const fs = require("fs");
const path = require("path");

const content = require("./cdp-plan-content.cjs");
const phases = require("./cdp-plan-phases.cjs");

const BRAND = "1B4332";
const GRAY = "F0F0F0";
const OUTPUT = path.join(__dirname, "..", "docs", "Coxa_CDP_Data_Intelligence_Plan.docx");
const PAGE_W = 9360;
const PAGE_MARGIN = { top: 1440, bottom: 1440, left: 1440, right: 1440 };

function h1(text) { return new Paragraph({ text, heading: HeadingLevel.HEADING_1, spacing: { before: 120, after: 160 } }); }
function h2(text) { return new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 120 } }); }

function txt(text, opts = {}) {
  return new Paragraph({
    children: [new TextRun({ text, size: 22, bold: opts.bold, color: opts.color })],
    spacing: { after: 140 },
    alignment: opts.center ? AlignmentType.CENTER : undefined,
  });
}

function bull(text) {
  return new Paragraph({ children: [new TextRun({ text, size: 21 })], bullet: { level: 0 }, spacing: { after: 80 } });
}

function cell(text, isHeader) {
  return new TableCell({
    children: [new Paragraph({
      children: [new TextRun({ text: String(text), size: isHeader ? 18 : 20, bold: isHeader, color: isHeader ? "FFFFFF" : undefined })],
      spacing: { before: 40, after: 40 },
    })],
    shading: isHeader ? { type: ShadingType.CLEAR, fill: BRAND } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
  });
}

function tbl(headers, rows, widths) {
  if (!widths) { const w = Math.floor(PAGE_W / headers.length); widths = headers.map(() => w); }
  return new Table({
    columnWidths: widths,
    rows: [
      new TableRow({ tableHeader: true, children: headers.map(h => cell(h, true)) }),
      ...rows.map(row => new TableRow({ children: row.map(c => cell(c, false)) })),
    ],
  });
}

function sp(n = 200) { return new Paragraph({ spacing: { before: n } }); }

function section(children, startType) {
  return {
    properties: { page: { margin: PAGE_MARGIN }, type: startType || SectionType.NEXT_PAGE },
    children,
  };
}

async function build() {
  const allSections = [];

  // ═══════ SECTION: Title Page ═══════
  allSections.push(section([
    sp(2400),
    new Paragraph({ children: [new TextRun({ text: "Coxa Fan OS", bold: true, size: 56, color: BRAND })], alignment: AlignmentType.CENTER }),
    sp(300),
    new Paragraph({ children: [new TextRun({ text: "CDP & Data Intelligence Platform", bold: true, size: 32 })], alignment: AlignmentType.CENTER }),
    new Paragraph({ children: [new TextRun({ text: "Development Plan v2", bold: true, size: 28 })], alignment: AlignmentType.CENTER }),
    sp(200),
    txt("Data Warehouse | CDP Events | Personalization | Segmentation | Multi-Channel Tracking", { center: true, color: "555555" }),
    sp(500),
    txt("Prepared: July 2026", { center: true, color: "666666" }),
    txt("Client: Coritiba FC / Coxa Fan OS", { center: true, color: "666666" }),
    txt("Timeline: 6 Weeks (4 Phases, AI-Accelerated)", { center: true, color: "666666" }),
    sp(200),
    txt("All tools: Open-source, self-hosted, zero vendor lock-in", { center: true, bold: true }),
    txt("Development Model: AI-Accelerated (Cursor + Claude + GPT-4o)", { center: true, color: "888888" }),
  ]));

  // ═══════ SECTION: Executive Summary ═══════
  allSections.push(section([
    h1("1. Executive Summary"),
    ...content.executiveSummary.map(x => txt(x)),
    sp(),
    h2("Key Deliverables"),
    ...content.keyDeliverables.map(x => bull(x)),
    sp(),
    h2("Expected Outcomes"),
    sp(100),
    tbl(["Metric", "Current", "Target"], content.expectedOutcomes, [2400, 3200, 3760]),
  ]));

  // ═══════ SECTION: Current System ═══════
  allSections.push(section([
    h1("2. Current System Assessment"),
    h2("2.1 What Exists Today"),
    txt("The platform has a working CDP - these are production-grade features:"),
    sp(100),
    tbl(["Capability", "Implementation", "Status"], content.currentAssets, [1800, 5800, 1760]),
    sp(300),
    h2("2.2 Gaps Addressed"),
    sp(100),
    tbl(["Gap", "Current", "Target"], content.gaps, [2200, 3400, 3760]),
  ]));

  // ═══════ SECTION: Tech Stack ═══════
  allSections.push(section([
    h1("3. Open-Source Technology Stack"),
    txt("All tools are production-proven, actively maintained, and fully open-source. Self-hosted deployment = zero per-event fees, full data ownership, and LGPD compliance by default."),
    sp(100),
    tbl(
      ["Tool", "Stars", "License", "What It Does", "Role in Coxa"],
      content.openSourceStack,
      [1500, 900, 1500, 2700, 2760],
    ),
  ]));

  // ═══════ SECTION: Replacements ═══════
  allSections.push(section([
    h1("4. What Gets Replaced vs What Stays"),
    h2("4.1 Modules Replaced by Open-Source Tools"),
    sp(100),
    tbl(["Current Module", "Replaced By", "Why"], content.replacementMap, [2600, 2600, 4160]),
    sp(300),
    h2("4.2 Modules Preserved and Enhanced"),
    txt("These contain sports-specific logic unique to Coxa that open-source tools cannot provide:"),
    sp(100),
    tbl(["Module", "Why It Stays", "Enhancement"], content.preserved, [2400, 3400, 3560]),
  ]));

  // ═══════ SECTION: Multi-Channel ═══════
  allSections.push(section([
    h1("5. Multi-Channel Event Capture"),
    txt(phases.multiChannel.description),
    txt("The following table shows how each fan touchpoint is instrumented:"),
    sp(100),
    tbl(
      ["Channel", "Technology", "What Gets Captured"],
      phases.multiChannel.channels,
      [2600, 2000, 4760],
    ),
  ]));

  // ═══════ SECTION: Phase 1 ═══════
  allSections.push(section([
    h1("6. Phase 1: Event Infrastructure (Weeks 1-2)"),
    txt(phases.phase1.objective),
    sp(),
    h2("Week 1: Deploy + Instrument"),
    ...phases.phase1.week1.map(x => bull(x)),
    sp(),
    h2("Week 2: Wire + Validate"),
    ...phases.phase1.week2.map(x => bull(x)),
    sp(),
    h2("Testing Gate (End of Week 2)"),
    sp(100),
    tbl(["Test", "Success Criteria"], phases.phase1.tests, [3200, 6160]),
  ]));

  // ═══════ SECTION: Phase 2 ═══════
  allSections.push(section([
    h1("7. Phase 2: Data Warehouse + Semantic Layer (Weeks 3-4)"),
    txt(phases.phase2.objective),
    sp(),
    h2("Week 3: Infrastructure"),
    ...phases.phase2.week3.map(x => bull(x)),
    sp(),
    h2("Week 4: Migration + Validation"),
    ...phases.phase2.week4.map(x => bull(x)),
    sp(),
    h2("Why No Airbyte Needed"),
    txt(phases.phase2.whyNoAirbyte),
    sp(),
    h2("Testing Gate (End of Week 4)"),
    sp(100),
    tbl(["Test", "Success Criteria"], phases.phase2.tests, [3200, 6160]),
  ]));

  // ═══════ SECTION: Phase 3 ═══════
  allSections.push(section([
    h1("8. Phase 3: Advanced Segmentation + ML Scoring (Weeks 4-5)"),
    txt(phases.phase3.objective),
    sp(),
    h2("Segmentation via Tracardi"),
    ...phases.phase3.segmentation.map(x => bull(x)),
    sp(),
    h2("ML Scoring Pipeline"),
    sp(100),
    tbl(["Model", "Type", "Output", "Use Case"], phases.phase3.mlModels, [2200, 2600, 1600, 2960]),
    sp(),
    h2("ML Architecture"),
    ...phases.phase3.mlArchitecture.map(x => bull(x)),
    sp(),
    h2("Testing Gate (End of Week 5)"),
    sp(100),
    tbl(["Test", "Success Criteria"], phases.phase3.tests, [3200, 6160]),
  ]));

  // ═══════ SECTION: Phase 4 ═══════
  allSections.push(section([
    h1("9. Phase 4: Personalization + Activation (Weeks 5-6)"),
    txt(phases.phase4.objective),
    sp(),
    h2("Multiwoven Reverse ETL (Auto-Activation)"),
    ...phases.phase4.multiwoven.map(x => bull(x)),
    sp(),
    h2("ML-Ranked Personalization"),
    ...phases.phase4.personalization.map(x => bull(x)),
    sp(),
    h2("AI Campaign Engine"),
    ...phases.phase4.aiCampaign.map(x => bull(x)),
    sp(),
    h2("Testing Gate (End of Week 6)"),
    sp(100),
    tbl(["Test", "Success Criteria"], phases.phase4.tests, [3200, 6160]),
  ]));

  // ═══════ SECTION: Timeline ═══════
  allSections.push(section([
    h1("10. Complete 6-Week Timeline"),
    sp(100),
    tbl(
      ["Wk", "Phase", "AI Delivers", "Human Validates", "Milestone"],
      phases.timeline,
      [500, 1100, 3400, 2400, 1960],
    ),
  ]));

  // ═══════ SECTION: Infrastructure ═══════
  allSections.push(section([
    h1("11. Infrastructure Requirements"),
    txt("All components run as Docker containers. Total additional infrastructure: ~15 CPU, 30GB RAM (fits on a single AWS m6i.4xlarge or equivalent)."),
    sp(100),
    tbl(
      ["Component", "Docker Image", "Resources", "Purpose"],
      phases.infrastructure,
      [2200, 2800, 1600, 2760],
    ),
  ]));

  // ═══════ SECTION: Risks ═══════
  allSections.push(section([
    h1("12. Risk Mitigations"),
    sp(100),
    tbl(["Risk", "Impact", "Mitigation"], phases.risks, [2200, 2200, 4960]),
  ]));

  // ═══════ SECTION: Team ═══════
  allSections.push(section([
    h1("13. Team Requirements (AI-Augmented)"),
    txt("AI agents generate 80-90% of implementation code. Human developers review, validate architectural decisions, and run acceptance tests."),
    sp(100),
    tbl(["Role", "Responsibility", "FTE", "Phases"], phases.teamRequirements, [2200, 4200, 600, 2360]),
    sp(),
    txt("Total: ~2.75 FTE over 6 weeks (AI agents effectively replace 3-4 additional developers while maintaining quality).", { bold: true }),
  ]));

  // ═══════ SECTION: Value ═══════
  allSections.push(section([
    h1("14. Value Delivered Per Phase"),
    txt("Each phase delivers standalone business value. The client sees measurable improvement at every 2-week boundary:"),
    sp(100),
    tbl(["Milestone", "What the Client Gets"], phases.valuePerPhase, [1800, 7560]),
  ]));

  // ═══════ SECTION: Conclusion ═══════
  allSections.push(section([
    h1("15. Conclusion"),
    txt("This plan transforms the existing Coxa CDP into a multi-channel enterprise data intelligence platform using best-in-class open-source tools. Key advantages over comparable commercial solutions:"),
    sp(),
    bull("6 weeks (not 8) - RudderStack eliminates Airbyte, Tracardi eliminates custom segment UI, PostHog eliminates custom A/B testing framework"),
    bull("Multi-channel from day 1 - website, app, POS, and pixel tracking all captured through RudderStack SDKs"),
    bull("Marketing self-service - Tracardi visual builder means no engineering tickets for segment creation"),
    bull("Automatic activation - Multiwoven syncs audiences to email, ads, and CRM tools without manual exports"),
    bull("Zero vendor lock-in - all tools self-hosted, open-source, data never leaves your infrastructure"),
    bull("LGPD compliant by design - self-hosted means full data sovereignty in Brazil"),
    sp(300),
    txt("The 6-week timeline delivers value at each phase boundary. Phase 1 alone captures fan behavior across all digital touchpoints for the first time. Phase 2 makes analytics instant. Phase 3 gives marketing self-serve segmentation and predictive intelligence. Phase 4 closes the loop with automatic activation and AI-powered campaigns."),
    sp(400),
    txt("Prepared by: Coxa Engineering", { center: true, bold: true }),
    txt("Date: July 2026  |  Next review: End of Phase 1 (Week 2)", { center: true, color: "666666" }),
  ]));

  // ═══════ BUILD DOCUMENT ═══════
  const doc = new Document({
    sections: allSections,
    styles: { default: { document: { run: { font: "Calibri", size: 22 } } } },
  });

  const buf = await Packer.toBuffer(doc);
  fs.writeFileSync(OUTPUT, buf);
  console.log("Generated:", OUTPUT);
  console.log("Size:", (buf.length / 1024).toFixed(1), "KB");
  console.log("Sections:", allSections.length);
}

build().catch(e => { console.error(e); process.exit(1); });
