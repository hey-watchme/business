import React, { useState } from 'react';

interface Phase3Data {
  assessment_v1?: {
    support_policy?: {
      child_understanding?: string;
      key_approaches?: string[];
      collaboration_notes?: string;
    };
    family_child_intentions?: {
      child?: string;
      parents?: string;
    };
    long_term_goal?: {
      goal?: string;
      timeline?: string;
      rationale?: string;
    };
    short_term_goals?: Array<{
      goal: string;
      timeline?: string;
    }>;
    support_items?: Array<{
      category?: string;
      target?: string;
      methods?: string[];
      staff?: string;
      timeline?: string;
      notes?: string;
      priority?: number;
    }>;
    family_support?: {
      goal?: string;
      methods?: string[];
      timeline?: string;
      notes?: string;
    };
    transition_support?: {
      goal?: string;
      methods?: string[];
      partner_organization?: string;
      timeline?: string;
      notes?: string;
    };
  };
}

interface Props {
  data: Phase3Data;
  sessionId?: string;
}

const Phase3Display: React.FC<Props> = ({ data, sessionId }) => {
  const [downloading, setDownloading] = useState(false);

  if (!data) return null;

  let assessment = data.assessment_v1;

  // Handle wrapped JSON format: {"summary": "```json\n{...}\n```"}
  if (!assessment && (data as any).summary) {
    try {
      const summaryText = (data as any).summary;
      // Extract JSON from markdown code block
      const jsonMatch = summaryText.match(/```json\s*\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1]);
        assessment = parsed.assessment_v1;
      }
    } catch (e) {
      console.error('Failed to parse wrapped JSON:', e);
    }
  }

  if (!assessment) {
    return (
      <div style={{ padding: '12px', color: 'var(--text-secondary)' }}>
        Phase 3データが見つかりません
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '20px' }}>
      {/* Support Policy */}
      {assessment.support_policy && (
        <div style={{
          background: 'var(--bg-primary)',
          border: '2px solid var(--accent-primary)',
          borderRadius: '12px',
          padding: '20px'
        }}>
          <h4 style={{
            fontSize: '16px',
            fontWeight: '700',
            margin: '0 0 16px 0',
            color: 'var(--accent-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 2C5.58 2 2 5.58 2 10s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6zm-1-9h2v2H9V7zm0 4h2v4H9v-4z"/>
            </svg>
            支援方針
          </h4>

          {assessment.support_policy.child_understanding && (
            <div style={{ marginBottom: '16px' }}>
              <h5 style={{ fontSize: '13px', fontWeight: '600', margin: '0 0 8px 0', color: 'var(--text-secondary)' }}>
                子どもの理解・見立て
              </h5>
              <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.8', color: 'var(--text-primary)' }}>
                {assessment.support_policy.child_understanding}
              </p>
            </div>
          )}

          {assessment.support_policy.key_approaches && assessment.support_policy.key_approaches.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <h5 style={{ fontSize: '13px', fontWeight: '600', margin: '0 0 8px 0', color: 'var(--text-secondary)' }}>
                主要アプローチ
              </h5>
              <ul style={{ margin: 0, paddingLeft: '20px', display: 'grid', gap: '6px' }}>
                {assessment.support_policy.key_approaches.map((approach, idx) => (
                  <li key={idx} style={{ fontSize: '13px', lineHeight: '1.6', color: 'var(--text-primary)' }}>
                    {approach}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {assessment.support_policy.collaboration_notes && (
            <div>
              <h5 style={{ fontSize: '13px', fontWeight: '600', margin: '0 0 8px 0', color: 'var(--text-secondary)' }}>
                連携・協力事項
              </h5>
              <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.6', color: 'var(--text-primary)' }}>
                {assessment.support_policy.collaboration_notes}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Family & Child Intentions */}
      {assessment.family_child_intentions && (
        <div style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-primary)',
          borderRadius: '8px',
          padding: '16px'
        }}>
          <h5 style={{
            fontSize: '14px',
            fontWeight: '600',
            margin: '0 0 12px 0',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{
              width: '4px',
              height: '16px',
              background: 'var(--accent-primary)',
              borderRadius: '2px'
            }}></span>
            本人・家族の意向
          </h5>
          <div style={{ display: 'grid', gap: '12px' }}>
            {assessment.family_child_intentions.child && (
              <div>
                <h6 style={{ fontSize: '12px', fontWeight: '600', margin: '0 0 4px 0', color: 'var(--text-secondary)' }}>
                  本人
                </h6>
                <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.6', color: 'var(--text-primary)' }}>
                  {assessment.family_child_intentions.child}
                </p>
              </div>
            )}
            {assessment.family_child_intentions.parents && (
              <div>
                <h6 style={{ fontSize: '12px', fontWeight: '600', margin: '0 0 4px 0', color: 'var(--text-secondary)' }}>
                  保護者
                </h6>
                <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.6', color: 'var(--text-primary)' }}>
                  {assessment.family_child_intentions.parents}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Long Term Goal */}
      {assessment.long_term_goal && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(147, 51, 234, 0.05) 100%)',
          border: '2px solid var(--accent-primary)',
          borderRadius: '12px',
          padding: '20px'
        }}>
          <h4 style={{
            fontSize: '16px',
            fontWeight: '700',
            margin: '0 0 4px 0',
            color: 'var(--accent-primary)'
          }}>
            長期目標
          </h4>
          {assessment.long_term_goal.timeline && (
            <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
              期間: {assessment.long_term_goal.timeline}
            </p>
          )}
          {assessment.long_term_goal.goal && (
            <p style={{ margin: '0 0 12px 0', fontSize: '14px', lineHeight: '1.8', color: 'var(--text-primary)', fontWeight: '500' }}>
              {assessment.long_term_goal.goal}
            </p>
          )}
          {assessment.long_term_goal.rationale && (
            <div style={{
              background: 'var(--bg-primary)',
              borderRadius: '6px',
              padding: '12px',
              fontSize: '13px',
              lineHeight: '1.6',
              color: 'var(--text-secondary)'
            }}>
              <strong>根拠:</strong> {assessment.long_term_goal.rationale}
            </div>
          )}
        </div>
      )}

      {/* Short Term Goals */}
      {assessment.short_term_goals && assessment.short_term_goals.length > 0 && (
        <div style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-primary)',
          borderRadius: '8px',
          padding: '16px'
        }}>
          <h5 style={{
            fontSize: '14px',
            fontWeight: '600',
            margin: '0 0 12px 0',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{
              width: '4px',
              height: '16px',
              background: 'var(--accent-primary)',
              borderRadius: '2px'
            }}></span>
            短期目標
          </h5>
          <div style={{ display: 'grid', gap: '12px' }}>
            {assessment.short_term_goals.map((goal, idx) => (
              <div key={idx} style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-primary)',
                borderRadius: '6px',
                padding: '12px'
              }}>
                {goal.timeline && (
                  <p style={{ margin: '0 0 6px 0', fontSize: '11px', color: 'var(--text-secondary)' }}>
                    期間: {goal.timeline}
                  </p>
                )}
                <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.6', color: 'var(--text-primary)' }}>
                  {goal.goal}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Support Items (5 Domains) */}
      {assessment.support_items && assessment.support_items.length > 0 && (
        <div style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-primary)',
          borderRadius: '8px',
          padding: '16px'
        }}>
          <h5 style={{
            fontSize: '14px',
            fontWeight: '600',
            margin: '0 0 12px 0',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{
              width: '4px',
              height: '16px',
              background: 'var(--accent-primary)',
              borderRadius: '2px'
            }}></span>
            支援項目（5領域）
          </h5>
          <div style={{ display: 'grid', gap: '16px' }}>
            {assessment.support_items.map((item, idx) => (
              <div key={idx} style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-primary)',
                borderRadius: '8px',
                padding: '16px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h6 style={{
                    margin: 0,
                    fontSize: '14px',
                    fontWeight: '600',
                    color: 'var(--accent-primary)'
                  }}>
                    {item.category || `領域 ${idx + 1}`}
                  </h6>
                  {item.priority && (
                    <span style={{
                      fontSize: '11px',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      background: 'rgba(59, 130, 246, 0.1)',
                      color: 'var(--accent-primary)',
                      fontWeight: '600'
                    }}>
                      優先度: {item.priority}
                    </span>
                  )}
                </div>

                {item.target && (
                  <div style={{ marginBottom: '12px' }}>
                    <p style={{ margin: '0 0 4px 0', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                      支援目標
                    </p>
                    <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.6', color: 'var(--text-primary)' }}>
                      {item.target}
                    </p>
                  </div>
                )}

                {item.methods && item.methods.length > 0 && (
                  <div style={{ marginBottom: '12px' }}>
                    <p style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                      支援方法
                    </p>
                    <ul style={{ margin: 0, paddingLeft: '20px', display: 'grid', gap: '6px' }}>
                      {item.methods.map((method, midx) => (
                        <li key={midx} style={{ fontSize: '13px', lineHeight: '1.6', color: 'var(--text-primary)' }}>
                          {method}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', fontSize: '12px' }}>
                  {item.staff && (
                    <div>
                      <p style={{ margin: '0 0 4px 0', fontWeight: '600', color: 'var(--text-secondary)' }}>担当</p>
                      <p style={{ margin: 0, color: 'var(--text-primary)' }}>{item.staff}</p>
                    </div>
                  )}
                  {item.timeline && (
                    <div>
                      <p style={{ margin: '0 0 4px 0', fontWeight: '600', color: 'var(--text-secondary)' }}>期間</p>
                      <p style={{ margin: 0, color: 'var(--text-primary)' }}>{item.timeline}</p>
                    </div>
                  )}
                </div>

                {item.notes && (
                  <div style={{
                    marginTop: '12px',
                    padding: '8px 12px',
                    background: 'rgba(251, 191, 36, 0.1)',
                    borderLeft: '3px solid var(--accent-warning)',
                    borderRadius: '4px',
                    fontSize: '12px',
                    lineHeight: '1.6',
                    color: 'var(--text-secondary)'
                  }}>
                    <strong>備考:</strong> {item.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Family Support */}
      {assessment.family_support && (
        <div style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-primary)',
          borderRadius: '8px',
          padding: '16px'
        }}>
          <h5 style={{
            fontSize: '14px',
            fontWeight: '600',
            margin: '0 0 12px 0',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{
              width: '4px',
              height: '16px',
              background: 'var(--accent-primary)',
              borderRadius: '2px'
            }}></span>
            家族支援
          </h5>

          {assessment.family_support.goal && (
            <div style={{ marginBottom: '12px' }}>
              <p style={{ margin: '0 0 4px 0', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                支援目標
              </p>
              <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.6', color: 'var(--text-primary)' }}>
                {assessment.family_support.goal}
              </p>
            </div>
          )}

          {assessment.family_support.methods && assessment.family_support.methods.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <p style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                支援方法
              </p>
              <ul style={{ margin: 0, paddingLeft: '20px', display: 'grid', gap: '6px' }}>
                {assessment.family_support.methods.map((method, idx) => (
                  <li key={idx} style={{ fontSize: '13px', lineHeight: '1.6', color: 'var(--text-primary)' }}>
                    {method}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', fontSize: '12px', marginBottom: assessment.family_support.notes ? '12px' : 0 }}>
            {assessment.family_support.timeline && (
              <div>
                <p style={{ margin: '0 0 4px 0', fontWeight: '600', color: 'var(--text-secondary)' }}>期間</p>
                <p style={{ margin: 0, color: 'var(--text-primary)' }}>{assessment.family_support.timeline}</p>
              </div>
            )}
          </div>

          {assessment.family_support.notes && (
            <div style={{
              padding: '8px 12px',
              background: 'rgba(251, 191, 36, 0.1)',
              borderLeft: '3px solid var(--accent-warning)',
              borderRadius: '4px',
              fontSize: '12px',
              lineHeight: '1.6',
              color: 'var(--text-secondary)'
            }}>
              <strong>備考:</strong> {assessment.family_support.notes}
            </div>
          )}
        </div>
      )}

      {/* Transition Support */}
      {assessment.transition_support && (
        <div style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-primary)',
          borderRadius: '8px',
          padding: '16px'
        }}>
          <h5 style={{
            fontSize: '14px',
            fontWeight: '600',
            margin: '0 0 12px 0',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{
              width: '4px',
              height: '16px',
              background: 'var(--accent-primary)',
              borderRadius: '2px'
            }}></span>
            移行支援・地域連携
          </h5>

          {assessment.transition_support.goal && (
            <div style={{ marginBottom: '12px' }}>
              <p style={{ margin: '0 0 4px 0', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                支援目標
              </p>
              <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.6', color: 'var(--text-primary)' }}>
                {assessment.transition_support.goal}
              </p>
            </div>
          )}

          {assessment.transition_support.methods && assessment.transition_support.methods.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <p style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                支援方法
              </p>
              <ul style={{ margin: 0, paddingLeft: '20px', display: 'grid', gap: '6px' }}>
                {assessment.transition_support.methods.map((method, idx) => (
                  <li key={idx} style={{ fontSize: '13px', lineHeight: '1.6', color: 'var(--text-primary)' }}>
                    {method}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', fontSize: '12px', marginBottom: assessment.transition_support.notes ? '12px' : 0 }}>
            {assessment.transition_support.partner_organization && (
              <div>
                <p style={{ margin: '0 0 4px 0', fontWeight: '600', color: 'var(--text-secondary)' }}>連携先</p>
                <p style={{ margin: 0, color: 'var(--text-primary)' }}>{assessment.transition_support.partner_organization}</p>
              </div>
            )}
            {assessment.transition_support.timeline && (
              <div>
                <p style={{ margin: '0 0 4px 0', fontWeight: '600', color: 'var(--text-secondary)' }}>期間</p>
                <p style={{ margin: 0, color: 'var(--text-primary)' }}>{assessment.transition_support.timeline}</p>
              </div>
            )}
          </div>

          {assessment.transition_support.notes && (
            <div style={{
              padding: '8px 12px',
              background: 'rgba(251, 191, 36, 0.1)',
              borderLeft: '3px solid var(--accent-warning)',
              borderRadius: '4px',
              fontSize: '12px',
              lineHeight: '1.6',
              color: 'var(--text-secondary)'
            }}>
              <strong>備考:</strong> {assessment.transition_support.notes}
            </div>
          )}
        </div>
      )}

      {/* Excel Download Button */}
      {sessionId && (
        <div style={{
          marginTop: '32px',
          padding: '20px',
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(147, 51, 234, 0.05) 100%)',
          border: '2px dashed var(--accent-primary)',
          borderRadius: '12px',
          textAlign: 'center'
        }}>
          <h5 style={{
            fontSize: '14px',
            fontWeight: '600',
            margin: '0 0 12px 0',
            color: 'var(--text-primary)'
          }}>
            個別支援計画書ダウンロード
          </h5>
          <p style={{
            fontSize: '12px',
            color: 'var(--text-secondary)',
            margin: '0 0 16px 0'
          }}>
            リタリコ様式のExcelファイルとしてダウンロードできます
          </p>
          <button
            onClick={async () => {
              try {
                setDownloading(true);
                const response = await fetch(`/api/sessions/${sessionId}/download-excel`, {
                  headers: {
                    'X-API-Token': 'watchme-b2b-poc-2025'
                  }
                });

                if (!response.ok) {
                  const error = await response.json();
                  throw new Error(error.detail || 'Failed to download Excel');
                }

                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `個別支援計画_${sessionId.slice(0, 8)}.xlsx`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
              } catch (error) {
                console.error('Download error:', error);
                alert(`ダウンロードに失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`);
              } finally {
                setDownloading(false);
              }
            }}
            disabled={downloading}
            style={{
              background: downloading ? 'var(--text-muted)' : 'var(--accent-primary)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '12px 32px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: downloading ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s ease',
              opacity: downloading ? 0.6 : 1
            }}
            onMouseOver={(e) => {
              if (!downloading) {
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
              }
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 12L6 8h2.5V4h3v4H14l-4 4zm-6 4h12v2H4v-2z"/>
            </svg>
            {downloading ? 'ダウンロード中...' : 'Excelダウンロード'}
          </button>
        </div>
      )}
    </div>
  );
};

export default Phase3Display;
