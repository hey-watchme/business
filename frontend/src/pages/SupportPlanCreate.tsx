import React, { useState, useEffect, useCallback } from 'react';
import RecordingSetup from '../components/RecordingSetup';
import RecordingSession from '../components/RecordingSession';
import Phase1Display from '../components/Phase1Display';
import Phase2Display from '../components/Phase2Display';
import Phase3Display from '../components/Phase3Display';
import EditableField from '../components/EditableField';
import EditableTableRow, { type SupportItem } from '../components/EditableTableRow';
import { api, type InterviewSession, type SupportPlan, type SupportPlanUpdate } from '../api/client';
import { calculateAge } from '../utils/date';
import './SupportPlanCreate.css';

type RecordingMode = 'none' | 'setup' | 'recording';

interface SupportPlanCreateProps {
  initialSubjectId?: string;
  hideHeader?: boolean;
}

const SupportPlanCreate: React.FC<SupportPlanCreateProps> = ({ initialSubjectId, hideHeader }) => {
  const [recordingMode, setRecordingMode] = useState<RecordingMode>('none');
  const [selectedChild, setSelectedChild] = useState('田中太郎'); // Will be updated by Subject data in real usage
  const [supportPlans, setSupportPlans] = useState<SupportPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<SupportPlan | null>(null);
  const [planSessions, setPlanSessions] = useState<InterviewSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

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
      setSelectedPlan(plan); // Update selectedPlan with full details including subjects
      if (plan.sessions) {
        setPlanSessions(plan.sessions);
      } else {
        // If no sessions in plan detail, fetch them separately
        const response = await api.getSessions(50, planId);
        setPlanSessions(response.sessions);
      }
    } catch (err) {
      console.error('Failed to fetch plan details:', err);
      setPlanSessions([]);
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

  const formatDuration = (seconds: number | null | undefined) => {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    return `${mins}分`;
  };

  // Check if any session is still processing (not yet completed)
  const isProcessing = (sessions: InterviewSession[]): boolean => {
    if (!sessions || sessions.length === 0) return false;
    return sessions.some(session =>
      session.status !== 'completed' && session.status !== 'error'
    );
  };

  // Get processing status message (detailed version for drawer)
  const getProcessingMessage = (sessions: InterviewSession[]): string => {
    if (!sessions || sessions.length === 0) return '';
    const processingSession = sessions.find(s =>
      s.status !== 'completed' && s.status !== 'error'
    );
    if (!processingSession) return '';

    switch (processingSession.status) {
      case 'uploaded':
        return '音声ファイルをアップロード済み。文字起こし処理待ち...';
      case 'transcribing':
        return '文字起こし処理中...（数分かかります）';
      case 'transcribed':
        return 'Phase 1: 事実抽出中...';
      case 'analyzing':
        return 'Phase 2-3: AI分析中...（まもなく完了します）';
      default:
        return '処理中...';
    }
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

  const handleRecordingStop = async () => {
    setRecordingMode('none');

    // Refresh support plans to show the new session
    await fetchSupportPlans();

    // If there's a selected plan, refresh its details to show the new session
    if (selectedPlan) {
      await fetchPlanDetails(selectedPlan.id);
      // Keep the drawer open to show the processing status
    }
  };

  const handleRecordingCancel = () => {
    setRecordingMode('none');
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

    setCreating(true);
    setShowCreateModal(false);

    try {
      // Generate automatic title with current date
      const today = new Date();
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const title = `個別支援計画書-${dateStr}`;

      // Create plan first (before recording)
      const newPlan = await api.createSupportPlan({
        subject_id: initialSubjectId || '',
        title: title,
        status: 'draft'
      });

      // Refresh the list
      await fetchSupportPlans();

      // Select the newly created plan
      setSelectedPlan(newPlan);

      // Open recording mode
      setRecordingMode('setup');
    } catch (error) {
      console.error('Failed to create plan for assessment:', error);
      alert('計画書の作成に失敗しました。');
    } finally {
      setCreating(false);
    }
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
      />
    );
  }

  if (recordingMode === 'recording') {
    return (
      <RecordingSession
        childName={selectedChild}
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
                          aiValue={null}
                          type="text"
                          label="事業所名"
                          placeholder="ヨリドコロ横浜白楽"
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
                          aiValue={null}
                          type="text"
                          label="計画作成者"
                          placeholder="児童発達支援管理責任者 山田太郎"
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

              {/* Document Page Actions */}
              <div className="doc-footer">
                <span className="page-indicator">個別支援計画書 1/2ページ</span>
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
                  Excelをダウンロード (1/2)
                </button>
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
                      aiValue={null}
                      type="text"
                      label="説明者"
                      placeholder="児童発達支援管理責任者　山田太郎"
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

              {/* Document Page Actions */}
              <div className="doc-footer">
                <span className="page-indicator">個別支援計画書 2/2ページ</span>
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
                  Excelをダウンロード (2/2)
                </button>
              </div>
            </div>

            {/* Assessment Section (Integrated Latest Session) */}
            <div className="meeting-section">
              <div className="meeting-header">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                <h4 className="meeting-title">アセスメント</h4>
              </div>

              {plan.sessions && plan.sessions.length > 0 ? (
                <div className="meeting-content">
                  <div className="meeting-info-grid">
                    <div className="meta-item" style={{ gridColumn: '1 / -1' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 7V5C3 3.89543 3.89543 3 5 3H19C20.1046 3 21 3.89543 21 5V7M3 7L12 13L21 7M3 7V19C3 20.1046 3.89543 21 5 21H19C20.1046 21 21 20.1046 21 19V7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>セッションID: {plan.sessions[0].id}</span>
                    </div>
                    <div className="meta-item">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                      </svg>
                      実施日: {formatDate(plan.sessions[0].recorded_at)}
                    </div>
                    <div className="meta-item">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                      </svg>
                      時間: {formatDuration(plan.sessions[0].duration_seconds)}
                    </div>
                    <div className="meta-item">
                      {getStatusIcon(plan.sessions[0].status)}
                      ステータス: {getStatusLabel(plan.sessions[0].status)}
                    </div>
                    <div className="meta-item">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                      </svg>
                      参加者: 未設定（保護者情報）、未設定（スタッフ）
                    </div>
                  </div>

                  <div className="transcription-area">
                    <span className="section-label">面談記録書き起こし</span>
                    <div className="transcription-box">
                      {plan.sessions[0].transcription ? (
                        plan.sessions[0].transcription
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>文字起こしデータがありません</span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '12px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
                  アセスメントデータが紐付けられていません
                </div>
              )}
            </div>

            {/* Individual Support Plan Contents (Phase 3 Results if available) */}
            <div className="plan-details-section">
              <span className="section-label">個別支援計画の内容（AI分析結果）</span>
              {plan.sessions && plan.sessions.length > 0 && (plan.sessions[0] as any).assessment_result_v1 ? (
                <div style={{ transform: 'scale(0.98)', transformOrigin: 'top left' }}>
                  <Phase3Display data={(plan.sessions[0] as any).assessment_result_v1} sessionId={plan.sessions[0].id} />
                </div>
              ) : (
                <div style={{ padding: '24px', background: 'rgba(124, 77, 255, 0.03)', borderRadius: '12px', border: '1px dashed var(--border-color)', textAlign: 'center' }}>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>
                    アセスメント分析を完了すると、ここに支援計画案が表示されます。
                  </p>
                </div>
              )}
            </div>

            {/* Island Actions Bar */}
            <div className="island-actions">
              <button
                className="drawer-details-btn"
                onClick={() => setSelectedPlan(plan)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
                AI処理プロセス・詳細データを確認
              </button>
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

      {/* Drawer Overlay */}
      {
        selectedPlan && (
          <>
            <div
              className="drawer-overlay"
              onClick={() => setSelectedPlan(null)}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.5)',
                zIndex: 1000,
                animation: 'fadeIn 0.2s ease-out'
              }}
            />
            <div
              className="session-detail-drawer"
              style={{
                position: 'fixed',
                top: 0,
                right: 0,
                bottom: 0,
                width: '700px',
                maxWidth: '90vw',
                background: 'var(--bg-secondary)',
                boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.3)',
                zIndex: 1001,
                overflowY: 'auto',
                animation: 'slideInRight 0.3s ease-out'
              }}
            >
              <div style={{
                position: 'sticky',
                top: 0,
                background: 'var(--bg-secondary)',
                zIndex: 10,
                padding: '24px 24px 20px 24px',
                borderBottom: '1px solid var(--border-primary)',
                marginBottom: '24px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <h2 style={{ fontSize: '20px', fontWeight: '600', margin: '0 0 4px 0', color: 'var(--text-primary)' }}>
                      {selectedPlan.title}
                    </h2>
                    <p style={{ fontSize: '12px', margin: 0, fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                      ID: {selectedPlan.id}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedPlan(null)}
                    style={{
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-primary)',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      padding: '8px',
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = 'var(--bg-hover)';
                      e.currentTarget.style.borderColor = 'var(--accent-primary)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = 'var(--bg-tertiary)';
                      e.currentTarget.style.borderColor = 'var(--border-primary)';
                    }}
                    title="閉じる"
                  >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>

                {/* Meta Info */}
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center', fontSize: '13px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <rect x="2" y="2" width="10" height="10" rx="1" stroke="var(--text-secondary)" strokeWidth="1" />
                      <path d="M2 4H12M4 2V1M10 2V1" stroke="var(--text-secondary)" strokeWidth="1" strokeLinecap="round" />
                    </svg>
                    <span style={{ color: 'var(--text-secondary)' }}>作成日: {formatDate(selectedPlan.created_at)}</span>
                  </div>
                </div>
              </div>

              <div style={{ padding: '0 24px 24px 24px' }}>
                {/* Processing Banner (lightweight notification) */}
                {isProcessing(planSessions) && (
                  <div style={{
                    background: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid rgba(59, 130, 246, 0.2)',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    marginBottom: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}>
                    <div style={{
                      width: '20px',
                      height: '20px',
                      border: '3px solid rgba(59, 130, 246, 0.3)',
                      borderTop: '3px solid #3B82F6',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#3B82F6', marginBottom: '2px' }}>
                        処理中
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {getProcessingMessage(planSessions)}
                      </div>
                    </div>
                  </div>
                )}

                {/* Support Plan Detail Content (Intermediate/Output information will go here) */}

                {/* Related Data Section */}
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: '700', margin: 0, color: 'var(--text-primary)' }}>
                      AI処理・技術詳細データ
                    </h3>
                    <div className="status-label processing" style={{ fontSize: '10px' }}>PRO ツール用</div>
                  </div>

                  {planSessions.length === 0 ? (
                    <div style={{
                      background: 'var(--bg-primary)',
                      border: '1px dashed var(--border-primary)',
                      borderRadius: '8px',
                      padding: '24px',
                      textAlign: 'center',
                      fontSize: '14px',
                      color: 'var(--text-secondary)'
                    }}>
                      詳細データがありません
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {planSessions.map(session => (
                        <div
                          key={session.id}
                          style={{
                            background: 'var(--bg-primary)',
                            border: '1px solid var(--border-primary)',
                            borderRadius: '12px',
                            padding: '20px',
                            fontSize: '13px'
                          }}
                        >
                          {/* Session Metadata Grid */}
                          <div style={{ marginBottom: '20px' }}>
                            <h4 style={{ fontSize: '12px', fontWeight: '700', margin: '0 0 12px 0', color: 'var(--accent-primary)', textTransform: 'uppercase' }}>
                              システムメタデータ
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px' }}>
                              <div style={{ padding: '8px', background: 'var(--bg-secondary)', borderRadius: '6px' }}>
                                <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>セッションID</span>
                                <span style={{ fontFamily: 'monospace', fontWeight: '600' }}>{session.id}</span>
                              </div>
                              <div style={{ padding: '8px', background: 'var(--bg-secondary)', borderRadius: '6px' }}>
                                <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>ステータス</span>
                                <span style={{ fontWeight: '600' }}>{getStatusLabel(session.status)}</span>
                              </div>
                              <div style={{ padding: '8px', background: 'var(--bg-secondary)', borderRadius: '6px' }}>
                                <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>作成日時</span>
                                <span>{formatDate(session.created_at)}</span>
                              </div>
                              <div style={{ padding: '8px', background: 'var(--bg-secondary)', borderRadius: '6px' }}>
                                <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>音声形式</span>
                                <span>WebM / AWS S3</span>
                              </div>
                            </div>
                          </div>


                          {/* Transcription Metadata */}
                          {session.transcription_metadata && (
                            <div style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid var(--border-primary)' }}>
                              <h4 style={{ fontSize: '12px', fontWeight: '600', margin: '0 0 8px 0', color: 'var(--text-secondary)' }}>文字起こしメタデータ</h4>
                              <pre style={{
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-primary)',
                                borderRadius: '6px',
                                padding: '12px',
                                fontSize: '11px',
                                lineHeight: '1.4',
                                color: 'var(--text-primary)',
                                maxHeight: '150px',
                                overflowY: 'auto',
                                margin: 0,
                                fontFamily: 'monospace'
                              }}>
                                {typeof session.transcription_metadata === 'string'
                                  ? JSON.stringify(JSON.parse(session.transcription_metadata), null, 2)
                                  : JSON.stringify(session.transcription_metadata, null, 2)}
                              </pre>
                            </div>
                          )}

                          {/* Fact Extraction Prompt */}
                          {session.fact_extraction_prompt_v1 && (
                            <div style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid var(--border-primary)' }}>
                              <h4 style={{ fontSize: '12px', fontWeight: '600', margin: '0 0 8px 0', color: 'var(--text-secondary)' }}>事実抽出プロンプト</h4>
                              <div style={{
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-primary)',
                                borderRadius: '6px',
                                padding: '12px',
                                fontSize: '12px',
                                lineHeight: '1.6',
                                color: 'var(--text-primary)',
                                maxHeight: '150px',
                                overflowY: 'auto',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word'
                              }}>
                                {typeof session.fact_extraction_prompt_v1 === 'object'
                                  ? JSON.stringify(session.fact_extraction_prompt_v1, null, 2)
                                  : session.fact_extraction_prompt_v1}
                              </div>
                            </div>
                          )}

                          {/* Phase 1: Fact Extraction Result */}
                          {session.fact_extraction_result_v1 && (
                            <div style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid var(--border-primary)' }}>
                              <h4 style={{ fontSize: '14px', fontWeight: '600', margin: '0 0 12px 0', color: 'var(--text-primary)' }}>
                                Phase 1: 事実抽出結果
                              </h4>
                              <Phase1Display data={session.fact_extraction_result_v1 as any} />
                            </div>
                          )}

                          {/* Phase 2: Fact Structuring Result */}
                          {(session as any).fact_structuring_result_v1 && (
                            <div style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid var(--border-primary)' }}>
                              <h4 style={{ fontSize: '14px', fontWeight: '600', margin: '0 0 12px 0', color: 'var(--text-primary)' }}>
                                Phase 2: 事実整理結果
                              </h4>
                              <Phase2Display data={(session as any).fact_structuring_result_v1} />
                            </div>
                          )}

                          {/* Error Message */}
                          {session.error_message && (
                            <div style={{
                              background: 'rgba(239, 68, 68, 0.1)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              borderRadius: '6px',
                              padding: '12px',
                              fontSize: '12px',
                              color: 'var(--accent-danger)'
                            }}>
                              <strong>エラー:</strong> {typeof session.error_message === 'object'
                                ? JSON.stringify(session.error_message, null, 2)
                                : session.error_message}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )
      }

      {/* Create Plan Modal */}
      {showCreateModal && (
        <>
          <div
            className="drawer-overlay"
            onClick={() => setShowCreateModal(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              zIndex: 2000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: 'fadeIn 0.2s ease-out'
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'white',
                borderRadius: '12px',
                maxWidth: '500px',
                width: '90%',
                padding: '32px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                animation: 'slideUp 0.3s ease-out'
              }}
            >
              <h2 style={{
                fontSize: '20px',
                fontWeight: '700',
                marginBottom: '16px',
                color: 'var(--text-primary)'
              }}>
                個別支援計画の作成方法を選択
              </h2>
              <p style={{
                fontSize: '14px',
                color: 'var(--text-secondary)',
                marginBottom: '32px',
                lineHeight: '1.6'
              }}>
                保護者とのヒアリングを録音して自動生成するか、フォーマットに手動入力するかを選択してください。
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Assessment Option */}
                <button
                  onClick={handleAssessmentCreate}
                  style={{
                    padding: '20px',
                    border: '2px solid var(--border-color)',
                    borderRadius: '8px',
                    background: 'white',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--accent-primary)';
                    e.currentTarget.style.background = 'rgba(37, 99, 235, 0.02)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                    e.currentTarget.style.background = 'white';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '20px'
                    }}>
                      🎤
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '4px' }}>
                        アセスメントを行う
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                        保護者との会議を録音し、個別支援計画を自動生成します
                      </div>
                    </div>
                  </div>
                </button>

                {/* Manual Option */}
                <button
                  onClick={handleManualCreate}
                  style={{
                    padding: '20px',
                    border: '2px solid var(--border-color)',
                    borderRadius: '8px',
                    background: 'white',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--accent-primary)';
                    e.currentTarget.style.background = 'rgba(37, 99, 235, 0.02)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                    e.currentTarget.style.background = 'white';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '20px'
                    }}>
                      ✏️
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '4px' }}>
                        個別支援計画書に手動入力する
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                        個別支援計画書のフォーマットに手動入力します
                      </div>
                    </div>
                  </div>
                </button>
              </div>

              <button
                onClick={() => setShowCreateModal(false)}
                style={{
                  marginTop: '24px',
                  width: '100%',
                  padding: '12px',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  background: 'white',
                  color: 'var(--text-secondary)',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg-secondary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'white';
                }}
              >
                キャンセル
              </button>
            </div>
          </div>
        </>
      )}
    </div >
  );
};

export default SupportPlanCreate;