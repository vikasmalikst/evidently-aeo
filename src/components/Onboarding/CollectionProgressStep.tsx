import React, { useEffect, useState } from 'react';
import { IconCheck, IconLoader2, IconCircleCheckFilled, IconAlertCircle } from '@tabler/icons-react';

interface CollectionProgressStepProps {
  onComplete: () => void;
  brandName: string;
  models: string[];
  topicsCount: number;
  promptsCount: number;
}

interface ProgressItem {
  id: string;
  label: string;
  status: 'pending' | 'loading' | 'completed' | 'error';
  progress: number;
}

export const CollectionProgressStep: React.FC<CollectionProgressStepProps> = ({
  onComplete,
  brandName,
  models,
  topicsCount,
  promptsCount
}) => {
  const [items, setItems] = useState<ProgressItem[]>([
    { id: 'init', label: 'Initializing data collectors', status: 'loading', progress: 0 },
    { id: 'models', label: `Connecting to ${models.length} AI models`, status: 'pending', progress: 0 },
    { id: 'queries', label: `Preparing ${promptsCount} search queries`, status: 'pending', progress: 0 },
    { id: 'collection', label: 'Collecting brand mentions and sentiment', status: 'pending', progress: 0 },
    { id: 'analysis', label: 'Running competitive analysis', status: 'pending', progress: 0 }
  ]);

  const [overallProgress, setOverallProgress] = useState(0);

  useEffect(() => {
    let currentItemIdx = 0;
    const interval = setInterval(() => {
      setItems(prev => {
        const next = [...prev];
        const currentItem = next[currentItemIdx];

        if (currentItem.status === 'pending') {
          currentItem.status = 'loading';
        }

        if (currentItem.status === 'loading') {
          currentItem.progress += Math.random() * 20;
          if (currentItem.progress >= 100) {
            currentItem.progress = 100;
            currentItem.status = 'completed';
            currentItemIdx++;
          }
        }

        return next;
      });

      setOverallProgress(prev => {
        const next = prev + 0.5;
        return next >= 100 ? 100 : next;
      });

      if (currentItemIdx >= items.length) {
        clearInterval(interval);
        setTimeout(onComplete, 1000);
      }
    }, 400);

    return () => clearInterval(interval);
  }, [onComplete, items.length]);

  return (
    <div className="collection-progress-step">
      <div className="onboarding-modal-body p-6">
        <div className="mb-10 text-center">
          <h3 className="text-xl font-semibold text-[var(--text-headings)] mb-2">
            Setting up your Dashboard
          </h3>
          <p className="text-sm text-[var(--text-caption)]">
            We're collecting and analyzing data for <strong>{brandName}</strong> across {models.length} models.
          </p>
        </div>

        <div className="max-w-md mx-auto space-y-8">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm font-bold">
              <span className="text-[var(--text-body)]">Overall Progress</span>
              <span className="text-[var(--accent-primary)]">{Math.round(overallProgress)}%</span>
            </div>
            <div className="h-3 w-full bg-[var(--bg-secondary)] rounded-full overflow-hidden border border-[var(--border-default)]">
              <div 
                className="h-full bg-[var(--accent-primary)] transition-all duration-300 ease-out"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>

          {/* List of Tasks */}
          <div className="space-y-4">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-4">
                <div className="flex-shrink-0">
                  {item.status === 'completed' ? (
                    <IconCircleCheckFilled size={24} className="text-[var(--success500)]" />
                  ) : item.status === 'loading' ? (
                    <IconLoader2 size={24} className="text-[var(--accent-primary)] animate-spin" />
                  ) : item.status === 'error' ? (
                    <IconAlertCircle size={24} className="text-red-500" />
                  ) : (
                    <div className="w-6 h-6 rounded-full border-2 border-[var(--border-default)]" />
                  )}
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-medium ${
                    item.status === 'completed' ? 'text-[var(--text-body)]' : 
                    item.status === 'loading' ? 'text-[var(--accent-primary)]' : 
                    'text-[var(--text-caption)]'
                  }`}>
                    {item.label}
                  </p>
                  {item.status === 'loading' && (
                    <div className="h-1 w-full bg-[var(--bg-secondary)] rounded-full mt-1 overflow-hidden">
                      <div 
                        className="h-full bg-[var(--accent-primary)] transition-all duration-300"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 p-4 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-default)] text-center">
            <p className="text-xs text-[var(--text-caption)] leading-relaxed">
              Please keep this window open. This initial collection usually takes about 1-2 minutes.
              Once finished, you'll be redirected to your new brand dashboard.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
