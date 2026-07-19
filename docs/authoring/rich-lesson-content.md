# Rich lesson content

Course Schema 1.2 lessons remain Markdown files with YAML-like front matter, but the Go runtime parses them into a validated, inert `LessonDocument`. The browser renders typed blocks; it does not execute raw HTML, JavaScript, arbitrary iframes, or author-supplied React components.

## Lesson front matter

```markdown
---
id: linear-reasoning
title: Suy luận đại số
position: 1
type: mixed
estimatedMinutes: 15
activitySets:
  - activities/practice.json
---
```

Use `theory` for reading-only content, `practice` for activity-focused content, and `mixed` when both are present. Activity set paths are relative to the lesson directory and must not escape the course package.

## Standard Markdown

The canonical parser supports headings, paragraphs, emphasis, strong text, strikethrough, safe links, inline code, fenced code, blockquotes, ordered and unordered nested lists, task lists, horizontal rules, tables, footnotes, and keyboard notation written as `` `<kbd>Enter</kbd>` ``. Raw HTML is displayed as inert text.

Inline mathematics uses single delimiters, such as `$a^2+b^2=c^2$`. Display mathematics uses delimiters on separate lines:

```markdown
$$
a^2+b^2=c^2
$$
```

The runtime renders mathematics with KaTeX and rejects unbalanced delimiters during `course validate`.

## Teaching directives

Directives are fenced with `:::` and are converted to typed blocks. Supported teaching directives include `note`, `hint`, `warning`, `important`, `misconception`, `details`, `tabs`, `objectives`, `definition`, `theorem`, `proof`, `worked-example`, `summary`, `vocabulary`, `compare`, and `walkthrough`.

```markdown
:::definition title="Phương trình"
Phương trình khẳng định hai biểu thức có cùng giá trị.
:::

:::worked-example title="Giải từng bước"
Từ $2x=8$ suy ra $x=4$.
:::
```

Embed an authored activity at a precise reading position with:

```markdown
:::activity id="solve-linear"
:::
```

An activity ID may appear only once in the document. Activities referenced by the set but not embedded are appended after the reading content in manifest order.

## Local media

Media must be local files contained by the course package. Figures require alt text. Audio and video require transcripts; video may also provide captions and a poster.

```markdown
:::figure source="media/triangle.png" alt="Tam giác vuông có các cạnh a, b và c" credit="Course author"
Hình 1. Các cạnh của tam giác vuông.
:::

:::audio source="media/greeting.mp3" title="Lời chào"
Transcript: Hello, how are you?
:::

:::video source="media/experiment.mp4" captions="media/experiment.vtt" title="Thí nghiệm"
Transcript mô tả đầy đủ lời nói và hành động quan trọng.
:::

:::attachment source="media/worksheet.pdf" label="Phiếu bài tập"
Tệp dùng cho phần thực hành ngoại tuyến.
:::
```

Remote media, path traversal, missing files, missing figure alt text, and missing transcripts are validation errors in strict mode.

## Validation

Run the authoritative validator before importing or publishing:

```bash
pnpm course:validate examples/multi-domain-foundations
```

Validation covers the manifest, lesson front matter, rich Markdown, directives, local assets, activity references, assessment sets, and progression graph. A package that validates should be renderable by the native runtime without converting parser failures into a generic lesson error.
