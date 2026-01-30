import React from 'react';
import { type Subject } from '../api/client';
import { useSubjects } from '../contexts/SubjectContext';
import './Sidebar.css';

interface MenuItem {
  id: string;
  label: string;
  icon: React.ReactElement;
  badge?: number | string;
  active?: boolean;
}

interface SidebarProps {
  selectedMenuId?: string;
  onMenuSelect?: (menuId: string) => void;
  selectedSubjectId?: string;
  onSubjectSelect?: (subject: Subject) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  selectedMenuId,
  onMenuSelect,
  selectedSubjectId,
  onSubjectSelect
}) => {
  const { subjects, loading } = useSubjects();

  const menuItems: MenuItem[] = [
    {
      id: 'dashboard',
      label: 'ダッシュボード',
      icon: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <rect x="3" y="3" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
          <rect x="11" y="3" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
          <rect x="3" y="11" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
          <rect x="11" y="11" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      )
    },
    {
      id: 'children',
      label: '児童管理',
      icon: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="7" r="3" stroke="currentColor" strokeWidth="1.5" />
          <path d="M5 18C5 15.2386 7.23858 13 10 13C12.7614 13 15 15.2386 15 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      )
    },
    {
      id: 'staff',
      label: '職員管理',
      icon: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="8" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M3 16C3 13.7909 4.79086 12 7 12H9C11.2091 12 13 13.7909 13 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="14.5" cy="7.5" r="1.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M16.5 13C16.5 11.6193 15.3807 10.5 14 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      )
    }
  ];

  const handleMenuClick = (menuId: string) => {
    if (onMenuSelect) {
      onMenuSelect(menuId);
    }
  };

  const handleSubjectClick = (subject: Subject) => {
    if (onSubjectSelect) {
      onSubjectSelect(subject);
    }
  };

  return (
    <aside className="sidebar">
      <nav className="sidebar-nav">
        <div className="menu-section">
          <ul className="menu-list">
            {menuItems.map(item => (
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
            ))}
          </ul>
        </div>

        <div className="menu-section">
          <h3 className="menu-section-title">支援対象</h3>
          <ul className="subject-list">
            {loading ? (
              <li className="list-loading">読み込み中...</li>
            ) : subjects.length === 0 ? (
              <li className="list-empty">未登録</li>
            ) : (
              subjects.map(subject => (
                <li key={subject.id}>
                  <button
                    className={`subject-item ${selectedSubjectId === subject.id ? 'active' : ''}`}
                    onClick={() => handleSubjectClick(subject)}
                  >
                    <div className="subject-avatar">
                      {subject.avatar_url ? (
                        <img src={subject.avatar_url} alt={subject.name} />
                      ) : (
                        <div className="avatar-placeholder">
                          {subject.name.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="subject-info">
                      <span className="subject-name">{subject.name}</span>
                      <span className="subject-meta">
                        {subject.age}歳 • {
                          subject.gender === 'male' || subject.gender === '男性' ? '男の子' :
                            subject.gender === 'female' || subject.gender === '女性' ? '女の子' :
                              'その他'
                        }
                      </span>
                    </div>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      </nav>
    </aside>
  );
};

export default Sidebar;