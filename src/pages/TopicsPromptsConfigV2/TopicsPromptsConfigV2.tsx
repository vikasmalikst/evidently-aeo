import { Layout } from '../../components/Layout/Layout';
import { SettingsLayout } from '../../components/Settings/SettingsLayout';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useManualBrandDashboard } from '../../manual-dashboard/useManualBrandDashboard';
import {
  IconDownload,
  IconFilter,
  IconForms,
  IconHistory,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconTags,
  IconTrash,
  IconUmbrella,
  IconUpload,
} from '@tabler/icons-react';
import {
  getBrightdataCountries,
  getTopicsPromptsConfigV2Rows,
  saveTopicsPromptsConfigV2Rows,
  getArchivedTopicsPromptsV2,
  type BrightdataCountry,
  type TopicsPromptsConfigV2Row,
  type ArchivedTopicsPromptsV2,
} from '../../api/promptManagementApi';

export const TopicsPromptsConfigV2 = () => {
  const { selectedBrandId } = useManualBrandDashboard();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Array<TopicsPromptsConfigV2Row & { clientId: string; isNew: boolean }>>([]);
  const [history, setHistory] = useState<ArchivedTopicsPromptsV2[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string>('Current');
  const [countries, setCountries] = useState<BrightdataCountry[]>([]);
  const [countriesError, setCountriesError] = useState<string | null>(null);
  const [topicFilter, setTopicFilter] = useState<string>('__ALL__');
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [importConfirm, setImportConfirm] = useState<{
    isOpen: boolean;
    importedRows: Array<TopicsPromptsConfigV2Row & { clientId: string; isNew: boolean }>;
    existingCount: number;
  }>({ isOpen: false, importedRows: [], existingCount: 0 });
  const [saveConfirm, setSaveConfirm] = useState<{ isOpen: boolean }>({ isOpen: false });

  const initialRowsByIdRef = useRef<Map<string, TopicsPromptsConfigV2Row>>(new Map());
  const importFileInputRef = useRef<HTMLInputElement | null>(null);
  const countryNameByCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of countries) {
      map.set(c.code.toUpperCase(), c.name);
    }
    return map;
  }, [countries]);

  const getFlagEmoji = useCallback((countryCode: string) => {
    const code = countryCode.trim().toUpperCase();
    if (code.length !== 2) return '🌐';
    const points = [...code].map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...points);
  }, []);

  const getCoverageColor = useCallback((coverage: number) => {
    if (coverage >= 90) return 'text-[var(--success500)]';
    if (coverage >= 70) return 'text-[var(--text-warning)]';
    return 'text-[var(--dataviz-4)]';
  }, []);

  const hasUnsavedChanges = useMemo(() => {
    if (deletedIds.size > 0) return true;
    for (const row of rows) {
      if (row.isNew) return true;
      const initial = initialRowsByIdRef.current.get(row.id);
      if (!initial) return true;
      if (
        initial.topic !== row.topic ||
        initial.prompt !== row.prompt ||
        initial.locale !== row.locale ||
        initial.country !== row.country
      ) {
        return true;
      }
    }
    return false;
  }, [rows, deletedIds]);

  const editBlockedReason = useMemo(() => {
    if (!selectedBrandId) return 'Select a brand to edit';
    if (isLoading) return 'Loading...';
    if (isSaving) return 'Saving...';
    if (!isEditMode) return 'Enable edit mode to edit';
    return null;
  }, [selectedBrandId, isLoading, isSaving, isEditMode]);

  const changeStats = useMemo(() => {
    const initialCount = initialRowsByIdRef.current.size;
    const added = rows.filter(r => r.isNew).length;
    let edited = 0;
    for (const row of rows) {
      if (row.isNew) continue;
      const initial = initialRowsByIdRef.current.get(row.id);
      if (!initial) continue;
      if (
        initial.topic !== row.topic ||
        initial.prompt !== row.prompt ||
        initial.locale !== row.locale ||
        initial.country !== row.country
      ) {
        edited++;
      }
    }
    const deleted = deletedIds.size;
    const totalChanges = added + edited + deleted;
    const percent = initialCount > 0 ? totalChanges / initialCount : totalChanges > 0 ? 1 : 0;
    const isSignificant = totalChanges >= 10 || percent >= 0.25;
    return { initialCount, added, edited, deleted, totalChanges, percent, isSignificant };
  }, [rows, deletedIds]);

  const kpis = useMemo(() => {
    const totalPrompts = rows.length;
    const topicSet = new Set<string>();
    for (const row of rows) {
      const t = row.topic.trim();
      if (!t) continue;
      topicSet.add(t.toLowerCase());
    }
    const totalTopics = topicSet.size;
    const baseScore = Math.min((totalPrompts / 50) * 60, 60);
    const topicScore = Math.min((totalTopics / 10) * 40, 40);
    const coverage = Math.round((baseScore + topicScore) * 10) / 10;
    return { totalPrompts, totalTopics, coverage };
  }, [rows]);

  const availableVersions = useMemo(() => {
    const versions = new Set<string>();
    history.forEach(h => versions.add(h.version_tag));
    return Array.from(versions).sort((a, b) => {
       const vA = parseInt(a.replace('V', ''), 10) || 0;
       const vB = parseInt(b.replace('V', ''), 10) || 0;
       return vB - vA;
    });
  }, [history]);

  const reconstructedRows = useMemo(() => {
    if (selectedVersion === 'Current') return [];
    
    const targetVer = parseInt(selectedVersion.replace('V', ''), 10);
    if (isNaN(targetVer)) return [];

    const allTopics = new Set<string>();
    rows.forEach(r => allTopics.add(r.topic.trim()));
    history.forEach(h => allTopics.add(h.topic_name.trim()));

    const result: Array<TopicsPromptsConfigV2Row & { clientId: string; isNew: boolean }> = [];

    allTopics.forEach(topic => {
      const archive = history.find(h => h.topic_name.trim() === topic && h.version_tag === selectedVersion);
      
      if (archive) {
         archive.prompts.forEach((p: any) => {
             result.push({
                 id: p.id || `archive-${archive.id}-${Math.random()}`,
                 topic: archive.topic_name,
                 prompt: p.query_text || p.text || '',
                 locale: p.locale,
                 country: p.country,
                 version: targetVer,
                 clientId: `archive-row-${archive.id}-${p.id || Math.random()}`,
                 isNew: false
             });
         });
         return;
      }

      const currentRowsForTopic = rows.filter(r => r.topic.trim() === topic);
      if (currentRowsForTopic.length > 0) {
          const currentVer = currentRowsForTopic[0].version || 1;
          if (currentVer <= targetVer) {
              currentRowsForTopic.forEach(r => result.push(r));
          }
      }
    });
    
    return result;
  }, [selectedVersion, rows, history]);

  const displayedRowsSource = selectedVersion === 'Current' ? rows : reconstructedRows;

  const filteredRows = useMemo(() => {
    if (topicFilter === '__ALL__') return displayedRowsSource;
    const normalized = topicFilter.trim().toLowerCase();
    return displayedRowsSource.filter(r => r.topic.trim().toLowerCase() === normalized);
  }, [displayedRowsSource, topicFilter]);

  const topicOptions = useMemo(() => {
    const normalizedToLabel = new Map<string, string>();
    for (const row of rows) {
      const label = row.topic.trim();
      if (!label) continue;
      const normalized = label.toLowerCase();
      if (!normalizedToLabel.has(normalized)) {
        normalizedToLabel.set(normalized, label);
      }
    }
    return Array.from(normalizedToLabel.values()).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const load = useCallback(async () => {
    if (!selectedBrandId) return;
    setIsLoading(true);
    setError(null);
    try {
      const [data, historyData] = await Promise.all([
        getTopicsPromptsConfigV2Rows(selectedBrandId),
        getArchivedTopicsPromptsV2(selectedBrandId)
      ]);
      initialRowsByIdRef.current = new Map(data.map((r: TopicsPromptsConfigV2Row) => [r.id, r]));
      setRows(data.map((r: TopicsPromptsConfigV2Row) => ({ ...r, clientId: r.id, isNew: false })));
      setHistory(historyData);
      setDeletedIds(new Set());
      setIsEditMode(false);
      setTopicFilter('__ALL__');
      setSelectedVersion('Current');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load config rows');
    } finally {
      setIsLoading(false);
    }
  }, [selectedBrandId]);

  useEffect(() => {
    load();
  }, [load]);

  const loadCountries = useCallback(async () => {
    try {
      setCountriesError(null);
      const data = await getBrightdataCountries();
      setCountries(data);
    } catch (e) {
      setCountries([]);
      setCountriesError(e instanceof Error ? e.message : 'Failed to load countries');
    }
  }, []);

  useEffect(() => {
    loadCountries();
  }, [loadCountries]);

  const updateRow = (clientId: string, patch: Partial<TopicsPromptsConfigV2Row>) => {
    setRows(prev =>
      prev.map(r => (r.clientId === clientId ? { ...r, ...patch } : r))
    );
  };

  const handleAddRow = () => {
    if (!selectedBrandId) return;
    if (!isEditMode) return;
    const clientId = `new-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    setRows(prev => [
      {
        id: '',
        topic: topicFilter === '__ALL__' ? '' : topicFilter,
        prompt: '',
        locale: 'en-US',
        country: 'US',
        clientId,
        isNew: true,
      },
      ...prev,
    ]);
  };

  const parseCsv = (csvText: string): string[][] => {
    const rowsOut: string[][] = [];
    let row: string[] = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < csvText.length; i++) {
      const char = csvText[i];

      if (inQuotes) {
        if (char === '"') {
          const next = csvText[i + 1];
          if (next === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += char;
        }
        continue;
      }

      if (char === '"') {
        inQuotes = true;
        continue;
      }

      if (char === ',') {
        row.push(field);
        field = '';
        continue;
      }

      if (char === '\n') {
        row.push(field);
        field = '';
        rowsOut.push(row);
        row = [];
        continue;
      }

      if (char === '\r') {
        continue;
      }

      field += char;
    }

    row.push(field);
    rowsOut.push(row);

    while (rowsOut.length > 0) {
      const last = rowsOut[rowsOut.length - 1];
      const isEmpty = last.every(cell => cell.trim() === '');
      if (!isEmpty) break;
      rowsOut.pop();
    }

    return rowsOut;
  };

  const escapeCsvCell = (value: string) => {
    const str = String(value ?? '');
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const safeFilePart = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');

  const handleExportCsv = () => {
    const exportRows = filteredRows;
    if (exportRows.length === 0) return;

    const headers = ['topic', 'prompt', 'country', 'locale'];
    const csvContent = [
      headers.join(','),
      ...exportRows.map(r =>
        [r.topic, r.prompt, r.country, r.locale].map(escapeCsvCell).join(',')
      ),
    ].join('\n');

    const topicSuffix = topicFilter === '__ALL__' ? 'all-topics' : safeFilePart(topicFilter);
    const dateSuffix = new Date().toISOString().split('T')[0];
    const versionSuffix = selectedVersion === 'Current' ? 'current' : selectedVersion.toLowerCase();
    const filename = `topics-prompts-config-v2-${versionSuffix}-${topicSuffix}-${dateSuffix}.csv`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const mapImportedCsvRows = (parsedRows: string[][]) => {
    if (parsedRows.length === 0) {
      throw new Error('CSV file is empty');
    }

    const normalizeHeader = (h: string) => h.trim().toLowerCase().replace(/\s+/g, '_');
    const header = parsedRows[0].map(normalizeHeader);
    const looksLikeHeader = header.some(h =>
      ['topic', 'prompt', 'query', 'query_text', 'country', 'country_code', 'locale'].includes(h)
    );

    const dataRows = looksLikeHeader ? parsedRows.slice(1) : parsedRows;

    const indexOf = (candidates: string[]) => {
      for (const c of candidates) {
        const idx = header.indexOf(c);
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const idxTopic = looksLikeHeader ? indexOf(['topic']) : 0;
    const idxPrompt = looksLikeHeader ? indexOf(['prompt', 'query', 'query_text']) : 1;
    const idxCountry = looksLikeHeader ? indexOf(['country', 'country_code']) : 2;
    const idxLocale = looksLikeHeader ? indexOf(['locale']) : 3;

    const imported = dataRows
      .map((r) => ({
        topic: (idxTopic >= 0 ? r[idxTopic] : '') ?? '',
        prompt: (idxPrompt >= 0 ? r[idxPrompt] : '') ?? '',
        country: (idxCountry >= 0 ? r[idxCountry] : '') ?? '',
        locale: (idxLocale >= 0 ? r[idxLocale] : '') ?? '',
      }))
      .map(r => ({
        topic: r.topic.trim(),
        prompt: r.prompt.trim(),
        country: r.country.trim().toUpperCase(),
        locale: r.locale.trim(),
      }))
      .filter(r => r.topic !== '' || r.prompt !== '' || r.country !== '' || r.locale !== '');

    if (imported.length === 0) {
      throw new Error('CSV has no data rows');
    }

    const defaultTopic = topicFilter === '__ALL__' ? '' : topicFilter;
    return imported.map((r, idx) => {
      const clientId = `import-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 9)}`;
      return {
        id: '',
        topic: r.topic || defaultTopic,
        prompt: r.prompt,
        locale: r.locale || 'en-US',
        country: r.country || 'US',
        clientId,
        isNew: true,
      };
    });
  };

  const handleImportClick = () => {
    if (!isEditMode) return;
    importFileInputRef.current?.click();
  };

  const handleImportFileSelected = async (file: File | null) => {
    if (!file) return;
    if (!isEditMode) return;

    try {
      setError(null);
      const csvText = await file.text();
      const parsedRows = parseCsv(csvText);
      const importedRows = mapImportedCsvRows(parsedRows);
      setImportConfirm({
        isOpen: true,
        importedRows,
        existingCount: rows.length
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to import CSV');
    } finally {
      if (importFileInputRef.current) {
        importFileInputRef.current.value = '';
      }
    }
  };

  const handleConfirmImportReplace = () => {
    const existingIds = rows.filter(r => !r.isNew && r.id).map(r => r.id);
    setDeletedIds(new Set(existingIds));
    setRows(importConfirm.importedRows);
    setImportConfirm({ isOpen: false, importedRows: [], existingCount: 0 });
  };

  const handleCancelImportReplace = () => {
    setImportConfirm({ isOpen: false, importedRows: [], existingCount: 0 });
  };

  const handleDeleteRow = (clientId: string) => {
    if (!isEditMode) return;
    setRows(prev => {
      const row = prev.find(r => r.clientId === clientId);
      if (!row) return prev;
      if (!row.isNew && row.id) {
        setDeletedIds(existing => {
          const next = new Set(existing);
          next.add(row.id);
          return next;
        });
      }
      return prev.filter(r => r.clientId !== clientId);
    });
  };

  const handleSaveInternal = async () => {
    if (!selectedBrandId) return;
    setIsSaving(true);
    setError(null);
    try {
      const payload = rows.map(r => ({
        id: r.isNew ? undefined : r.id,
        topic: r.topic,
        prompt: r.prompt,
        locale: r.locale,
        country: r.country.trim().toUpperCase(),
      }));
      await saveTopicsPromptsConfigV2Rows(selectedBrandId, payload, Array.from(deletedIds));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save config rows');
    } finally {
      setIsSaving(false);
    }
  };

  const addButtonDisabledReason = useMemo(() => {
    if (!selectedBrandId) return 'Select a brand to add rows';
    if (isLoading) return 'Loading...';
    if (isSaving) return 'Saving...';
    if (selectedVersion !== 'Current') return 'Cannot add rows to historical version';
    if (!isEditMode) return 'Enable edit mode to add rows';
    return null;
  }, [selectedBrandId, isLoading, isSaving, isEditMode, selectedVersion]);

  const importButtonDisabledReason = useMemo(() => {
    if (!selectedBrandId) return 'Select a brand to import';
    if (isLoading) return 'Loading...';
    if (isSaving) return 'Saving...';
    if (selectedVersion !== 'Current') return 'Cannot import to historical version';
    if (!isEditMode) return 'Enable edit mode to import';
    return null;
  }, [selectedBrandId, isLoading, isSaving, isEditMode, selectedVersion]);

  const exportButtonDisabledReason = useMemo(() => {
    if (!selectedBrandId) return 'Select a brand to export';
    if (isLoading) return 'Loading...';
    if (isSaving) return 'Saving...';
    if (filteredRows.length === 0) return 'No rows to export';
    return null;
  }, [selectedBrandId, isLoading, isSaving, filteredRows.length]);

  const saveDisabledReason = useMemo(() => {
    if (!selectedBrandId) return 'Select a brand to save changes';
    if (isLoading) return 'Loading...';
    if (isSaving) return 'Saving...';
    if (selectedVersion !== 'Current') return 'Cannot save historical version';
    if (!isEditMode) return 'Enable edit mode to save changes';
    if (rows.length === 0) return 'No rows to save';
    if (!hasUnsavedChanges) return 'No Edits to Save';
    return null;
  }, [selectedBrandId, isLoading, isSaving, isEditMode, rows.length, hasUnsavedChanges, selectedVersion]);

  const refreshButtonDisabledReason = useMemo(() => {
    if (!selectedBrandId) return 'Select a brand to refresh';
    if (isLoading) return 'Loading...';
    if (isSaving) return 'Saving...';
    return null;
  }, [selectedBrandId, isLoading, isSaving]);

  const editModeButtonDisabledReason = useMemo(() => {
    if (!selectedBrandId) return 'Select a brand to edit';
    if (isLoading) return 'Loading...';
    if (isSaving) return 'Saving...';
    if (selectedVersion !== 'Current') return 'Editing disabled in history view';
    return null;
  }, [selectedBrandId, isLoading, isSaving, selectedVersion]);

  const isEditingBlocked = Boolean(editBlockedReason);

  const handleSaveClick = () => {
    if (saveDisabledReason) return;
    if (changeStats.isSignificant) {
      setSaveConfirm({ isOpen: true });
      return;
    }
    void handleSaveInternal();
  };

  const handleConfirmSave = () => {
    setSaveConfirm({ isOpen: false });
    void handleSaveInternal();
  };

  const handleCancelSave = () => {
    setSaveConfirm({ isOpen: false });
  };

  const handleDiscardChanges = () => {
    const initialRows = Array.from(initialRowsByIdRef.current.values());
    setRows(initialRows.map(r => ({ ...r, clientId: r.id, isNew: false })));
    setDeletedIds(new Set());
    setIsEditMode(false);
  };

  return (
    <Layout>
      <SettingsLayout>
        <div className="p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-[var(--text-headings)]">
              Topics/Prompts Config V2
            </h1>
            <p className="text-sm text-[var(--text-caption)] mt-1">
              View and edit topics, prompts, locale, and country.
            </p>
          </div>

          {selectedVersion !== 'Current' && (
            <div className="mb-6 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 flex items-center gap-3">
              <IconHistory size={20} />
              <div>
                <span className="font-semibold">Viewing Historical Version: {selectedVersion}</span>
                <p className="text-sm mt-1">
                  This view is read-only. You cannot edit or save changes in this mode. Switch to "Current Version" to make changes.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-white border border-[var(--border-default)] rounded-lg shadow-sm p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center flex-shrink-0">
                  <IconForms size={20} className="text-[var(--accent-primary)]" />
                </div>
                <div className="text-sm font-semibold text-[var(--text-headings)]">
                  Total Prompts
                </div>
              </div>
              <div className="text-3xl font-bold text-[var(--text-headings)]">
                {kpis.totalPrompts}
              </div>
            </div>

            <div className="bg-white border border-[var(--border-default)] rounded-lg shadow-sm p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center flex-shrink-0">
                  <IconTags size={20} className="text-[var(--accent-primary)]" />
                </div>
                <div className="text-sm font-semibold text-[var(--text-headings)]">
                  Topics Covered
                </div>
              </div>
              <div className="text-3xl font-bold text-[var(--text-headings)]">
                {kpis.totalTopics}
              </div>
            </div>

            <div className="bg-white border border-[var(--border-default)] rounded-lg shadow-sm p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--success500)]/10 flex items-center justify-center flex-shrink-0">
                  <IconUmbrella size={20} className={getCoverageColor(kpis.coverage)} />
                </div>
                <div className="text-sm font-semibold text-[var(--text-headings)]">
                  Coverage
                </div>
              </div>
              <div className={`text-3xl font-bold ${getCoverageColor(kpis.coverage)}`}>
                {kpis.coverage.toFixed(1)}%
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <IconHistory size={16} className="text-[var(--text-caption)]" />
                <select
                  value={selectedVersion}
                  onChange={(e) => {
                    setSelectedVersion(e.target.value);
                    setIsEditMode(false);
                  }}
                  disabled={isLoading || isSaving}
                  className="px-3 py-2 rounded-lg bg-white border border-[var(--border-default)] text-sm text-[var(--text-body)] hover:border-[var(--accent-primary)] disabled:opacity-50"
                >
                  <option value="Current">Current Version</option>
                  {availableVersions.map(v => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-px h-6 bg-[var(--border-default)] mx-2" />

              <div className="flex items-center gap-2">
                <IconFilter size={16} className="text-[var(--text-caption)]" />
                <select
                  value={topicFilter}
                  onChange={(e) => setTopicFilter(e.target.value)}
                  disabled={isLoading || isSaving}
                  className="px-3 py-2 rounded-lg bg-white border border-[var(--border-default)] text-sm text-[var(--text-body)] hover:border-[var(--accent-primary)] disabled:opacity-50"
                >
                  <option value="__ALL__">All topics</option>
                  {topicOptions.map(t => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <span title={refreshButtonDisabledReason || 'Refresh'} className={`inline-flex ${refreshButtonDisabledReason ? 'cursor-not-allowed' : ''}`}>
                <button
                  onClick={load}
                  disabled={Boolean(refreshButtonDisabledReason)}
                  className={`p-2 rounded-lg bg-white border border-[var(--border-default)] text-[var(--text-body)] hover:border-[var(--accent-primary)] disabled:opacity-50 ${
                    refreshButtonDisabledReason ? 'pointer-events-none' : ''
                  }`}
                >
                  <IconRefresh size={18} />
                </button>
              </span>
              <span title={editModeButtonDisabledReason || (isEditMode ? 'Exit edit mode' : 'Edit')} className={`inline-flex ${editModeButtonDisabledReason ? 'cursor-not-allowed' : ''}`}>
                <button
                  onClick={() => setIsEditMode(v => !v)}
                  disabled={Boolean(editModeButtonDisabledReason)}
                  className={`p-2 rounded-lg bg-white border border-[var(--border-default)] text-[var(--text-body)] hover:border-[var(--accent-primary)] disabled:opacity-50 ${
                    isEditMode ? 'border-[var(--accent-primary)]' : ''
                  } ${editModeButtonDisabledReason ? 'pointer-events-none' : ''}`}
                >
                  <IconPencil size={18} />
                </button>
              </span>
              <span title={addButtonDisabledReason || 'Add row'} className={`inline-flex ${addButtonDisabledReason ? 'cursor-not-allowed' : ''}`}>
                <button
                  onClick={handleAddRow}
                  disabled={Boolean(addButtonDisabledReason)}
                  className={`p-2 rounded-lg bg-white border border-[var(--border-default)] text-[var(--text-body)] hover:border-[var(--accent-primary)] disabled:opacity-50 ${
                    addButtonDisabledReason ? 'pointer-events-none' : ''
                  }`}
                >
                  <IconPlus size={18} />
                </button>
              </span>
              <span title={exportButtonDisabledReason || 'Export CSV'} className={`inline-flex ${exportButtonDisabledReason ? 'cursor-not-allowed' : ''}`}>
                <button
                  onClick={handleExportCsv}
                  disabled={Boolean(exportButtonDisabledReason)}
                  className={`p-2 rounded-lg bg-white border border-[var(--border-default)] text-[var(--text-body)] hover:border-[var(--accent-primary)] disabled:opacity-50 ${
                    exportButtonDisabledReason ? 'pointer-events-none' : ''
                  }`}
                >
                  <IconDownload size={18} />
                </button>
              </span>
              <span title={importButtonDisabledReason || 'Import CSV'} className={`inline-flex ${importButtonDisabledReason ? 'cursor-not-allowed' : ''}`}>
                <button
                  onClick={handleImportClick}
                  disabled={Boolean(importButtonDisabledReason)}
                  className={`p-2 rounded-lg bg-white border border-[var(--border-default)] text-[var(--text-body)] hover:border-[var(--accent-primary)] disabled:opacity-50 ${
                    importButtonDisabledReason ? 'pointer-events-none' : ''
                  }`}
                >
                  <IconUpload size={18} />
                </button>
              </span>
              <input
                ref={importFileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => void handleImportFileSelected(e.target.files?.[0] || null)}
              />
            </div>
            {hasUnsavedChanges && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDiscardChanges}
                  disabled={isSaving}
                  className="px-4 py-2 rounded-lg bg-white border border-[var(--border-default)] text-[var(--text-body)] text-sm font-medium hover:bg-[var(--bg-secondary)] disabled:opacity-50"
                >
                  Discard changes
                </button>
                <span title={saveDisabledReason || 'Save changes'} className={`inline-flex ${saveDisabledReason ? 'cursor-not-allowed' : ''}`}>
                  <button
                    onClick={handleSaveClick}
                    disabled={Boolean(saveDisabledReason)}
                    className={`px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-white text-sm font-medium disabled:opacity-50 ${
                      saveDisabledReason ? 'pointer-events-none' : ''
                    }`}
                  >
                    {isSaving ? 'Saving...' : 'Save changes'}
                  </button>
                </span>
              </div>
            )}
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700">
              {error}
            </div>
          )}
          {countriesError && (
            <div className="mb-4 p-3 rounded-lg border border-amber-200 bg-amber-50 text-sm text-amber-800">
              {countriesError}
            </div>
          )}

          {!selectedBrandId ? (
            <div className="p-4 bg-white border border-[var(--border-default)] rounded-lg text-sm text-[var(--text-caption)]">
              Select a brand to view and edit config rows.
            </div>
          ) : isLoading ? (
            <div className="p-4 bg-white border border-[var(--border-default)] rounded-lg text-sm text-[var(--text-caption)]">
              Loading...
            </div>
          ) : (
            <div className="bg-white border border-[var(--border-default)] rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-[var(--border-default)]">
                  <thead className="bg-[var(--bg-secondary)]">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-caption)] uppercase tracking-wider">
                        Topic {selectedVersion !== 'Current' && <span className="ml-2 px-2 py-0.5 rounded bg-amber-100 text-amber-700 normal-case">Archived</span>}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-caption)] uppercase tracking-wider">
                        Prompt
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-caption)] uppercase tracking-wider">
                        Country
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-[var(--text-caption)] uppercase tracking-wider">
                        {selectedVersion === 'Current' ? 'Actions' : 'Version'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-default)]">
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-4 py-6 text-center text-sm text-[var(--text-caption)]"
                        >
                          No rows found.
                        </td>
                      </tr>
                    ) : (
                      filteredRows.map((row) => (
                        <tr key={row.clientId}>
                          <td className="px-4 py-2 align-middle" style={{ width: '20rem' }}>
                            <input
                              value={row.topic}
                              onChange={(e) => updateRow(row.clientId, { topic: e.target.value })}
                              readOnly={isEditingBlocked}
                              title={isEditingBlocked ? (editBlockedReason ?? undefined) : undefined}
                              className={`w-full h-12 px-3 py-2 border border-[var(--border-default)] rounded-lg text-sm ${
                                isEditingBlocked ? 'bg-[var(--bg-secondary)]' : 'bg-white'
                              }`}
                              placeholder="Topic"
                            />
                          </td>
                          <td className="px-4 py-2 align-middle">
                            <textarea
                              value={row.prompt}
                              onChange={(e) => updateRow(row.clientId, { prompt: e.target.value })}
                              readOnly={isEditingBlocked}
                              title={isEditingBlocked ? (editBlockedReason ?? undefined) : undefined}
                              className={`w-full h-12 px-3 py-2 border border-[var(--border-default)] rounded-lg text-sm resize-none overflow-y-auto ${
                                isEditingBlocked ? 'bg-[var(--bg-secondary)]' : 'bg-white'
                              }`}
                              placeholder="Prompt / query"
                            />
                          </td>
                          <td className="px-4 py-2 align-middle" style={{ width: '16rem' }}>
                            {(() => {
                              const currentCode = (row.country || 'US').trim().toUpperCase() || 'US';
                              const currentName = countryNameByCode.get(currentCode) || currentCode;
                              const hasCurrentInList =
                                countries.length > 0 && countryNameByCode.has(currentCode);

                              return (
                                <span
                                  title={isEditingBlocked ? (editBlockedReason ?? undefined) : undefined}
                                  className={isEditingBlocked ? 'inline-flex cursor-not-allowed' : 'inline-flex'}
                                >
                                  <select
                                    value={currentCode}
                                    onChange={(e) => updateRow(row.clientId, { country: e.target.value })}
                                    disabled={isEditingBlocked}
                                    onFocus={() => {
                                      if (countries.length === 0) loadCountries();
                                    }}
                                    className={`w-full h-12 min-w-[240px] px-3 py-2 border border-[var(--border-default)] rounded-lg text-sm ${
                                      isEditingBlocked ? 'bg-[var(--bg-secondary)] pointer-events-none' : 'bg-white'
                                    }`}
                                  >
                                    {countries.length === 0 ? (
                                      <option value={currentCode}>
                                        {getFlagEmoji(currentCode)} {currentName}
                                      </option>
                                    ) : (
                                      <>
                                        {!hasCurrentInList && (
                                          <option value={currentCode}>
                                            {getFlagEmoji(currentCode)} {currentName}
                                          </option>
                                        )}
                                        {countries.map((c) => (
                                          <option key={c.code} value={c.code.toUpperCase()}>
                                            {getFlagEmoji(c.code)} {c.name}
                                          </option>
                                        ))}
                                      </>
                                    )}
                                  </select>
                                </span>
                              );
                            })()}
                          </td>
                          <td className="px-4 py-2 align-middle text-right" style={{ width: '5rem' }}>
                            {selectedVersion === 'Current' ? (
                              <span
                                title={
                                  isEditingBlocked ? (editBlockedReason ?? undefined) : 'Delete row'
                                }
                                className={`inline-flex ${isEditingBlocked ? 'cursor-not-allowed' : ''}`}
                              >
                                <button
                                  onClick={() => handleDeleteRow(row.clientId)}
                                  disabled={isEditingBlocked}
                                  className={`h-12 w-12 inline-flex items-center justify-center rounded-lg hover:bg-[var(--bg-secondary)] disabled:opacity-50 ${
                                    isEditingBlocked ? 'pointer-events-none' : ''
                                  }`}
                                >
                                  <IconTrash size={18} className="text-[var(--text-caption)]" />
                                </button>
                              </span>
                            ) : (
                              <span className="text-xs font-medium text-[var(--text-caption)] bg-[var(--bg-secondary)] px-2 py-1 rounded">
                                V{row.version || 1}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {importConfirm.isOpen && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div
              className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-[var(--text-headings)] mb-2">
                Replace table with imported CSV?
              </h3>
              <p className="text-sm text-[var(--text-body)] mb-4">
                This will replace the grid with {importConfirm.importedRows.length} imported row{importConfirm.importedRows.length === 1 ? '' : 's'}.
                {importConfirm.existingCount > 0
                  ? ` Your current ${importConfirm.existingCount} row${importConfirm.existingCount === 1 ? '' : 's'} will be removed from the grid.`
                  : ''}
              </p>
              <div className="mb-4 p-3 rounded-lg border border-amber-200 bg-amber-50 text-sm text-amber-800">
                Existing Topics/Prompts will be overwritten once you click Save changes.
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={handleCancelImportReplace}
                  className="px-4 py-2 rounded-lg border border-[var(--border-default)] text-sm font-medium text-[var(--text-body)] hover:bg-[var(--bg-secondary)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmImportReplace}
                  className="px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-white text-sm font-medium"
                >
                  Replace
                </button>
              </div>
            </div>
          </div>
        )}

        {saveConfirm.isOpen && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div
              className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-[var(--text-headings)] mb-2">
                Confirm save changes
              </h3>
              <p className="text-sm text-[var(--text-body)] mb-4">
                You are making a significant change to your prompts configuration.
              </p>
              <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                <div className="p-3 rounded-lg border border-[var(--border-default)] bg-white">
                  <div className="text-[var(--text-caption)] text-xs uppercase tracking-wider">Added</div>
                  <div className="font-semibold text-[var(--text-headings)]">{changeStats.added}</div>
                </div>
                <div className="p-3 rounded-lg border border-[var(--border-default)] bg-white">
                  <div className="text-[var(--text-caption)] text-xs uppercase tracking-wider">Edited</div>
                  <div className="font-semibold text-[var(--text-headings)]">{changeStats.edited}</div>
                </div>
                <div className="p-3 rounded-lg border border-[var(--border-default)] bg-white">
                  <div className="text-[var(--text-caption)] text-xs uppercase tracking-wider">Deleted</div>
                  <div className="font-semibold text-[var(--text-headings)]">{changeStats.deleted}</div>
                </div>
              </div>
              <div className="mb-4 p-3 rounded-lg border border-amber-200 bg-amber-50 text-sm text-amber-800">
                Significant changes in Prompts can change future Scores and cause trend breaks.
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={handleCancelSave}
                  className="px-4 py-2 rounded-lg border border-[var(--border-default)] text-sm font-medium text-[var(--text-body)] hover:bg-[var(--bg-secondary)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmSave}
                  className="px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-white text-sm font-medium"
                >
                  Save anyway
                </button>
              </div>
            </div>
          </div>
        )}
      </SettingsLayout>
    </Layout>
  );
};
