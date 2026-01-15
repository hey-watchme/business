import { useState } from 'react';
import Layout from './components/Layout';
import SupportPlanCreate from './pages/SupportPlanCreate';
import ChildrenList from './pages/ChildrenList';
import './App.css';

function App() {
  const [selectedMenu, setSelectedMenu] = useState('support-plan');

  const renderContent = () => {
    switch (selectedMenu) {
      case 'support-plan':
        return <SupportPlanCreate />;
      case 'dashboard':
        return (
          <div style={{ padding: '24px' }}>
            <h1>ダッシュボード</h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              全体の統計情報やパフォーマンスメトリクスを表示します。
            </p>
          </div>
        );
      case 'children':
        return <ChildrenList />;
      case 'interviews':
        return (
          <div style={{ padding: '24px' }}>
            <h1>ヒアリング録音</h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              保護者ヒアリングの録音と管理を行います。
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
    <Layout selectedMenuId={selectedMenu} onMenuSelect={setSelectedMenu}>
      {renderContent()}
    </Layout>
  );
}

export default App
