export type MobilePresentationChapter = 'mobile-alert' | 'mobile-help';
export type MobilePresentationPage = 'home' | 'alerts' | 'area' | 'help' | 'account';
export const isMobilePresentationChapter = (id: string): id is MobilePresentationChapter => id === 'mobile-alert' || id === 'mobile-help';
export const mobilePresentationLocation = { lat: 14.63, lng: 121.10, accuracy: 12 };
export const mobilePresentationHelpNote = 'DEMO: Two people need evacuation transport near the community hall. One person needs mobility assistance.';

export interface MobilePresentationState {
  page: MobilePresentationPage;
  alertOpen: boolean;
  acknowledged: boolean;
  sharing: boolean;
  assistance: string;
  people: number;
  note: string;
  request: null | { status: 'new' | 'assigned'; type: string; people: number; note: string; location: typeof mobilePresentationLocation | null };
}
export type MobilePresentationAction =
  | { type: 'navigate'; page: MobilePresentationPage }
  | { type: 'open-alert' | 'acknowledge' | 'share-location' | 'send-request' | 'assign-team' }
  | { type: 'edit-request'; field: 'assistance' | 'people' | 'note'; value: string };

// Each chapter is replayable without an account, a device permission or a server.
export function createMobilePresentation(chapter: MobilePresentationChapter): MobilePresentationState {
  return { page: 'home', alertOpen: false, acknowledged: chapter === 'mobile-help', sharing: false,
    assistance: 'Medical assistance', people: 1, note: '', request: null };
}
export function mobilePresentationReducer(state: MobilePresentationState, action: MobilePresentationAction): MobilePresentationState {
  switch (action.type) {
    case 'navigate': return { ...state, page: action.page, alertOpen: false };
    case 'open-alert': return { ...state, page: 'alerts', alertOpen: true };
    case 'acknowledge': return state.alertOpen ? { ...state, acknowledged: true } : state;
    case 'share-location': return { ...state, sharing: true };
    case 'edit-request': {
      if (state.request) return state;
      if (action.field === 'people') {
        const people = Number(action.value);
        return Number.isInteger(people) && people >= 1 && people <= 20 ? { ...state, people } : state;
      }
      return action.field === 'note' ? { ...state, note: action.value.slice(0, 500) } : { ...state, assistance: action.value };
    }
    case 'send-request': return state.request || !state.note.trim() ? state : { ...state,
      request: { status: 'new', type: state.assistance, people: state.people, note: state.note.trim(),
        location: state.sharing ? { ...mobilePresentationLocation } : null } };
    case 'assign-team': return state.request ? { ...state, request: { ...state.request, status: 'assigned' } } : state;
  }
}
