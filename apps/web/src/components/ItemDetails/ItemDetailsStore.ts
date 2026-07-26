import { createJSONStorage, persist } from "zustand/middleware";
import { create } from "zustand";

const DEFAULT_WIDTH = 288;
const MIN_WIDTH = 240;
const MAX_WIDTH = 380;

export const useItemDetailsOpen = create<{
  isOpen: boolean;
  toggle: () => void;
  setOpen: (v: boolean) => void;
}>()(
  persist(
    (set) => ({
      isOpen: false,
      toggle: () => set((s) => ({ isOpen: !s.isOpen })),
      setOpen: (v: boolean) => set({ isOpen: v }),
    }),
    {
      name: "item-details-open",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

export const useItemDetailsSize = create<{
  width: number;
  setWidth: (value: number) => void;
}>()(
  persist(
    (set) => ({
      width: DEFAULT_WIDTH,
      setWidth: (value: number) => {
        set({
          width: Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, value)),
        });
      },
    }),
    {
      name: "item-details-size",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

export const useItemDetailsEditRequest = create<{
  request: { itemId: string; field: "description"; nonce: number } | null;
  editDescription: (itemId: string) => void;
  clearRequest: () => void;
}>()((set) => ({
  request: null,
  editDescription: (itemId: string) =>
    set({
      request: {
        itemId,
        field: "description",
        nonce: Date.now(),
      },
    }),
  clearRequest: () => set({ request: null }),
}));
