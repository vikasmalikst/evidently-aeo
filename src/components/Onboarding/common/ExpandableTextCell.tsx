import { useState, useRef, useEffect } from 'react';
import { Edit2, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ExpandableTextCellProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export const ExpandableTextCell = ({ value, onChange, placeholder, disabled }: ExpandableTextCellProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isExpanded && textareaRef.current) {
      textareaRef.current.focus();
      // Move cursor to end
      const length = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(length, length);
    }
  }, [isExpanded]);

  // Handle click outside to collapse
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (textareaRef.current && !textareaRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
      }
    };

    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExpanded]);

  if (isExpanded) {
    return (
      <div className="relative z-10">
        <div className="fixed inset-0 z-0 bg-transparent" onClick={() => setIsExpanded(false)} />
        <div className="relative z-10">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            rows={5}
            className="w-full px-4 py-3 pr-10 bg-white border-2 border-cyan-500 rounded-xl text-sm leading-relaxed shadow-lg focus:outline-none resize-none transition-all"
            style={{ minWidth: '100%' }}
          />
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(false);
            }}
            className="absolute top-3 right-3 p-1.5 text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors cursor-pointer"
            title="Collapse"
            type="button"
          >
            <ChevronUp size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => !disabled && setIsExpanded(true)}
      className={`
        group relative w-full px-3 py-2 min-h-[42px] bg-white border border-gray-200 rounded-xl text-sm 
        cursor-pointer hover:border-cyan-400 hover:shadow-sm transition-all duration-200
        ${disabled ? 'opacity-60 cursor-not-allowed' : ''}
      `}
    >
      <div className="line-clamp-2 text-gray-700 leading-relaxed pr-8">
        {value || <span className="text-gray-400 italic">{placeholder}</span>}
      </div>
      {!disabled && (
        <div className="absolute top-3 right-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200 transform group-hover:scale-110">
          <Edit2 size={14} />
        </div>
      )}
    </div>
  );
};
