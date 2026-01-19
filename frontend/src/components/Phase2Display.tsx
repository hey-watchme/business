import React from 'react';

interface Phase2Data {
  fact_clusters_v1?: {
    child_profile?: {
      name?: string;
      age?: number;
      diagnosis?: string[];
      school_name?: string;
    };
    strengths_facts?: string[];
    challenges_facts?: string[];
    cognitive_facts?: string[];
    behavior_facts?: string[];
    social_communication_facts?: string[];
    physical_sensory_facts?: string[];
    daily_living_facts?: string[];
    medical_facts?: string[];
    family_context?: string[];
    parent_child_intentions?: Array<{
      speaker: string;
      intention: string;
      priority?: number;
    }>;
    service_administrative_facts?: string[];
  };
}

interface Props {
  data: Phase2Data;
}

const Phase2Display: React.FC<Props> = ({ data }) => {
  if (!data) return null;

  let clusters = data.fact_clusters_v1;

  // Handle wrapped JSON format: {"summary": "```json\n{...}\n```"}
  if (!clusters && (data as any).summary) {
    try {
      const summaryText = (data as any).summary;
      // Extract JSON from markdown code block
      const jsonMatch = summaryText.match(/```json\s*\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1]);
        clusters = parsed.fact_clusters_v1;
      }
    } catch (e) {
      console.error('Failed to parse wrapped JSON:', e);
    }
  }

  if (!clusters) {
    return (
      <div style={{ padding: '12px', color: 'var(--text-secondary)' }}>
        Phase 2データが見つかりません
      </div>
    );
  }

  const renderStringArray = (items: string[] | undefined) => {
    if (!items || items.length === 0) {
      return <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>データなし</p>;
    }

    return (
      <ul style={{ margin: 0, paddingLeft: '20px', display: 'grid', gap: '8px' }}>
        {items.map((item, idx) => (
          <li key={idx} style={{ fontSize: '13px', lineHeight: '1.6', color: 'var(--text-primary)' }}>
            {item}
          </li>
        ))}
      </ul>
    );
  };

  const renderIntentions = (items: Array<any> | undefined) => {
    if (!items || items.length === 0) {
      return <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>データなし</p>;
    }

    return (
      <div style={{ display: 'grid', gap: '12px' }}>
        {items.map((item, idx) => (
          <div key={idx} style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-primary)',
            borderRadius: '6px',
            padding: '12px'
          }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '6px', alignItems: 'center' }}>
              <span style={{
                fontSize: '12px',
                fontWeight: '600',
                padding: '4px 8px',
                borderRadius: '4px',
                background: 'var(--accent-primary)',
                color: 'white'
              }}>
                {item.speaker}
              </span>
              {item.priority && (
                <span style={{
                  fontSize: '11px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: 'rgba(59, 130, 246, 0.1)',
                  color: 'var(--accent-primary)'
                }}>
                  優先度: {item.priority}
                </span>
              )}
            </div>
            <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.6', color: 'var(--text-primary)' }}>
              {item.intention}
            </p>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      {/* Child Profile */}
      {clusters.child_profile && (
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
            児童プロフィール
          </h5>
          <div style={{ display: 'grid', gap: '8px', fontSize: '13px' }}>
            {clusters.child_profile.name && (
              <div style={{ display: 'flex', gap: '12px' }}>
                <span style={{ fontWeight: '600', color: 'var(--text-secondary)', minWidth: '100px' }}>氏名:</span>
                <span style={{ color: 'var(--text-primary)' }}>{clusters.child_profile.name}</span>
              </div>
            )}
            {clusters.child_profile.age && (
              <div style={{ display: 'flex', gap: '12px' }}>
                <span style={{ fontWeight: '600', color: 'var(--text-secondary)', minWidth: '100px' }}>年齢:</span>
                <span style={{ color: 'var(--text-primary)' }}>{clusters.child_profile.age}歳</span>
              </div>
            )}
            {clusters.child_profile.diagnosis && clusters.child_profile.diagnosis.length > 0 && (
              <div style={{ display: 'flex', gap: '12px' }}>
                <span style={{ fontWeight: '600', color: 'var(--text-secondary)', minWidth: '100px' }}>診断:</span>
                <span style={{ color: 'var(--text-primary)' }}>{clusters.child_profile.diagnosis.join(', ')}</span>
              </div>
            )}
            {clusters.child_profile.school_name && (
              <div style={{ display: 'flex', gap: '12px' }}>
                <span style={{ fontWeight: '600', color: 'var(--text-secondary)', minWidth: '100px' }}>所属:</span>
                <span style={{ color: 'var(--text-primary)' }}>{clusters.child_profile.school_name}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Strengths Facts */}
      {clusters.strengths_facts && clusters.strengths_facts.length > 0 && (
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
              background: 'var(--accent-success)',
              borderRadius: '2px'
            }}></span>
            強み
          </h5>
          {renderStringArray(clusters.strengths_facts)}
        </div>
      )}

      {/* Challenges Facts */}
      {clusters.challenges_facts && clusters.challenges_facts.length > 0 && (
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
              background: 'var(--accent-warning)',
              borderRadius: '2px'
            }}></span>
            課題
          </h5>
          {renderStringArray(clusters.challenges_facts)}
        </div>
      )}

      {/* Other fact categories */}
      {[
        { title: '認知面', key: 'cognitive_facts' as const },
        { title: '行動面', key: 'behavior_facts' as const },
        { title: '社会性・コミュニケーション', key: 'social_communication_facts' as const },
        { title: '身体・感覚', key: 'physical_sensory_facts' as const },
        { title: '日常生活', key: 'daily_living_facts' as const },
        { title: '医療', key: 'medical_facts' as const },
        { title: '家族・環境', key: 'family_context' as const },
        { title: '事務・行政', key: 'service_administrative_facts' as const },
      ].map(section => {
        const items = clusters[section.key];
        if (!items || items.length === 0) return null;

        return (
          <div key={section.key} style={{
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
              {section.title}
            </h5>
            {renderStringArray(items)}
          </div>
        );
      })}

      {/* Parent/Child Intentions */}
      {clusters.parent_child_intentions && clusters.parent_child_intentions.length > 0 && (
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
            本人・保護者の意向
          </h5>
          {renderIntentions(clusters.parent_child_intentions)}
        </div>
      )}
    </div>
  );
};

export default Phase2Display;
