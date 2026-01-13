import React, { useState } from 'react';
import './SupportPlanCreate.css';

interface Session {
  id: string;
  childName: string;
  date: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  duration?: string;
  progress?: number;
}

const SupportPlanCreate: React.FC = () => {
  const [sessions] = useState<Session[]>([
    {
      id: '1',
      childName: '田中太郎',
      date: '2026-01-13',
      status: 'completed',
      duration: '45分',
      progress: 100
    },
    {
      id: '2',
      childName: '佐藤花子',
      date: '2026-01-13',
      status: 'processing',
      progress: 65
    },
    {
      id: '3',
      childName: '鈴木一郎',
      date: '2026-01-12',
      status: 'pending'
    }
  ]);

  const getStatusIcon = (status: Session['status']) => {
    switch (status) {
      case 'completed':
        return (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="var(--accent-success)" strokeWidth="1.5"/>
            <path d="M5 8L7 10L11 6" stroke="var(--accent-success)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
      case 'processing':
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

  const getStatusLabel = (status: Session['status']) => {
    switch (status) {
      case 'completed': return '完了';
      case 'processing': return '処理中';
      case 'error': return 'エラー';
      default: return '待機中';
    }
  };

  return (
    <div className="support-plan-create">
      <div className="page-header">
        <div>
          <h1 className="page-title">個別支援計画作成</h1>
          <p className="page-subtitle">保護者ヒアリング録音から個別支援計画書を自動生成</p>
        </div>
        <button className="primary-button">
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

      {/* Sessions List */}
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

        <div className="sessions-list">
          {sessions.map(session => (
            <div key={session.id} className={`session-card ${session.status}`}>
              <div className="session-status">
                {getStatusIcon(session.status)}
              </div>

              <div className="session-info">
                <h3 className="session-child-name">{session.childName}</h3>
                <div className="session-meta">
                  <span className="meta-item">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <rect x="2" y="2" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1"/>
                      <path d="M2 4H10M4 2V1M8 2V1" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                    </svg>
                    {session.date}
                  </span>
                  {session.duration && (
                    <span className="meta-item">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1"/>
                        <path d="M6 3V6L8 7" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                      </svg>
                      {session.duration}
                    </span>
                  )}
                </div>
              </div>

              <div className="session-progress">
                {session.status === 'processing' && session.progress && (
                  <>
                    <div className="circular-progress">
                      <svg width="40" height="40" viewBox="0 0 40 40">
                        <circle cx="20" cy="20" r="16" stroke="var(--bg-tertiary)" strokeWidth="3" fill="none"/>
                        <circle
                          cx="20"
                          cy="20"
                          r="16"
                          stroke="var(--accent-primary)"
                          strokeWidth="3"
                          fill="none"
                          strokeDasharray={`${session.progress} ${100 - session.progress}`}
                          strokeDashoffset="25"
                          transform="rotate(-90 20 20)"
                        />
                      </svg>
                      <span className="progress-value">{session.progress}%</span>
                    </div>
                  </>
                )}
                <span className={`status-label ${session.status}`}>
                  {getStatusLabel(session.status)}
                </span>
              </div>

              <div className="session-actions">
                {session.status === 'completed' ? (
                  <>
                    <button className="action-button" title="プレビュー">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5"/>
                        <path d="M1 8C1 8 3 3 8 3C13 3 15 8 15 8C15 8 13 13 8 13C3 13 1 8 1 8Z" stroke="currentColor" strokeWidth="1.5"/>
                      </svg>
                    </button>
                    <button className="action-button" title="ダウンロード">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M8 2V10M8 10L11 7M8 10L5 7M2 14H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </>
                ) : session.status === 'processing' ? (
                  <button className="action-button" title="キャンセル">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <rect x="3" y="3" width="10" height="10" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                    </svg>
                  </button>
                ) : (
                  <button className="action-button primary" title="開始">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M5 3L13 8L5 13V3Z" fill="currentColor"/>
                    </svg>
                  </button>
                )}
                <button className="action-button" title="詳細">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="3" r="1" fill="currentColor"/>
                    <circle cx="8" cy="8" r="1" fill="currentColor"/>
                    <circle cx="8" cy="13" r="1" fill="currentColor"/>
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SupportPlanCreate;