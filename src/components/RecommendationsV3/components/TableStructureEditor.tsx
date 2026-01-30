import React, { useState, useEffect } from 'react';
import { IconPlus, IconTrash, IconX } from '@tabler/icons-react';

interface TableStructureEditorProps {
    content: string;
    onChange: (newContent: string) => void;
}

export const TableStructureEditor: React.FC<TableStructureEditorProps> = ({ content, onChange }) => {
    const [rows, setRows] = useState<string[][]>([]);

    useEffect(() => {
        // Parse markdown table
        const lines = content.split('\n').filter(line => line.trim() !== '');
        
        const parsedRows: string[][] = [];
        
        for (const line of lines) {
            // Check if it's a separator line (contains only | and - and :)
            if (/^[\s|:-]+$/.test(line)) {
                continue;
            }
            
            // Extract cells
            const cells = line.split('|').map(cell => cell.trim());
            
            // Remove first and last empty elements if they exist (standard markdown format usually has leading/trailing pipes)
            if (cells.length > 0 && cells[0] === '') cells.shift();
            if (cells.length > 0 && cells[cells.length - 1] === '') cells.pop();
            
            parsedRows.push(cells);
        }

        // Ensure at least one cell if empty
        if (parsedRows.length === 0) {
            parsedRows.push(['Feature', 'Option A', 'Option B']);
        }
        
        setRows(parsedRows);
    }, []); // Run only on mount to avoid cursor jumping issues if we re-parse on every type

    const updateContent = (newRows: string[][]) => {
        setRows(newRows);
        
        if (newRows.length === 0) {
            onChange('');
            return;
        }

        const header = newRows[0];
        const separator = header.map(() => '---');
        
        const lines = [
            `| ${header.join(' | ')} |`,
            `| ${separator.join('|')} |`
        ];

        for (let i = 1; i < newRows.length; i++) {
            lines.push(`| ${newRows[i].join(' | ')} |`);
        }
        
        onChange(lines.join('\n'));
    };

    const handleCellChange = (rowIndex: number, colIndex: number, value: string) => {
        const newRows = [...rows];
        newRows[rowIndex] = [...newRows[rowIndex]];
        newRows[rowIndex][colIndex] = value;
        updateContent(newRows);
    };

    const addColumn = () => {
        const newRows = rows.map(row => [...row, 'New Col']);
        updateContent(newRows);
    };

    const removeColumn = (colIndex: number) => {
        if (rows[0].length <= 1) return; // Prevent removing last column
        const newRows = rows.map(row => row.filter((_, index) => index !== colIndex));
        updateContent(newRows);
    };

    const addRow = () => {
        const colCount = rows[0]?.length || 1;
        const newRow = Array(colCount).fill('Value');
        const newRows = [...rows, newRow];
        updateContent(newRows);
    };

    const removeRow = (rowIndex: number) => {
        if (rows.length <= 1) return; // Prevent removing last row (header)
        const newRows = rows.filter((_, index) => index !== rowIndex);
        updateContent(newRows);
    };

    if (rows.length === 0) return <div>Loading table...</div>;

    return (
        <div className="w-full overflow-x-auto border border-slate-200 rounded-lg shadow-sm bg-white">
            <table className="w-full text-sm text-left text-slate-600">
                <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
                    <tr>
                        {rows[0].map((header, colIndex) => (
                            <th key={`header-${colIndex}`} className="px-4 py-3 min-w-[150px] relative group">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={header}
                                        onChange={(e) => handleCellChange(0, colIndex, e.target.value)}
                                        className="bg-transparent font-bold w-full focus:outline-none focus:border-b-2 focus:border-blue-500"
                                    />
                                    <button 
                                        onClick={() => removeColumn(colIndex)}
                                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-opacity p-1"
                                        title="Remove Column"
                                    >
                                        <IconX size={14} />
                                    </button>
                                </div>
                            </th>
                        ))}
                        <th className="px-2 py-3 w-[50px] text-center border-l border-slate-100">
                             <button 
                                onClick={addColumn}
                                className="text-blue-500 hover:text-blue-700 p-1 hover:bg-blue-50 rounded"
                                title="Add Column"
                            >
                                <IconPlus size={16} />
                            </button>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {rows.slice(1).map((row, rowIndex) => (
                        <tr key={`row-${rowIndex + 1}`} className="bg-white border-b border-slate-100 hover:bg-slate-50/50">
                            {row.map((cell, colIndex) => (
                                <td key={`cell-${rowIndex + 1}-${colIndex}`} className="px-4 py-2 border-r border-slate-50 last:border-r-0">
                                    <input
                                        type="text"
                                        value={cell}
                                        onChange={(e) => handleCellChange(rowIndex + 1, colIndex, e.target.value)}
                                        className="w-full bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-100 rounded px-1 py-1"
                                    />
                                </td>
                            ))}
                            <td className="px-2 py-2 text-center border-l border-slate-100">
                                <button 
                                    onClick={() => removeRow(rowIndex + 1)}
                                    className="text-slate-300 hover:text-red-500 p-1 hover:bg-red-50 rounded transition-colors"
                                    title="Remove Row"
                                >
                                    <IconTrash size={14} />
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <div className="p-3 border-t border-slate-100 bg-slate-50/30 flex justify-center">
                <button 
                    onClick={addRow}
                    className="flex items-center gap-2 text-xs font-semibold text-blue-600 hover:text-blue-700 px-4 py-2 hover:bg-blue-50 rounded-md transition-colors"
                >
                    <IconPlus size={14} />
                    Add Row
                </button>
            </div>
        </div>
    );
};
