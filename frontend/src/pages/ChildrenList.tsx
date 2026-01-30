import React, { useState } from 'react';
import { api, type Subject } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useSubjects } from '../contexts/SubjectContext';
import './ChildrenList.css';

const ChildrenList: React.FC = () => {
  const { subjects, analytics, loading, refreshSubjects } = useSubjects();
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const { profile } = useAuth();

  // Registration Modal States
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    gender: '未指定',
    notes: '',
    birth_date: ''
  });

  const handleRegisterClick = () => {
    setFormData({
      name: '',
      age: '',
      gender: '未指定',
      notes: '',
      birth_date: ''
    });
    setIsRegisterModalOpen(true);
  };

  const handleRegisterClose = () => {
    if (isSubmitting) return;
    setIsRegisterModalOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.facility_id) return;
    if (!formData.name.trim()) {
      alert('お名前を入力してください');
      return;
    }

    try {
      setIsSubmitting(true);
      await api.createSubject({
        facility_id: profile.facility_id,
        name: formData.name,
        age: formData.age ? parseInt(formData.age) : undefined,
        gender: formData.gender,
        notes: formData.notes
      });

      // Success
      setIsRegisterModalOpen(false);
      await refreshSubjects(); // This will update both ChildrenList and Sidebar!
    } catch (err) {
      console.error('Failed to register subject:', err);
      alert('登録に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getAgeLabel = (age: number | null | undefined): string => {
    if (age === null || age === undefined) return '年齢不明';
    return `${age}歳`;
  };

  const getGenderLabel = (gender: string | null | undefined): string => {
    switch (gender) {
      case 'male':
      case '男性': return '男';
      case 'female':
      case '女性': return '女';
      case 'other':
      case 'その他': return 'その他';
      default: return '性別不明';
    }
  };

  const getCognitiveTypeLabel = (type: string | null | undefined): string => {
    const labels: Record<string, string> = {
      'sensory_sensitive': '感覚過敏',
      'sensory_insensitive': '感覚鈍感',
      'cognitive_analytical': '分析的思考',
      'cognitive_intuitive': '直感的思考',
      'verbal_expressive': '言語表現型',
      'verbal_introspective': '内省的',
      'behavioral_impulsive': '衝動的行動',
      'behavioral_deliberate': '慎重行動',
      'emotional_stable': '情緒安定',
      'emotional_unstable': '情緒不安定',
    };
    return type ? (labels[type] || type) : '未評価';
  };

  const getInitial = (name: string): string => {
    return name.charAt(0);
  };

  const getGenderColor = (gender: string | null | undefined): string => {
    switch (gender) {
      case 'male':
      case '男性': return '#4FC3F7';
      case 'female':
      case '女性': return '#F48FB1';
      case 'other':
      case 'その他': return '#9C27B0';
      default: return '#999';
    }
  };

  return (
    <div className="children-list">
      <div className="page-header">
        <h1 className="page-title">児童管理</h1>
        <button className="primary-button" onClick={handleRegisterClick}>
          <span className="button-icon">+</span>
          新規児童登録
        </button>
      </div>

      {/* Analytics Section */}
      {analytics && analytics.total_count > 0 && (
        <div className="analytics-section">
          <div className="analytics-card">
            <div className="analytics-value">{analytics.total_count}</div>
            <div className="analytics-label">登録児童数</div>
          </div>
          <div className="analytics-card">
            <div className="analytics-chart">
              <div className="gender-bars">
                <div
                  className="gender-bar male"
                  style={{
                    width: `${(analytics.gender_distribution.male / analytics.total_count * 100) || 0}%`,
                    backgroundColor: '#4FC3F7'
                  }}
                />
                <div
                  className="gender-bar female"
                  style={{
                    width: `${(analytics.gender_distribution.female / analytics.total_count * 100) || 0}%`,
                    backgroundColor: '#F48FB1'
                  }}
                />
                <div
                  className="gender-bar other"
                  style={{
                    width: `${(analytics.gender_distribution.other / analytics.total_count * 100) || 0}%`,
                    backgroundColor: '#9C27B0'
                  }}
                />
                <div
                  className="gender-bar unknown"
                  style={{
                    width: `${(analytics.gender_distribution.unknown / analytics.total_count * 100) || 0}%`,
                    backgroundColor: '#999'
                  }}
                />
              </div>
              <div className="gender-labels">
                <span className="gender-label">
                  <span className="gender-dot" style={{ backgroundColor: '#4FC3F7' }} />
                  男児 {analytics.gender_distribution.male}名
                </span>
                <span className="gender-label">
                  <span className="gender-dot" style={{ backgroundColor: '#F48FB1' }} />
                  女児 {analytics.gender_distribution.female}名
                </span>
                {(analytics.gender_distribution.other > 0 || analytics.gender_distribution.unknown > 0) && (
                  <span className="gender-label">
                    <span className="gender-dot" style={{ backgroundColor: '#999' }} />
                    その他 {analytics.gender_distribution.other + analytics.gender_distribution.unknown}名
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="analytics-card">
            <div className="age-distribution">
              {Object.entries(analytics.age_groups).map(([group, count]) => {
                if (count === 0) return null;
                return (
                  <div key={group} className="age-group">
                    <span className="age-group-label">
                      {group === 'unknown' ? '年齢不明' : `${group}歳`}
                    </span>
                    <span className="age-group-count">{count}名</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Children List */}
      <div className="content-area">
        {loading && subjects.length === 0 && (
          <div className="loading-state">
            <div className="spinner" />
            <p>データを読み込み中...</p>
          </div>
        )}

        {!loading && subjects.length === 0 && (
          <div className="empty-state">
            <p>児童が登録されていません</p>
            <button className="primary-button" onClick={handleRegisterClick}>
              <span className="button-icon">+</span>
              最初の児童を登録
            </button>
          </div>
        )}

        {subjects.length > 0 && (
          <div className="subjects-grid">
            {subjects.map(subject => (
              <div
                key={subject.id}
                className={`subject-card ${selectedSubject?.id === subject.id ? 'selected' : ''}`}
                onClick={() => setSelectedSubject(subject)}
              >
                <div className="subject-avatar" style={{ backgroundColor: getGenderColor(subject.gender) }}>
                  {subject.avatar_url ? (
                    <img src={subject.avatar_url} alt={subject.name} />
                  ) : (
                    <span className="avatar-initial">{getInitial(subject.name)}</span>
                  )}
                </div>
                <div className="subject-info">
                  <h3 className="subject-name">{subject.name}</h3>
                  <div className="subject-meta">
                    <span className="subject-age">{getAgeLabel(subject.age)}</span>
                    <span className="subject-gender">{getGenderLabel(subject.gender)}</span>
                  </div>
                  {subject.cognitive_type && (
                    <div className="subject-cognitive-type">
                      {getCognitiveTypeLabel(subject.cognitive_type)}
                    </div>
                  )}
                  {subject.city && (
                    <div className="subject-location">
                      {subject.prefecture && `${subject.prefecture} `}{subject.city}
                    </div>
                  )}
                </div>
                <div className="subject-actions">
                  <button className="icon-button">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Register Modal */}
      {isRegisterModalOpen && (
        <div className="modal-overlay" onClick={handleRegisterClose}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>新規児童登録</h2>
              <button className="close-button" onClick={handleRegisterClose}>×</button>
            </div>
            <form onSubmit={handleRegisterSubmit}>
              <div className="modal-body">
                <div className="registration-form">
                  <div className="form-group">
                    <label htmlFor="name">氏名</label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      className="form-input"
                      placeholder="例：山田 太郎"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="age">年齢</label>
                      <input
                        type="number"
                        id="age"
                        name="age"
                        className="form-input"
                        placeholder="例：5"
                        min="0"
                        value={formData.age}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="gender">性別</label>
                      <select
                        id="gender"
                        name="gender"
                        className="form-select"
                        value={formData.gender}
                        onChange={handleInputChange}
                      >
                        <option value="未指定">未指定</option>
                        <option value="男性">男児</option>
                        <option value="女性">女児</option>
                        <option value="その他">その他</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="notes">備考・特性メモ</label>
                    <textarea
                      id="notes"
                      name="notes"
                      className="form-textarea"
                      placeholder="支援にあたっての留意事項など"
                      value={formData.notes}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="cancel-button"
                  onClick={handleRegisterClose}
                  disabled={isSubmitting}
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? '登録中...' : '登録する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Drawer for selected subject */}
      {selectedSubject && !isRegisterModalOpen && (
        <>
          <div
            className="drawer-overlay"
            onClick={() => setSelectedSubject(null)}
          />
          <div className="drawer">
            <div className="drawer-header">
              <h2>児童詳細</h2>
              <button
                className="close-button"
                onClick={() => setSelectedSubject(null)}
              >
                ×
              </button>
            </div>
            <div className="drawer-content">
              <div className="subject-detail">
                <div className="detail-avatar" style={{ backgroundColor: getGenderColor(selectedSubject.gender) }}>
                  {selectedSubject.avatar_url ? (
                    <img src={selectedSubject.avatar_url} alt={selectedSubject.name} />
                  ) : (
                    <span className="avatar-initial-large">{getInitial(selectedSubject.name)}</span>
                  )}
                </div>
                <h3 className="detail-name">{selectedSubject.name}</h3>

                <div className="detail-info">
                  <div className="detail-row">
                    <span className="detail-label">年齢</span>
                    <span className="detail-value">{getAgeLabel(selectedSubject.age)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">性別</span>
                    <span className="detail-value">{getGenderLabel(selectedSubject.gender)}</span>
                  </div>
                  {selectedSubject.cognitive_type && (
                    <div className="detail-row">
                      <span className="detail-label">認知タイプ</span>
                      <span className="detail-value">{getCognitiveTypeLabel(selectedSubject.cognitive_type)}</span>
                    </div>
                  )}
                  {(selectedSubject.prefecture || selectedSubject.city) && (
                    <div className="detail-row">
                      <span className="detail-label">居住地</span>
                      <span className="detail-value">
                        {selectedSubject.prefecture && `${selectedSubject.prefecture} `}
                        {selectedSubject.city}
                      </span>
                    </div>
                  )}
                  {selectedSubject.notes && (
                    <div className="detail-notes">
                      <span className="detail-label">メモ</span>
                      <p className="detail-notes-text">{selectedSubject.notes}</p>
                    </div>
                  )}
                </div>

                <div className="detail-actions">
                  <button className="primary-button">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ marginRight: '8px' }}>
                      <path d="M4 13L9 18L16 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    個別支援計画を作成
                  </button>
                  <button className="secondary-button">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ marginRight: '8px' }}>
                      <path d="M14.8 4.2L15.8 5.2L7 14H6V13L14.8 4.2Z" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                    編集
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

export default ChildrenList;