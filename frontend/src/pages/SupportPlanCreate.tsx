import React, { useState, useEffect } from 'react';
import RecordingSetup from '../components/RecordingSetup';
import RecordingSession from '../components/RecordingSession';
import SupportPlanModal from '../components/SupportPlanModal';
import { api, type InterviewSession, type SupportPlan } from '../api/client';
import './SupportPlanCreate.css';

type RecordingMode = 'none' | 'setup' | 'recording';

const SupportPlanCreate: React.FC = () => {
  const [recordingMode, setRecordingMode] = useState<RecordingMode>('none');
  const [selectedChild, setSelectedChild] = useState('田中太郎');
  const [supportPlans, setSupportPlans] = useState<SupportPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<SupportPlan | null>(null);
  const [planSessions, setPlanSessions] = useState<InterviewSession[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSupportPlans();
  }, []);

  useEffect(() => {
    if (selectedPlan) {
      fetchPlanDetails(selectedPlan.id);
    }
  }, [selectedPlan]);

  const fetchSupportPlans = async () => {
    try {
      setLoading(true);
      const plans = await api.getSupportPlans();
      setSupportPlans(plans);
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

  const getStatusIcon = (status: InterviewSession['status']) => {
    switch (status) {
      case 'completed':
        return (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="var(--accent-success)" strokeWidth="1.5"/>
            <path d="M5 8L7 10L11 6" stroke="var(--accent-success)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
      case 'transcribing':
      case 'analyzing':
        return (
          <svg width="16" height="16" className="spinning" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="var(--text-muted)" strokeWidth="1.5" opacity="0.3"/>
            <path d="M8 2C4.69 2 2 4.69 2 8" stroke="var(--accent-primary)" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        );
      case 'error':
        return (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="var(--accent-danger)" strokeWidth="1.5"/>
            <path d="M10 6L6 10M6 6L10 10" stroke="var(--accent-danger)" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        );
      default:
        return (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="var(--text-muted)" strokeWidth="1.5" strokeDasharray="2 2"/>
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

  const formatDuration = (seconds: number | null | undefined) => {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    return `${mins}分`;
  };

  const getPlanStatusIcon = (status: SupportPlan['status']) => {
    switch (status) {
      case 'active':
        return (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="var(--accent-success)" strokeWidth="1.5"/>
            <path d="M5 8L7 10L11 6" stroke="var(--accent-success)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
      case 'completed':
        return (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="var(--text-secondary)" strokeWidth="1.5"/>
            <path d="M5 8L7 10L11 6" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
      case 'archived':
        return (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="3" y="6" width="10" height="7" rx="1" stroke="var(--text-muted)" strokeWidth="1.5"/>
            <path d="M5 3H11V6H5V3Z" stroke="var(--text-muted)" strokeWidth="1.5"/>
          </svg>
        );
      default: // draft
        return (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="var(--text-muted)" strokeWidth="1.5" strokeDasharray="2 2"/>
          </svg>
        );
    }
  };

  const getPlanStatusLabel = (status: SupportPlan['status']) => {
    switch (status) {
      case 'active': return 'アクティブ';
      case 'completed': return '完了';
      case 'archived': return 'アーカイブ';
      default: return '下書き';
    }
  };


  const handleRecordingStart = (childName: string) => {
    setSelectedChild(childName);
    setRecordingMode('recording');
  };

  const handleRecordingStop = () => {
    setRecordingMode('none');
    // TODO: Add session to list after recording
  };

  const handleRecordingCancel = () => {
    setRecordingMode('none');
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
      <div className="page-header">
        <div>
          <h1 className="page-title">個別支援計画管理</h1>
          <p className="page-subtitle">保護者ヒアリング録音から個別支援計画書を自動生成</p>
        </div>
        <button className="primary-button" onClick={() => setShowCreateModal(true)}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          新規計画作成
        </button>
      </div>

      <div className="dashboard-grid">
        {/* Statistics Cards */}
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">今月の作成数</span>
            <span className="stat-trend positive">+12%</span>
          </div>
          <div className="stat-value">24</div>
          <div className="stat-chart">
            <svg width="100%" height="40" viewBox="0 0 100 40" preserveAspectRatio="none">
              <polyline
                points="0,30 20,25 40,27 60,20 80,15 100,10"
                fill="none"
                stroke="var(--accent-success)"
                strokeWidth="2"
                opacity="0.6"
              />
              <polyline
                points="0,30 20,25 40,27 60,20 80,15 100,10 100,40 0,40"
                fill="url(#gradient-success)"
                opacity="0.2"
              />
              <defs>
                <linearGradient id="gradient-success" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent-success)" />
                  <stop offset="100%" stopColor="var(--accent-success)" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">処理中</span>
            <span className="stat-badge">リアルタイム</span>
          </div>
          <div className="stat-value">3</div>
          <div className="stat-progress">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: '65%' }}></div>
            </div>
            <span className="progress-text">平均進捗: 65%</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">平均処理時間</span>
          </div>
          <div className="stat-value">
            4.5<span className="stat-unit">分</span>
          </div>
          <div className="stat-comparison">
            <span className="comparison-label">前月比</span>
            <span className="comparison-value better">-23%</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">エラー率</span>
          </div>
          <div className="stat-value">
            0.8<span className="stat-unit">%</span>
          </div>
          <div className="stat-status">
            <span className="status-indicator good"></span>
            <span className="status-text">正常</span>
          </div>
        </div>
      </div>

      {/* Support Plans List */}
      <div className="sessions-container">
        <div className="sessions-section">
          <div className="section-header">
            <h2 className="section-title">個別支援計画一覧</h2>
            <div className="section-actions">
              <button className="filter-button">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M2 4H14M4 8H12M6 12H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                フィルター
              </button>
              <button className="filter-button">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 6L8 2L13 6M3 10L8 14L13 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                並び替え
              </button>
            </div>
          </div>

        {loading && (
          <div style={{ padding: '24px', textAlign: 'center' }}>
            <p>読み込み中...</p>
          </div>
        )}

        {error && (
          <div style={{ padding: '24px', color: 'var(--accent-danger)' }}>
            <p>エラー: {error}</p>
          </div>
        )}

        {!loading && !error && supportPlans.length === 0 && (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <p>個別支援計画がありません</p>
          </div>
        )}

        <div className="sessions-list">
          {supportPlans.map(plan => (
            <div
              key={plan.id}
              className={`session-card ${plan.status} ${selectedPlan?.id === plan.id ? 'selected' : ''}`}
              onClick={() => {
                setSelectedPlan(plan);
              }}
              style={{ cursor: 'pointer' }}
            >
              <div className="session-status">
                {getPlanStatusIcon(plan.status)}
              </div>

              <div className="session-info">
                <h3 className="session-child-name">{plan.title}</h3>
                {plan.plan_number && (
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                    計画番号: {plan.plan_number}
                  </p>
                )}
                <div className="session-meta">
                  <span className="meta-item">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <rect x="2" y="2" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1"/>
                      <path d="M2 4H10M4 2V1M8 2V1" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                    </svg>
                    {formatDate(plan.created_at)}
                  </span>
                  {plan.session_count !== undefined && (
                    <span className="meta-item">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <rect x="2" y="3" width="8" height="6" rx="0.5" stroke="currentColor" strokeWidth="1"/>
                        <circle cx="3.5" cy="6" r="0.5" fill="currentColor"/>
                        <line x1="5" y1="6" x2="8" y2="6" stroke="currentColor" strokeWidth="1"/>
                      </svg>
                      {plan.session_count} セッション
                    </span>
                  )}
                </div>
              </div>

              <div className="session-progress">
                <span className={`status-label ${plan.status}`}>
                  {getPlanStatusLabel(plan.status)}
                </span>
              </div>

              <div className="session-actions">
                <button
                  className="action-button"
                  title="詳細表示"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPlan(plan);
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M5 8H11M11 8L8 5M11 8L8 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <SupportPlanModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            fetchSupportPlans();
          }}
        />
      )}

      {/* Drawer Overlay */}
      {selectedPlan && (
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
              padding: '24px 24px 16px 24px',
              borderBottom: '1px solid var(--border-primary)',
              marginBottom: '24px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: '20px', fontWeight: '600', margin: 0, color: 'var(--text-primary)' }}>支援計画詳細</h2>
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
                    <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            </div>

            <div style={{ padding: '0 24px 24px 24px' }}>
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: 'var(--text-secondary)' }}>基本情報</h3>
              <div style={{ display: 'grid', gap: '12px' }}>
                <div>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>計画ID</span>
                  <p style={{ fontSize: '14px', margin: '4px 0 0 0', fontFamily: 'monospace', color: 'var(--text-primary)' }}>{selectedPlan.id}</p>
                </div>
                <div>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>タイトル</span>
                  <p style={{ fontSize: '14px', margin: '4px 0 0 0', color: 'var(--text-primary)' }}>{selectedPlan.title}</p>
                </div>
                {selectedPlan.plan_number && (
                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>計画番号</span>
                    <p style={{ fontSize: '14px', margin: '4px 0 0 0', color: 'var(--text-primary)' }}>{selectedPlan.plan_number}</p>
                  </div>
                )}
                <div>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>作成日時</span>
                  <p style={{ fontSize: '14px', margin: '4px 0 0 0', color: 'var(--text-primary)' }}>{formatDate(selectedPlan.created_at)}</p>
                </div>
                <div>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>ステータス</span>
                  <p style={{ fontSize: '14px', margin: '4px 0 0 0' }}>
                    <span className={`status-label ${selectedPlan.status}`}>
                      {getPlanStatusLabel(selectedPlan.status)}
                    </span>
                  </p>
                </div>
                <div>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>支援対象児童</span>
                  <p style={{ fontSize: '14px', margin: '4px 0 0 0', color: 'var(--text-primary)' }}>
                    {(selectedPlan as any).subjects ? (
                      <span>
                        {(selectedPlan as any).subjects.name}
                        {(selectedPlan as any).subjects.age && ` (${(selectedPlan as any).subjects.age}歳)`}
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginLeft: '8px', fontFamily: 'monospace' }}>
                          ID: {(selectedPlan as any).subjects.subject_id.slice(0, 8)}...
                        </span>
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)' }}>未選択</span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Sessions List in Drawer */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '600', margin: 0, color: 'var(--text-secondary)' }}>
                  関連セッション ({planSessions.length})
                </h3>
                <button
                  onClick={() => {
                    setRecordingMode('setup');
                    // TODO: Associate with this plan
                  }}
                  style={{
                    background: 'var(--accent-primary)',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    color: 'white',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'scale(1.02)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <circle cx="6" cy="6" r="5" fill="white"/>
                  </svg>
                  セッション開始
                </button>
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
                  まだセッションがありません
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {planSessions.map(session => (
                    <div
                      key={session.id}
                      style={{
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-primary)',
                        borderRadius: '8px',
                        padding: '12px',
                        fontSize: '13px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.borderColor = 'var(--accent-primary)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-primary)';
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <p style={{ margin: 0, color: 'var(--text-primary)', fontWeight: '500' }}>
                            {formatDate(session.recorded_at)}
                          </p>
                          <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: '12px' }}>
                            {formatDuration(session.duration_seconds)} • {getStatusLabel(session.status)}
                          </p>
                        </div>
                        {getStatusIcon(session.status)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            </div>
          </div>
        </>
      )}
      </div>
    </div>
  );
};

export default SupportPlanCreate;