import React, { useState, useEffect } from 'react';
import RecordingSetup from '../components/RecordingSetup';
import RecordingSession from '../components/RecordingSession';
import SupportPlanModal from '../components/SupportPlanModal';
import Phase1Display from '../components/Phase1Display';
import Phase2Display from '../components/Phase2Display';
import Phase3Display from '../components/Phase3Display';
import { api, type InterviewSession, type SupportPlan } from '../api/client';
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
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const formatDuration = (seconds: number | null | undefined) => {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    return `${mins}分`;
  };


  const getPlanStatusLabel = (status: SupportPlan['status']) => {
    switch (status) {
      case 'active': return '運用中';
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

  const handleDownloadExcel = async (plan: SupportPlan) => {
    try {
      // If sessions are not in the plan object, fetch them
      let sessionId = '';
      if (plan.sessions && plan.sessions.length > 0) {
        sessionId = plan.sessions[0].id;
      } else {
        const detail = await api.getSupportPlan(plan.id);
        if (detail.sessions && detail.sessions.length > 0) {
          sessionId = detail.sessions[0].id;
        }
      }

      if (!sessionId) {
        alert('ダウンロード可能なセッションが見つかりません。');
        return;
      }

      const response = await fetch(`https://api.hey-watch.me/business/api/sessions/${sessionId}/download-excel`, {
        headers: {
          'X-API-Token': 'watchme-b2b-poc-2025'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to download Excel');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `個別支援計画_${plan.title}_${sessionId.slice(0, 8)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      alert('ダウンロードに失敗しました。');
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
          <button className="primary-button" onClick={() => setShowCreateModal(true)}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            新規計画作成
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
                  <span className={`status-label ${plan.status}`}>
                    {getPlanStatusLabel(plan.status)}
                  </span>
                  {plan.plan_number && (
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      計画番号: {plan.plan_number}
                    </span>
                  )}
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    作成日: {formatDate(plan.created_at)}
                  </span>
                </div>
              </div>
              <div className="session-actions">
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
                      <div className="doc-cell value">ヨリドコロ横浜白楽</div>
                    </div>
                    <div className="doc-half">
                      <div className="doc-cell label">生年月日</div>
                      <div className="doc-cell value">--- ({plan.subjects?.age ? `${plan.subjects.age}歳` : '---歳'})</div>
                    </div>
                  </div>
                </div>
                <div className="doc-row">
                  <div className="doc-row-split">
                    <div className="doc-half">
                      <div className="doc-cell label">計画作成者</div>
                      <div className="doc-cell value">児童発達支援管理責任者 山田太郎</div>
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
                      <div className="doc-cell value">2025年11月20日 〜 2026年3月31日</div>
                    </div>
                  </div>
                </div>
                <div className="doc-row">
                  <div className="doc-cell label">利用者及びその家族の生活に対する意向・ニーズ（生活全般の質を向上させるための課題）</div>
                  <div className="nested-info-table">
                    <div className="nested-info-row">
                      <div className="nested-label">ご本人</div>
                      <div className="nested-value">自立性を高め、集団での活動に楽しく参加できるようになりたい。</div>
                    </div>
                    <div className="nested-info-row">
                      <div className="nested-label">ご家族</div>
                      <div className="nested-value">お友達とのコミュニケーションが円滑になり、自分の気持ちを言葉で伝えられるようになってほしい。</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Service Time Table */}
              <div className="doc-info-table">
                <div className="doc-row">
                  <div className="doc-cell label large">支援の標準的な提供時間等(曜日・頻度・時間)</div>
                  <div className="doc-cell value">
                    <ul className="doc-list">
                      <li>週一回(火曜日)</li>
                      <li>サービス提供時間は原則。13時55分から17時の計3時間5分とする。</li>
                      <li>欠席の振り替え、保護者の希望等があれば、契約用日以外に利用することがある</li>
                      <li>上記以外の曜日にて利用する場合においても、サービス提供時間は原則13時55分から17時の計3時間5分とする。</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Notes Section Table */}
              <div className="doc-info-table">
                <div className="doc-row">
                  <div className="doc-cell label large">留意点・備考</div>
                  <div className="doc-cell value">
                    <ul className="doc-list">
                      <li>安全確保のために、感情が高ぶった時や、危険行動とは判断したとき、気持ちを落ち着かせるために抱き、抱える等一時的な行動の制限や場所の移動することがあります。</li>
                      <li>学びやすさのために手を添えて課題を行う等、身体的な支援を行うことがあります。</li>
                      <li>アレルギー:なし</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* General Policy Table */}
              <div className="doc-info-table">
                <div className="doc-row">
                  <div className="doc-cell label large">総合的な支援の方針</div>
                  <div className="doc-cell value" style={{ fontWeight: 500, lineHeight: 1.8 }}>
                    明るく楽しいことや人との関わりを楽しめ、物事をすぐに理解できる。前向きな正弦さん。絵本やロールプレイなどを通して、登場人物の気持ちや状況を一緒に考えながら、感情語を学び、気持ちを言葉で表現できるよう支援します。小集団での活動では、職員が意思表現のモデルを示し、発言ややりとりの機会を逃さず、声をかけることで自分の考えを伝える経験を積み重ねられるようにします。また安心できる人との関わりを基盤に相手との適切な距離感を保ちながら、関係を広げていけるよう支援します。
                  </div>
                </div>
              </div>

              {/* Long Term Goal Table */}
              <div className="doc-info-table">
                <div className="doc-row">
                  <div className="doc-row-split">
                    <div className="doc-half">
                      <div className="doc-cell label">長期目標</div>
                      <div className="doc-cell value">小学校での基本的生活習慣や集団参加の力を身に付けながら安心して学校生活を過ごす</div>
                    </div>
                    <div className="doc-half" style={{ flex: '0 0 250px' }}>
                      <div className="doc-cell label" style={{ width: '80px' }}>期間</div>
                      <div className="doc-cell value">1年</div>
                    </div>
                  </div>
                </div>
                <div className="doc-row">
                  <div className="doc-row-split">
                    <div className="doc-half">
                      <div className="doc-cell label">短期目標</div>
                      <div className="doc-cell value">友達と適切な距離や言葉遣いを意識して関わりながら見通しを持って集中して活動に取り組む。</div>
                    </div>
                    <div className="doc-half" style={{ flex: '0 0 250px' }}>
                      <div className="doc-cell label" style={{ width: '80px' }}>期間</div>
                      <div className="doc-cell value">6ヶ月</div>
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

            {/* Parent Meeting Section (Integrated Latest Session) */}
            <div className="meeting-section">
              <div className="meeting-header">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                <h4 className="meeting-title">保護者ミーティング</h4>
              </div>

              {plan.sessions && plan.sessions.length > 0 ? (
                <div className="meeting-content">
                  <div className="meeting-info-grid">
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
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                      </svg>
                      参加者: 保護者・スタッフ
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
                  ミーティングデータが紐付けられていません
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
                    ミーティング分析を完了すると、ここに支援計画案が表示されます。
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
          onClick={() => setShowCreateModal(true)}
        >
          <div className="icon-circle">+</div>
          新しい個別支援計画を作成する
        </button>
      </div >

      {showCreateModal && (
        <SupportPlanModal
          subjectId={initialSubjectId || ''}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            fetchSupportPlans();
          }}
        />
      )}

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
                  <div>
                    <span className={`status-label ${selectedPlan.status}`}>
                      {getPlanStatusLabel(selectedPlan.status)}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ padding: '0 24px 24px 24px' }}>
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
    </div >
  );
};

export default SupportPlanCreate;