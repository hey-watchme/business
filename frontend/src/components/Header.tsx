import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './Header.css';

interface HeaderProps {
  companyName: string;
  facilityName: string;
  userName: string;
  avatarUrl?: string;
  onSettingsClick?: () => void;
  onOrganizationClick?: () => void;
  onFacilityClick?: () => void;
}

const Header: React.FC<HeaderProps> = ({
  companyName = '未設定',
  facilityName = '未設定',
  userName = 'ゲスト',
  avatarUrl,
  onSettingsClick,
  onOrganizationClick,
  onFacilityClick
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  return (
    <header className="header">
      <div className="header-left">
        <div className="logo-section">
          <span className="logo">WatchMe</span>
          <span className="logo-business">Business</span>
        </div>
        <div className="org-info">
          <span className="company-name" onClick={onOrganizationClick} style={{ cursor: 'pointer' }}>{companyName}</span>
          <span className="divider">|</span>
          <span className="facility-name" onClick={onFacilityClick} style={{ cursor: 'pointer' }}>{facilityName}</span>
        </div>
      </div>

      <div className="header-center">
        <div className="search-bar">
          <svg className="search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input type="text" placeholder="検索..." />
        </div>
      </div>

      <div className="header-right">
        <button className="header-icon-btn" title="通知">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M15 7C15 5.67392 14.4732 4.40215 13.5355 3.46447C12.5979 2.52678 11.3261 2 10 2C8.67392 2 7.40215 2.52678 6.46447 3.46447C5.52678 4.40215 5 5.67392 5 7C5 14 2 16 2 16H18C18 16 15 14 15 7Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M11.73 18C11.5542 18.3031 11.3019 18.5547 10.9982 18.7295C10.6946 18.9044 10.3504 18.9965 10 18.9965C9.64964 18.9965 9.30541 18.9044 9.00179 18.7295C8.69818 18.5547 8.44583 18.3031 8.27 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="notification-badge">3</span>
        </button>

        <button className="header-icon-btn" title="設定" onClick={onSettingsClick}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
        </button>

        <div
          className="user-profile-container"
          onMouseEnter={() => setIsMenuOpen(true)}
          onMouseLeave={() => setIsMenuOpen(false)}
        >
          <div className="user-profile">
            <div className="user-info">
              <span className="user-name">{userName}</span>
            </div>
            <div className="user-avatar">
              {avatarUrl ? (
                <img src={avatarUrl} alt={userName} className="avatar-img" />
              ) : (
                userName.charAt(0)
              )}
            </div>
          </div>

          {isMenuOpen && (
            <div className="user-dropdown">
              <button className="dropdown-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                マイページ
              </button>
              <button className="dropdown-item" onClick={handleSignOut}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12.22 2h3.28a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2h-3.28" />
                  <path d="m7 16-4-4 4-4" />
                  <path d="M3 12h13" />
                </svg>
                ログアウト
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;