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
  onOrganizationClick?: () => void;
  onFacilityClick?: () => void;
  onSettingsClick?: () => void;
}

const Layout: React.FC<LayoutProps> = ({
  children,
  selectedMenuId,
  onMenuSelect,
  selectedSubjectId,
  onSubjectSelect,
  onOrganizationClick,
  onFacilityClick,
  onSettingsClick
}) => {
  const { profile } = useAuth();

  return (
    <div className="layout">
      <Header
        companyName={profile?.organization_name || '未設定'}
        facilityName={profile?.facility_name || '未設定'}
        userName={profile?.name || 'ゲスト'}
        avatarUrl={profile?.avatar_url || undefined}
        onOrganizationClick={onOrganizationClick}
        onFacilityClick={onFacilityClick}
        onSettingsClick={onSettingsClick}
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