import React from 'react';
import './Sidebar.css';

interface MenuItem {
  id: string;
  label: string;
  icon: JSX.Element;
  badge?: number | string;
  active?: boolean;
  subItems?: MenuItem[];
}

interface SidebarProps {
  selectedMenuId?: string;
  onMenuSelect?: (menuId: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ selectedMenuId = 'support-plan', onMenuSelect }) => {
  const menuItems: MenuItem[] = [
    {
      id: 'dashboard',
      label: 'ダッシュボード',
      icon: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <rect x="3" y="3" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
          <rect x="11" y="3" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
          <rect x="3" y="11" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
          <rect x="11" y="11" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
        </svg>
      )
    },
    {
      id: 'support-plan',
      label: '個別支援計画作成',
      icon: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V16C4 16.5304 4.21071 17.0391 4.58579 17.4142C4.96086 17.7893 5.46957 18 6 18H14C14.5304 18 15.0391 17.7893 15.4142 17.4142C15.7893 17.0391 16 16.5304 16 16V4C16 3.46957 15.7893 2.96086 15.4142 2.58579C15.0391 2.21071 14.5304 2 14 2Z" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M8 7H12M8 10H12M8 13H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      ),
      badge: '3'
    },
    {
      id: 'children',
      label: '児童管理',
      icon: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="7" r="3" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M5 18C5 15.2386 7.23858 13 10 13C12.7614 13 15 15.2386 15 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      )
    },
    {
      id: 'interviews',
      label: 'ヒアリング録音',
      icon: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <rect x="7" y="4" width="6" height="8" rx="3" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M5 10V11C5 14.3137 7.68629 17 11 17M15 10V11C15 14.3137 12.3137 17 9 17M10 17V19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      )
    },
    {
      id: 'reports',
      label: 'レポート',
      icon: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M4 16V8M8 16V4M12 16V12M16 16V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      badge: 'New'
    },
    {
      id: 'facilities',
      label: '事業所管理',
      icon: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M3 10L10 3L17 10M5 8.5V16C5 16.5523 5.44772 17 6 17H14C14.5523 17 15 16.5523 15 16V8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <rect x="8" y="11" width="4" height="6" stroke="currentColor" strokeWidth="1.5"/>
        </svg>
      )
    },
    {
      id: 'staff',
      label: '職員管理',
      icon: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="8" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M3 16C3 13.7909 4.79086 12 7 12H9C11.2091 12 13 13.7909 13 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          <circle cx="14.5" cy="7.5" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M16.5 13C16.5 11.6193 15.3807 10.5 14 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      )
    }
  ];

  const systemMenuItems: MenuItem[] = [
    {
      id: 'alerts',
      label: 'アラート',
      icon: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M10 2L2 7L10 12L18 7L10 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
          <path d="M2 13L10 18L18 13" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
        </svg>
      ),
      badge: '7'
    },
    {
      id: 'compliance',
      label: 'コンプライアンス',
      icon: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M10 2L3 7V11C3 15.5 6 18.5 10 19C14 18.5 17 15.5 17 11V7L10 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
          <path d="M7 10L9 12L13 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    },
    {
      id: 'settings',
      label: '設定',
      icon: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="2" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M10 4V2M10 18V16M16 10H18M2 10H4M14.24 5.76L15.66 4.34M4.34 15.66L5.76 14.24M14.24 14.24L15.66 15.66M4.34 4.34L5.76 5.76" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      )
    }
  ];

  const handleMenuClick = (menuId: string) => {
    if (onMenuSelect) {
      onMenuSelect(menuId);
    }
  };

  const renderMenuItem = (item: MenuItem) => (
    <li key={item.id}>
      <button
        className={`menu-item ${selectedMenuId === item.id ? 'active' : ''}`}
        onClick={() => handleMenuClick(item.id)}
      >
        <span className="menu-icon">{item.icon}</span>
        <span className="menu-label">{item.label}</span>
        {item.badge && (
          <span className={`menu-badge ${typeof item.badge === 'string' ? 'badge-new' : ''}`}>
            {item.badge}
          </span>
        )}
      </button>
    </li>
  );

  return (
    <aside className="sidebar">
      <nav className="sidebar-nav">
        <div className="menu-section">
          <h3 className="menu-section-title">業務メニュー</h3>
          <ul className="menu-list">
            {menuItems.map(renderMenuItem)}
          </ul>
        </div>

        <div className="menu-section">
          <h3 className="menu-section-title">システム</h3>
          <ul className="menu-list">
            {systemMenuItems.map(renderMenuItem)}
          </ul>
        </div>
      </nav>

      <div className="sidebar-footer">
        <div className="storage-indicator">
          <div className="storage-label">
            <span>ストレージ使用量</span>
            <span>65%</span>
          </div>
          <div className="storage-bar">
            <div className="storage-fill" style={{ width: '65%' }}></div>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;