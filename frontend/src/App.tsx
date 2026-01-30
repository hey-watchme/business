import { useState } from 'react';
import Layout from './components/Layout';
import SupportPlanCreate from './pages/SupportPlanCreate';
import ChildrenList from './pages/ChildrenList';
import StaffList from './pages/StaffList';
import Login from './pages/Login';
import { useAuth } from './contexts/AuthContext';
import { type Subject } from './api/client';
import './App.css';

// Move StatCards outside to improve HMR and prevent re-definition
const StatCards = () => (
  <div className="dashboard-grid">
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
);

function App() {
  const { user, profile, loading, isBusinessUser, signOut } = useAuth();
  const [selectedMenu, setSelectedMenu] = useState('dashboard');
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);

  // ローディング中
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        fontSize: '16px'
      }}>
        読み込み中...
      </div>
    );
  }

  // 未ログイン
  if (!user) {
    return <Login />;
  }

  // ログイン済みだがビジネスユーザーではない
  if (!isBusinessUser) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        color: 'white',
        padding: '20px',
        textAlign: 'center'
      }}>
        <div style={{
          background: 'rgba(255, 255, 255, 0.95)',
          borderRadius: '20px',
          padding: '48px',
          maxWidth: '420px',
          color: '#333'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
          <h2 style={{ marginBottom: '16px' }}>アクセス権限がありません</h2>
          <p style={{ color: '#666', marginBottom: '24px', lineHeight: '1.6' }}>
            このサービスを利用するには、事業所への登録が必要です。<br />
            管理者にお問い合わせください。
          </p>
          <p style={{ color: '#888', fontSize: '14px', marginBottom: '24px' }}>
            ログイン中: {profile?.email || user.email}
          </p>
          <button
            onClick={signOut}
            style={{
              background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
              color: 'white',
              border: 'none',
              padding: '14px 32px',
              borderRadius: '10px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            ログアウト
          </button>
        </div>
      </div>
    );
  }

  const handleMenuSelect = (menuId: string) => {
    setSelectedMenu(menuId);
    setSelectedSubject(null);
  };

  const handleSubjectSelect = (subject: Subject) => {
    setSelectedSubject(subject);
    setSelectedMenu('subject-detail');
  };

  const renderContent = () => {
    if (selectedMenu === 'subject-detail' && selectedSubject) {
      return (
        <div style={{ padding: '24px' }}>
          {/* Header Section */}
          <div style={{ marginBottom: '32px' }}>
            <h1 className="page-title">支援管理</h1>
            <p className="page-subtitle">支援対象の個別支援計画の作成と管理</p>
          </div>

          {/* Child Info Card */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '24px',
            marginBottom: '32px',
            background: 'var(--bg-tertiary)',
            padding: '24px',
            borderRadius: '16px',
            border: '1px solid var(--border-color)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)'
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              backgroundColor: 'var(--bg-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '32px',
              fontWeight: '600',
              border: '4px solid var(--bg-primary)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              overflow: 'hidden'
            }}>
              {selectedSubject.avatar_url ? (
                <img src={selectedSubject.avatar_url} alt={selectedSubject.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                selectedSubject.name.charAt(0)
              )}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <h2 style={{ fontSize: '24px', fontWeight: '700', margin: 0, color: 'var(--text-primary)' }}>{selectedSubject.name}</h2>
                <span style={{
                  background: 'var(--accent-primary)',
                  color: 'white',
                  fontSize: '11px',
                  padding: '2px 10px',
                  borderRadius: '20px',
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>支援対象</span>
              </div>
              <p style={{ color: 'var(--text-secondary)', margin: '8px 0 0', fontSize: '15px' }}>
                {selectedSubject.age}歳 • {
                  selectedSubject.gender === 'male' || selectedSubject.gender === '男性' ? '男の子' :
                    selectedSubject.gender === 'female' || selectedSubject.gender === '女性' ? '女の子' :
                      'その他'
                } • {
                  selectedSubject.diagnosis && selectedSubject.diagnosis.length > 0
                    ? selectedSubject.diagnosis.join(' / ')
                    : selectedSubject.cognitive_type || '特性情報未設定'
                }
              </p>
              {selectedSubject.notes && (
                <p style={{
                  color: 'var(--text-muted)',
                  margin: '12px 0 0',
                  fontSize: '13px',
                  lineHeight: '1.6',
                  maxWidth: '600px',
                  whiteSpace: 'pre-wrap'
                }}>
                  {selectedSubject.notes}
                </p>
              )}
            </div>
          </div>

          <SupportPlanCreate initialSubjectId={selectedSubject.id} hideHeader={true} />
        </div>
      );
    }

    switch (selectedMenu) {
      case 'dashboard':
        return (
          <div style={{ padding: '24px' }}>
            <div style={{ marginBottom: '32px' }}>
              <h1 className="page-title">ダッシュボード</h1>
              <p className="page-subtitle">全体の統計情報やパフォーマンスメトリクスを表示します。</p>
            </div>
            <StatCards />
          </div>
        );
      case 'organization-detail':
        return (
          <div style={{ padding: '24px' }}>
            <h1 className="page-title">{profile?.organization_name}について</h1>
            <p className="page-subtitle">オーガニゼーション基本情報と施設一覧</p>
            <div style={{
              marginTop: '32px',
              background: 'var(--bg-tertiary)',
              padding: '24px',
              borderRadius: '12px',
              border: '1px solid var(--border-color)'
            }}>
              <h3 style={{ marginBottom: '16px' }}>企業情報</h3>
              <p style={{ color: 'var(--text-secondary)' }}>現在、詳細情報は準備中です。</p>
            </div>
            <div style={{ marginTop: '32px' }}>
              <h3 style={{ marginBottom: '16px' }}>所属施設一覧</h3>
              <div className="subjects-grid">
                <div
                  className="subject-card"
                  style={{ width: '300px' }}
                  onClick={() => setSelectedMenu('facility-detail')}
                >
                  <div className="subject-info">
                    <h4 className="subject-name">{profile?.facility_name}</h4>
                    <span className="subject-meta">メイン拠点</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case 'facility-detail':
        return (
          <div style={{ padding: '24px' }}>
            <h1 className="page-title">{profile?.facility_name}</h1>
            <p className="page-subtitle">施設の詳細情報と管理</p>
            <div style={{
              marginTop: '32px',
              background: 'var(--bg-tertiary)',
              padding: '24px',
              borderRadius: '12px',
              border: '1px solid var(--border-color)'
            }}>
              <h3 style={{ marginBottom: '16px' }}>施設基本情報</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '16px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>施設コード</span>
                <span>{profile?.facility_id || '---'}</span>
                <span style={{ color: 'var(--text-secondary)' }}>所属企業</span>
                <span>{profile?.organization_name}</span>
              </div>
              <p style={{ color: 'var(--text-secondary)', marginTop: '24px' }}>現在、詳細情報は準備中です。</p>
            </div>
          </div>
        );
      case 'children':
        return <ChildrenList />;
      case 'staff':
        return <StaffList />;
      case 'facilities':
        return (
          <div style={{ padding: '24px' }}>
            <h1>施設管理</h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              施設の基本設定や利用状況を確認します。
            </p>
          </div>
        );
      case 'settings':
        return (
          <div style={{ padding: '24px' }}>
            <h1>設定</h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              システム全般の設定を管理します。
            </p>
          </div>
        );
      default:
        return (
          <div style={{ padding: '24px' }}>
            <h1>{selectedMenu}</h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              このセクションは準備中です。
            </p>
          </div>
        );
    }
  };

  return (
    <Layout
      selectedMenuId={selectedMenu}
      onMenuSelect={handleMenuSelect}
      onSettingsClick={() => setSelectedMenu('settings')}
      onOrganizationClick={() => setSelectedMenu('organization-detail')}
      onFacilityClick={() => setSelectedMenu('facility-detail')}
      selectedSubjectId={selectedSubject?.id}
      onSubjectSelect={handleSubjectSelect}
    >
      {renderContent()}
    </Layout>
  );
}

export default App;
