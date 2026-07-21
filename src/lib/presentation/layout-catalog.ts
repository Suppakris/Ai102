/**
 * Shared layout catalog for presentation XML generation.
 *
 * Single source of truth for all layout definitions used by both
 * full-presentation generation (generate/route.ts) and
 * single-slide generation (generate-slide/route.ts).
 */

/**
 * Compact, categorized layout reference used in generation and editing prompts.
 * Most layout components share the same child structure:
 * <DIV icon="optional"><H3>Label</H3><P>Short supporting text</P></DIV>.
 * Icon lists can switch to generated item images with prompt attributes.
 */
export const LAYOUT_REFERENCE = `Available XML syntax and layout families:

Base slide shell:
<PRESENTATION><SECTION layout="left|right|vertical">...</SECTION></PRESENTATION>
Use one main component inside each SECTION. Add a direct child <IMG query="..." /> or <IMG url="..." /> only when a root slide image helps; place it last. Simple slides may use only <TITLE>, <LABEL>, <H1>, <H2>, <H3>, <H4>, <P>, <QUOTE>, <CALLOUT>, <CODE>, or <CONTRIBUTOR />.

Shared item pattern:
Most visual components contain repeated items shaped as <DIV icon="optional"><H3>Label</H3><P>Short supporting text</P></DIV>. The wrapper tag changes the visual treatment. Only add icon="..." when the wrapper supports icons.

Columns:
Use <COLUMNS> when the slide needs balanced lanes or a container that can hold mixed nested content. Give each column a self-contained element -- a stat, a quote, a callout, an icon item, an image, a chart, or an infographic -- instead of plain paragraph text. A short <H3> or <LABEL> lane title is fine, but do not fill a column with <P> body text; if a lane genuinely needs a sentence of support, attach it to the element itself (e.g. inside a <STATS> or <QUOTE> item) rather than as a bare paragraph.
<COLUMNS><DIV><STATS statstype="plain"><DIV stat="42%"><H3>Market</H3><P>Demand growth this quarter.</P></DIV></STATS></DIV><DIV><IMG query="team planning" /><H3>Execution</H3></DIV></COLUMNS>

Text and content blocks:
Use these like normal content components anywhere plain text, headings, or paragraphs would fit. Use <TITLE> only for the first slide, a newly created title slide, or an introduction slide. Avoid bare <P> paragraphs inside <COLUMNS> specifically -- see the Columns guidance above.
- <TITLE alignment="left|center|right">Main message</TITLE>
- <LABEL alignment="left|center|right">Category</LABEL>
- Quote family: <QUOTE variant="sidequote|large|sidequote-icon" author="Name">Memorable sentence.</QUOTE>. Use sidequote for the simple block quote treatment.
- <CALLOUT variant="note|info|warning|caution|success|question">Short contextual note.</CALLOUT>
- <CODE language="typescript">const example = true;</CODE>
- <CONTRIBUTOR /> is standalone and self-populates from frontend presentation metadata, you can chose the alignment attribute here if needed.

First slide title pattern:
For most generated first slides, use a compact title-slide pattern with <TITLE>, <CONTRIBUTOR />, and a supporting visual image. Place any direct child root <IMG query="..." /> last. You can omit <CONTRIBUTOR /> when the first slide needs a stronger creative concept.

List family:
Use these for grouped points, feature sets, benefits, requirements, or short takeaways. Choose the wrapper that best matches the visual emphasis.
- <BULLETS bulletType="basic|numbered|arrow">...</BULLETS>
- <ICONS variant="icon|image" orientation="side|top">...</ICONS>
    For <ICONS variant="image">, use <DIV prompt="detailed image prompt"> instead of icon. For <ICONS variant="icon">, use <DIV icon="keyword">.
- <BOXES boxType="outline|icon|solid|sideline|side-label|top-label|top-circle|joined|joined-icon|leaf|labeled|alternating|quote-box|speech-bubble" orientation="horizontal|vertical" numbered="true">...</BOXES>
- <ARROWS orientation="horizontal|vertical" svgType="arrow|pill|parallelogram" showIcon="true|false">...</ARROWS>

Example: <BULLETS bulletType="arrow"><DIV><H3>Faster review</H3><P>Decisions move in hours.</P></DIV><DIV><H3>Cleaner handoff</H3><P>Teams share one source.</P></DIV></BULLETS>

Sequence family:
Use these for steps, roadmaps, process flow, maturity, progression, hierarchy, funnels, and growth paths.
- <STEPS variant="arrow|box">...</STEPS>
- <ARROW-SEQUENCE orientation="vertical|horizontal">...</ARROW-SEQUENCE>
- <TIMELINE orientation="vertical|horizontal" sidedness="single|double" numbered="true" showLine="true">...</TIMELINE>
- <CYCLE variant="flower|ring|circle">...</CYCLE>
- <PYRAMID isFunnel="true" variant="inside">...</PYRAMID>
- <STAIRCASE variant="inside">...</STAIRCASE>
- <SNAKE>...</SNAKE>
- <SLOPE><DIV icon="idea"><H4>Start</H4></DIV><DIV icon="growth"><H4>Scale</H4></DIV></SLOPE>
Example: <STEPS variant="arrow"><DIV icon="search"><H3>Discover</H3><P>Find the real constraint.</P></DIV><DIV icon="settings"><H3>Build</H3><P>Ship the smallest useful system.</P></DIV><DIV icon="analytics"><H3>Improve</H3><P>Measure and refine.</P></DIV></STEPS>

Comparison family:
Use these when the audience must compare choices, trade-offs, states, or opposing positions.
- <COMPARE><DIV><H3>Option A</H3><LI>Strength</LI><LI>Risk</LI></DIV><DIV><H3>Option B</H3><LI>Strength</LI><LI>Risk</LI></DIV></COMPARE>
- <BEFORE-AFTER><DIV><H3>Before</H3><P>Manual and fragmented.</P></DIV><DIV><H3>After</H3><P>Automated and visible.</P></DIV></BEFORE-AFTER>
- <PROS-CONS><PROS><H3>Pros</H3><LI>Fast rollout</LI></PROS><CONS><H3>Cons</H3><LI>Training needed</LI></CONS></PROS-CONS>

Relationship family:
Use these for ecosystems, dependencies, loops, connected concepts, and a core idea surrounded by factors.
- <CIRCULAR-GRID centerText="Core idea">...</CIRCULAR-GRID>
- <CONNECTED-CIRCLES>...</CONNECTED-CIRCLES>
- <CYCLE variant="flower|ring|circle">...</CYCLE>

Data family:
Use data components when numbers or structured evidence carry the message.
- <STATS statstype="plain|circle|circle-bold|star|bar|dot-grid|dot-line"><DIV stat="85%"><H3>Retention</H3><P>After onboarding.</P></DIV></STATS>
Here the stat attribute is just for numeric values, percentages, or other quantitative metrics. NOT WORDS. 
- <TABLE><TR><TH>Segment</TH><TH>Value</TH></TR><TR><TD>SMB</TD><TD>42%</TD></TR></TABLE>
- <CHART charttype="bar|pie|line|area|radar|scatter|radial-bar|composed|treemap|bubble|donut|histogram|heatmap|range-bar|range-area|waterfall|box-plot|candlestick|ohlc|nightingale|radial-column|sunburst|sankey|chord|funnel|cone-funnel|pyramid|radial-gauge|linear-gauge">
| label | value |
| --- | --- |
| Q1 | 24 |
| Q2 | 31 |
</CHART>
For charts, put a markdown table directly inside <CHART>. Headers define field names once. For multi-series charts, add columns such as revenue and profit. For scatter/bubble charts, use x, y, and optional z headers. For specialized charts, use the renderer field names: category/low/high, category/amount, date/open/high/low/close, category/min/q1/median/q3/max, x/y/value, or from/to/size.

Infographic family:
Use <INFOGRAPHIC>self-contained visual prompt</INFOGRAPHIC> for custom diagrams, process maps, lifecycle visuals, hierarchies, funnels, matrices, frameworks, or cause-and-effect flows. Include exact labels, values, entities, sequence, relationships, orientation, and takeaway in the element text.

Supporting tags:
Use <DIV>, <TITLE>, <LABEL>, <CONTRIBUTOR />, <QUOTE>, <CALLOUT>, <CODE>, <H1>, <H2>, <H3>, <H4>, <P>, <LI>, <IMG />, <OPTIONS>, <TR>, <TH>, <TD>, <PROS>, and <CONS> exactly as shown. Do not invent tags or attributes.`;
