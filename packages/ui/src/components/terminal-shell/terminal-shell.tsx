import { Terminal } from 'lucide-react';
import type { ReactNode } from 'react';

/** Public properties for the terminal output surface. */
export interface TerminalShellProps {
  readonly output: string;
  readonly status?: string;
  readonly children?: ReactNode;
}

/** Displays streamed output as an accessible live log. */
export function TerminalShell({ children, output, status }: TerminalShellProps): ReactNode {
  return (
    <section className="syn-terminal-shell" aria-label="Kết quả thực hành">
      <header className="syn-terminal-shell__header">
        <span>
          <Terminal aria-hidden="true" size={17} /> Terminal
        </span>
        {status ? <small>{status}</small> : null}
      </header>
      <pre
        className="syn-terminal-shell__output"
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
      >
        {output || 'Sẵn sàng chạy bài thực hành.'}
      </pre>
      {children}
    </section>
  );
}
