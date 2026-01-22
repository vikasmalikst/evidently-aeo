import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AdminState {
    selectedCustomerId: string | null;
    selectedBrandId: string | null;
    setSelectedCustomerId: (id: string | null) => void;
    setSelectedBrandId: (id: string | null) => void;
}

export const useAdminStore = create<AdminState>()(
    persist(
        (set) => ({
            selectedCustomerId: null,
            selectedBrandId: null,
            setSelectedCustomerId: (id) => set({ selectedCustomerId: id, selectedBrandId: null }),
            setSelectedBrandId: (id) => set({ selectedBrandId: id }),
        }),
        {
            name: 'admin-selection-storage',
        }
    )
);
