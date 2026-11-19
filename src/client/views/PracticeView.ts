import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { PracticeMode } from '../components/PracticeMode.tsx';

export function mountPracticeView(container: HTMLElement): () => void {
  const root = createRoot(container);
  root.render(createElement(PracticeMode));
  return () => {
    root.unmount();
  };
}
