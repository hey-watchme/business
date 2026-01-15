import React, { useState, useEffect } from 'react';
import { api, type Subject, type SubjectsResponse } from '../api/client';
import './ChildrenList.css';

const ChildrenList: React.FC = () => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [analytics, setAnalytics] = useState<SubjectsResponse['analytics'] | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSubjects();
  }, []);

  const fetchSubjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.getSubjects();
      setSubjects(response.subjects);
      setAnalytics(response.analytics);
    } catch (err) {
      console.error('Failed to fetch subjects:', err);
      setError('児童情報の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const getAgeLabel = (age: number | null | undefined): string => {
    if (age === null || age === undefined) return '年齢不明';
    return `${age}歳`;
  };

  const getGenderLabel = (gender: string | null | undefined): string => {
    switch (gender) {
      case 'male': return '男';
      case 'female': return '女';
      case 'other': return 'その他';
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
      case 'male': return '#4FC3F7';
      case 'female': return '#F48FB1';
      case 'other': return '#9C27B0';
      default: return '#999';
    }
  };

  return (
    <div className="children-list">
      <div className="page-header">
        <h1 className="page-title">児童管理</h1>
        <button className="primary-button">
          <span className="button-icon">+</span>
          新規児童登録
        </button>
      </div>

      {/* Analytics Section */}
      {analytics && (
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
                  <span className="gender-dot" style={{ backgroundColor: '#4FC3F7' }}/>
                  男児 {analytics.gender_distribution.male}名
                </span>
                <span className="gender-label">
                  <span className="gender-dot" style={{ backgroundColor: '#F48FB1' }}/>
                  女児 {analytics.gender_distribution.female}名
                </span>
                {(analytics.gender_distribution.other > 0 || analytics.gender_distribution.unknown > 0) && (
                  <span className="gender-label">
                    <span className="gender-dot" style={{ backgroundColor: '#999' }}/>
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
        {loading && (
          <div className="loading-state">
            <div className="spinner" />
            <p>データを読み込み中...</p>
          </div>
        )}

        {error && (
          <div className="error-state">
            <p>{error}</p>
            <button onClick={fetchSubjects}>再試行</button>
          </div>
        )}

        {!loading && !error && subjects.length === 0 && (
          <div className="empty-state">
            <p>児童が登録されていません</p>
            <button className="primary-button">
              <span className="button-icon">+</span>
              最初の児童を登録
            </button>
          </div>
        )}

        {!loading && !error && subjects.length > 0 && (
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
                      <path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Drawer for selected subject */}
      {selectedSubject && (
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
                      <path d="M4 13L9 18L16 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    個別支援計画を作成
                  </button>
                  <button className="secondary-button">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ marginRight: '8px' }}>
                      <path d="M14.8 4.2L15.8 5.2L7 14H6V13L14.8 4.2Z" stroke="currentColor" strokeWidth="1.5"/>
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