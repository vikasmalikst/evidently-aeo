import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type { Recommendation, RecommendationGeneratedContent } from '../../../api/recommendationsApi';
import {
  fetchRecommendationContentLatest,
  generateRecommendationContent,
  updateRecommendationContentStatus
} from '../../../api/recommendationsApi';

type GeneratedContentJsonV1 = {
  version: '1.0';
  recommendationId: string;
  brandName: string;
  targetSource: { domain: string; mode: 'post_on_source' | 'pitch_collaboration'; rationale: string };
  deliverable: { type: string; placement: string };
  whatToPublishOrSend: { subjectLine?: string; readyToPaste: string; cta: string };
  keyPoints: string[];
  seoAeo: { h1: string; h2: string[]; faq: string[]; snippetSummary: string };
  requiredInputs: string[];
  complianceNotes: string[];
};

interface RecommendationContentModalProps {
  isOpen: boolean;
  onClose: () => void;
  recommendation: Recommendation | null;
}

const StatusPill = ({ status }: { status: RecommendationGeneratedContent['status'] }) => {
  const cfg: Record<string, { label: string; cls: string }> = {
    generated: { label: 'Draft', cls: 'bg-[#f1f5f9] text-[#334155] border-[#e2e8f0]' },
    accepted: { label: 'Accepted', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    rejected: { label: 'Rejected', cls: 'bg-rose-50 text-rose-700 border-rose-200' }
  };
  const { label, cls } = cfg[status] || cfg.generated;
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border ${cls}`}>
      {label}
    </span>
  );
};

export const RecommendationContentModal = ({ isOpen, onClose, recommendation }: RecommendationContentModalProps) => {
  const recommendationId = recommendation?.id;
  const title = useMemo(() => recommendation?.action || 'Generate Content', [recommendation]);

  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [record, setRecord] = useState<RecommendationGeneratedContent | null>(null);

  const canGenerate = Boolean(recommendationId);

  const parsedJson = useMemo<GeneratedContentJsonV1 | null>(() => {
    if (!record?.content) return null;
    try {
      const parsed = JSON.parse(record.content);
      if (parsed?.version === '1.0' && parsed?.whatToPublishOrSend?.readyToPaste) {
        return parsed as GeneratedContentJsonV1;
      }
      return null;
    } catch {
      return null;
    }
  }, [record?.content]);

  const loadLatest = async () => {
    if (!recommendationId) return;
    setIsFetching(true);
    setError(null);
    try {
      const resp = await fetchRecommendationContentLatest(recommendationId);
      if (resp.success) {
        setRecord(resp.data?.content || null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load latest content');
    } finally {
      setIsFetching(false);
    }
  };

  const doGenerate = async () => {
    if (!recommendationId) return;
    setIsLoading(true);
    setError(null);
    try {
      const resp = await generateRecommendationContent(recommendationId, 'draft');
      if (!resp.success || !resp.data?.content) {
        setError(resp.error || 'Failed to generate content');
        return;
      }
      setRecord(resp.data.content);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate content');
    } finally {
      setIsLoading(false);
    }
  };

  const updateStatus = async (status: 'accepted' | 'rejected') => {
    if (!record?.id) return;
    setIsLoading(true);
    setError(null);
    try {
      const resp = await updateRecommendationContentStatus(record.id, status);
      if (!resp.success || !resp.data?.content) {
        setError(resp.error || 'Failed to update status');
        return;
      }
      setRecord(resp.data.content);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update status');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setRecord(null);

    // Load latest draft; user can explicitly generate/regenerate.
    (async () => {
      await loadLatest();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, recommendationId]);

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="recommendation-content-modal-title"
      />

      <div
        className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[51] bg-white rounded-lg shadow-xl w-[95%] sm:w-[90%] max-w-[880px] max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-4 sm:p-6 border-b border-[var(--border-default)] gap-4">
          <div className="flex-1 min-w-0">
            <h2
              id="recommendation-content-modal-title"
              className="text-lg sm:text-xl font-semibold text-[var(--text-headings)] mb-2"
              title={title}
              style={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden'
              }}
            >
              {title}
            </h2>
            <div className="flex items-center gap-2 flex-wrap">
              {record?.status && <StatusPill status={record.status} />}
              {record?.model_provider && (
                <span className="text-[12px] text-[var(--text-caption)]">
                  Provider: <span className="font-medium text-[var(--text-body)]">{record.model_provider}</span>
                  {record.model_name ? (
                    <> · Model: <span className="font-medium text-[var(--text-body)]">{record.model_name}</span></>
                  ) : null}
                </span>
              )}
              {recommendation && (
                <span className="text-[12px] text-[var(--text-caption)]">
                  KPI: <span className="font-medium text-[var(--text-body)]">{recommendation.kpi}</span>
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors flex-shrink-0"
            aria-label="Close modal"
          >
            <X size={20} className="text-[var(--text-body)]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {!canGenerate && (
            <div className="bg-[#fff7ed] border border-[#fed7aa] rounded-lg p-4 text-[13px] text-[#9a3412]">
              This recommendation doesn’t have a persisted ID yet. Please wait a moment for the page to sync (it fetches from DB after generation), then try again.
            </div>
          )}

          {(isFetching || isLoading) && !record && (
            <div className="text-center py-10 text-[var(--text-caption)]">
              <div className="inline-block h-8 w-8 rounded-full border-2 border-t-transparent border-[var(--accent-primary)] animate-spin mb-3"></div>
              <p className="text-sm">{isFetching ? 'Loading latest…' : 'Generating content…'}</p>
            </div>
          )}

          {error && (
            <div className="bg-[#fef2f2] border border-[#fecaca] rounded-lg p-4 mb-4 text-[13px] text-[#991b1b]">
              {error}
            </div>
          )}

          {record?.content && parsedJson && (
            <div className="space-y-3">
              <div className="text-[12px] text-[var(--text-caption)]">
                Generated at: {new Date(record.created_at).toLocaleString()}
              </div>

              <div className="rounded-lg border border-[var(--border-default)] bg-white overflow-hidden">
                <div className="p-4 border-b border-[var(--border-default)]">
                  <div className="text-[11px] uppercase tracking-wide text-[var(--text-caption)]">Target</div>
                  <div className="text-[13px] text-[var(--text-body)] font-medium">
                    {parsedJson.targetSource.domain} · {parsedJson.targetSource.mode === 'pitch_collaboration' ? 'Pitch collaboration' : 'Post on source'}
                  </div>
                  {parsedJson.targetSource.rationale && (
                    <div className="text-[12px] text-[var(--text-caption)] mt-1">{parsedJson.targetSource.rationale}</div>
                  )}
                </div>

                <div className="p-4 space-y-4">
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-[var(--text-caption)] mb-1">Deliverable</div>
                    <div className="text-[13px] text-[var(--text-body)]">
                      <span className="font-medium">{parsedJson.deliverable.type}</span>
                      {parsedJson.deliverable.placement ? <> · {parsedJson.deliverable.placement}</> : null}
                    </div>
                  </div>

                  {parsedJson.whatToPublishOrSend.subjectLine && (
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-[var(--text-caption)] mb-1">Subject line</div>
                      <div className="text-[13px] text-[var(--text-body)] font-medium">
                        {parsedJson.whatToPublishOrSend.subjectLine}
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-[var(--text-caption)] mb-1">
                      {parsedJson.targetSource.mode === 'pitch_collaboration' ? 'Ready-to-send pitch' : 'Ready-to-paste content'}
                    </div>
                    <textarea
                      value={parsedJson.whatToPublishOrSend.readyToPaste}
                      readOnly
                      className="w-full min-h-[260px] p-3 rounded-lg border border-[var(--border-default)] text-[13px] text-[var(--text-body)] bg-white focus:outline-none"
                    />
                    {parsedJson.whatToPublishOrSend.cta && (
                      <div className="text-[12px] text-[var(--text-caption)] mt-2">
                        Next step: <span className="font-medium text-[var(--text-body)]">{parsedJson.whatToPublishOrSend.cta}</span>
                      </div>
                    )}
                  </div>

                  {parsedJson.keyPoints?.length > 0 && (
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-[var(--text-caption)] mb-2">Key points</div>
                      <ul className="list-disc pl-5 space-y-1">
                        {parsedJson.keyPoints.map((p, idx) => (
                          <li key={idx} className="text-[13px] text-[var(--text-body)]">{p}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-[var(--text-caption)] mb-2">AEO/SEO structure</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="rounded-lg border border-[var(--border-default)] p-3">
                        <div className="text-[11px] text-[var(--text-caption)] mb-1">H1</div>
                        <div className="text-[13px] text-[var(--text-body)] font-medium">{parsedJson.seoAeo.h1 || '—'}</div>
                      </div>
                      <div className="rounded-lg border border-[var(--border-default)] p-3">
                        <div className="text-[11px] text-[var(--text-caption)] mb-1">Snippet summary</div>
                        <div className="text-[13px] text-[var(--text-body)]">{parsedJson.seoAeo.snippetSummary || '—'}</div>
                      </div>
                      <div className="rounded-lg border border-[var(--border-default)] p-3">
                        <div className="text-[11px] text-[var(--text-caption)] mb-1">H2s</div>
                        <ul className="list-disc pl-5 space-y-1">
                          {(parsedJson.seoAeo.h2 || []).map((h, idx) => (
                            <li key={idx} className="text-[13px] text-[var(--text-body)]">{h}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-lg border border-[var(--border-default)] p-3">
                        <div className="text-[11px] text-[var(--text-caption)] mb-1">FAQs</div>
                        <ul className="list-disc pl-5 space-y-1">
                          {(parsedJson.seoAeo.faq || []).map((q, idx) => (
                            <li key={idx} className="text-[13px] text-[var(--text-body)]">{q}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>

                  {(parsedJson.requiredInputs?.length > 0 || parsedJson.complianceNotes?.length > 0) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="rounded-lg border border-[#fde68a] bg-[#fffbeb] p-3">
                        <div className="text-[11px] uppercase tracking-wide text-[#92400e] mb-2">Required inputs (verify/add)</div>
                        <ul className="list-disc pl-5 space-y-1">
                          {(parsedJson.requiredInputs || []).map((x, idx) => (
                            <li key={idx} className="text-[13px] text-[#92400e]">{x}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3">
                        <div className="text-[11px] uppercase tracking-wide text-[var(--text-caption)] mb-2">Compliance notes</div>
                        <ul className="list-disc pl-5 space-y-1">
                          {(parsedJson.complianceNotes || []).map((x, idx) => (
                            <li key={idx} className="text-[13px] text-[var(--text-body)]">{x}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {record?.content && !parsedJson && (
            <div className="space-y-3">
              <div className="text-[12px] text-[var(--text-caption)]">
                Generated at: {new Date(record.created_at).toLocaleString()}
              </div>
              <div className="bg-[#fff7ed] border border-[#fed7aa] rounded-lg p-4 text-[13px] text-[#9a3412]">
                This draft is in a legacy format. Regenerate to get the structured JSON output.
              </div>
              <textarea
                value={record.content}
                readOnly
                className="w-full min-h-[320px] p-3 rounded-lg border border-[var(--border-default)] text-[13px] text-[var(--text-body)] bg-white focus:outline-none"
              />
            </div>
          )}
        </div>

        <div className="p-4 sm:p-6 border-t border-[var(--border-default)] bg-[var(--bg-secondary)] flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              onClick={doGenerate}
              disabled={!canGenerate || isLoading}
              className="px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-white font-medium hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Generating…' : record ? 'Regenerate' : 'Generate'}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => updateStatus('rejected')}
              disabled={!record?.id || isLoading}
              className="px-4 py-2 rounded-lg border border-[var(--border-default)] bg-white text-[var(--text-body)] font-medium hover:bg-[#f8fafc] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reject
            </button>
            <button
              onClick={() => updateStatus('accepted')}
              disabled={!record?.id || isLoading}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Accept
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
