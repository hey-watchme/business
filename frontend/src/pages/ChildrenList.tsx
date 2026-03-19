import React, { useState } from 'react';
import { api, type Subject } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useSubjects } from '../contexts/SubjectContext';
import { calculateAge } from '../utils/date';
import './ChildrenList.css';

type EditForm = {
  name: string;
  birth_date: string;
  gender: string;
  diagnosis: string;
  school_name: string;
  school_type: string;
  prefecture: string;
  city: string;
  recipient_certificate_number: string;
  attending_facilities: string;
  guardian_father_name: string;
  guardian_mother_name: string;
  notes: string;
};

const ChildrenList: React.FC = () => {
  const { subjects, analytics, loading, refreshSubjects } = useSubjects();
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const { profile } = useAuth();

  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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

  const handleEditStart = (subject: Subject) => {
    const g = (() => {
      if (!subject.guardians) return {};
      try {
        return typeof subject.guardians === 'string' ? JSON.parse(subject.guardians) : subject.guardians;
      } catch { return {}; }
    })();
    setEditForm({
      name: subject.name || '',
      birth_date: subject.birth_date || '',
      gender: subject.gender || '',
      diagnosis: subject.diagnosis ? subject.diagnosis.join('、') : '',
      school_name: subject.school_name || '',
      school_type: subject.school_type || '',
      prefecture: subject.prefecture || '',
      city: subject.city || '',
      recipient_certificate_number: subject.recipient_certificate_number || '',
      attending_facilities: subject.attending_facilities ? subject.attending_facilities.join('、') : '',
      guardian_father_name: g.father?.name || '',
      guardian_mother_name: g.mother?.name || '',
      notes: subject.notes || '',
    });
    setSaveError(null);
    setIsEditMode(true);
  };

  const handleEditCancel = () => {
    setIsEditMode(false);
    setEditForm(null);
    setSaveError(null);
  };

  const handleEditSave = async () => {
    if (!selectedSubject || !editForm) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const guardians: Record<string, { name: string; relationship: string }> = {};
      if (editForm.guardian_father_name.trim()) guardians.father = { name: editForm.guardian_father_name.trim(), relationship: '父' };
      if (editForm.guardian_mother_name.trim()) guardians.mother = { name: editForm.guardian_mother_name.trim(), relationship: '母' };

      await api.updateSubject(selectedSubject.id, {
        name: editForm.name,
        birth_date: editForm.birth_date || undefined,
        gender: editForm.gender || undefined,
        diagnosis: editForm.diagnosis ? editForm.diagnosis.split(/[、,，]/).map(s => s.trim()).filter(Boolean) : [],
        school_name: editForm.school_name || undefined,
        school_type: editForm.school_type || undefined,
        prefecture: editForm.prefecture || undefined,
        city: editForm.city || undefined,
        recipient_certificate_number: editForm.recipient_certificate_number || undefined,
        attending_facilities: editForm.attending_facilities
          ? editForm.attending_facilities.split(/[、,，]/).map(s => s.trim()).filter(Boolean)
          : [],
        guardians: Object.keys(guardians).length > 0 ? guardians : undefined,
        notes: editForm.notes || undefined,
      });

      await refreshSubjects();
      // Update selectedSubject with new data
      setSelectedSubject(prev => prev ? {
        ...prev,
        name: editForm.name,
        birth_date: editForm.birth_date || null,
        gender: editForm.gender || null,
        diagnosis: editForm.diagnosis ? editForm.diagnosis.split(/[、,，]/).map(s => s.trim()).filter(Boolean) : [],
        school_name: editForm.school_name || null,
        school_type: editForm.school_type || null,
        prefecture: editForm.prefecture || null,
        city: editForm.city || null,
        recipient_certificate_number: editForm.recipient_certificate_number || null,
        attending_facilities: editForm.attending_facilities
          ? editForm.attending_facilities.split(/[、,，]/).map(s => s.trim()).filter(Boolean)
          : [],
        guardians: Object.keys(guardians).length > 0 ? guardians : null,
        notes: editForm.notes || null,
      } : null);
      setIsEditMode(false);
      setEditForm(null);
    } catch (e) {
      setSaveError('保存に失敗しました。もう一度お試しください。');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditForm(prev => prev ? { ...prev, [name]: value } : null);
  };

  const handleDeleteSubject = async (subject: Subject) => {
    if (!window.confirm(`「${subject.name}」の児童情報をすべて削除します。\nこの操作は取り消せません。よろしいですか？`)) return;
    try {
      await api.deleteSubject(subject.id);
      setSelectedSubject(null);
      setIsEditMode(false);
      await refreshSubjects();
    } catch (e) {
      alert('削除に失敗しました。');
    }
  };

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

  // Removed local implementation of calculateAge as it is imported from utils

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
        birth_date: formData.birth_date || undefined,
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

  const getAgeLabel = (subject: Subject): string => {
    const age = calculateAge(subject.birth_date) ?? subject.age;
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
                    <span className="subject-age">{getAgeLabel(subject)}</span>
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

                  <div className="form-group">
                    <label htmlFor="birth_date">生年月日</label>
                    <input
                      type="date"
                      id="birth_date"
                      name="birth_date"
                      className="form-input"
                      value={formData.birth_date}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="age">年齢 (生年月日が不明な場合)</label>
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
              <h2>{isEditMode ? '児童情報を編集' : '児童詳細'}</h2>
              <button
                className="close-button"
                onClick={() => { setSelectedSubject(null); setIsEditMode(false); setEditForm(null); }}
              >
                ×
              </button>
            </div>
            <div className="drawer-content">
              {isEditMode && editForm ? (
                <div style={{ width: '100%' }}>
                  <div className="drawer-edit-form">
                    <p className="form-section-title">基本情報</p>
                    <div className="form-group">
                      <label>氏名</label>
                      <input className="form-input" name="name" value={editForm.name} onChange={handleEditFormChange} />
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>生年月日</label>
                        <input className="form-input" type="date" name="birth_date" value={editForm.birth_date} onChange={handleEditFormChange} />
                      </div>
                      <div className="form-group">
                        <label>性別</label>
                        <select className="form-select" name="gender" value={editForm.gender} onChange={handleEditFormChange}>
                          <option value="">未指定</option>
                          <option value="男性">男児</option>
                          <option value="女性">女児</option>
                          <option value="その他">その他</option>
                        </select>
                      </div>
                    </div>
                    <div className="form-group">
                      <label>診断・特性（複数はカンマ区切り）</label>
                      <input className="form-input" name="diagnosis" value={editForm.diagnosis} onChange={handleEditFormChange} placeholder="例: ASD、ADHD" />
                    </div>

                    <p className="form-section-title">支援・通所情報</p>
                    <div className="form-group">
                      <label>受給者証番号</label>
                      <input className="form-input" name="recipient_certificate_number" value={editForm.recipient_certificate_number} onChange={handleEditFormChange} />
                    </div>
                    <div className="form-group">
                      <label>通所支援利用事業所（複数はカンマ区切り）</label>
                      <input className="form-input" name="attending_facilities" value={editForm.attending_facilities} onChange={handleEditFormChange} />
                    </div>

                    <p className="form-section-title">所属・居住地</p>
                    <div className="form-row">
                      <div className="form-group">
                        <label>学校・園名</label>
                        <input className="form-input" name="school_name" value={editForm.school_name} onChange={handleEditFormChange} />
                      </div>
                      <div className="form-group">
                        <label>学校種別</label>
                        <select className="form-select" name="school_type" value={editForm.school_type} onChange={handleEditFormChange}>
                          <option value="">未指定</option>
                          <option value="kindergarten">幼稚園</option>
                          <option value="nursery">保育園</option>
                          <option value="elementary">小学校</option>
                          <option value="junior_high">中学校</option>
                          <option value="high_school">高等学校</option>
                          <option value="special_needs">特別支援学校</option>
                        </select>
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>都道府県</label>
                        <input className="form-input" name="prefecture" value={editForm.prefecture} onChange={handleEditFormChange} placeholder="例: 神奈川県" />
                      </div>
                      <div className="form-group">
                        <label>市区町村</label>
                        <input className="form-input" name="city" value={editForm.city} onChange={handleEditFormChange} placeholder="例: 横浜市" />
                      </div>
                    </div>

                    <p className="form-section-title">保護者</p>
                    <div className="form-row">
                      <div className="form-group">
                        <label>父・氏名</label>
                        <input className="form-input" name="guardian_father_name" value={editForm.guardian_father_name} onChange={handleEditFormChange} />
                      </div>
                      <div className="form-group">
                        <label>母・氏名</label>
                        <input className="form-input" name="guardian_mother_name" value={editForm.guardian_mother_name} onChange={handleEditFormChange} />
                      </div>
                    </div>

                    <p className="form-section-title">メモ・特性</p>
                    <div className="form-group">
                      <label>自由記述</label>
                      <textarea className="form-textarea" name="notes" value={editForm.notes} onChange={handleEditFormChange} />
                    </div>

                    {saveError && <p className="drawer-save-error">{saveError}</p>}
                  </div>
                  <div className="drawer-edit-actions">
                    <button className="primary-button" onClick={handleEditSave} disabled={isSaving}>
                      {isSaving ? '保存中...' : '保存する'}
                    </button>
                    <button className="secondary-button" onClick={handleEditCancel} disabled={isSaving}>
                      キャンセル
                    </button>
                  </div>
                </div>
              ) : (
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
                  {selectedSubject.birth_date && (
                    <div className="detail-row">
                      <span className="detail-label">生年月日</span>
                      <span className="detail-value">{selectedSubject.birth_date}</span>
                    </div>
                  )}
                  <div className="detail-row">
                    <span className="detail-label">年齢</span>
                    <span className="detail-value">{getAgeLabel(selectedSubject)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">性別</span>
                    <span className="detail-value">{getGenderLabel(selectedSubject.gender)}</span>
                  </div>
                  {selectedSubject.diagnosis && selectedSubject.diagnosis.length > 0 && (
                    <div className="detail-row">
                      <span className="detail-label">診断・特性</span>
                      <span className="detail-value">{selectedSubject.diagnosis.join('、')}</span>
                    </div>
                  )}
                  <div className="detail-row">
                    <span className="detail-label">受給者証番号</span>
                    <span className="detail-value">{selectedSubject.recipient_certificate_number || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>データなし</span>}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">通所支援利用事業所</span>
                    <span className="detail-value">
                      {selectedSubject.attending_facilities && selectedSubject.attending_facilities.length > 0
                        ? selectedSubject.attending_facilities.join('、')
                        : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>データなし</span>}
                    </span>
                  </div>
                  {selectedSubject.school_name && (
                    <div className="detail-row">
                      <span className="detail-label">所属</span>
                      <span className="detail-value">{selectedSubject.school_name}{selectedSubject.school_type && `（${selectedSubject.school_type}）`}</span>
                    </div>
                  )}
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
                  {selectedSubject.guardians && (() => {
                    const g = typeof selectedSubject.guardians === 'string'
                      ? JSON.parse(selectedSubject.guardians)
                      : selectedSubject.guardians;
                    const entries = Object.values(g) as Array<{ name: string; relationship: string }>;
                    return entries.length > 0 ? entries.map((e, i) => (
                      <div key={i} className="detail-row">
                        <span className="detail-label">保護者（{e.relationship}）</span>
                        <span className="detail-value">{e.name}</span>
                      </div>
                    )) : null;
                  })()}
                  {selectedSubject.notes && (
                    <div className="detail-notes">
                      <span className="detail-label">メモ</span>
                      <p className="detail-notes-text">{selectedSubject.notes}</p>
                    </div>
                  )}
                </div>

                <div className="detail-actions">
                  <button className="secondary-button" onClick={() => handleEditStart(selectedSubject)}>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ marginRight: '8px' }}>
                      <path d="M14.8 4.2L15.8 5.2L7 14H6V13L14.8 4.2Z" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                    編集
                  </button>
                  {profile?.role === 'admin' && (
                    <button
                      className="delete-subject-link"
                      onClick={() => handleDeleteSubject(selectedSubject)}
                    >
                      児童情報を削除する
                    </button>
                  )}
                </div>
              </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ChildrenList;