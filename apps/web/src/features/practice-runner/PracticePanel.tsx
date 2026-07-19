import type { CodingWorkspaceTarget, LessonPayload } from '@synaploom/protocol';
import { ActionBar, Button, StatusBadge, TerminalShell } from '@synaploom/ui';
import { RotateCcw, Save } from 'lucide-react';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useApi } from '#src/app/providers/AppProviders';
import { useProcessEvents } from '#src/features/practice-runner/useProcessEvents';

export interface PracticePanelHandle {
  isDirty(): boolean;
  saveIfDirty(): Promise<void>;
}

interface PracticePanelProps {
  readonly lesson: LessonPayload;
  readonly workspaceTarget?: CodingWorkspaceTarget;
  readonly onActionComplete: () => void;
}

/** Practice pane for declared actions and editable course workspace files. */
export const PracticePanel = forwardRef<PracticePanelHandle, PracticePanelProps>(
  function PracticePanel({ lesson, workspaceTarget, onActionComplete }, ref): ReactNode {
    const api = useApi();
    const [files, setFiles] = useState<readonly string[]>([]);
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [content, setContent] = useState('');
    const [savedContent, setSavedContent] = useState('');
    const [eventsUrl, setEventsUrl] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const process = useProcessEvents(eventsUrl);
    const onActionCompleteRef = useRef(onActionComplete);
    const completedEventsUrlRef = useRef<string | null>(null);

    useEffect(() => {
      if (!lesson.exercise) return undefined;
      let cancelled = false;
      const request =
        workspaceTarget && api.listActivityFiles
          ? api.listActivityFiles(workspaceTarget)
          : api.listFiles(lesson.id);
      void request.then((items) => {
        if (cancelled) return;
        setFiles(items);
        setSelectedFile(items[0] ?? null);
      });
      return () => {
        cancelled = true;
      };
    }, [api, lesson.exercise, lesson.id, workspaceTarget]);

    useEffect(() => {
      if (!selectedFile) return undefined;
      let cancelled = false;
      const request =
        workspaceTarget && api.readActivityFile
          ? api.readActivityFile(workspaceTarget, selectedFile)
          : api.readFile(lesson.id, selectedFile);
      void request.then((file) => {
        if (!cancelled) {
          setContent(file.content);
          setSavedContent(file.content);
        }
      });
      return () => {
        cancelled = true;
      };
    }, [api, lesson.id, selectedFile, workspaceTarget]);

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

    const dirty = selectedFile !== null && content !== savedContent;

    const saveCurrentFile = useCallback(async (): Promise<void> => {
      if (!selectedFile || !dirty) return;
      setBusy(true);
      try {
        if (workspaceTarget && api.writeActivityFile) {
          await api.writeActivityFile(workspaceTarget, selectedFile, content);
        } else {
          await api.writeFile(lesson.id, selectedFile, content);
        }
        setSavedContent(content);
      } finally {
        setBusy(false);
      }
    }, [api, content, dirty, lesson.id, selectedFile, workspaceTarget]);

    useImperativeHandle(
      ref,
      () => ({
        isDirty: () => dirty,
        saveIfDirty: saveCurrentFile,
      }),
      [dirty, saveCurrentFile],
    );

    const run = async (actionId: string): Promise<void> => {
      setBusy(true);
      try {
        await saveCurrentFile();
        const session =
          workspaceTarget && api.runActivityAction
            ? await api.runActivityAction(workspaceTarget, actionId)
            : await api.runAction(lesson.id, actionId);
        setEventsUrl(session.eventsUrl);
      } finally {
        setBusy(false);
      }
    };

    const reset = async (): Promise<void> => {
      setBusy(true);
      try {
        if (workspaceTarget && api.resetActivityWorkspace) {
          await api.resetActivityWorkspace(workspaceTarget);
        } else {
          await api.resetWorkspace(lesson.id);
        }
        if (selectedFile) {
          const file =
            workspaceTarget && api.readActivityFile
              ? await api.readActivityFile(workspaceTarget, selectedFile)
              : await api.readFile(lesson.id, selectedFile);
          setContent(file.content);
          setSavedContent(file.content);
        }
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
                  onClick={() => {
                    void saveCurrentFile()
                      .then(() => setSelectedFile(file))
                      .catch(() => undefined);
                  }}
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
              onClick={() => {
                void saveCurrentFile().catch(() => undefined);
              }}
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
  },
);
