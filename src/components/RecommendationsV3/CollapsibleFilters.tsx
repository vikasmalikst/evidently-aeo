/**
 * Collapsible Filters Component
 * Wraps multiple filter dropdowns into a single expandable panel
 */

import React, { useState, useRef, useEffect } from 'react';
import { IconFilter, IconChevronDown, IconX } from '@tabler/icons-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CollapsibleFiltersProps {
    children: React.ReactNode;
    activeFilterCount?: number;
    onClearAll?: () => void;
}

export const CollapsibleFilters = ({
    children,
    activeFilterCount = 0,
    onClearAll
}: CollapsibleFiltersProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    return (
        <div className="relative" ref={panelRef}>
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-200 ${isOpen
                        ? 'bg-[#00bcdc] text-white border-[#00bcdc] shadow-md'
                        : activeFilterCount > 0
                            ? 'bg-[#f0f9ff] text-[#00bcdc] border-[#00bcdc]/30 hover:border-[#00bcdc]'
                            : 'bg-white text-[#64748b] border-[#e2e8f0] hover:border-[#cbd5e1] hover:bg-[#f8fafc]'
                    }`}
            >
                <IconFilter size={16} />
                <span className="text-[13px] font-medium">Filters</span>
                {activeFilterCount > 0 && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isOpen ? 'bg-white/20 text-white' : 'bg-[#00bcdc] text-white'
                        }`}>
                        {activeFilterCount}
                    </span>
                )}
                <IconChevronDown
                    size={14}
                    className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>

            {/* Dropdown Panel */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-full right-0 mt-2 bg-white rounded-xl border border-[#e2e8f0] shadow-xl p-4 z-50 min-w-[280px]"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-3 pb-3 border-b border-[#f1f5f9]">
                            <span className="text-[12px] font-semibold text-[#64748b] uppercase tracking-wide">
                                Filter Options
                            </span>
                            {activeFilterCount > 0 && onClearAll && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onClearAll();
                                    }}
                                    className="flex items-center gap-1 text-[11px] text-[#ef4444] hover:text-[#dc2626] font-medium transition-colors"
                                >
                                    <IconX size={12} />
                                    Clear all
                                </button>
                            )}
                        </div>

                        {/* Filter Controls */}
                        <div className="flex flex-col gap-3">
                            {children}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
