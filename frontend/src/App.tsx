import { useState } from 'react';
import Layout from './components/Layout';
import SupportPlanCreate from './pages/SupportPlanCreate';
import ChildrenList from './pages/ChildrenList';
import StaffList from './pages/StaffList';
import Login from './pages/Login';
import { useAuth } from './contexts/AuthContext';
import { type Subject } from './api/client';
import { calculateAge } from './utils/date';
import './App.css';

// Format date as "YYYY年MM月DD日"
const formatDateOnly = (dateString: string | null | undefined): string => {
  if (!dateString) return '---';
  const date = new Date(dateString);
  return `${date.getFullYear()}年${(date.getMonth() + 1).toString().padStart(2, '0')}月${date.getDate().toString().padStart(2, '0')}日`;
};

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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                {/* 基本情報 */}
                <div style={{ display: 'flex', gap: '16px', fontSize: '15px' }}>
                  <div><span style={{ color: 'var(--text-muted)' }}>生年月日:</span> <span style={{ color: 'var(--text-primary)' }}>{formatDateOnly(selectedSubject.birth_date)}</span></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>年齢:</span> <span style={{ color: 'var(--text-primary)' }}>{calculateAge(selectedSubject.birth_date) ?? '---'}歳</span></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>性別:</span> <span style={{ color: 'var(--text-primary)' }}>{
                    selectedSubject.gender === 'male' || selectedSubject.gender === '男性' ? '男性' :
                      selectedSubject.gender === 'female' || selectedSubject.gender === '女性' ? '女性' :
                        'その他'
                  }</span></div>
                </div>
                {/* 診断・特性 */}
                {(selectedSubject.diagnosis && selectedSubject.diagnosis.length > 0) && (
                  <div style={{ fontSize: '14px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>診断・特性:</span> <span style={{ color: 'var(--text-secondary)' }}>{selectedSubject.diagnosis.join(', ')}</span>
                  </div>
                )}
                {/* 所属 */}
                {selectedSubject.school_name && (
                  <div style={{ fontSize: '14px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>所属:</span> <span style={{ color: 'var(--text-secondary)' }}>{selectedSubject.school_name} ({selectedSubject.school_type || '学校'})</span>
                  </div>
                )}
                {/* お住まい - Removed as property doesn't exist */}
              </div>
              {selectedSubject.notes && (
                <p style={{
                  color: 'var(--text-muted)',
                  margin: '12px 0 0',
                  fontSize: '13px',
                  lineHeight: '1.6',
                  maxWidth: '850px',
                  whiteSpace: 'pre-wrap',
                  padding: '8px 12px',
                  background: 'var(--bg-tertiary)',
                  borderRadius: '8px'
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
      case 'children':
        return <ChildrenList />;
      case 'staff':
        return <StaffList />;
      case 'settings':
        return (
          <div style={{ padding: '24px' }}>
            <h1 className="page-title">システム設定</h1>
            <p className="page-subtitle">システム全般の設定を管理します。</p>
            <div style={{ marginTop: '32px', background: 'var(--bg-tertiary)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
              <h3>一般設定</h3>
              <p style={{ color: 'var(--text-secondary)' }}>通知設定、表示言語、タイムゾーンなどの管理。</p>
            </div>
          </div>
        );
      case 'organization':
        return (
          <div style={{ padding: '24px' }}>
            <h1 className="page-title">法人情報</h1>
            <p className="page-subtitle">法人（組織）の基本情報を確認・編集します。</p>
            <div style={{ marginTop: '32px', background: 'var(--bg-tertiary)', padding: '32px', borderRadius: '16px', border: '1px solid var(--border-color)', maxWidth: '800px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '24px' }}>
                <div style={{ color: 'var(--text-muted)' }}>法人名</div>
                <div style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{profile?.organization_name || '株式会社ウォッチミー'}</div>

                <div style={{ color: 'var(--text-muted)' }}>代表者</div>
                <div style={{ color: 'var(--text-primary)' }}>山田 一郎</div>

                <div style={{ color: 'var(--text-muted)' }}>設立</div>
                <div style={{ color: 'var(--text-primary)' }}>2020年4月1日</div>

                <div style={{ color: 'var(--text-muted)' }}>所在地</div>
                <div style={{ color: 'var(--text-primary)' }}>東京都港区六本木 1-2-3</div>

                <div style={{ color: 'var(--text-muted)' }}>事業内容</div>
                <div style={{ color: 'var(--text-primary)' }}>福祉支援DXソリューションの開発・提供</div>
              </div>
            </div>
          </div>
        );
      case 'facilities':
        return (
          <div style={{ padding: '24px' }}>
            <h1 className="page-title">施設管理</h1>
            <p className="page-subtitle">現在の事業所の詳細情報を管理します。</p>
            <div style={{ marginTop: '32px', background: 'var(--bg-tertiary)', padding: '32px', borderRadius: '16px', border: '1px solid var(--border-color)', maxWidth: '800px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '24px' }}>
                <div style={{ color: 'var(--text-muted)' }}>事業所名</div>
                <div style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{profile?.facility_name || '未設定'}</div>

                <div style={{ color: 'var(--text-muted)' }}>施設形態</div>
                <div style={{ color: 'var(--text-primary)' }}>児童発達支援・放課後等デイサービス</div>

                <div style={{ color: 'var(--text-muted)' }}>住所</div>
                <div style={{ color: 'var(--text-primary)' }}>東京都世田谷区北沢 2-10-15</div>

                <div style={{ color: 'var(--text-muted)' }}>電話番号</div>
                <div style={{ color: 'var(--text-primary)' }}>03-1234-5678</div>

                <div style={{ color: 'var(--text-muted)' }}>定員</div>
                <div style={{ color: 'var(--text-primary)' }}>10名 / 日</div>
              </div>
            </div>
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
      selectedSubjectId={selectedSubject?.id}
      onSubjectSelect={handleSubjectSelect}
      onOrganizationClick={() => setSelectedMenu('organization')}
      onFacilityClick={() => setSelectedMenu('facilities')}
      onSettingsClick={() => setSelectedMenu('settings')}
    >
      {renderContent()}
    </Layout>
  );
}

export default App;
