import React from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import './Layout.css';

interface LayoutProps {
  children: React.ReactNode;
  selectedMenuId?: string;
  onMenuSelect?: (menuId: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, selectedMenuId, onMenuSelect }) => {
  return (
    <div className="layout">
      <Header
        companyName="株式会社すまいる"
        facilityName="横浜市港北営業所"
        userName="山田太郎"
        userRole="管理者"
      />
      <div className="layout-body">
        <Sidebar selectedMenuId={selectedMenuId} onMenuSelect={onMenuSelect} />
        <main className="main-content">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;