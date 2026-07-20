import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { LessonDocument } from '@synaploom/contracts';
import { LessonDocumentRenderer } from '#src/features/lesson-content/LessonDocumentRenderer';

const document: LessonDocument = {
  id: 'rich',
  courseId: 'course',
  position: 1,
  title: 'Rich',
  type: 'mixed',
  blocks: [
    {
      type: 'table',
      caption: 'Score table',
      alignments: ['left', 'right'],
      header: {
        cells: [
          { children: [{ type: 'text', value: 'Name' }] },
          { children: [{ type: 'text', value: 'Score' }] },
        ],
      },
      rows: [
        {
          cells: [
            { children: [{ type: 'text', value: 'Ada' }] },
            { children: [{ type: 'text', value: '10' }] },
          ],
        },
      ],
    },
    {
      type: 'details',
      summary: [{ type: 'text', value: 'Show explanation' }],
      blocks: [{ type: 'paragraph', children: [{ type: 'text', value: 'Hidden details' }] }],
    },
    {
      type: 'tabs',
      tabs: [
        {
          id: 'first',
          label: 'First',
          blocks: [{ type: 'paragraph', children: [{ type: 'text', value: 'First panel' }] }],
        },
        {
          id: 'second',
          label: 'Second',
          blocks: [{ type: 'paragraph', children: [{ type: 'text', value: 'Second panel' }] }],
        },
      ],
    },
    { type: 'math', source: '\\not-a-real-command{' },
    {
      type: 'audio',
      source: '/assets/audio.mp3',
      title: 'Listening',
      transcript: [{ type: 'paragraph', children: [{ type: 'text', value: 'Audio transcript' }] }],
    },
    {
      type: 'paragraph',
      children: [
        {
          type: 'link',
          href: 'https://example.com',
          external: true,
          children: [{ type: 'text', value: 'External' }],
        },
      ],
    },
    { type: 'activity', activityId: 'quiz-1' },
  ],
};

describe('LessonDocumentRenderer', () => {
  it('renders rich semantic blocks without parsing Markdown in the browser', () => {
    const renderActivity = vi.fn((id: string) => <div>Activity {id}</div>);
    render(<LessonDocumentRenderer document={document} renderActivity={renderActivity} />);

    const table = screen.getByRole('table', { name: 'Score table' });
    expect(table).toBeVisible();
    expect(screen.getByText('Hidden details')).toBeInTheDocument();
    expect(screen.getByText('Audio transcript')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'External' })).toHaveAttribute(
      'rel',
      'noreferrer noopener',
    );
    expect(screen.getByText('Activity quiz-1')).toBeVisible();
    expect(renderActivity).toHaveBeenCalledWith('quiz-1');
    expect(screen.getByText('\\not-a-real-command{')).toBeVisible();
  });

  it('supports keyboard tab selection', () => {
    render(<LessonDocumentRenderer document={document} renderActivity={() => null} />);
    const first = screen.getByRole('tab', { name: 'First' });
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Second' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Second panel')).toBeVisible();
  });

  it('converts GitHub-style note blockquotes into callout chrome', () => {
    const noteDocument: LessonDocument = {
      ...document,
      blocks: [
        {
          type: 'blockquote',
          blocks: [
            { type: 'paragraph', children: [{ type: 'text', value: '[!NOTE]' }] },
            {
              type: 'paragraph',
              children: [{ type: 'text', value: 'Thứ tự bước là một phần của tính đúng đắn.' }],
            },
          ],
        },
      ],
    };
    render(<LessonDocumentRenderer document={noteDocument} renderActivity={() => null} />);
    expect(screen.getByRole('note', { name: 'Ghi chú' })).toHaveTextContent(
      'Thứ tự bước là một phần của tính đúng đắn.',
    );
    expect(screen.queryByText('[!NOTE]')).not.toBeInTheDocument();
  });
  it('converts parser-coalesced note blockquotes into callout chrome', () => {
    const noteDocument: LessonDocument = {
      ...document,
      blocks: [
        {
          type: 'blockquote',
          blocks: [
            {
              type: 'paragraph',
              children: [
                {
                  type: 'text',
                  value: '[!NOTE]\nThứ tự bước là một phần của tính đúng đắn.',
                },
              ],
            },
          ],
        },
      ],
    };
    render(<LessonDocumentRenderer document={noteDocument} renderActivity={() => null} />);
    expect(screen.getByRole('note', { name: 'Ghi chú' })).toHaveTextContent(
      'Thứ tự bước là một phần của tính đúng đắn.',
    );
    expect(screen.queryByText(/\[!NOTE\]/)).not.toBeInTheDocument();
  });
});
