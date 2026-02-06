import { useState, useRef, useCallback } from 'react';
import { IconUpload, IconFileCode, IconAlertTriangle } from '@tabler/icons-react';
import { z } from 'zod';

interface UploadStepProps {
    onNext: (data: any) => void;
}

// Basic Schema Validation
const CompanyProfileSchema = z.object({
    company_name: z.string(),
    website: z.string().url(),
});

const CompetitorSchema = z.object({
    company_name: z.string(),
    domain: z.string(),
});

const JSONSchema = z.object({
    company_profile: CompanyProfileSchema,
    competitors: z.array(CompetitorSchema),
    // Allow other fields loosely for now, will validate loosely
});

export const UploadStep = ({ onNext }: UploadStepProps) => {
    const [isDragOver, setIsDragOver] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isParsing, setIsParsing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
    };

    const processFile = useCallback((selectedFile: File) => {
        setError(null);
        if (!selectedFile.name.endsWith('.json')) {
            setError('Please upload a valid JSON file.');
            return;
        }
        setFile(selectedFile);
    }, []);

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        if (e.dataTransfer.files?.[0]) {
            processFile(e.dataTransfer.files[0]);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            processFile(e.target.files[0]);
        }
    };

    const handleParseAndContinue = async () => {
        if (!file) return;

        setIsParsing(true);
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target?.result as string);

                // Validate Structure
                const result = JSONSchema.safeParse(json);

                if (!result.success) {
                    console.error(result.error);
                    setError('Invalid JSON structure. Missing required fields (company_profile, competitors).');
                    setIsParsing(false);
                    return;
                }

                // Basic mapping to flatten the structure slightly if needed, or pass as is
                // We'll map fields more concretely in the next steps
                onNext({
                    brand_name: json.company_profile.company_name,
                    website_url: json.company_profile.website,
                    description: json.company_profile.description,
                    industry: json.company_profile.industry,
                    competitors: json.competitors,
                    // Pass raw prompts arrays
                    biased_prompts: json.biased_prompts,
                    blind_prompts: json.blind_prompts
                });

            } catch (err) {
                setError('Failed to parse JSON file. Syntax error.');
                setIsParsing(false);
            }
        };

        reader.readAsText(file);
    };

    return (
        <div className="max-w-2xl mx-auto text-center">
            <div className="mb-8">
                <h2 className="text-2xl font-bold text-[var(--text-headings)]">Upload Onboarding Report</h2>
                <p className="text-[var(--text-caption)] mt-2">
                    Upload the JSON research report to automatically extract brand, competitor, and query data.
                </p>
            </div>

            <div
                className={`border-2 border-dashed rounded-xl p-12 transition-all cursor-pointer ${isDragOver
                        ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/5'
                        : file
                            ? 'border-green-500 bg-green-50'
                            : 'border-gray-200 hover:border-[var(--accent-primary)] hover:bg-gray-50'
                    }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
            >
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".json"
                    onChange={handleFileSelect}
                />

                {file ? (
                    <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
                        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                            <IconFileCode size={32} />
                        </div>
                        <p className="text-lg font-medium text-[var(--text-headings)]">{file.name}</p>
                        <p className="text-sm text-[var(--text-caption)]">{(file.size / 1024).toFixed(1)} KB</p>
                        <button
                            onClick={(e) => { e.stopPropagation(); setFile(null); }}
                            className="mt-4 text-sm text-[var(--text-caption)] hover:text-red-500 transition-colors pointer-events-auto"
                        >
                            Change File
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col items-center">
                        <div className="w-16 h-16 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mb-4">
                            <IconUpload size={32} />
                        </div>
                        <p className="text-lg font-medium text-[var(--text-headings)]">
                            Click to upload or drag and drop
                        </p>
                        <p className="text-sm text-[var(--text-caption)] mt-1">
                            JSON files only
                        </p>
                    </div>
                )}
            </div>

            {error && (
                <div className="mt-6 p-4 bg-red-50 border border-red-100 rounded-lg flex items-center gap-3 text-left animate-in slide-in-from-top-2">
                    <IconAlertTriangle className="text-red-500 flex-shrink-0" />
                    <div>
                        <p className="text-sm font-bold text-red-700">Validation Error</p>
                        <p className="text-xs text-red-600">{error}</p>
                    </div>
                </div>
            )}

            <div className="mt-8">
                <button
                    onClick={handleParseAndContinue}
                    disabled={!file || isParsing}
                    className={`px-8 py-3 rounded-lg font-medium text-white transition-all shadow-lg hover:shadow-xl active:scale-95 ${!file || isParsing
                            ? 'bg-gray-300 cursor-not-allowed shadow-none'
                            : 'bg-[var(--accent-primary)] hover:opacity-90'
                        }`}
                >
                    {isParsing ? 'Processing...' : 'Continue to Review'}
                </button>
            </div>
        </div>
    );
};
