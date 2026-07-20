import type { InlineNode, LessonBlock, LessonDocument, TabItem } from '@synaploom/contracts';
import { externalLinkProps } from '@synaploom/lesson-renderer';
import { Fragment, useId, useState, type KeyboardEvent, type ReactNode } from 'react';
import { MathContent } from '#src/features/lesson-content/MathContent';

type Admonition = {
  readonly kind: 'note' | 'tip' | 'warning' | 'important';
  readonly title: string;
  readonly blocks: readonly LessonBlock[];
};

const admonitionKinds = {
  '[!NOTE]': { kind: 'note', title: 'Ghi chú' },
  '[!TIP]': { kind: 'tip', title: 'Mẹo' },
  '[!WARNING]': { kind: 'warning', title: 'Cảnh báo' },
  '[!IMPORTANT]': { kind: 'important', title: 'Quan trọng' },
} as const;

function blockquoteAdmonition(blocks: readonly LessonBlock[]): Admonition | null {
  const first = blocks[0];
  if (first?.type !== 'paragraph' || first.children.length !== 1) return null;
  const marker = first.children[0];
  if (marker?.type !== 'text') return null;
  const config = admonitionKinds[marker.value.trim() as keyof typeof admonitionKinds];
  return config ? { ...config, blocks: blocks.slice(1) } : null;
}

function renderInline(nodes: readonly InlineNode[]): ReactNode {
  return nodes.map((node, index) => {
    const key = `${node.type}-${index}`;
    switch (node.type) {
      case 'text':
        return <Fragment key={key}>{node.value}</Fragment>;
      case 'emphasis':
        return <em key={key}>{renderInline(node.children)}</em>;
      case 'strong':
        return <strong key={key}>{renderInline(node.children)}</strong>;
      case 'strikethrough':
        return <s key={key}>{renderInline(node.children)}</s>;
      case 'code':
        return <code key={key}>{node.value}</code>;
      case 'link':
        return (
          <a key={key} href={node.href} title={node.title} {...externalLinkProps(node.href)}>
            {renderInline(node.children)}
          </a>
        );
      case 'hard-break':
        return <br key={key} />;
      case 'math':
        return <MathContent key={key} source={node.source} />;
      case 'keyboard':
        return <kbd key={key}>{node.value}</kbd>;
      case 'superscript':
        return <sup key={key}>{renderInline(node.children)}</sup>;
      case 'subscript':
        return <sub key={key}>{renderInline(node.children)}</sub>;
      case 'footnote-reference':
        return (
          <sup key={key}>
            <a href={`#footnote-${node.id}`}>[{node.id}]</a>
          </sup>
        );
      default: {
        const exhaustive: never = node;
        return exhaustive;
      }
    }
  });
}

