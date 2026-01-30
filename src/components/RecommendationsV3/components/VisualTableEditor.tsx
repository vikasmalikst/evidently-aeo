import React, { useState, useEffect, useCallback } from 'react';
import { IconPlus, IconTrash, IconLayoutColumns, IconLayoutRows, IconDeviceFloppy, IconX } from '@tabler/icons-react';

interface VisualTableEditorProps {
    content: string;
    onContentChange: (content: string) => void;
    onClose?: () => void;
}

interface TableModel {
    headers: string[];
    rows: string[][];
    prefix: string;
    suffix: string;
}

/**
 * Visual Table Editor
 * Splits markdown content into prefix, table, and suffix.
 * Allows visual editing of the table parts.
 */
export const VisualTableEditor: React.FC<VisualTableEditorProps> = ({
    content,
    onContentChange,
    onClose
}) => {
    const [model, setModel] = useState<TableModel | null>(null);

    // Parse markdown content into structured model
    useEffect(() => {
        const lines = content.split('\n');
        let tableStart = -1;
        let tableEnd = -1;

        // Find table boundaries
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim().startsWith('|') && lines[i].includes('|')) {
                if (tableStart === -1) tableStart = i;
                tableEnd = i;
            }
        }

        if (tableStart !== -1) {
            const prefix = lines.slice(0, tableStart).join('\n');
            const suffix = lines.slice(tableEnd + 1).join('\n');
            const tableLines = lines.slice(tableStart, tableEnd + 1);

            // Parse headers
            const headerLine = tableLines[0];
            const headers = headerLine.split('|').map(h => h.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);

            // Parse data rows (skip separator row at index 1)
            const dataRows = tableLines.slice(2).map(line => {
                return line.split('|').map(c => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);
            });

            setModel({
                headers: headers.length > 0 ? headers : ['Column 1'],
                rows: dataRows.length > 0 ? dataRows : [['']],
                prefix,
                suffix
            });
        } else {
            // No table found, create a default one
            setModel({
                headers: ['Header 1', 'Header 2'],
                rows: [['Cell 1', 'Cell 2']],
                prefix: content ? content + '\n\n' : '',
                suffix: ''
            });
        }
    }, [content]);

    const updateContent = useCallback((updatedModel: TableModel) => {
        const tableHeader = `| ${updatedModel.headers.join(' | ')} |`;
        const tableDivider = `| ${updatedModel.headers.map(() => '---').join(' | ')} |`;
        const tableRows = updatedModel.rows.map(row => `| ${row.join(' | ')} |`).join('\n');

        const newContent = [
            updatedModel.prefix,
            tableHeader,
            tableDivider,
            tableRows,
            updatedModel.suffix
        ].filter(p => p !== undefined).join('\n').trim();

        onContentChange(newContent);
    }, [onContentChange]);

    if (!model) return null;

    const handleHeaderChange = (idx: number, value: string) => {
        const newHeaders = [...model.headers];
        newHeaders[idx] = value;
        const newModel = { ...model, headers: newHeaders };
        setModel(newModel);
        updateContent(newModel);
    };

    const handleCellChange = (rowIdx: number, colIdx: number, value: string) => {
        const newRows = [...model.rows];
        newRows[rowIdx] = [...newRows[rowIdx]];
        newRows[rowIdx][colIdx] = value;
        const newModel = { ...model, rows: newRows };
        setModel(newModel);
        updateContent(newModel);
    };

    const addRow = () => {
        const newRows = [...model.rows, new Array(model.headers.length).fill('')];
        const newModel = { ...model, rows: newRows };
        setModel(newModel);
        updateContent(newModel);
    };

    const removeRow = (idx: number) => {
        if (model.rows.length <= 1) return;
        const newRows = model.rows.filter((_, i) => i !== idx);
        const newModel = { ...model, rows: newRows };
        setModel(newModel);
        updateContent(newModel);
    };

    const addColumn = () => {
        const newHeaders = [...model.headers, `Column ${model.headers.length + 1}`];
        const newRows = model.rows.map(row => [...row, '']);
        const newModel = { ...model, headers: newHeaders, rows: newRows };
        setModel(newModel);
        updateContent(newModel);
    };

    const removeColumn = (idx: number) => {
        if (model.headers.length <= 1) return;
        const newHeaders = model.headers.filter((_, i) => i !== idx);
        const newRows = model.rows.map(row => row.filter((_, i) => i !== idx));
        const newModel = { ...model, headers: newHeaders, rows: newRows };
        setModel(newModel);
        updateContent(newModel);
    };

    return (
        <div className="visual-table-editor space-y-4">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <button
                        onClick={addRow}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f1f5f9] text-[#475569] hover:bg-[#e2e8f0] rounded-lg text-[12px] font-semibold transition-colors"
                    >
                        <IconLayoutRows size={14} /> Add Row
                    </button>
                    <button
                        onClick={addColumn}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f1f5f9] text-[#475569] hover:bg-[#e2e8f0] rounded-lg text-[12px] font-semibold transition-colors"
                    >
                        <IconLayoutColumns size={14} /> Add Column
                    </button>
                </div>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md"
                    >
                        <IconX size={18} />
                    </button>
                )}
            </div>

            <div className="overflow-x-auto rounded-lg border border-[#e2e8f0] shadow-sm">
                <table className="w-full text-[13px] border-collapse bg-white">
                    <thead className="bg-[#f8fafc] border-b-2 border-[#e2e8f0]">
                        <tr>
                            {model.headers.map((header, idx) => (
                                <th key={idx} className="px-2 py-2 border-r border-[#e2e8f0] min-w-[120px]">
                                    <div className="flex items-center gap-1">
                                        <input
                                            type="text"
                                            value={header}
                                            onChange={(e) => handleHeaderChange(idx, e.target.value)}
                                            className="w-full bg-transparent border-none focus:ring-1 focus:ring-[#00bcdc] rounded px-1 py-1 font-bold text-[#1e293b] text-[13px]"
                                        />
                                        <button
                                            onClick={() => removeColumn(idx)}
                                            className="p-1 text-gray-400 hover:text-red-500 rounded"
                                            title="Remove Column"
                                        >
                                            <IconTrash size={12} />
                                        </button>
                                    </div>
                                </th>
                            ))}
                            <th className="w-8"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {model.rows.map((row, rowIdx) => (
                            <tr key={rowIdx} className="hover:bg-[#f8fafc] group">
                                {row.map((cell, colIdx) => (
                                    <td key={colIdx} className="px-2 py-2 border-b border-[#eff1f5] border-r border-[#eff1f5]">
                                        <textarea
                                            rows={1}
                                            value={cell}
                                            onChange={(e) => handleCellChange(rowIdx, colIdx, e.target.value)}
                                            className="w-full bg-transparent border-none focus:ring-1 focus:ring-[#00bcdc] rounded px-1 py-1 text-[#374151] text-[13px] resize-none overflow-hidden"
                                            style={{ height: 'auto' }}
                                            onInput={(e) => {
                                                const target = e.target as HTMLTextAreaElement;
                                                target.style.height = 'auto';
                                                target.style.height = target.scrollHeight + 'px';
                                            }}
                                        />
                                    </td>
                                ))}
                                <td className="px-2 py-2 border-b border-[#eff1f5] text-center w-8">
                                    <button
                                        onClick={() => removeRow(rowIdx)}
                                        className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity rounded"
                                        title="Remove Row"
                                    >
                                        <IconTrash size={14} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
