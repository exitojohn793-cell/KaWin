import { renderFooter } from './client/components/Footer.ts';
import { type AppRoute, renderTopBar } from './client/components/TopBar.ts';
import { escapeHtml } from './client/components/Shapes.ts';
import { appStore } from './client/store.ts';
import { mountEditorView } from './client/views/EditorView.ts';
import { renderHomeView } from './client/views/HomeView.ts';
import { mountHostView } from './client/views/HostView.ts';
import { renderLibraryView } from './client/views/LibraryView.ts';
import { renderPlayerView } from './client/views/PlayerView.ts';
import { mountPracticeView } from './client/views/PracticeView.ts';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element #root not found');
}

root.innerHTML = `
  <div class="studio-backdrop flex min-h-screen flex-col">
    <div id="topbar-slot"></div>
    <div id="toast-slot" class="pointer-events-none fixed right-4 top-20 z-50"></div>
    <main id="main-slot" class="flex-1"></main>
    <div id="footer-slot"></div>
  </div>
`;

const topbarSlot = document.getElementById('topbar-slot')!;
const toastSlot = document.getElementById('toast-slot')!;
const mainSlot = document.getElementById('main-slot')!;
const footerSlot = document.getElementById('footer-slot')!;

let cleanupView: (() => void) | null = null;
let mountedReactRoute: 'editor' | 'host' | 'practice' | null = null;
let lastRenderedVisitor = '';
let lastRenderedToast: string | null = null;

function renderShell(): void {
  const state = appStore.getState();

  document.body.dataset.state = state.route;

  renderTopBar(topbarSlot, {
    activeRoute: state.route,
    wsConnected: state.wsConnected,
    muted: state.muted,
    onNavigate: (r: AppRoute) => appStore.setRoute(r),
    onToggleMute: () => appStore.toggleMute(),
    onQuickHost: () => {
      if (state.hostSession.roomState || state.quizzes.length > 0) {
        appStore.setRoute('host');
      } else {
        appStore.openEditorForQuiz();
      }
    },
  });

  if (state.visitorFormatted !== lastRenderedVisitor) {
    lastRenderedVisitor = state.visitorFormatted;
    renderFooter(footerSlot, state.visitorFormatted);
  }

  if (state.toast !== lastRenderedToast) {
    lastRenderedToast = state.toast;
    toastSlot.innerHTML = state.toast
      ? `
        <div class="rounded-xl border border-amber-400/40 bg-[#131B31] px-4 py-2.5 text-sm font-semibold text-white shadow-xl">
          ${escapeHtml(state.toast)}
        </div>
      `
      : '';
  }

  // Keep React views mounted continuously while on editor, host, or practice so internal
  // useSyncExternalStore updates never lose input focus or reset timers.
  if (
    state.route === 'editor' ||
    state.route === 'host' ||
    state.route === 'practice'
  ) {
    if (mountedReactRoute === state.route) {
      return;
    }
    if (cleanupView) {
      cleanupView();
      cleanupView = null;
    }
    mainSlot.innerHTML = '';
    mountedReactRoute = state.route;
    cleanupView =
      state.route === 'editor'
        ? mountEditorView(mainSlot)
        : state.route === 'host'
          ? mountHostView(mainSlot)
          : mountPracticeView(mainSlot);
    return;
  }

  if (cleanupView) {
    cleanupView();
    cleanupView = null;
  }
  mountedReactRoute = null;

  switch (state.route) {
    case 'home':
      renderHomeView(mainSlot, {
        quizzes: state.quizzes,
        onJoinPin: async (pin) => {
          await appStore.checkAndGoToJoin(pin);
        },
        onStartHost: (quizId) => appStore.startHostRoom(quizId),
        onEditQuiz: (quizId) => appStore.openEditorForQuiz(quizId),
        onCreateNew: () => appStore.openEditorForQuiz(),
        onOpenLibrary: () => appStore.setRoute('library'),
      });
      break;

    case 'join':
      cleanupView = renderPlayerView(mainSlot, {
        session: state.playerSession,
        onPinInput: (pin) => {
          void appStore.refreshJoinRoomMeta(pin);
        },
        onJoinSubmit: (pin, nickname, avatar, teamName) =>
          appStore.submitPlayerJoin(pin, nickname, avatar, teamName),
        onSubmitAnswer: (optionIndex) => appStore.submitPlayerAnswer(optionIndex),
        onSendReaction: (emoji) => appStore.sendPlayerReaction(emoji),
        onLeaveRoom: () => appStore.leavePlayerRoom(),
      });
      break;

    case 'library':
      renderLibraryView(
        mainSlot,
        {
          quizzes: state.quizzes,
          onStartHost: (quizId) => appStore.startHostRoom(quizId),
          onPracticeQuiz: (quizId) => appStore.startPractice(quizId),
          onEditQuiz: (quizId) => appStore.openEditorForQuiz(quizId),
          onDuplicateQuiz: (quiz) => appStore.duplicateQuizInLibrary(quiz),
          onDeleteQuiz: (quizId) => appStore.deleteQuizFromLibrary(quizId),
          onCreateNew: () => appStore.openEditorForQuiz(),
          onImportJson: (rawJson) => appStore.importQuizJson(rawJson),
        },
        state.libraryFilter
      );
      break;
  }
}

renderFooter(footerSlot, appStore.getState().visitorFormatted);
appStore.subscribe(renderShell);
appStore.init();
renderShell();