function TabsBlock({
  tabs,
  renderActivity,
}: {
  readonly tabs: readonly TabItem[];
  readonly renderActivity: ActivityRenderer;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const baseId = useId();
  const selectRelative = (event: KeyboardEvent<HTMLButtonElement>, delta: number) => {
    event.preventDefault();
    setSelectedIndex((current) => (current + delta + tabs.length) % tabs.length);
  };
  const selected = tabs[selectedIndex] ?? tabs[0];
  return (
    <section className="syn-document-tabs">
      <div role="tablist" aria-label="Nội dung theo thẻ" className="syn-document-tabs__list">
        {tabs.map((tab, index) => (
          <button
            aria-controls={`${baseId}-panel-${tab.id}`}
            aria-selected={index === selectedIndex}
            className="syn-document-tabs__tab"
            id={`${baseId}-tab-${tab.id}`}
            key={tab.id}
            onClick={() => setSelectedIndex(index)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight') selectRelative(event, 1);
              if (event.key === 'ArrowLeft') selectRelative(event, -1);
              if (event.key === 'Home') {
                event.preventDefault();
                setSelectedIndex(0);
              }
              if (event.key === 'End') {
                event.preventDefault();
                setSelectedIndex(tabs.length - 1);
              }
            }}
            role="tab"
            tabIndex={index === selectedIndex ? 0 : -1}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>
      {selected ? (
        <div
          aria-labelledby={`${baseId}-tab-${selected.id}`}
          id={`${baseId}-panel-${selected.id}`}
          role="tabpanel"
        >
          <Blocks blocks={selected.blocks} renderActivity={renderActivity} />
        </div>
      ) : null}
    </section>
  );
}

type ActivityRenderer = (activityId: string) => ReactNode;

function Blocks({
  blocks,
  renderActivity,
}: {
  readonly blocks: readonly LessonBlock[];
  readonly renderActivity: ActivityRenderer;
}) {
  return blocks.map((block, index) => (
    <Block key={`${block.type}-${index}`} block={block} renderActivity={renderActivity} />
  ));
}

function Block({
  block,
  renderActivity,
}: {
  readonly block: LessonBlock;
  readonly renderActivity: ActivityRenderer;
}): ReactNode {
  switch (block.type) {
    case 'heading': {
      const Heading = `h${block.level}` as keyof React.JSX.IntrinsicElements;
      return <Heading>{renderInline(block.children)}</Heading>;
    }
    case 'paragraph':
      return <p>{renderInline(block.children)}</p>;
    case 'blockquote': {
      const admonition = blockquoteAdmonition(block.blocks);
      return admonition ? (
        <aside
          aria-label={admonition.title}
          className={`syn-lesson-callout syn-lesson-callout--${admonition.kind}`}
          role="note"
        >
          <h3>{admonition.title}</h3>
          <Blocks blocks={admonition.blocks} renderActivity={renderActivity} />
        </aside>
      ) : (
        <blockquote>
          <Blocks blocks={block.blocks} renderActivity={renderActivity} />
        </blockquote>
      );
    }
    case 'list': {
      const List = block.ordered ? 'ol' : 'ul';
      return (
        <List start={block.ordered ? block.start : undefined}>
          {block.items.map((item, index) => (
            <li
              key={index}
              className={
                item.checked === null || item.checked === undefined
                  ? undefined
                  : 'syn-task-list-item'
              }
            >
              {item.checked === null || item.checked === undefined ? null : (
                <input
                  aria-label="Trạng thái mục"
                  checked={item.checked}
                  disabled
                  type="checkbox"
                />
              )}
              <Blocks blocks={item.blocks} renderActivity={renderActivity} />
            </li>
          ))}
        </List>
      );
    }
    case 'code':
      return (
        <figure className="syn-code-block">
          {block.filename ? <figcaption>{block.filename}</figcaption> : null}
          <pre data-line-numbers={block.lineNumbers ? 'true' : undefined}>
            <code data-language={block.language ?? ''}>{block.code}</code>
          </pre>
        </figure>
      );
    case 'thematic-break':
      return <hr />;
    case 'table':
      return (
        <div className="syn-table-scroll">
          <table>
            {block.caption ? <caption>{block.caption}</caption> : null}
            <thead>
              <tr>
                {block.header.cells.map((cell, index) => (
                  <th
                    key={index}
                    scope="col"
                    style={{ textAlign: block.alignments[index] ?? undefined }}
                  >
                    {renderInline(cell.children)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.cells.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      style={{ textAlign: block.alignments[cellIndex] ?? undefined }}
                    >
                      {renderInline(cell.children)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'footnote-definition':
      return (
        <aside id={`footnote-${block.id}`} className="syn-footnote">
          <Blocks blocks={block.blocks} renderActivity={renderActivity} />
        </aside>
      );
    case 'math':
      return <MathContent display source={block.source} />;
    case 'callout':
      return (
        <aside
          aria-label={block.title ?? 'Ghi chú'}
          className={`syn-lesson-callout syn-lesson-callout--${block.kind}`}
          role="note"
        >
          {block.title ? <h3>{block.title}</h3> : null}
          <Blocks blocks={block.blocks} renderActivity={renderActivity} />
        </aside>
      );
    case 'details':
      return (
        <details open={block.open}>
          <summary>{renderInline(block.summary)}</summary>
          <Blocks blocks={block.blocks} renderActivity={renderActivity} />
        </details>
      );
    case 'tabs':
      return <TabsBlock tabs={block.tabs} renderActivity={renderActivity} />;
    case 'objectives':
      return (
        <section className="syn-pedagogical-block syn-objectives">
          <h2>{block.title ?? 'Mục tiêu học tập'}</h2>
          <ul>
            {block.items.map((item, index) => (
              <li key={index}>{renderInline(item)}</li>
            ))}
          </ul>
        </section>
      );
    case 'definition':
    case 'theorem':
    case 'worked-example':
      return (
        <section className={`syn-pedagogical-block syn-pedagogical-block--${block.type}`}>
          <h3>{block.title}</h3>
          <Blocks blocks={block.blocks} renderActivity={renderActivity} />
        </section>
      );
    case 'proof':
    case 'summary':
      return (
        <section className={`syn-pedagogical-block syn-pedagogical-block--${block.type}`}>
          {block.title ? <h3>{block.title}</h3> : null}
          <Blocks blocks={block.blocks} renderActivity={renderActivity} />
        </section>
      );
    case 'vocabulary':
      return (
        <section className="syn-pedagogical-block">
          <h3>{block.title ?? 'Từ vựng'}</h3>
          <dl>
            {block.items.map((item, index) => (
              <Fragment key={index}>
                <dt>{renderInline(item.term)}</dt>
                <dd>
                  <Blocks blocks={item.definition} renderActivity={renderActivity} />
                </dd>
              </Fragment>
            ))}
          </dl>
        </section>
      );
    case 'compare':
      return (
        <section className="syn-pedagogical-block syn-compare">
          {block.title ? <h3>{block.title}</h3> : null}
          <div className="syn-compare__columns">
            {block.columns.map((column) => (
              <section key={column.title}>
                <h4>{column.title}</h4>
                <Blocks blocks={column.blocks} renderActivity={renderActivity} />
              </section>
            ))}
          </div>
        </section>
      );
    case 'walkthrough':
      return (
        <section className="syn-pedagogical-block syn-walkthrough">
          {block.title ? <h3>{block.title}</h3> : null}
          <ol>
            {block.steps.map((step) => (
              <li key={step.title}>
                <h4>{step.title}</h4>
                <Blocks blocks={step.blocks} renderActivity={renderActivity} />
              </li>
            ))}
          </ol>
        </section>
      );
    case 'activity':
      return (
        <section className="syn-activity-embed" data-activity-id={block.activityId}>
          {renderActivity(block.activityId)}
        </section>
      );
    case 'figure':
      return (
        <figure>
          <img alt={block.alt} src={block.source} />
          {block.caption ? (
            <figcaption>
              {renderInline(block.caption)}
              {block.credit ? <> · {block.credit}</> : null}
            </figcaption>
          ) : null}
        </figure>
      );
    case 'audio':
      return (
        <figure className="syn-media-block">
          <figcaption>{block.title}</figcaption>
          {/* Transcript disclosure provides the accessible text alternative. */}
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio controls src={block.source} />
          <details>
            <summary>Bản chép lời</summary>
            <Blocks blocks={block.transcript} renderActivity={renderActivity} />
          </details>
        </figure>
      );
    case 'video':
      return (
        <figure className="syn-media-block">
          <figcaption>{block.title}</figcaption>
          {/* A mandatory transcript follows; timed captions remain optional in v1. */}
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video controls poster={block.poster} src={block.source}>
            {block.captions ? <track default kind="captions" src={block.captions} /> : null}
          </video>
          <details>
            <summary>Bản chép lời</summary>
            <Blocks blocks={block.transcript} renderActivity={renderActivity} />
          </details>
        </figure>
      );
    case 'attachment':
      return (
        <aside className="syn-attachment">
          <a href={block.source} download>
            {block.label}
          </a>
          {block.description ? <p>{renderInline(block.description)}</p> : null}
        </aside>
      );
    default: {
      const exhaustive: never = block;
      return exhaustive;
    }
  }
}

export function LessonDocumentRenderer({
  document,
  renderActivity = () => null,
}: {
  readonly document: LessonDocument;
  readonly renderActivity?: ActivityRenderer;
}): ReactNode {
  return (
    <div className="syn-prose">
      <Blocks blocks={document.blocks} renderActivity={renderActivity} />
    </div>
  );
}
