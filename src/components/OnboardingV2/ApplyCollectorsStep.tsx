import { AIModelSelection } from '../Onboarding/AIModelSelection';

interface ApplyCollectorsStepProps {
    data: any;
    selectedModels: string[];
    updateData: (data: any) => void;
    onNext: () => void;
    onBack: () => void;
    onModelToggle: (modelId: string) => void;
}

export const ApplyCollectorsStep = ({
    selectedModels,
    onNext,
    onBack,
    onModelToggle
}: ApplyCollectorsStepProps) => {
    return (
        <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="mb-0">
                <AIModelSelection
                    selectedModels={selectedModels}
                    onModelToggle={onModelToggle}
                />
            </div>

            <div className="flex justify-between mt-8 pt-6 border-t border-gray-100 mb-6 px-10">
                <button
                    onClick={onBack}
                    className="px-6 py-2.5 text-sm font-medium text-[var(--text-caption)] hover:text-[var(--text-headings)] hover:bg-gray-50 rounded-lg transition-colors border border-transparent hover:border-gray-200"
                >
                    Back
                </button>
                <button
                    onClick={onNext}
                    disabled={selectedModels.length === 0}
                    className="px-8 py-2.5 bg-[var(--accent-primary)] text-white rounded-lg font-medium hover:opacity-90 transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Continue to Enrichment
                </button>
            </div>
        </div>
    );
};
