import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { QuizBuilder } from '../components/QuizBuilder.tsx';

export {
  type EditorDraft,
  createEmptyQuestion,
  createInitialDraft,
} from '../store.ts';

export function mountEditorView(container: HTMLElement): () => void {
  const root = createRoot(container);
  root.render(createElement(QuizBuilder));
  return () => {
    root.unmount();
  };
}
