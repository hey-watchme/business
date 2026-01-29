import React, { useState } from 'react';
import { api, type SupportPlanCreate } from '../api/client';
import './SupportPlanModal.css';

interface SupportPlanModalProps {
  onClose: () => void;
  onCreated: () => void;
  subjectId: string;
}

const SupportPlanModal: React.FC<SupportPlanModalProps> = ({ onClose, onCreated, subjectId }) => {
  const [formData, setFormData] = useState<SupportPlanCreate>({
    subject_id: subjectId,
    title: '',
    plan_number: '',
    status: 'draft',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      setError('タイトルを入力してください');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const dataToSend: SupportPlanCreate = {
        subject_id: formData.subject_id,
        title: formData.title,
        status: formData.status,
      };

      // Only include plan_number if it has a value
      if (formData.plan_number && formData.plan_number.trim()) {
        dataToSend.plan_number = formData.plan_number;
      }

      await api.createSupportPlan(dataToSend);
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '作成に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="modal-overlay"
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          zIndex: 1000,
          animation: 'fadeIn 0.2s ease-out'
        }}
      />

      {/* Modal */}
      <div
        className="modal-container"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'var(--bg-secondary)',
          borderRadius: '12px',
          border: '1px solid var(--border-primary)',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
          padding: '32px',
          width: '500px',
          maxWidth: '90vw',
          zIndex: 1001,
          animation: 'slideUp 0.3s ease-out'
        }}
      >
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600', margin: '0 0 8px 0', color: 'var(--text-primary)' }}>
            個別支援計画を作成
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>
            新しい個別支援計画を作成します
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: 'var(--text-primary)' }}>
              タイトル <span style={{ color: 'var(--accent-danger)' }}>*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="例: 田中太郎くん 2025年度 個別支援計画"
              style={{
                width: '100%',
                padding: '10px 14px',
                fontSize: '14px',
                border: '1px solid var(--border-primary)',
                borderRadius: '8px',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                outline: 'none',
                transition: 'border-color 0.2s ease'
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--accent-primary)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border-primary)'}
              disabled={loading}
              autoFocus
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: 'var(--text-primary)' }}>
              計画番号（オプション）
            </label>
            <input
              type="text"
              value={formData.plan_number || ''}
              onChange={(e) => setFormData({ ...formData, plan_number: e.target.value })}
              placeholder="例: 2025-001"
              style={{
                width: '100%',
                padding: '10px 14px',
                fontSize: '14px',
                border: '1px solid var(--border-primary)',
                borderRadius: '8px',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                outline: 'none',
                transition: 'border-color 0.2s ease'
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--accent-primary)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border-primary)'}
              disabled={loading}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: 'var(--text-primary)' }}>
              ステータス
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as 'draft' | 'active' })}
              style={{
                width: '100%',
                padding: '10px 14px',
                fontSize: '14px',
                border: '1px solid var(--border-primary)',
                borderRadius: '8px',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                outline: 'none',
                transition: 'border-color 0.2s ease',
                cursor: 'pointer'
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--accent-primary)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border-primary)'}
              disabled={loading}
            >
              <option value="draft">下書き</option>
              <option value="active">アクティブ</option>
            </select>
          </div>

          {error && (
            <div style={{
              padding: '12px',
              marginBottom: '20px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid var(--accent-danger)',
              borderRadius: '8px',
              color: 'var(--accent-danger)',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: '500',
                border: '1px solid var(--border-primary)',
                borderRadius: '8px',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-secondary)',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => !loading && (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseOut={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={loading || !formData.title.trim()}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: '500',
                border: 'none',
                borderRadius: '8px',
                background: loading || !formData.title.trim() ? 'var(--text-muted)' : 'var(--accent-primary)',
                color: 'white',
                cursor: loading || !formData.title.trim() ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {loading ? '作成中...' : '作成'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

export default SupportPlanModal;