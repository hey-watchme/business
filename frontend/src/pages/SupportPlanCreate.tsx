import React, { useState, useEffect, useCallback } from 'react';
import RecordingSetup from '../components/RecordingSetup';
import RecordingSession from '../components/RecordingSession';
import Phase1Display from '../components/Phase1Display';
import Phase2Display from '../components/Phase2Display';
import Phase3Display from '../components/Phase3Display';
import EditableField from '../components/EditableField';
import EditableTableRow, { type SupportItem } from '../components/EditableTableRow';
import { api, type InterviewSession, type SupportPlan, type SupportPlanUpdate } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { calculateAge } from '../utils/date';
import './SupportPlanCreate.css';

type RecordingMode = 'none' | 'setup' | 'recording';
type PlanTab = 'home' | 'assessment' | 'phase1' | 'phase2' | 'phase3';

interface SupportPlanCreateProps {
  initialSubjectId?: string;
  hideHeader?: boolean;
}

const SupportPlanCreate: React.FC<SupportPlanCreateProps> = ({ initialSubjectId, hideHeader }) => {
  const { profile } = useAuth();
  const [recordingMode, setRecordingMode] = useState<RecordingMode>('none');
  const [selectedChild, setSelectedChild] = useState('田中太郎'); // Will be updated by Subject data in real usage
  const [supportPlans, setSupportPlans] = useState<SupportPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<SupportPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [pendingPlanTitle, setPendingPlanTitle] = useState<string | null>(null);
  const [pendingSubjectName, setPendingSubjectName] = useState<string | null>(null);
  const [pendingSubjectAvatar, setPendingSubjectAvatar] = useState<string | null>(null);
  // Tab state per plan (key: planId, value: active tab)
  const [activeTabByPlan, setActiveTabByPlan] = useState<Record<string, PlanTab>>({});

  // Transcription editing state (key: sessionId, value: edited transcription)
  const [editingTranscription, setEditingTranscription] = useState<Record<string, string>>({});
  const [savingTranscription, setSavingTranscription] = useState<Record<string, boolean>>({});

  // Re-analysis state (key: sessionId)
  const [reanalyzing, setReanalyzing] = useState<Record<string, boolean>>({});
  const [reanalysisPhase, setReanalysisPhase] = useState<Record<string, string>>({});

  // Phase execution result feedback (key: sessionId, value: result info)
  const [phaseResult, setPhaseResult] = useState<Record<string, { status: 'success' | 'error'; message: string } | null>>({});

  // Manual session creation state (key: planId)
  const [creatingManualSession, setCreatingManualSession] = useState<Record<string, boolean>>({});

  // Save feedback state (key: sessionId, value: 'success' | 'error')
  const [saveFeedback, setSaveFeedback] = useState<Record<string, 'success' | 'error' | null>>({});

  // Prompt editing state (key: `${sessionId}_${phase}`)
  const [editingPrompt, setEditingPrompt] = useState<Record<string, string>>({});
  const [savingPrompt, setSavingPrompt] = useState<Record<string, boolean>>({});
  const [promptFeedback, setPromptFeedback] = useState<Record<string, 'success' | 'error' | null>>({});

  // Model selection state
  const [showModelModal, setShowModelModal] = useState(false);
  const [modelModalPlanId, setModelModalPlanId] = useState<string | null>(null);
  const [modelModalSessionId, setModelModalSessionId] = useState<string | null>(null);
  const [selectedModelForBatch, setSelectedModelForBatch] = useState({ provider: 'openai', model: 'gpt-4o' });
  const [phaseRerunModal, setPhaseRerunModal] = useState<{ sessionId: string; planId: string; phase: 1 | 2 | 3; modelUsed?: string } | null>(null);
  const [selectedModelForPhaseRerun, setSelectedModelForPhaseRerun] = useState({ provider: 'openai', model: 'gpt-4o' });

  // Clipboard copy state (key: unique id, value: true = just copied)
  const [copiedKey, setCopiedKey] = useState<Record<string, boolean>>({});

  const handleCopyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(prev => ({ ...prev, [key]: true }));
      setTimeout(() => setCopiedKey(prev => ({ ...prev, [key]: false })), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const CopyButton: React.FC<{ text: string; copyKey: string }> = ({ text, copyKey }) => (
    <button
      onClick={() => handleCopyToClipboard(text, copyKey)}
      title="クリップボードにコピー"
      style={{
        padding: '4px 8px',
        borderRadius: '4px',
        border: '1px solid var(--border-color)',
        background: copiedKey[copyKey] ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-secondary)',
        color: copiedKey[copyKey] ? '#10b981' : 'var(--text-secondary)',
        fontSize: '12px',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        transition: 'all 0.2s ease',
      }}
    >
      {copiedKey[copyKey] ? (
        <><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8.5L6.5 12L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>コピー済</>
      ) : (
        <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>コピー</>
      )}
    </button>
  );

  // Get active tab for a plan (default to 'assessment')
  const getActiveTab = (planId: string): PlanTab => activeTabByPlan[planId] || 'assessment';

  // Set active tab for a plan
  const setActiveTab = (planId: string, tab: PlanTab) => {
    setActiveTabByPlan(prev => ({ ...prev, [planId]: tab }));
  };

  useEffect(() => {
    fetchSupportPlans();
  }, [initialSubjectId]);

  useEffect(() => {
    if (selectedPlan) {
      fetchPlanDetails(selectedPlan.id);
    }
  }, [selectedPlan?.id]); // Only depend on ID to prevent infinite loop

  const fetchSupportPlans = async () => {
    try {
      setLoading(true);
      let plans = await api.getSupportPlans();

      if (initialSubjectId) {
        plans = plans.filter(p => p.subject_id === initialSubjectId);
      }

      // Fetch full details for each plan to get sessions
      const fullPlans = await Promise.all(
        plans.map(plan => api.getSupportPlan(plan.id))
      );

      setSupportPlans(fullPlans);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch support plans');
    } finally {
      setLoading(false);
    }
  };

  const fetchPlanDetails = async (planId: string) => {
    try {
      const plan = await api.getSupportPlan(planId);
      setSelectedPlan(plan);
      setSupportPlans(prev => prev.map(p => p.id === planId ? plan : p));
    } catch (err) {
      console.error('Failed to fetch plan details:', err);
    }
  };

  // ===== 2-column structure helpers and handlers =====

  // Save handler for single field
  const handleFieldSave = useCallback(async (planId: string, field: string, value: string) => {
    try {
      const updateData: SupportPlanUpdate = { [field]: value };
      const updated = await api.updateSupportPlan(planId, updateData);

      // Update local state
      setSupportPlans(prev => prev.map(p => p.id === updated.id ? updated : p));
      if (selectedPlan?.id === updated.id) {
        setSelectedPlan(updated);
      }
    } catch (err) {
      console.error('Failed to save field:', err);
      throw err;
    }
  }, [selectedPlan?.id]);

  // Save handler for support items array
  const handleSupportItemSave = useCallback(async (planId: string, index: number, item: SupportItem) => {
    const plan = supportPlans.find(p => p.id === planId);
    if (!plan) return;

    const currentItems = plan.support_items_user_edited ?? plan.support_items_ai_generated ?? [];
    const updatedItems = [...currentItems];
    updatedItems[index] = item;

    try {
      const updated = await api.updateSupportPlan(planId, {
        support_items: updatedItems
      });

      setSupportPlans(prev => prev.map(p => p.id === updated.id ? updated : p));
      if (selectedPlan?.id === updated.id) {
        setSelectedPlan(updated);
      }
    } catch (err) {
      console.error('Failed to save support item:', err);
      throw err;
    }
  }, [supportPlans, selectedPlan?.id]);

  // Delete handler for support items
  const handleSupportItemDelete = useCallback(async (planId: string, index: number) => {
    const plan = supportPlans.find(p => p.id === planId);
    if (!plan) return;

    const currentItems = plan.support_items_user_edited ?? plan.support_items_ai_generated ?? [];
    const updatedItems = currentItems.filter((_, i) => i !== index);

    try {
      const updated = await api.updateSupportPlan(planId, {
        support_items: updatedItems
      });

      setSupportPlans(prev => prev.map(p => p.id === updated.id ? updated : p));
      if (selectedPlan?.id === updated.id) {
        setSelectedPlan(updated);
      }
    } catch (err) {
      console.error('Failed to delete support item:', err);
      throw err;
    }
  }, [supportPlans, selectedPlan?.id]);

  // Add new support item
  const handleAddSupportItem = useCallback(async (planId: string) => {
    const plan = supportPlans.find(p => p.id === planId);
    if (!plan) return;

    const currentItems = plan.support_items_user_edited ?? plan.support_items_ai_generated ?? [];
    const newItem: SupportItem = {
      category: '',
      target: '',
      methods: [],
      timeline: '6ヶ月',
      staff: '',
      notes: '',
      priority: currentItems.length + 1
    };

    try {
      const updated = await api.updateSupportPlan(planId, {
        support_items: [...currentItems, newItem]
      });

      setSupportPlans(prev => prev.map(p => p.id === updated.id ? updated : p));
      if (selectedPlan?.id === updated.id) {
        setSelectedPlan(updated);
      }
    } catch (err) {
      console.error('Failed to add support item:', err);
      throw err;
    }
  }, [supportPlans, selectedPlan?.id]);

  // Sync from assessment API handler
  const handleSyncFromAssessment = useCallback(async (planId: string) => {
    try {
      const result = await api.syncFromAssessment(planId);
      if (result.success) {
        // Refresh plan data
        const updated = await api.getSupportPlan(planId);
        setSupportPlans(prev => prev.map(p => p.id === updated.id ? updated : p));
        if (selectedPlan?.id === updated.id) {
          setSelectedPlan(updated);
        }
        alert(`${result.synced_fields.length}件のフィールドを同期しました`);
      }
    } catch (err) {
      console.error('Sync from assessment failed:', err);
      alert('AI分析結果の同期に失敗しました');
    }
  }, [selectedPlan?.id]);

  // ===== Transcription editing handlers =====
  const handleTranscriptionChange = (sessionId: string, value: string) => {
    setEditingTranscription(prev => ({ ...prev, [sessionId]: value }));
  };

  const handleSaveTranscription = async (sessionId: string) => {
    const transcription = editingTranscription[sessionId];
    if (!transcription) return;

    setSavingTranscription(prev => ({ ...prev, [sessionId]: true }));
    try {
      await api.updateTranscription(sessionId, transcription);
      if (selectedPlan) {
        await fetchPlanDetails(selectedPlan.id);
      }
      setSaveFeedback(prev => ({ ...prev, [sessionId]: 'success' }));
      setTimeout(() => setSaveFeedback(prev => ({ ...prev, [sessionId]: null })), 2000);
    } catch (err) {
      console.error('Failed to save transcription:', err);
      setSaveFeedback(prev => ({ ...prev, [sessionId]: 'error' }));
      setTimeout(() => setSaveFeedback(prev => ({ ...prev, [sessionId]: null })), 3000);
    } finally {
      setSavingTranscription(prev => ({ ...prev, [sessionId]: false }));
    }
  };

  // ===== Re-analysis handlers =====
  const pollSessionStatus = async (sessionId: string, targetStatus: string): Promise<boolean> => {
    const maxAttempts = 60; // Max 60 attempts (60 seconds)
    let attempts = 0;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second

      try {
        const session = await api.getSession(sessionId);
        if (session.status === 'completed' || session.status === targetStatus) {
          return true;
        }
        if (session.status === 'error') {
          throw new Error(session.error_message || 'Analysis failed');
        }
      } catch (err) {
        console.error('Polling error:', err);
      }

      attempts++;
    }

    throw new Error('Timeout waiting for analysis to complete');
  };

  const pollSessionField = async (sessionId: string, field: string, previousUpdatedAt?: string): Promise<boolean> => {
    const maxAttempts = 60;
    let attempts = 0;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));

      try {
        const session = await api.getSession(sessionId);
        if (session.status === 'error') {
          throw new Error(session.error_message || 'Processing failed');
        }
        const value = (session as unknown as Record<string, unknown>)[field];
        if (value !== null && value !== undefined) {
          // If we have a previous updated_at, wait until it actually changes
          if (previousUpdatedAt && session.updated_at === previousUpdatedAt) {
            // Data exists but hasn't been updated yet - keep waiting
            attempts++;
            continue;
          }
          return true;
        }
      } catch (err) {
        if (err instanceof Error && err.message.includes('failed')) throw err;
        console.error('Polling error:', err);
      }

      attempts++;
    }

    throw new Error(`Timeout waiting for ${field}`);
  };

  const handleBatchAnalyze = async (sessionId: string, planId: string, modelConfig: { provider: string; model: string }) => {
    setReanalyzing(prev => ({ ...prev, [sessionId]: true }));
    setPhaseResult(prev => ({ ...prev, [sessionId]: null }));
    const startTime = Date.now();
    const modelLabel = `${modelConfig.provider}/${modelConfig.model}`;

    try {
      // Get current updated_at before starting
      const currentSession = await api.getSession(sessionId);
      let previousUpdatedAt = currentSession.updated_at;

      // Phase 1: Fact Extraction
      setReanalysisPhase(prev => ({ ...prev, [sessionId]: `Phase 1 実行中... (${modelLabel})` }));
      await api.triggerPhase1(sessionId, false, modelConfig.provider, modelConfig.model);
      await pollSessionStatus(sessionId, 'analyzed');

      // Update previousUpdatedAt for Phase 2
      const afterPhase1 = await api.getSession(sessionId);
      previousUpdatedAt = afterPhase1.updated_at;

      // Phase 2: Fact Structuring
      setReanalysisPhase(prev => ({ ...prev, [sessionId]: `Phase 2 実行中... (${modelLabel})` }));
      await api.triggerPhase2(sessionId, false, modelConfig.provider, modelConfig.model);
      await pollSessionField(sessionId, 'fact_structuring_result_v1', previousUpdatedAt);

      // Update previousUpdatedAt for Phase 3
      const afterPhase2 = await api.getSession(sessionId);
      previousUpdatedAt = afterPhase2.updated_at;

      // Phase 3: Assessment
      setReanalysisPhase(prev => ({ ...prev, [sessionId]: `Phase 3 実行中... (${modelLabel})` }));
      await api.triggerPhase3(sessionId, false, modelConfig.provider, modelConfig.model);
      await pollSessionField(sessionId, 'assessment_result_v1', previousUpdatedAt);

      // Refresh plan data
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      setReanalysisPhase(prev => ({ ...prev, [sessionId]: '完了' }));
      setPhaseResult(prev => ({ ...prev, [sessionId]: { status: 'success', message: `全Phase完了 (${modelLabel}, ${elapsed}秒)` } }));
      await fetchPlanDetails(planId);
    } catch (err) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.error('Batch analysis failed:', err);
      const errorMsg = err instanceof Error ? err.message : '不明';
      setReanalysisPhase(prev => ({ ...prev, [sessionId]: `エラー: ${errorMsg}` }));
      setPhaseResult(prev => ({ ...prev, [sessionId]: { status: 'error', message: `エラー: ${errorMsg} (${elapsed}秒)` } }));
      await new Promise(resolve => setTimeout(resolve, 3000));
    } finally {
      setReanalyzing(prev => ({ ...prev, [sessionId]: false }));
      setReanalysisPhase(prev => ({ ...prev, [sessionId]: '' }));
      setTimeout(() => setPhaseResult(prev => ({ ...prev, [sessionId]: null })), 10000);
    }
  };

  // ===== Prompt editing handlers =====
  const handlePromptChange = (sessionId: string, phase: string, value: string) => {
    setEditingPrompt(prev => ({ ...prev, [`${sessionId}_${phase}`]: value }));
  };

  const getPromptKey = (sessionId: string, phase: string) => `${sessionId}_${phase}`;

  const handleSavePrompt = async (sessionId: string, phase: string) => {
    const key = getPromptKey(sessionId, phase);
    const prompt = editingPrompt[key];
    if (!prompt) return;

    setSavingPrompt(prev => ({ ...prev, [key]: true }));
    try {
      await api.updatePrompt(sessionId, phase, prompt);
      if (selectedPlan) {
        await fetchPlanDetails(selectedPlan.id);
      }
      setPromptFeedback(prev => ({ ...prev, [key]: 'success' }));
      setTimeout(() => setPromptFeedback(prev => ({ ...prev, [key]: null })), 2000);
    } catch (err) {
      console.error('Failed to save prompt:', err);
      setPromptFeedback(prev => ({ ...prev, [key]: 'error' }));
      setTimeout(() => setPromptFeedback(prev => ({ ...prev, [key]: null })), 3000);
    } finally {
      setSavingPrompt(prev => ({ ...prev, [key]: false }));
    }
  };

  const handlePhaseOnlyReanalyze = async (sessionId: string, planId: string, phase: 1 | 2 | 3, modelConfig: { provider: string; model: string }) => {
    setReanalyzing(prev => ({ ...prev, [sessionId]: true }));
    setPhaseResult(prev => ({ ...prev, [sessionId]: null }));
    const startTime = Date.now();
    const modelLabel = `${modelConfig.provider}/${modelConfig.model}`;

    try {
      setReanalysisPhase(prev => ({ ...prev, [sessionId]: `Phase ${phase} 実行中... (${modelLabel})` }));

      // Get current updated_at before starting, to detect actual change
      const currentSession = await api.getSession(sessionId);
      const previousUpdatedAt = currentSession.updated_at;

      if (phase === 1) {
        await api.triggerPhase1(sessionId, true, modelConfig.provider, modelConfig.model);
        await pollSessionStatus(sessionId, 'analyzed');
      } else if (phase === 2) {
        await api.triggerPhase2(sessionId, true, modelConfig.provider, modelConfig.model);
        await pollSessionField(sessionId, 'fact_structuring_result_v1', previousUpdatedAt);
      } else if (phase === 3) {
        await api.triggerPhase3(sessionId, true, modelConfig.provider, modelConfig.model);
        await pollSessionField(sessionId, 'assessment_result_v1', previousUpdatedAt);
      }

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      setReanalysisPhase(prev => ({ ...prev, [sessionId]: '完了' }));
      setPhaseResult(prev => ({ ...prev, [sessionId]: { status: 'success', message: `Phase ${phase} 完了 (${modelLabel}, ${elapsed}秒)` } }));
      await fetchPlanDetails(planId);
    } catch (err) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.error(`Phase ${phase} analysis failed:`, err);
      const errorMsg = err instanceof Error ? err.message : '不明';
      setReanalysisPhase(prev => ({ ...prev, [sessionId]: `エラー: ${errorMsg}` }));
      setPhaseResult(prev => ({ ...prev, [sessionId]: { status: 'error', message: `Phase ${phase} エラー: ${errorMsg} (${elapsed}秒)` } }));
      await new Promise(resolve => setTimeout(resolve, 3000));
    } finally {
      setReanalyzing(prev => ({ ...prev, [sessionId]: false }));
      setReanalysisPhase(prev => ({ ...prev, [sessionId]: '' }));
      // Auto-clear result after 10 seconds
      setTimeout(() => setPhaseResult(prev => ({ ...prev, [sessionId]: null })), 10000);
    }
  };

  const handleGeneratePhase1Prompt = async (sessionId: string, planId: string) => {
    setReanalyzing(prev => ({ ...prev, [sessionId]: true }));
    setReanalysisPhase(prev => ({ ...prev, [sessionId]: 'Phase 1プロンプト生成中...' }));

    try {
      const result = await api.generatePhase1Prompt(sessionId);

      if (result.success && result.prompt) {
        // Store generated prompt in editing state
        const key = `${sessionId}_phase1`;
        setEditingPrompt(prev => ({ ...prev, [key]: result.prompt }));

        // Refresh plan data
        await fetchPlanDetails(planId);

        // Switch to Phase 1 tab
        setActiveTab(planId, 'phase1');

        setReanalysisPhase(prev => ({ ...prev, [sessionId]: '完了' }));
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (err) {
      console.error('Failed to generate Phase 1 prompt:', err);
      setReanalysisPhase(prev => ({ ...prev, [sessionId]: `エラー: ${err instanceof Error ? err.message : '不明'}` }));
      await new Promise(resolve => setTimeout(resolve, 3000));
    } finally {
      setReanalyzing(prev => ({ ...prev, [sessionId]: false }));
      setReanalysisPhase(prev => ({ ...prev, [sessionId]: '' }));
    }
  };

  const handleGeneratePhase2Prompt = async (sessionId: string, planId: string) => {
    setReanalyzing(prev => ({ ...prev, [sessionId]: true }));
    setReanalysisPhase(prev => ({ ...prev, [sessionId]: 'Phase 2プロンプト生成中...' }));

    try {
      const result = await api.generatePhase2Prompt(sessionId);

      if (result.success && result.prompt) {
        // Store generated prompt in editing state
        const key = `${sessionId}_phase2`;
        setEditingPrompt(prev => ({ ...prev, [key]: result.prompt }));

        // Refresh plan data
        await fetchPlanDetails(planId);

        // Switch to Phase 2 tab
        setActiveTab(planId, 'phase2');

        setReanalysisPhase(prev => ({ ...prev, [sessionId]: '完了' }));
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (err) {
      console.error('Failed to generate Phase 2 prompt:', err);
      setReanalysisPhase(prev => ({ ...prev, [sessionId]: `エラー: ${err instanceof Error ? err.message : '不明'}` }));
      await new Promise(resolve => setTimeout(resolve, 3000));
    } finally {
      setReanalyzing(prev => ({ ...prev, [sessionId]: false }));
      setReanalysisPhase(prev => ({ ...prev, [sessionId]: '' }));
    }
  };

  const handleGeneratePhase3Prompt = async (sessionId: string, planId: string) => {
    setReanalyzing(prev => ({ ...prev, [sessionId]: true }));
    setReanalysisPhase(prev => ({ ...prev, [sessionId]: 'Phase 3プロンプト生成中...' }));

    try {
      const result = await api.generatePhase3Prompt(sessionId);

      if (result.success && result.prompt) {
        const key = `${sessionId}_phase3`;
        setEditingPrompt(prev => ({ ...prev, [key]: result.prompt }));

        await fetchPlanDetails(planId);

        // Switch to Phase 3 tab
        setActiveTab(planId, 'phase3');

        setReanalysisPhase(prev => ({ ...prev, [sessionId]: '完了' }));
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (err) {
      console.error('Failed to generate Phase 3 prompt:', err);
      setReanalysisPhase(prev => ({ ...prev, [sessionId]: `エラー: ${err instanceof Error ? err.message : '不明'}` }));
      await new Promise(resolve => setTimeout(resolve, 3000));
    } finally {
      setReanalyzing(prev => ({ ...prev, [sessionId]: false }));
      setReanalysisPhase(prev => ({ ...prev, [sessionId]: '' }));
    }
  };

  const handleCreateManualSession = async (plan: SupportPlan) => {
    setCreatingManualSession(prev => ({ ...prev, [plan.id]: true }));

    try {
      const facilityId = "00000000-0000-0000-0000-000000000001";
      const result = await api.createManualSession({
        facility_id: facilityId,
        subject_id: plan.subject_id || '',
        support_plan_id: plan.id,
      });

      if (result.success) {
        await fetchPlanDetails(plan.id);
        await fetchSupportPlans();
      }
    } catch (err) {
      console.error('Failed to create manual session:', err);
      alert('セッション作成に失敗しました');
    } finally {
      setCreatingManualSession(prev => ({ ...prev, [plan.id]: false }));
    }
  };

  const getStatusIcon = (status: InterviewSession['status']) => {
    switch (status) {
      case 'completed':
        return (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="var(--accent-success)" strokeWidth="1.5" />
            <path d="M5 8L7 10L11 6" stroke="var(--accent-success)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      case 'transcribing':
      case 'analyzing':
        return (
          <svg width="16" height="16" className="spinning" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="var(--text-muted)" strokeWidth="1.5" opacity="0.3" />
            <path d="M8 2C4.69 2 2 4.69 2 8" stroke="var(--accent-primary)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        );
      case 'error':
        return (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="var(--accent-danger)" strokeWidth="1.5" />
            <path d="M10 6L6 10M6 6L10 10" stroke="var(--accent-danger)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        );
      default:
        return (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="var(--text-muted)" strokeWidth="1.5" strokeDasharray="2 2" />
          </svg>
        );
    }
  };

  const getStatusLabel = (status: InterviewSession['status']) => {
    switch (status) {
      case 'completed': return '完了';
      case 'transcribing': return '文字起こし中';
      case 'transcribed': return '文字起こし完了';
      case 'analyzing': return '分析中';
      case 'error': return 'エラー';
      case 'uploaded': return 'アップロード済み';
      default: return '待機中';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDateOnly = (dateString: string | null | undefined) => {
    if (!dateString) return '---';
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };


  // Get plan status badge (for plan card)
  const getPlanStatusBadge = (plan: SupportPlan): { label: string; icon: string; color: string } => {
    const sessions = plan.sessions || [];

    if (sessions.length === 0) {
      return {
        label: '手動作成',
        icon: '✏️',
        color: '#6B7280' // gray
      };
    }

    const latestSession = sessions[0];

    switch (latestSession.status) {
      case 'uploaded':
        return { label: '録音完了・処理待ち', icon: '🔄', color: '#F59E0B' }; // amber
      case 'transcribing':
        return { label: '文字起こし中...', icon: '🔄', color: '#3B82F6' }; // blue
      case 'transcribed':
        return { label: '事実抽出待ち', icon: '🔄', color: '#8B5CF6' }; // violet
      case 'analyzing':
        return { label: 'AI分析中...', icon: '🔄', color: '#8B5CF6' }; // violet
      case 'completed':
        return { label: 'アセスメント完了', icon: '✅', color: '#10B981' }; // green
      case 'error':
        return { label: 'エラー発生', icon: '⚠️', color: '#EF4444' }; // red
      default:
        return { label: '処理中', icon: '🔄', color: '#6B7280' }; // gray
    }
  };

  const handleRecordingStart = (childName: string) => {
    setSelectedChild(childName);
    setRecordingMode('recording');
  };

  const handleRecordingStop = async (sessionId?: string) => {
    setRecordingMode('none');

    try {
      // If we were in the "new plan via assessment" flow, create the plan now
      if (pendingPlanTitle && sessionId) {
        setCreating(true);
        const newPlan = await api.createSupportPlan({
          subject_id: initialSubjectId || '',
          title: pendingPlanTitle,
          status: 'draft'
        });

        // Link the session to the new plan
        await api.updateSession(sessionId, {
          support_plan_id: newPlan.id
        });

        // Clear pending state
        setPendingPlanTitle(null);

        // Fetch everything again
        await fetchSupportPlans();
        await fetchPlanDetails(newPlan.id);
      } else {
        // Normal session recording for an existing plan
        await fetchSupportPlans();
        if (selectedPlan) {
          await fetchPlanDetails(selectedPlan.id);
        }
      }
    } catch (error) {
      console.error('Failed to complete assessment flow:', error);
      alert('計画書の作成または紐付けに失敗しました。');
    } finally {
      setCreating(false);
    }
  };

  const handleRecordingCancel = () => {
    setRecordingMode('none');
    setPendingPlanTitle(null); // Clear any pending plan title
  };

  const handleCreatePlan = () => {
    // Show modal to choose creation method
    setShowCreateModal(true);
  };

  const handleManualCreate = async () => {
    if (creating) return;

    setCreating(true);
    setShowCreateModal(false);
    try {
      // Generate automatic title with current date
      const today = new Date();
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const title = `個別支援計画書-${dateStr}`;

      // Create plan immediately without modal
      await api.createSupportPlan({
        subject_id: initialSubjectId || '',
        title: title,
        status: 'draft'
      });

      // Refresh the list
      await fetchSupportPlans();
    } catch (error) {
      console.error('Failed to create plan:', error);
      alert('計画書の作成に失敗しました。');
    } finally {
      setCreating(false);
    }
  };

  const handleAssessmentCreate = async () => {
    if (creating) return;

    setShowCreateModal(false);

    // Generate automatic title with current date but DON'T create the plan yet
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const title = `個別支援計画書-${dateStr}`;

    setPendingPlanTitle(title);

    // Try to get child info for the recording screen
    if (initialSubjectId) {
      try {
        const subjectData = await api.getSubject(initialSubjectId);
        setSelectedChild(subjectData.subject.name);
        setPendingSubjectName(subjectData.subject.name);
        setPendingSubjectAvatar(subjectData.subject.avatar_url || null);
      } catch (e) {
        console.warn('Failed to fetch subject info for recording:', e);
      }
    }

    // Open recording mode
    setRecordingMode('setup');
  };

  const handleDownloadExcel = async (plan: SupportPlan) => {
    try {
      // Use plan_id directly (session not required)
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8052';
      const apiToken = import.meta.env.VITE_API_TOKEN || 'watchme-b2b-poc-2025';

      const response = await fetch(`${apiBaseUrl}/api/support-plans/${plan.id}/download-excel`, {
        headers: {
          'X-API-Token': apiToken
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Excel download failed:', errorText);
        throw new Error('Failed to download Excel');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeTitle = plan.title ? plan.title.replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/g, '_').slice(0, 30) : plan.id.slice(0, 8);
      a.download = `個別支援計画_${safeTitle}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      alert('Excelのダウンロードに失敗しました。');
    }
  };

  const handleDeletePlan = async (plan: SupportPlan) => {
    // Confirmation dialog
    const sessionCount = plan.sessions?.length || 0;
    const message = sessionCount > 0
      ? `「${plan.title}」を削除しますか？\n\n関連する${sessionCount}件のセッションも削除されます。\nこの操作は取り消せません。`
      : `「${plan.title}」を削除しますか？\n\nこの操作は取り消せません。`;

    if (!confirm(message)) {
      return;
    }

    try {
      await api.deleteSupportPlan(plan.id);

      // Close drawer if the deleted plan was selected
      if (selectedPlan?.id === plan.id) {
        setSelectedPlan(null);
      }

      // Refresh the list
      await fetchSupportPlans();

      alert('個別支援計画書を削除しました。');
    } catch (error) {
      console.error('Failed to delete plan:', error);
      alert('削除に失敗しました。');
    }
  };

  // Show recording modes
  if (recordingMode === 'setup') {
    return (
      <RecordingSetup
        onStart={handleRecordingStart}
        onCancel={handleRecordingCancel}
        subjectName={pendingSubjectName || selectedChild}
        subjectAvatar={pendingSubjectAvatar || undefined}
      />
    );
  }

  if (recordingMode === 'recording') {
    return (
      <RecordingSession
        childName={selectedChild}
        childAvatar={pendingSubjectAvatar || undefined}
        subjectId={selectedPlan?.subject_id || initialSubjectId || ''}
        supportPlanId={selectedPlan?.id}
        onStop={handleRecordingStop}
      />
    );
  }

  return (
    <div className="support-plan-create">
      {!hideHeader && (
        <div className="page-header">
          <div>
            <h1 className="page-title">個別支援計画管理</h1>
            <p className="page-subtitle">保護者ヒアリング録音から個別支援計画書を自動生成</p>
          </div>
          <button className="primary-button" onClick={handleCreatePlan} disabled={creating}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            {creating ? '作成中...' : '新規計画作成'}
          </button>
        </div>
      )}

      {/* Support Plans List */}

      {/* Support Plans List */}
      <div className="plan-islands-container">
        {loading && (
          <div style={{ padding: '48px', textAlign: 'center' }}>
            <div className="spinning" style={{ marginBottom: '16px' }}>
              <svg width="32" height="32" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="var(--text-muted)" strokeWidth="1.5" opacity="0.3" />
                <path d="M8 2C4.69 2 2 4.69 2 8" stroke="var(--accent-primary)" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <p style={{ color: 'var(--text-secondary)' }}>計画データを読み込み中...</p>
          </div>
        )}

        {error && (
          <div style={{ padding: '24px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)', borderRadius: '12px' }}>
            <p>エラーが発生しました: {error}</p>
          </div>
        )}

        {!loading && !error && supportPlans.length === 0 && (
          <div style={{ padding: '48px', textAlign: 'center', background: 'var(--bg-tertiary)', borderRadius: '16px', border: '1px dashed var(--border-color)' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '16px' }}>登録されている個別支援計画がありません</p>
          </div>
        )}

        {supportPlans.map(plan => (
          <div key={plan.id} className="plan-island">
            {/* Plan Header */}
            <div className="plan-header">
              <div className="plan-title-area">
                <h3 className="plan-title">{plan.title}</h3>
                <div className="plan-badge-row">
                  {(() => {
                    const statusBadge = getPlanStatusBadge(plan);
                    return (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '13px',
                        fontWeight: '600',
                        color: statusBadge.color,
                        background: `${statusBadge.color}15`,
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: `1px solid ${statusBadge.color}30`
                      }}>
                        <span>{statusBadge.icon}</span>
                        <span>{statusBadge.label}</span>
                      </span>
                    );
                  })()}
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    作成日: {formatDate(plan.created_at)}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    プランID: {plan.id}
                  </span>
                </div>
              </div>
              <div className="session-actions">
                <button
                  className="action-button"
                  title="AI分析結果を反映"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSyncFromAssessment(plan.id);
                  }}
                  style={{ background: 'rgba(124, 77, 255, 0.1)', color: '#7c4dff', borderColor: 'rgba(124, 77, 255, 0.2)' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
                  </svg>
                </button>
                <button
                  className="action-button"
                  title="Excelダウンロード"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownloadExcel(plan);
                  }}
                  style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#16a34a', borderColor: 'rgba(34, 197, 94, 0.2)' }}
                >
                  <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                    <path d="M12 10V12H4V10M8 3V9M8 9L11 6M8 9L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <button
                  className="action-button"
                  title="削除"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeletePlan(plan);
                  }}
                  style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="plan-tabs">
              <button
                className={`plan-tab ${getActiveTab(plan.id) === 'assessment' ? 'active' : ''}`}
                onClick={() => setActiveTab(plan.id, 'assessment')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                0: アセスメント
              </button>
              <button
                className={`plan-tab ${getActiveTab(plan.id) === 'phase1' ? 'active' : ''}`}
                onClick={() => setActiveTab(plan.id, 'phase1')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                1: 事実抽出
              </button>
              <button
                className={`plan-tab ${getActiveTab(plan.id) === 'phase2' ? 'active' : ''}`}
                onClick={() => setActiveTab(plan.id, 'phase2')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
                2: 事実分析
              </button>
              <button
                className={`plan-tab ${getActiveTab(plan.id) === 'phase3' ? 'active' : ''}`}
                onClick={() => setActiveTab(plan.id, 'phase3')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 12l2 2 4-4" />
                  <circle cx="12" cy="12" r="10" />
                </svg>
                3: 生成
              </button>
              <button
                className={`plan-tab ${getActiveTab(plan.id) === 'home' ? 'active' : ''}`}
                onClick={() => setActiveTab(plan.id, 'home')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                4: 個別支援計画書
              </button>
            </div>

            {/* Tab Content */}
            {getActiveTab(plan.id) === 'home' && (
              <>
                {/* Official Document Header Section */}
                <div className="official-document-header">
                  <h2 className="doc-main-title">個別支援計画書</h2>

                  {/* Main Info Table */}
                  <div className="doc-info-table">
                    <div className="doc-row">
                      <div className="doc-row-split">
                        <div className="doc-half">
                          <div className="doc-cell label">事業所名</div>
                          <div className="doc-cell value">
                            <EditableField
                              planId={plan.id}
                              field="facility_name"
                              value={plan.facility_name ?? null}
                              aiValue={profile?.facility_name || null}
                              type="text"
                              label="事業所名"
                              onSave={(field, value) => handleFieldSave(plan.id, field, value)}
                            />
                          </div>
                        </div>
                        <div className="doc-half">
                          <div className="doc-cell label">生年月日</div>
                          <div className="doc-cell value">
                            {plan.subjects?.birth_date ? formatDateOnly(plan.subjects.birth_date) : '---'}
                            ({calculateAge(plan.subjects?.birth_date) ?? '---'}歳)
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="doc-row">
                      <div className="doc-row-split">
                        <div className="doc-half">
                          <div className="doc-cell label">計画作成者</div>
                          <div className="doc-cell value">
                            <EditableField
                              planId={plan.id}
                              field="manager_name"
                              value={plan.manager_name ?? null}
                              aiValue={profile?.name || null}
                              type="text"
                              label="計画作成者"
                              onSave={(field, value) => handleFieldSave(plan.id, field, value)}
                            />
                          </div>
                        </div>
                        <div className="doc-half">
                          <div className="doc-cell label">計画作成日</div>
                          <div className="doc-cell value">{formatDate(plan.created_at)}</div>
                        </div>
                      </div>
                    </div>
                    <div className="doc-row">
                      <div className="doc-row-split">
                        <div className="doc-half">
                          <div className="doc-cell label">利用者氏名</div>
                          <div className="doc-cell value name">{plan.subjects?.name || '---'} 様</div>
                        </div>
                        <div className="doc-half">
                          <div className="doc-cell label">モニタリング期間</div>
                          <div className="doc-cell value" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <EditableField
                              planId={plan.id}
                              field="monitoring_start"
                              value={plan.monitoring_start ?? null}
                              aiValue={null}
                              type="date"
                              label="開始日"
                              placeholder="開始日"
                              onSave={(field, value) => handleFieldSave(plan.id, field, value)}
                            />
                            <span>〜</span>
                            <EditableField
                              planId={plan.id}
                              field="monitoring_end"
                              value={plan.monitoring_end ?? null}
                              aiValue={null}
                              type="date"
                              label="終了日"
                              placeholder="終了日"
                              onSave={(field, value) => handleFieldSave(plan.id, field, value)}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="doc-row">
                      <div className="doc-cell label">利用者及びその家族の生活に対する意向・ニーズ（生活全般の質を向上させるための課題）</div>
                      <div className="doc-cell value" style={{ padding: 0 }}>
                        <div className="nested-info-table">
                          <div className="nested-info-row">
                            <div className="nested-label">ご本人</div>
                            <div className="nested-value">
                              <EditableField
                                planId={plan.id}
                                field="child_intention_user_edited"
                                value={plan.child_intention_user_edited ?? null}
                                aiValue={plan.child_intention_ai_generated ?? null}
                                type="textarea"
                                label="ご本人の意向"
                                placeholder="情報が取得できませんでした"
                                onSave={(field, value) => handleFieldSave(plan.id, field, value)}
                              />
                            </div>
                          </div>
                          <div className="nested-info-row">
                            <div className="nested-label">ご家族</div>
                            <div className="nested-value">
                              <EditableField
                                planId={plan.id}
                                field="family_intention_user_edited"
                                value={plan.family_intention_user_edited ?? null}
                                aiValue={plan.family_intention_ai_generated ?? null}
                                type="textarea"
                                label="ご家族の意向"
                                placeholder="情報が取得できませんでした"
                                onSave={(field, value) => handleFieldSave(plan.id, field, value)}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Service Time Table */}
                  <div className="doc-info-table">
                    <div className="doc-row">
                      <div className="doc-cell label large">支援の標準的な提供時間等(曜日・頻度・時間)</div>
                      <div className="doc-cell value">
                        <EditableField
                          planId={plan.id}
                          field="service_schedule"
                          value={plan.service_schedule ?? null}
                          aiValue={null}
                          type="textarea"
                          label="支援提供時間"
                          placeholder="週一回(火曜日)、サービス提供時間は原則13時55分から17時..."
                          onSave={(field, value) => handleFieldSave(plan.id, field, value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Notes Section Table */}
                  <div className="doc-info-table">
                    <div className="doc-row">
                      <div className="doc-cell label large">留意点・備考</div>
                      <div className="doc-cell value">
                        <EditableField
                          planId={plan.id}
                          field="notes"
                          value={plan.notes ?? null}
                          aiValue={null}
                          type="textarea"
                          label="留意点・備考"
                          placeholder="安全確保のための対応、アレルギー情報など..."
                          onSave={(field, value) => handleFieldSave(plan.id, field, value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* General Policy Table */}
                  <div className="doc-info-table">
                    <div className="doc-row">
                      <div className="doc-cell label large">総合的な支援の方針</div>
                      <div className="doc-cell value" style={{ fontWeight: 500, lineHeight: 1.8 }}>
                        <EditableField
                          planId={plan.id}
                          field="general_policy_user_edited"
                          value={plan.general_policy_user_edited ?? null}
                          aiValue={plan.general_policy_ai_generated ?? null}
                          type="textarea"
                          label="総合的な支援の方針"
                          placeholder="子どもの理解と支援方針を入力..."
                          onSave={(field, value) => handleFieldSave(plan.id, field, value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Long Term Goal Table */}
                  <div className="doc-info-table">
                    <div className="doc-row">
                      <div className="doc-row-split">
                        <div className="doc-half">
                          <div className="doc-cell label">長期目標</div>
                          <div className="doc-cell value">
                            <EditableField
                              planId={plan.id}
                              field="long_term_goal_user_edited"
                              value={plan.long_term_goal_user_edited ?? null}
                              aiValue={plan.long_term_goal_ai_generated ?? null}
                              type="textarea"
                              label="長期目標"
                              placeholder="長期目標を入力..."
                              onSave={(field, value) => handleFieldSave(plan.id, field, value)}
                            />
                          </div>
                        </div>
                        <div className="doc-half" style={{ flex: '0 0 250px' }}>
                          <div className="doc-cell label" style={{ width: '80px' }}>期間</div>
                          <div className="doc-cell value">
                            <EditableField
                              planId={plan.id}
                              field="long_term_period_user_edited"
                              value={plan.long_term_period_user_edited ?? null}
                              aiValue={plan.long_term_period_ai_generated ?? '1年'}
                              type="text"
                              label="長期目標期間"
                              placeholder="1年"
                              onSave={(field, value) => handleFieldSave(plan.id, field, value)}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="doc-row">
                      <div className="doc-row-split">
                        <div className="doc-half">
                          <div className="doc-cell label">短期目標</div>
                          <div className="doc-cell value">
                            <EditableField
                              planId={plan.id}
                              field="short_term_goal"
                              value={plan.short_term_goal ?? null}
                              aiValue={plan.short_term_goals_ai_generated?.[0]?.goal ?? null}
                              type="textarea"
                              label="短期目標"
                              placeholder="短期目標を入力..."
                              onSave={(field, value) => handleFieldSave(plan.id, field, value)}
                            />
                          </div>
                        </div>
                        <div className="doc-half" style={{ flex: '0 0 250px' }}>
                          <div className="doc-cell label" style={{ width: '80px' }}>期間</div>
                          <div className="doc-cell value">
                            <EditableField
                              planId={plan.id}
                              field="short_term_period"
                              value={plan.short_term_period ?? null}
                              aiValue={plan.short_term_goals_ai_generated?.[0]?.timeline ?? '6ヶ月'}
                              type="text"
                              label="短期目標期間"
                              placeholder="6ヶ月"
                              onSave={(field, value) => handleFieldSave(plan.id, field, value)}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Document Page Footer */}
                  <div className="doc-footer">
                    <span className="page-indicator">個別支援計画書 1/2ページ</span>
                  </div>
                </div>

                {/* Page 2: Support Details Table */}
                <div className="official-document-header">
                  <div className="support-details-wrapper">
                    <table className="support-details-table">
                      <thead>
                        <tr>
                          <th>項目</th>
                          <th>具体的な到達目標</th>
                          <th>
                            具体的な支援内容・5領域との関係性等
                            <br />
                            <span style={{ fontSize: '10px', fontWeight: 'normal' }}>
                              ※ 5領域「健康・生活」「運動・感覚」「認知・行動」「言語・コミュニケーション」「人間関係・社会性」
                            </span>
                          </th>
                          <th>達成時期</th>
                          <th>担当者<br />提供期間</th>
                          <th>留意事項</th>
                          <th>優先順位</th>
                          <th>操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(plan.support_items_user_edited ?? plan.support_items_ai_generated ?? []).map((item, index) => (
                          <EditableTableRow
                            key={index}
                            planId={plan.id}
                            index={index}
                            item={item}
                            aiItem={plan.support_items_ai_generated?.[index]}
                            onSave={(idx, updatedItem) => handleSupportItemSave(plan.id, idx, updatedItem)}
                            onDelete={(idx) => handleSupportItemDelete(plan.id, idx)}
                          />
                        ))}
                        {/* Add new row button */}
                        <tr>
                          <td colSpan={8} style={{ textAlign: 'center', padding: '12px' }}>
                            <button
                              onClick={() => handleAddSupportItem(plan.id)}
                              style={{
                                background: 'rgba(124, 77, 255, 0.1)',
                                color: 'var(--accent-primary)',
                                border: '1px dashed var(--accent-primary)',
                                borderRadius: '6px',
                                padding: '8px 16px',
                                cursor: 'pointer',
                                fontSize: '13px'
                              }}
                            >
                              + 支援項目を追加
                            </button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Agreement Statement */}
                  <div style={{ marginTop: '32px', marginBottom: '32px', fontSize: '14px', lineHeight: '1.8' }}>
                    提供する支援内容について、本計画書に基づき説明を受け、内容に同意しました。
                  </div>

                  {/* Explanation and Consent Table */}
                  <div className="doc-info-table">
                    <div className="doc-row">
                      <div className="doc-cell label" style={{ width: '140px' }}>説明者</div>
                      <div className="doc-cell value">
                        <EditableField
                          planId={plan.id}
                          field="explainer_name"
                          value={plan.explainer_name ?? null}
                          aiValue={profile?.name || null}
                          type="text"
                          label="説明者"
                          onSave={(field, value) => handleFieldSave(plan.id, field, value)}
                        />
                      </div>
                    </div>
                    <div className="doc-row">
                      <div className="doc-row-split">
                        <div className="doc-half">
                          <div className="doc-cell label">説明・同意日</div>
                          <div className="doc-cell value">
                            <EditableField
                              planId={plan.id}
                              field="consent_date"
                              value={plan.consent_date ?? null}
                              aiValue={null}
                              type="date"
                              label="説明・同意日"
                              placeholder="日付を選択"
                              onSave={(field, value) => handleFieldSave(plan.id, field, value)}
                            />
                          </div>
                        </div>
                        <div className="doc-half">
                          <div className="doc-cell label">保護者氏名</div>
                          <div className="doc-cell value" style={{ position: 'relative', minHeight: '50px' }}>
                            <span style={{
                              position: 'absolute',
                              bottom: '8px',
                              right: '12px',
                              fontSize: '11px',
                              color: '#999'
                            }}>(自署または捺印)</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Document Page Footer */}
                  <div className="doc-footer">
                    <span className="page-indicator">個別支援計画書 2/2ページ</span>
                  </div>
                </div>

                {/* Excel Download Button - outside document UI */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                  <button
                    className="excel-download-mini-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownloadExcel(plan);
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                      <path d="M12 10V12H4V10M8 3V9M8 9L11 6M8 9L5 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Excelをダウンロード
                  </button>
                </div>

              </>
            )}

            {/* Assessment Tab Content */}
            {getActiveTab(plan.id) === 'assessment' && (
              <div className="tab-content-assessment" style={{ display: 'grid', gap: '16px' }}>

                {plan.sessions && plan.sessions.length > 0 ? (
                  <>
                    {/* Session Info Section */}
                    <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px' }}>
                      <h5 style={{ fontSize: '14px', fontWeight: '600', margin: '0 0 12px 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '4px', height: '16px', background: 'var(--accent-primary)', borderRadius: '2px' }}></span>
                        セッション情報
                      </h5>
                      <div style={{ display: 'grid', gap: '8px', fontSize: '13px' }}>
                        <div style={{ display: 'flex', gap: '12px' }}>
                          <span style={{ fontWeight: '600', color: 'var(--text-secondary)', minWidth: '100px' }}>セッションID:</span>
                          <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: '12px' }}>{plan.sessions[0].id}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                          <span style={{ fontWeight: '600', color: 'var(--text-secondary)', minWidth: '100px' }}>実施日時:</span>
                          <span style={{ color: 'var(--text-primary)' }}>{formatDate(plan.sessions[0].recorded_at)}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                          <span style={{ fontWeight: '600', color: 'var(--text-secondary)', minWidth: '100px' }}>ステータス:</span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)' }}>
                            {getStatusIcon(plan.sessions[0].status)}
                            {getStatusLabel(plan.sessions[0].status)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Transcription Section */}
                    <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h5 style={{ fontSize: '14px', fontWeight: '600', margin: '0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ width: '4px', height: '16px', background: 'var(--accent-info, #2196f3)', borderRadius: '2px' }}></span>
                          面談記録
                        </h5>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          {saveFeedback[plan.sessions?.[0]?.id || ''] === 'success' && (
                            <span style={{ color: 'var(--accent-success)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8.5L6.5 12L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                              保存完了
                            </span>
                          )}
                          {saveFeedback[plan.sessions?.[0]?.id || ''] === 'error' && (
                            <span style={{ color: 'var(--accent-danger)', fontSize: '13px' }}>保存失敗</span>
                          )}
                          <button
                            onClick={() => plan.sessions?.[0]?.id && handleSaveTranscription(plan.sessions[0].id)}
                            disabled={savingTranscription[plan.sessions?.[0]?.id || ''] || !editingTranscription[plan.sessions?.[0]?.id || '']}
                            style={{
                              padding: '8px 20px',
                              borderRadius: '6px',
                              border: '1px solid rgba(16, 185, 129, 0.4)',
                              background: '#10b981',
                              color: 'white',
                              fontSize: '13px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              opacity: (!editingTranscription[plan.sessions?.[0]?.id || ''] || savingTranscription[plan.sessions?.[0]?.id || '']) ? 0.4 : 1,
                              transition: 'all 0.2s ease',
                            }}
                          >
                            {savingTranscription[plan.sessions?.[0]?.id || ''] ? '保存中...' : '保存'}
                          </button>
                          <button
                            onClick={() => {
                              if (plan.sessions?.[0]?.id) {
                                handleGeneratePhase1Prompt(plan.sessions[0].id, plan.id);
                              }
                            }}
                            disabled={reanalyzing[plan.sessions?.[0]?.id || '']}
                            style={{
                              padding: '8px 20px',
                              borderRadius: '6px',
                              border: '1px solid rgba(59, 130, 246, 0.4)',
                              background: '#3b82f6',
                              color: 'white',
                              fontSize: '13px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              opacity: reanalyzing[plan.sessions?.[0]?.id || ''] ? 0.6 : 1,
                              transition: 'all 0.2s ease',
                            }}
                          >
                            {reanalyzing[plan.sessions[0].id]
                              ? (reanalysisPhase[plan.sessions?.[0]?.id || ''] || 'Phase 1プロンプト生成中...')
                              : 'Phase 1プロンプト生成'}
                          </button>
                          <button
                            onClick={() => {
                              if (plan.sessions?.[0]?.id) {
                                setModelModalPlanId(plan.id);
                                setModelModalSessionId(plan.sessions[0].id);
                                setShowModelModal(true);
                              }
                            }}
                            disabled={reanalyzing[plan.sessions?.[0]?.id || '']}
                            style={{
                              padding: '8px 20px',
                              borderRadius: '6px',
                              border: '1px solid rgba(124, 77, 255, 0.4)',
                              background: 'var(--accent-primary)',
                              color: 'white',
                              fontSize: '13px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              opacity: reanalyzing[plan.sessions?.[0]?.id || ''] ? 0.6 : 1,
                              transition: 'all 0.2s ease',
                            }}
                          >
                            {reanalyzing[plan.sessions[0].id]
                              ? (reanalysisPhase[plan.sessions?.[0]?.id || ''] || '分析中...')
                              : '分析開始'}
                          </button>
                        </div>
                      </div>
                      <div style={{ background: 'var(--bg-secondary)', borderRadius: '6px', borderLeft: '4px solid var(--accent-primary)', maxHeight: '600px', overflowY: 'auto' }}>
                        <textarea
                          value={editingTranscription[plan.sessions?.[0]?.id || ''] ?? plan.sessions[0].transcription ?? ''}
                          onChange={(e) => plan.sessions?.[0]?.id && handleTranscriptionChange(plan.sessions[0].id, e.target.value)}
                          style={{
                            width: '100%',
                            minHeight: '400px',
                            padding: '16px',
                            fontFamily: 'inherit',
                            fontSize: '13px',
                            lineHeight: '1.7',
                            border: 'none',
                            background: 'transparent',
                            resize: 'vertical',
                            outline: 'none',
                            color: 'var(--text-primary)',
                          }}
                          placeholder="面談記録のテキストを入力してください"
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '32px', textAlign: 'center' }}>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px' }}>
                      アセスメントデータが紐付けられていません
                    </p>
                    <button
                      className="action-button"
                      onClick={() => handleCreateManualSession(plan)}
                      disabled={creatingManualSession[plan.id]}
                      style={{
                        background: 'rgba(16, 185, 129, 0.1)',
                        color: '#10b981',
                        borderColor: 'rgba(16, 185, 129, 0.2)',
                        opacity: creatingManualSession[plan.id] ? 0.5 : 1,
                      }}
                    >
                      {creatingManualSession[plan.id] ? 'セッション作成中...' : '面談記録を手動入力'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Phase 1 Tab Content */}
            {getActiveTab(plan.id) === 'phase1' && (
              <div className="tab-content-phase1">
                <div className="phase-section">
                  <h4 className="phase-title">Phase 1: 事実抽出結果</h4>
                  <p className="phase-description">
                    ヒアリング内容から事実のみを抽出した結果です。推論や解釈は含まれていません。
                  </p>
                  {plan.sessions?.[0]?.model_used_phase1 && (
                    <div style={{ display: 'flex', gap: '16px', padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px', border: '1px solid var(--border-color)' }}>
                      <span><strong>使用モデル:</strong> {plan.sessions[0].model_used_phase1}</span>
                      <span><strong>実行日時:</strong> {formatDate(plan.sessions[0].updated_at)}</span>
                    </div>
                  )}
                  {plan.sessions?.[0] && (() => {
                    const session = plan.sessions![0];
                    const promptKey = getPromptKey(session.id, 'phase1');
                    const currentPrompt = editingPrompt[promptKey] ?? session.fact_extraction_prompt_v1 ?? '';
                    const hasEdit = editingPrompt[promptKey] !== undefined && editingPrompt[promptKey] !== session.fact_extraction_prompt_v1;
                    return (
                      <>
                        {currentPrompt ? (
                          <details className="prompt-viewer">
                            <summary>LLM プロンプトを表示 / 編集</summary>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px' }}>
                              <CopyButton text={currentPrompt} copyKey={`prompt_phase1_${session.id}`} />
                            </div>
                            <textarea
                              className="prompt-editor"
                              value={currentPrompt}
                              onChange={(e) => handlePromptChange(session.id, 'phase1', e.target.value)}
                            />
                            <div className="prompt-actions">
                              <button
                                className="prompt-save-btn"
                                onClick={() => handleSavePrompt(session.id, 'phase1')}
                                disabled={savingPrompt[promptKey] || !hasEdit}
                              >
                                {savingPrompt[promptKey] ? '保存中...' : promptFeedback[promptKey] === 'success' ? '保存完了 ✓' : 'プロンプトを保存'}
                              </button>
                              <button
                                className="prompt-rerun-btn"
                                onClick={() => {
                                  setSelectedModelForPhaseRerun({ provider: 'openai', model: 'gpt-4o' });
                                  setPhaseRerunModal({ sessionId: session.id, planId: plan.id, phase: 1, modelUsed: session.model_used_phase1 || undefined });
                                }}
                                disabled={reanalyzing[session.id]}
                              >
                                {reanalyzing[session.id] ? (reanalysisPhase[session.id] || '実行中...') : 'Phase 1 のみ再実行'}
                              </button>
                            </div>
                            {phaseResult[session.id] && (
                              <div style={{
                                marginTop: '8px',
                                padding: '8px 12px',
                                borderRadius: '6px',
                                fontSize: '13px',
                                fontWeight: '600',
                                background: phaseResult[session.id]!.status === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                color: phaseResult[session.id]!.status === 'success' ? '#10b981' : '#ef4444',
                                border: `1px solid ${phaseResult[session.id]!.status === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                              }}>
                                {phaseResult[session.id]!.status === 'success' ? '\u2713 ' : '\u2717 '}{phaseResult[session.id]!.message}
                              </div>
                            )}
                          </details>
                        ) : null}
                      </>
                    );
                  })()}
                  {plan.sessions && plan.sessions.length > 0 && plan.sessions[0].fact_extraction_result_v1 ? (
                    <>
                      <details className="prompt-viewer">
                        <summary>LLM 出力 (生JSON)</summary>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px' }}>
                          <CopyButton text={JSON.stringify(plan.sessions[0].fact_extraction_result_v1, null, 2)} copyKey={`output_phase1_${plan.sessions[0].id}`} />
                        </div>
                        <pre className="prompt-content">{JSON.stringify(plan.sessions[0].fact_extraction_result_v1, null, 2)}</pre>
                      </details>
                      <Phase1Display data={plan.sessions[0].fact_extraction_result_v1 as any} />
                      {/* Phase 2 prompt generation button */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px', padding: '16px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                        <button
                          onClick={() => {
                            if (plan.sessions?.[0]?.id) {
                              handleGeneratePhase2Prompt(plan.sessions[0].id, plan.id);
                            }
                          }}
                          disabled={reanalyzing[plan.sessions?.[0]?.id || '']}
                          style={{
                            padding: '8px 20px',
                            borderRadius: '6px',
                            border: '1px solid rgba(59, 130, 246, 0.4)',
                            background: '#3b82f6',
                            color: 'white',
                            fontSize: '13px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            opacity: reanalyzing[plan.sessions?.[0]?.id || ''] ? 0.6 : 1,
                            transition: 'all 0.2s ease',
                          }}
                        >
                          {reanalyzing[plan.sessions[0].id]
                            ? (reanalysisPhase[plan.sessions?.[0]?.id || ''] || '事実分析プロンプト生成中...')
                            : '次へ: 事実分析プロンプト生成'}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div style={{ padding: '24px', background: 'var(--bg-secondary)', borderRadius: '12px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
                      Phase 1 の処理結果がありません
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Phase 2 Tab Content */}
            {getActiveTab(plan.id) === 'phase2' && (
              <div className="tab-content-phase2">
                <div className="phase-section">
                  <h4 className="phase-title">Phase 2: 事実整理結果</h4>
                  <p className="phase-description">
                    抽出した事実を支援計画用に再分類した結果です。
                  </p>
                  {plan.sessions?.[0]?.model_used_phase2 && (
                    <div style={{ display: 'flex', gap: '16px', padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px', border: '1px solid var(--border-color)' }}>
                      <span><strong>使用モデル:</strong> {plan.sessions[0].model_used_phase2}</span>
                      <span><strong>実行日時:</strong> {formatDate(plan.sessions[0].updated_at)}</span>
                    </div>
                  )}
                  {plan.sessions?.[0] && (() => {
                    const session = plan.sessions![0];
                    const promptKey = getPromptKey(session.id, 'phase2');
                    const currentPrompt = editingPrompt[promptKey] ?? session.fact_structuring_prompt_v1 ?? '';
                    const hasEdit = editingPrompt[promptKey] !== undefined && editingPrompt[promptKey] !== session.fact_structuring_prompt_v1;
                    return (
                      <>
                        {currentPrompt ? (
                          <details className="prompt-viewer">
                            <summary>LLM プロンプトを表示 / 編集</summary>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px' }}>
                              <CopyButton text={currentPrompt} copyKey={`prompt_phase2_${session.id}`} />
                            </div>
                            <textarea
                              className="prompt-editor"
                              value={currentPrompt}
                              onChange={(e) => handlePromptChange(session.id, 'phase2', e.target.value)}
                            />
                            <div className="prompt-actions">
                              <button
                                className="prompt-save-btn"
                                onClick={() => handleSavePrompt(session.id, 'phase2')}
                                disabled={savingPrompt[promptKey] || !hasEdit}
                              >
                                {savingPrompt[promptKey] ? '保存中...' : promptFeedback[promptKey] === 'success' ? '保存完了 ✓' : 'プロンプトを保存'}
                              </button>
                              <button
                                className="prompt-rerun-btn"
                                onClick={() => {
                                  setSelectedModelForPhaseRerun({ provider: 'openai', model: 'gpt-4o' });
                                  setPhaseRerunModal({ sessionId: session.id, planId: plan.id, phase: 2, modelUsed: session.model_used_phase2 || undefined });
                                }}
                                disabled={reanalyzing[session.id]}
                              >
                                {reanalyzing[session.id] ? (reanalysisPhase[session.id] || '実行中...') : 'Phase 2 のみ再実行'}
                              </button>
                            </div>
                            {phaseResult[session.id] && (
                              <div style={{
                                marginTop: '8px',
                                padding: '8px 12px',
                                borderRadius: '6px',
                                fontSize: '13px',
                                fontWeight: '600',
                                background: phaseResult[session.id]!.status === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                color: phaseResult[session.id]!.status === 'success' ? '#10b981' : '#ef4444',
                                border: `1px solid ${phaseResult[session.id]!.status === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                              }}>
                                {phaseResult[session.id]!.status === 'success' ? '\u2713 ' : '\u2717 '}{phaseResult[session.id]!.message}
                              </div>
                            )}
                          </details>
                        ) : null}
                      </>
                    );
                  })()}
                  {plan.sessions && plan.sessions.length > 0 && plan.sessions[0].fact_structuring_result_v1 ? (
                    <>
                      <details className="prompt-viewer">
                        <summary>LLM 出力 (生JSON)</summary>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px' }}>
                          <CopyButton text={JSON.stringify(plan.sessions[0].fact_structuring_result_v1, null, 2)} copyKey={`output_phase2_${plan.sessions[0].id}`} />
                        </div>
                        <pre className="prompt-content">{JSON.stringify(plan.sessions[0].fact_structuring_result_v1, null, 2)}</pre>
                      </details>
                      <Phase2Display data={plan.sessions[0].fact_structuring_result_v1 as any} />
                      {/* Phase 3 prompt generation button */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px', padding: '16px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                        <button
                          onClick={() => {
                            if (plan.sessions?.[0]?.id) {
                              handleGeneratePhase3Prompt(plan.sessions[0].id, plan.id);
                            }
                          }}
                          disabled={reanalyzing[plan.sessions?.[0]?.id || '']}
                          style={{
                            padding: '8px 20px',
                            borderRadius: '6px',
                            border: '1px solid rgba(59, 130, 246, 0.4)',
                            background: '#3b82f6',
                            color: 'white',
                            fontSize: '13px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            opacity: reanalyzing[plan.sessions?.[0]?.id || ''] ? 0.6 : 1,
                            transition: 'all 0.2s ease',
                          }}
                        >
                          {reanalyzing[plan.sessions[0].id]
                            ? (reanalysisPhase[plan.sessions?.[0]?.id || ''] || 'Phase 3プロンプト生成中...')
                            : 'Phase 3 プロンプト生成'}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div style={{ padding: '24px', background: 'var(--bg-secondary)', borderRadius: '12px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
                      Phase 2 の処理結果がありません
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Phase 3 Tab Content */}
            {getActiveTab(plan.id) === 'phase3' && (
              <div className="tab-content-phase3">
                <div className="phase-section">
                  <h4 className="phase-title">Phase 3: 個別支援計画生成結果</h4>
                  <p className="phase-description">
                    事実整理結果から個別支援計画書を生成した結果です。
                  </p>
                  {plan.sessions?.[0]?.model_used_phase3 && (
                    <div style={{ display: 'flex', gap: '16px', padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px', border: '1px solid var(--border-color)' }}>
                      <span><strong>使用モデル:</strong> {plan.sessions[0].model_used_phase3}</span>
                      <span><strong>実行日時:</strong> {formatDate(plan.sessions[0].updated_at)}</span>
                    </div>
                  )}
                  {plan.sessions?.[0] && (() => {
                    const session = plan.sessions![0];
                    const promptKey = getPromptKey(session.id, 'phase3');
                    const currentPrompt = editingPrompt[promptKey] ?? session.assessment_prompt_v1 ?? '';
                    const hasEdit = editingPrompt[promptKey] !== undefined && editingPrompt[promptKey] !== session.assessment_prompt_v1;
                    return (
                      <>
                        {currentPrompt ? (
                          <details className="prompt-viewer">
                            <summary>LLM プロンプトを表示 / 編集</summary>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px' }}>
                              <CopyButton text={currentPrompt} copyKey={`prompt_phase3_${session.id}`} />
                            </div>
                            <textarea
                              className="prompt-editor"
                              value={currentPrompt}
                              onChange={(e) => handlePromptChange(session.id, 'phase3', e.target.value)}
                            />
                            <div className="prompt-actions">
                              <button
                                className="prompt-save-btn"
                                onClick={() => handleSavePrompt(session.id, 'phase3')}
                                disabled={savingPrompt[promptKey] || !hasEdit}
                              >
                                {savingPrompt[promptKey] ? '保存中...' : promptFeedback[promptKey] === 'success' ? '保存完了 ✓' : 'プロンプトを保存'}
                              </button>
                              <button
                                className="prompt-rerun-btn"
                                onClick={() => {
                                  setSelectedModelForPhaseRerun({ provider: 'openai', model: 'gpt-4o' });
                                  setPhaseRerunModal({ sessionId: session.id, planId: plan.id, phase: 3, modelUsed: session.model_used_phase3 || undefined });
                                }}
                                disabled={reanalyzing[session.id]}
                              >
                                {reanalyzing[session.id] ? (reanalysisPhase[session.id] || '実行中...') : 'Phase 3 のみ再実行'}
                              </button>
                            </div>
                            {phaseResult[session.id] && (
                              <div style={{
                                marginTop: '8px',
                                padding: '8px 12px',
                                borderRadius: '6px',
                                fontSize: '13px',
                                fontWeight: '600',
                                background: phaseResult[session.id]!.status === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                color: phaseResult[session.id]!.status === 'success' ? '#10b981' : '#ef4444',
                                border: `1px solid ${phaseResult[session.id]!.status === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                              }}>
                                {phaseResult[session.id]!.status === 'success' ? '\u2713 ' : '\u2717 '}{phaseResult[session.id]!.message}
                              </div>
                            )}
                          </details>
                        ) : null}
                      </>
                    );
                  })()}
                  {plan.sessions && plan.sessions.length > 0 && plan.sessions[0].assessment_result_v1 ? (
                    <>
                      <details className="prompt-viewer">
                        <summary>LLM 出力 (生JSON)</summary>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px' }}>
                          <CopyButton text={JSON.stringify(plan.sessions[0].assessment_result_v1, null, 2)} copyKey={`output_phase3_${plan.sessions[0].id}`} />
                        </div>
                        <pre className="prompt-content">{JSON.stringify(plan.sessions[0].assessment_result_v1, null, 2)}</pre>
                      </details>
                      <Phase3Display data={plan.sessions[0].assessment_result_v1 as any} />
                    </>
                  ) : (
                    <div style={{ padding: '24px', background: 'var(--bg-secondary)', borderRadius: '12px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
                      Phase 3 の処理結果がありません
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Island Actions Bar */}
            <div className="island-actions">
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                最終更新: {formatDate(plan.updated_at)}
              </div>
            </div>
          </div >
        ))}

        {/* New Plan Button at the Bottom */}
        <button
          className="new-plan-island-btn"
          onClick={handleCreatePlan}
          disabled={creating}
        >
          <div className="icon-circle">+</div>
          {creating ? '作成中...' : '新しい個別支援計画を作成する'}
        </button>
      </div >

      {/* Model Selection Modal */}
      {showModelModal && modelModalSessionId && modelModalPlanId && (
        <div className="modal-overlay" onClick={() => setShowModelModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <h3>使用するLLMモデルを選択</h3>
            <div className="modal-field">
              <label>プロバイダー:</label>
              <select
                value={selectedModelForBatch.provider}
                onChange={(e) => setSelectedModelForBatch({
                  provider: e.target.value,
                  model: e.target.value === 'openai' ? 'gpt-4o' : 'gemini-3-pro-preview'
                })}
              >
                <option value="openai">OpenAI</option>
                <option value="gemini">Google Gemini</option>
              </select>
            </div>
            <div className="modal-field">
              <label>モデル:</label>
              {selectedModelForBatch.provider === 'openai' ? (
                <select
                  value={selectedModelForBatch.model}
                  onChange={(e) => setSelectedModelForBatch(prev => ({ ...prev, model: e.target.value }))}
                >
                  <option value="gpt-4o">GPT-4o (default)</option>
                  <option value="gpt-5.2-2025-12-11">GPT-5.2 (latest)</option>
                  <option value="gpt-4o-mini">GPT-4o Mini (low cost)</option>
                </select>
              ) : (
                <select
                  value={selectedModelForBatch.model}
                  onChange={(e) => setSelectedModelForBatch(prev => ({ ...prev, model: e.target.value }))}
                >
                  <option value="gemini-3-pro-preview">Gemini 3 Pro Preview</option>
                  <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash</option>
                </select>
              )}
            </div>
            <div className="modal-actions">
              <button onClick={() => setShowModelModal(false)}>キャンセル</button>
              <button
                className="primary-button"
                onClick={() => {
                  setShowModelModal(false);
                  handleBatchAnalyze(modelModalSessionId!, modelModalPlanId!, selectedModelForBatch);
                }}
              >
                全Phase一括実行
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phase Rerun Modal */}
      {phaseRerunModal && (
        <div className="modal-overlay" onClick={() => setPhaseRerunModal(null)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <h3>Phase {phaseRerunModal.phase} を再実行</h3>
            {phaseRerunModal.modelUsed && (
              <div className="current-model-badge" style={{ marginBottom: '12px' }}>
                前回使用: {phaseRerunModal.modelUsed}
              </div>
            )}
            <div className="modal-field">
              <label>プロバイダー:</label>
              <select
                value={selectedModelForPhaseRerun.provider}
                onChange={(e) => setSelectedModelForPhaseRerun({
                  provider: e.target.value,
                  model: e.target.value === 'openai' ? 'gpt-4o' : 'gemini-3-pro-preview'
                })}
              >
                <option value="openai">OpenAI</option>
                <option value="gemini">Google Gemini</option>
              </select>
            </div>
            <div className="modal-field">
              <label>モデル:</label>
              {selectedModelForPhaseRerun.provider === 'openai' ? (
                <select
                  value={selectedModelForPhaseRerun.model}
                  onChange={(e) => setSelectedModelForPhaseRerun(prev => ({ ...prev, model: e.target.value }))}
                >
                  <option value="gpt-4o">GPT-4o (default)</option>
                  <option value="gpt-5.2-2025-12-11">GPT-5.2 (latest)</option>
                  <option value="gpt-4o-mini">GPT-4o Mini (low cost)</option>
                </select>
              ) : (
                <select
                  value={selectedModelForPhaseRerun.model}
                  onChange={(e) => setSelectedModelForPhaseRerun(prev => ({ ...prev, model: e.target.value }))}
                >
                  <option value="gemini-3-pro-preview">Gemini 3 Pro Preview</option>
                  <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash</option>
                </select>
              )}
            </div>
            <div className="modal-actions">
              <button onClick={() => setPhaseRerunModal(null)}>キャンセル</button>
              <button
                className="primary-button"
                onClick={() => {
                  const { sessionId, planId, phase } = phaseRerunModal;
                  setPhaseRerunModal(null);
                  handlePhaseOnlyReanalyze(sessionId, planId, phase, selectedModelForPhaseRerun);
                }}
              >
                Phase {phaseRerunModal.phase} を実行
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Plan Modal */}
      {showCreateModal && (
        <div className="creation-modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="creation-modal-container" onClick={(e) => e.stopPropagation()}>
            <h2 className="creation-modal-title">個別支援計画の作成</h2>
            <p className="creation-modal-description">
              作成方法を選択してください。アセスメント機能を使うと、ヒアリング内容から最適な計画をAIが自動生成します。
            </p>

            <div className="creation-options">
              {/* Assessment Option */}
              <button className="creation-option-btn" onClick={handleAssessmentCreate}>
                <div className="creation-option-icon-wrapper ai">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                    <line x1="12" y1="19" x2="12" y2="23"></line>
                    <line x1="8" y1="23" x2="16" y2="23"></line>
                  </svg>
                </div>
                <div className="creation-option-content">
                  <div className="creation-option-title">AIアセスメントで作成</div>
                  <div className="creation-option-subtitle">
                    対話内容を記録・分析し、支援計画を自動生成します
                  </div>
                </div>
              </button>

              {/* Manual Option */}
              <button className="creation-option-btn" onClick={handleManualCreate}>
                <div className="creation-option-icon-wrapper manual">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                  </svg>
                </div>
                <div className="creation-option-content">
                  <div className="creation-option-title">手動で作成</div>
                  <div className="creation-option-subtitle">
                    従来のフォーマットに直接入力して作成します
                  </div>
                </div>
              </button>
            </div>

            <div className="creation-modal-actions">
              <button className="creation-cancel-btn" onClick={() => setShowCreateModal(false)}>
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div >
  );
};

export default SupportPlanCreate;