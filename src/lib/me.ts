import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** "I am this player" on this device: lets teammates vote and comment without an account. */
export const useMe = create<{ playerId: string | null; set: (id: string | null) => void }>()(
  persist(
    set => ({ playerId: null, set: playerId => set({ playerId }) }),
    {
      name: 'chukgubang:me',
      storage: createJSONStorage(() => ({
        getItem: k => { try { return localStorage.getItem(k); } catch { return null; } },
        setItem: (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
        removeItem: k => { try { localStorage.removeItem(k); } catch { /* ignore */ } },
      })),
    },
  ),
);
