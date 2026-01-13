import React, { useState, useEffect } from 'react';
import RecordingSetup from '../components/RecordingSetup';
import RecordingSession from '../components/RecordingSession';
import { api, type InterviewSession } from '../api/client';
import './SupportPlanCreate.css';

type RecordingMode = 'none' | 'setup' | 'recording';

const SupportPlanCreate: React.FC = () => {
  const [recordingMode, setRecordingMode] = useState<RecordingMode>('none');
  const [selectedChild, setSelectedChild] = useState('田中太郎');
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<InterviewSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const response = await api.getSessions();
      setSessions(response.sessions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch sessions');
    } finally {
      setLoading(false);
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

  const handleStartRecording = () => {
    setRecordingMode('setup');
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
        onStop={handleRecordingStop}
      />
    );
  }

  return (
    <div className="support-plan-create">
      <div className="page-header">
        <div>
          <h1 className="page-title">個別支援計画作成</h1>
          <p className="page-subtitle">保護者ヒアリング録音から個別支援計画書を自動生成</p>
        </div>
        <button className="primary-button" onClick={handleStartRecording}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          新規ヒアリング開始
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

      {/* Sessions List with Detail Panel */}
      <div className="sessions-container" style={{ display: 'grid', gridTemplateColumns: selectedSession ? '1fr 1fr' : '1fr', gap: '24px' }}>
        <div className="sessions-section">
          <div className="section-header">
            <h2 className="section-title">最近のヒアリングセッション</h2>
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

        {!loading && !error && sessions.length === 0 && (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <p>ヒアリングセッションがありません</p>
          </div>
        )}

        <div className="sessions-list">
          {sessions.map(session => (
            <div
              key={session.id}
              className={`session-card ${session.status} ${selectedSession?.id === session.id ? 'selected' : ''}`}
              onClick={() => setSelectedSession(session)}
              style={{ cursor: 'pointer' }}
            >
              <div className="session-status">
                {getStatusIcon(session.status)}
              </div>

              <div className="session-info">
                <h3 className="session-child-name">サブジェクト: {session.child_id}</h3>
                {session.staff_id && (
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                    担当者: {session.staff_id}
                  </p>
                )}
                <div className="session-meta">
                  <span className="meta-item">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <rect x="2" y="2" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1"/>
                      <path d="M2 4H10M4 2V1M8 2V1" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                    </svg>
                    {formatDate(session.recorded_at)}
                  </span>
                  {session.duration_seconds && (
                    <span className="meta-item">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1"/>
                        <path d="M6 3V6L8 7" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                      </svg>
                      {formatDuration(session.duration_seconds)}
                    </span>
                  )}
                </div>
              </div>

              <div className="session-progress">
                <span className={`status-label ${session.status}`}>
                  {getStatusLabel(session.status)}
                </span>
              </div>

              <div className="session-actions">
                {session.status === 'completed' && (
                  <>
                    <button
                      className="action-button"
                      title="詳細表示"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSession(session);
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5"/>
                        <path d="M1 8C1 8 3 3 8 3C13 3 15 8 15 8C15 8 13 13 8 13C3 13 1 8 1 8Z" stroke="currentColor" strokeWidth="1.5"/>
                      </svg>
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detail Panel */}
      {selectedSession && (
        <div className="session-detail-panel" style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-primary)',
            borderRadius: '12px',
            padding: '24px',
            maxHeight: '800px',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>詳細情報</h2>
              <button
                onClick={() => setSelectedSession(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px',
                  color: 'var(--text-secondary)'
                }}
                title="閉じる"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: 'var(--text-secondary)' }}>基本情報</h3>
              <div style={{ display: 'grid', gap: '12px' }}>
                <div>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>セッションID</span>
                  <p style={{ fontSize: '14px', margin: '4px 0 0 0', fontFamily: 'monospace' }}>{selectedSession.id}</p>
                </div>
                <div>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>サブジェクト（子供）</span>
                  <p style={{ fontSize: '14px', margin: '4px 0 0 0' }}>{selectedSession.child_id}</p>
                </div>
                {selectedSession.staff_id && (
                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>担当者</span>
                    <p style={{ fontSize: '14px', margin: '4px 0 0 0' }}>{selectedSession.staff_id}</p>
                  </div>
                )}
                <div>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>録音日時</span>
                  <p style={{ fontSize: '14px', margin: '4px 0 0 0' }}>{formatDate(selectedSession.recorded_at)}</p>
                </div>
                <div>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>ステータス</span>
                  <p style={{ fontSize: '14px', margin: '4px 0 0 0' }}>
                    <span className={`status-label ${selectedSession.status}`}>
                      {getStatusLabel(selectedSession.status)}
                    </span>
                  </p>
                </div>
                {selectedSession.duration_seconds && (
                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>録音時間</span>
                    <p style={{ fontSize: '14px', margin: '4px 0 0 0' }}>{formatDuration(selectedSession.duration_seconds)}</p>
                  </div>
                )}
              </div>
            </div>

            {selectedSession.transcription && (
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: 'var(--text-secondary)' }}>文字起こし</h3>
                <div style={{
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: '8px',
                  padding: '16px',
                  fontSize: '14px',
                  lineHeight: '1.6',
                  whiteSpace: 'pre-wrap',
                  maxHeight: '300px',
                  overflowY: 'auto'
                }}>
                  {selectedSession.transcription}
                </div>
              </div>
            )}

            {selectedSession.analysis_result && (
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: 'var(--text-secondary)' }}>分析結果</h3>
                <div style={{
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: '8px',
                  padding: '16px',
                  fontSize: '14px',
                  lineHeight: '1.6',
                  whiteSpace: 'pre-wrap',
                  maxHeight: '300px',
                  overflowY: 'auto'
                }}>
                  {(() => {
                    try {
                      const result = JSON.parse(selectedSession.analysis_result);
                      return result.summary || selectedSession.analysis_result;
                    } catch {
                      return selectedSession.analysis_result;
                    }
                  })()}
                </div>
              </div>
            )}

            {selectedSession.transcription_metadata && (
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: 'var(--text-secondary)' }}>メタデータ</h3>
                <div style={{
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: '8px',
                  padding: '16px',
                  fontSize: '12px',
                  lineHeight: '1.6',
                  whiteSpace: 'pre-wrap',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  fontFamily: 'monospace'
                }}>
                  {(() => {
                    try {
                      const metadata = JSON.parse(selectedSession.transcription_metadata);
                      return JSON.stringify(metadata, null, 2);
                    } catch {
                      return selectedSession.transcription_metadata;
                    }
                  })()}
                </div>
              </div>
            )}

            {selectedSession.error_message && (
              <div style={{ marginTop: '24px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: 'var(--accent-danger)' }}>エラー</h3>
                <div style={{
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--accent-danger)',
                  borderRadius: '8px',
                  padding: '16px',
                  fontSize: '14px',
                  lineHeight: '1.6',
                  color: 'var(--accent-danger)'
                }}>
                  {selectedSession.error_message}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SupportPlanCreate;