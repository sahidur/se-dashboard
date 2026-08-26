import { create } from 'zustand';

interface UiState {
  /** Whether the off-canvas mobile navigation drawer is open. */
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
}

/**
 * Shared UI state so the hamburger trigger living in the page Header can open
 * the drawer rendered by the Sidebar without prop drilling through the layout.
 */
export const useUiStore = create<UiState>((set) => ({
  mobileNavOpen: false,
  setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
}));
