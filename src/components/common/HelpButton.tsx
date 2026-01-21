import React from 'react';
import { HelpCircle } from 'lucide-react';

interface HelpButtonProps {
    onClick: (e?: React.MouseEvent) => void;
    label?: string;
    size?: number;
    className?: string;
}

export const HelpButton = ({
    onClick,
    label = "Get help",
    size = 18,
    className = ""
}: HelpButtonProps) => {
    return (
        <button
            onClick={onClick}
            className={`group relative flex items-center justify-center rounded-full bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white transition-all duration-200 shadow-sm hover:shadow-md hover:scale-105 active:scale-95 ${className}`}
            style={{
                width: size + 10,
                height: size + 10,
                minWidth: size + 10,
                minHeight: size + 10
            }}
            aria-label={label}
            type="button"
        >
            <HelpCircle size={size} strokeWidth={2.5} className="text-white" />

            {/* Optional: subtle pulse effect to draw attention if needed, but maybe too much? 
          User said "prominent", solid color is usually enough. keeping it clean. */}
        </button>
    );
};
