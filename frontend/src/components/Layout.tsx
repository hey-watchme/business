import React from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import { type Subject } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import './Layout.css';

interface LayoutProps {
  children: React.ReactNode;
  selectedMenuId?: string;
  onMenuSelect?: (menuId: string) => void;
  selectedSubjectId?: string;
  onSubjectSelect?: (subject: Subject) => void;
}

const Layout: React.FC<LayoutProps> = ({
  children,
  selectedMenuId,
  onMenuSelect,
  selectedSubjectId,
  onSubjectSelect
}) => {
  const { profile } = useAuth();

  return (
    <div className="layout">
      <Header
        companyName={profile?.organization_name || '未設定'}
        facilityName={profile?.facility_name || '未設定'}
        userName={profile?.name || 'ゲスト'}
        userRole={profile?.role === 'admin' ? '管理者' : 'スタッフ'}
      />
      <div className="layout-body">
        <Sidebar
          selectedMenuId={selectedMenuId}
          onMenuSelect={onMenuSelect}
          selectedSubjectId={selectedSubjectId}
          onSubjectSelect={onSubjectSelect}
        />
        <main className="main-content">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;