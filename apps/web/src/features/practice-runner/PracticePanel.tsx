import type { LessonPayload } from '@synaploom/protocol';
import { ActionBar, Button, StatusBadge, TerminalShell } from '@synaploom/ui';
import { RotateCcw, Save } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useApi } from '#src/app/providers/AppProviders';
import { useProcessEvents } from '#src/features/practice-runner/useProcessEvents';

/** Practice pane for declared actions and editable course workspace files. */
export function PracticePanel({
  lesson,
  onActionComplete,
}: {
  readonly lesson: LessonPayload;
  readonly onActionComplete: () => void;
}): ReactNode {
  const api = useApi();
  const [files, setFiles] = useState<readonly string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [eventsUrl, setEventsUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const process = useProcessEvents(eventsUrl);
  const onActionCompleteRef = useRef(onActionComplete);
  const completedEventsUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void api.listFiles(lesson.id).then((items) => {
      if (cancelled) return;
      setFiles(items);
      setSelectedFile(items[0] ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [api, lesson.id]);

  useEffect(() => {
    if (!selectedFile) return undefined;
    let cancelled = false;
    void api.readFile(lesson.id, selectedFile).then((file) => {
      if (!cancelled) setContent(file.content);
    });
    return () => {
      cancelled = true;
    };
  }, [api, lesson.id, selectedFile]);

  useEffect(() => {
    onActionCompleteRef.current = onActionComplete;
  }, [onActionComplete]);

  useEffect(() => {
    if (!eventsUrl || !process.terminal || completedEventsUrlRef.current === eventsUrl) return;
    completedEventsUrlRef.current = eventsUrl;
    onActionCompleteRef.current();
  }, [eventsUrl, process.terminal]);

  const checkRows = useMemo(
    () =>
      lesson.latestCheck?.checks ??
      lesson.exercise?.checks.map((check) => ({ ...check, passed: false })) ??
      [],
    [lesson.exercise?.checks, lesson.latestCheck?.checks],
  );

  const save = async (): Promise<void> => {
    if (!selectedFile) return;
    setBusy(true);
    try {
      await api.writeFile(lesson.id, selectedFile, content);
    } finally {
      setBusy(false);
    }
  };

  const run = async (actionId: string): Promise<void> => {
    setBusy(true);
    try {
      if (selectedFile) await api.writeFile(lesson.id, selectedFile, content);
      const session = await api.runAction(lesson.id, actionId);
      setEventsUrl(session.eventsUrl);
    } finally {
      setBusy(false);
    }
  };

  const reset = async (): Promise<void> => {
    setBusy(true);
    try {
      await api.resetWorkspace(lesson.id);
      if (selectedFile) setContent((await api.readFile(lesson.id, selectedFile)).content);
    } finally {
      setBusy(false);
    }
  };

  if (!lesson.exercise) {
    return (
      <section className="syn-empty-practice">
        <h2>Không có bài thực hành</h2>
        <p>Hoàn thành phần đọc để tiếp tục.</p>
      </section>
    );
  }

  return (
    <section className="syn-practice-panel">
      <header className="syn-practice-panel__header">
        <div>
          <small>Workspace</small>
          <h2>{lesson.exercise.title}</h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          leadingIcon={<RotateCcw size={15} />}
          onClick={() => void reset()}
          disabled={busy}
        >
          Reset
        </Button>
      </header>
      <div className="syn-practice-panel__body">
        <div className="syn-code-editor">
          <div className="syn-code-editor__tabs" role="tablist" aria-label="Tệp bài tập">
            {files.map((file) => (
              <button
                role="tab"
                aria-selected={file === selectedFile}
                key={file}
                onClick={() => setSelectedFile(file)}
              >
                {file}
              </button>
            ))}
          </div>
          <textarea
            aria-label="Trình soạn thảo mã"
            value={selectedFile ? content : ''}
            onChange={(event) => setContent(event.target.value)}
            spellCheck={false}
          />
          <Button
            className="syn-code-editor__save"
            variant="secondary"
            size="sm"
            leadingIcon={<Save size={15} />}
            onClick={() => void save()}
            loading={busy}
          >
            Lưu
          </Button>
        </div>
        <div className="syn-practice-panel__results">
          <TerminalShell
            output={process.output}
            status={
              process.disconnected
                ? 'Mất kết nối'
                : process.terminal
                  ? 'Đã kết thúc'
                  : eventsUrl
                    ? 'Đang chạy'
                    : 'Sẵn sàng'
            }
          />
          <section className="syn-check-results" aria-label="Kết quả kiểm tra">
            <h3>Kết quả kiểm tra</h3>
            {checkRows.length === 0 ? (
              <p>Chưa có kết quả.</p>
            ) : (
              checkRows.map((check) => (
                <div key={check.id}>
                  <StatusBadge status={check.passed ? 'passed' : 'neutral'}>
                    {check.passed ? 'Đạt' : 'Chưa đạt'}
                  </StatusBadge>
                  <span>{check.title}</span>
                </div>
              ))
            )}
          </section>
        </div>
      </div>
      <ActionBar>
        {lesson.exercise.actions.map((action) => (
          <Button
            key={action.id}
            variant={action.id === 'check' ? 'primary' : 'secondary'}
            disabled={busy}
            onClick={() => void run(action.id)}
          >
            {action.label}
          </Button>
        ))}
      </ActionBar>
    </section>
  );
}
