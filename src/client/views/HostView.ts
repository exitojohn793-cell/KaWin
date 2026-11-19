import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { PresenterPanel } from '../components/PresenterPanel.tsx';

export { type HostSessionState } from '../store.ts';

export function mountHostView(container: HTMLElement): () => void {
  const root = createRoot(container);
  root.render(createElement(PresenterPanel));
  return () => {
    root.unmount();
  };
}
