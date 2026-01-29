import React from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import { type Subject } from '../api/client';
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
  return (
    <div className="layout">
      <Header
        companyName="株式会社すまいる"
        facilityName="横浜市港北営業所"
        userName="山田太郎"
        userRole="管理者"
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