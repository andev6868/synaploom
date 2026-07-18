import katex from 'katex';
import 'katex/dist/katex.min.css';

function renderMathMarkup(source: string, display: boolean): string | null {
  try {
    return katex.renderToString(source, {
      displayMode: display,
      throwOnError: true,
      strict: 'error',
      trust: false,
      output: 'htmlAndMathml',
    });
  } catch {
    return null;
  }
}

export function MathContent({
  source,
  display = false,
}: {
  readonly source: string;
  readonly display?: boolean;
}) {
  const markup = renderMathMarkup(source, display);
  if (markup === null) {
    return (
      <code
        className={display ? 'syn-math-fallback syn-math-fallback--display' : 'syn-math-fallback'}
      >
        {source}
      </code>
    );
  }
  return (
    <span
      className={display ? 'syn-math syn-math--display' : 'syn-math'}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
