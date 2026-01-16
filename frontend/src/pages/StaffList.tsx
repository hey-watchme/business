import React, { useState, useEffect } from 'react';
import { api, type User, type UsersResponse } from '../api/client';
import './ChildrenList.css';

const StaffList: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [analytics, setAnalytics] = useState<UsersResponse['analytics'] | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.getUsers();
      setUsers(response.users);
      setAnalytics(response.analytics);
    } catch (err) {
      console.error('Failed to fetch users:', err);
      setError('職員情報の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const getRoleLabel = (role: string | null | undefined): string => {
    if (!role || role === 'unknown') return '未設定';
    const roleLabels: Record<string, string> = {
      'admin': '管理者',
      'staff': '職員',
      'therapist': '療育士',
      'manager': 'マネージャー',
    };
    return roleLabels[role] || role;
  };

  const getInitial = (name: string): string => {
    return name.charAt(0);
  };

  const getRoleColor = (role: string | null | undefined): string => {
    if (!role || role === 'unknown') return '#999';
    const roleColors: Record<string, string> = {
      'admin': '#F44336',
      'staff': '#4FC3F7',
      'therapist': '#9C27B0',
      'manager': '#FF9800',
    };
    return roleColors[role] || '#999';
  };

  return (
    <div className="children-list">
      <div className="page-header">
        <h1 className="page-title">職員管理</h1>
        <button className="primary-button">
          <span className="button-icon">+</span>
          新規職員登録
        </button>
      </div>

      {/* Analytics Section */}
      {analytics && (
        <div className="analytics-section">
          <div className="analytics-card">
            <div className="analytics-value">{analytics.total_count}</div>
            <div className="analytics-label">登録職員数</div>
          </div>
          <div className="analytics-card">
            <div className="analytics-label" style={{ marginBottom: '12px' }}>役職別内訳</div>
            <div className="age-distribution">
              {Object.entries(analytics.role_distribution).map(([role, count]) => (
                <div key={role} className="age-group">
                  <span className="age-group-label">{getRoleLabel(role)}</span>
                  <span className="age-group-count">{count}名</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Users List */}
      <div className="content-area">
        {loading && (
          <div className="loading-state">
            <div className="spinner" />
            <p>データを読み込み中...</p>
          </div>
        )}

        {error && (
          <div className="error-state">
            <p>{error}</p>
            <button onClick={fetchUsers}>再試行</button>
          </div>
        )}

        {!loading && !error && users.length === 0 && (
          <div className="empty-state">
            <p>職員が登録されていません</p>
            <button className="primary-button">
              <span className="button-icon">+</span>
              最初の職員を登録
            </button>
          </div>
        )}

        {!loading && !error && users.length > 0 && (
          <div className="subjects-grid">
            {users.map(user => (
              <div
                key={user.id}
                className={`subject-card ${selectedUser?.id === user.id ? 'selected' : ''}`}
                onClick={() => setSelectedUser(user)}
              >
                <div className="subject-avatar" style={{ backgroundColor: getRoleColor(user.role) }}>
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt={user.display_name} />
                  ) : (
                    <span className="avatar-initial">{getInitial(user.display_name)}</span>
                  )}
                </div>
                <div className="subject-info">
                  <h3 className="subject-name">{user.display_name}</h3>
                  <div className="subject-meta">
                    <span className="subject-age">{user.email}</span>
                  </div>
                  {user.role && (
                    <div className="subject-cognitive-type">
                      {getRoleLabel(user.role)}
                    </div>
                  )}
                </div>
                <div className="subject-actions">
                  <button className="icon-button">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Drawer for selected user */}
      {selectedUser && (
        <>
          <div
            className="drawer-overlay"
            onClick={() => setSelectedUser(null)}
          />
          <div className="drawer">
            <div className="drawer-header">
              <h2>職員詳細</h2>
              <button
                className="close-button"
                onClick={() => setSelectedUser(null)}
              >
                ×
              </button>
            </div>
            <div className="drawer-content">
              <div className="subject-detail">
                <div className="detail-avatar" style={{ backgroundColor: getRoleColor(selectedUser.role) }}>
                  {selectedUser.avatar_url ? (
                    <img src={selectedUser.avatar_url} alt={selectedUser.display_name} />
                  ) : (
                    <span className="avatar-initial-large">{getInitial(selectedUser.display_name)}</span>
                  )}
                </div>
                <h3 className="detail-name">{selectedUser.display_name}</h3>

                <div className="detail-info">
                  <div className="detail-row">
                    <span className="detail-label">メールアドレス</span>
                    <span className="detail-value">{selectedUser.email}</span>
                  </div>
                  {selectedUser.role && (
                    <div className="detail-row">
                      <span className="detail-label">役職</span>
                      <span className="detail-value">{getRoleLabel(selectedUser.role)}</span>
                    </div>
                  )}
                  {selectedUser.facility_id && (
                    <div className="detail-row">
                      <span className="detail-label">施設ID</span>
                      <span className="detail-value">{selectedUser.facility_id}</span>
                    </div>
                  )}
                </div>

                <div className="detail-actions">
                  <button className="primary-button">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ marginRight: '8px' }}>
                      <path d="M14.8 4.2L15.8 5.2L7 14H6V13L14.8 4.2Z" stroke="white" strokeWidth="1.5"/>
                    </svg>
                    編集
                  </button>
                  <button className="secondary-button">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ marginRight: '8px' }}>
                      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M10 6V10L13 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    アクセス履歴
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default StaffList;
