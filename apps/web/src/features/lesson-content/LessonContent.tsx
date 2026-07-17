import type { InlineContent, LessonBlock } from '@synaploom/contracts';
import type { ReactNode } from 'react';

function inline(content: readonly InlineContent[]): ReactNode {
  return content.map((item, index) => {
    if (item.type === 'text') return item.value;
    if (item.type === 'code') return <code key={index}>{item.value}</code>;
    if (item.type === 'strong') return <strong key={index}>{inline(item.children)}</strong>;
    return (
      <a key={index} href={item.href} rel="noreferrer" target="_blank">
        {inline(item.children)}
      </a>
    );
  });
}

function block(item: LessonBlock, index: number): ReactNode {
  switch (item.type) {
    case 'heading': {
      const Tag = `h${item.level}` as keyof React.JSX.IntrinsicElements;
      return <Tag key={index}>{item.text}</Tag>;
    }
    case 'paragraph':
      return <p key={index}>{inline(item.children)}</p>;
    case 'list': {
      const List = item.ordered ? 'ol' : 'ul';
      return (
        <List key={index}>
          {item.items.map((value) => (
            <li key={value}>{value}</li>
          ))}
        </List>
      );
    }
    case 'code':
      return (
        <pre key={index}>
          <code data-language={item.language}>{item.code}</code>
        </pre>
      );
    case 'callout':
      return (
        <aside className={`syn-lesson-callout syn-lesson-callout--${item.kind}`} key={index}>
          {inline(item.children)}
        </aside>
      );
    case 'image':
      return (
        <figure key={index}>
          <img alt={item.alt} src={item.source} />
          <figcaption>{item.alt}</figcaption>
        </figure>
      );
    case 'assignment':
      return (
        <section className="syn-assignment" key={index}>
          <h2>Bài tập</h2>
          <ol>
            {item.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>
      );
  }
}

/** Renders only the inert typed document produced by the lesson parser. */
export function LessonContent({ blocks }: { readonly blocks: readonly LessonBlock[] }): ReactNode {
  return <div className="syn-prose">{blocks.map(block)}</div>;
}
