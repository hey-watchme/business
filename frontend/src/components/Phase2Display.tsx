import React from 'react';

interface ProfessionalAnalysis {
  background: string;
  strength_potential: string | null;
  priority: 'high' | 'normal';
}

interface AnnotatedItem {
  source_category: string;
  original_fact: string;
  category: string;
  setting: string;
  professional_analysis: ProfessionalAnalysis;
}

interface ParentChildIntention {
  speaker: string;
  original_intention: string;
  priority: string;
}

interface UnresolvedItem {
  original_fact: string;
  reason: string;
}

interface ChildProfile {
  name?: string;
  age?: number;
  birth_date?: string;
  gender?: string;
  diagnosis?: string[];
  school_name?: string;
  school_type?: string;
}

interface Phase2Data {
  annotated_facts_v1?: {
    child_profile?: ChildProfile;
    annotated_items?: AnnotatedItem[];
    parent_child_intentions?: ParentChildIntention[];
    unresolved_items?: UnresolvedItem[];
  };
  // Legacy format
  fact_clusters_v1?: Record<string, unknown>;
}

interface Props {
  data: Phase2Data;
}

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  social_communication: { label: 'Human Relations & Sociality', color: '#8b5cf6' },
  cognitive_behavior: { label: 'Cognition & Behavior', color: '#3b82f6' },
  health_daily_living: { label: 'Health & Daily Living', color: '#10b981' },
  motor_sensory: { label: 'Motor & Sensory', color: '#f59e0b' },
  language_communication: { label: 'Language & Communication', color: '#ec4899' },
};

const SETTING_LABELS: Record<string, string> = {
  home: 'Home',
  school: 'School',
  therapy: 'Therapy',
  general: 'General',
};

const Phase2Display: React.FC<Props> = ({ data }) => {
  if (!data) return null;

  let annotated = data.annotated_facts_v1;

  // Handle wrapped JSON format: {"summary": "```json\n{...}\n```"}
  if (!annotated && (data as any).summary) {
    try {
      const summaryText = (data as any).summary;
      const jsonMatch = summaryText.match(/```json\s*\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1]);
        annotated = parsed.annotated_facts_v1;
      }
    } catch (e) {
      console.error('Failed to parse wrapped JSON:', e);
    }
  }

  // Legacy format fallback
  if (!annotated && data.fact_clusters_v1) {
    return (
      <div style={{
        padding: '24px',
        background: 'rgba(251, 191, 36, 0.08)',
        border: '1px solid rgba(251, 191, 36, 0.3)',
        borderRadius: '12px',
        textAlign: 'center',
        color: 'var(--text-secondary)',
        fontSize: '14px'
      }}>
        Old format data detected. Please re-run Phase 2 to use the new annotation format.
      </div>
    );
  }

  if (!annotated) {
    return (
      <div style={{ padding: '12px', color: 'var(--text-secondary)' }}>
        Phase 2 data not found
      </div>
    );
  }

  // Group annotated_items by category
  const groupedItems: Record<string, AnnotatedItem[]> = {};
  if (annotated.annotated_items) {
    for (const item of annotated.annotated_items) {
      const cat = item.category || 'other';
      if (!groupedItems[cat]) groupedItems[cat] = [];
      groupedItems[cat].push(item);
    }
  }

  const renderChildProfile = (profile: ChildProfile | undefined) => {
    if (!profile || Object.keys(profile).length === 0) {
      return <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>No data</p>;
    }

    const fields = [
      { label: 'Name', value: profile.name },
      { label: 'Age', value: profile.age ? `${profile.age}` : null },
      { label: 'Diagnosis', value: profile.diagnosis?.length ? profile.diagnosis.join(', ') : null },
      { label: 'School', value: profile.school_name },
    ];

    return (
      <div style={{ display: 'grid', gap: '8px', fontSize: '13px' }}>
        {fields.map((f, idx) => (
          <div key={idx} style={{ display: 'flex', gap: '12px' }}>
            <span style={{ fontWeight: '600', color: 'var(--text-secondary)', minWidth: '100px' }}>{f.label}:</span>
            <span style={{ color: 'var(--text-primary)' }}>{f.value || 'No data'}</span>
          </div>
        ))}
      </div>
    );
  };

  const renderAnnotatedCard = (item: AnnotatedItem, idx: number) => {
    const analysis = item.professional_analysis;
    const isHigh = analysis?.priority === 'high';

    return (
      <div key={idx} style={{
        background: 'var(--bg-secondary)',
        border: `1px solid ${isHigh ? 'rgba(239, 68, 68, 0.3)' : 'var(--border-primary)'}`,
        borderRadius: '8px',
        padding: '14px',
        display: 'grid',
        gap: '10px',
      }}>
        {/* Fact row */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, fontSize: '13px', lineHeight: '1.7', color: 'var(--text-primary)', fontWeight: '500' }}>
            {item.original_fact}
          </div>
          <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
            {item.setting && (
              <span style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '4px',
                background: 'rgba(59, 130, 246, 0.08)',
                color: 'var(--accent-primary)',
                whiteSpace: 'nowrap',
              }}>
                {SETTING_LABELS[item.setting] || item.setting}
              </span>
            )}
            {isHigh && (
              <span style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '4px',
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#ef4444',
                fontWeight: '600',
                whiteSpace: 'nowrap',
              }}>
                HIGH
              </span>
            )}
          </div>
        </div>

        {/* Analysis row */}
        {analysis && (
          <div style={{
            background: 'rgba(0, 0, 0, 0.02)',
            borderRadius: '6px',
            padding: '10px 12px',
            display: 'grid',
            gap: '6px',
            fontSize: '12px',
            color: 'var(--text-secondary)',
            lineHeight: '1.6',
          }}>
            {analysis.background && (
              <div>
                <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>Background: </span>
                {analysis.background}
              </div>
            )}
            {analysis.strength_potential && (
              <div>
                <span style={{ fontWeight: '600', color: 'var(--accent-success)' }}>Strength: </span>
                {analysis.strength_potential}
              </div>
            )}
          </div>
        )}

        {/* Source category tag */}
        {item.source_category && (
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            source: {item.source_category}
          </div>
        )}
      </div>
    );
  };

  const categoryOrder = [
    'social_communication',
    'cognitive_behavior',
    'health_daily_living',
    'motor_sensory',
    'language_communication',
  ];

  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      {/* Child Profile */}
      <div style={{
        background: 'var(--bg-primary)',
        border: '1px solid var(--border-primary)',
        borderRadius: '8px',
        padding: '16px'
      }}>
        <h5 style={{
          fontSize: '14px', fontWeight: '600', margin: '0 0 12px 0',
          color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px'
        }}>
          <span style={{ width: '4px', height: '16px', background: 'var(--accent-primary)', borderRadius: '2px' }}></span>
          Child Profile
        </h5>
        {renderChildProfile(annotated.child_profile)}
      </div>

      {/* 5 Domain Sections */}
      {categoryOrder.map(catKey => {
        const items = groupedItems[catKey];
        const catInfo = CATEGORY_LABELS[catKey] || { label: catKey, color: '#6b7280' };

        return (
          <div key={catKey} style={{
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-primary)',
            borderRadius: '8px',
            padding: '16px'
          }}>
            <h5 style={{
              fontSize: '14px', fontWeight: '600', margin: '0 0 12px 0',
              color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px'
            }}>
              <span style={{ width: '4px', height: '16px', background: catInfo.color, borderRadius: '2px' }}></span>
              {catInfo.label}
              <span style={{ color: 'var(--text-muted)', fontWeight: '400', fontSize: '12px' }}>
                ({items?.length || 0})
              </span>
            </h5>
            {items && items.length > 0 ? (
              <div style={{ display: 'grid', gap: '10px' }}>
                {items.map((item, idx) => renderAnnotatedCard(item, idx))}
              </div>
            ) : (
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>No data</p>
            )}
          </div>
        );
      })}

      {/* Uncategorized items */}
      {Object.keys(groupedItems).filter(k => !categoryOrder.includes(k)).map(catKey => {
        const items = groupedItems[catKey];
        return (
          <div key={catKey} style={{
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-primary)',
            borderRadius: '8px',
            padding: '16px'
          }}>
            <h5 style={{
              fontSize: '14px', fontWeight: '600', margin: '0 0 12px 0',
              color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px'
            }}>
              <span style={{ width: '4px', height: '16px', background: '#6b7280', borderRadius: '2px' }}></span>
              Other <span style={{ color: 'var(--text-muted)', fontWeight: '400', fontSize: '12px' }}>({catKey}, {items.length})</span>
            </h5>
            <div style={{ display: 'grid', gap: '10px' }}>
              {items.map((item, idx) => renderAnnotatedCard(item, idx))}
            </div>
          </div>
        );
      })}

      {/* Parent/Child Intentions */}
      {annotated.parent_child_intentions && annotated.parent_child_intentions.length > 0 && (
        <div style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-primary)',
          borderRadius: '8px',
          padding: '16px'
        }}>
          <h5 style={{
            fontSize: '14px', fontWeight: '600', margin: '0 0 12px 0',
            color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px'
          }}>
            <span style={{ width: '4px', height: '16px', background: 'var(--accent-primary)', borderRadius: '2px' }}></span>
            Intentions
          </h5>
          <div style={{ display: 'grid', gap: '12px' }}>
            {annotated.parent_child_intentions.map((item, idx) => (
              <div key={idx} style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-primary)',
                borderRadius: '6px',
                padding: '12px'
              }}>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '6px', alignItems: 'center' }}>
                  <span style={{
                    fontSize: '12px', fontWeight: '600', padding: '4px 8px',
                    borderRadius: '4px', background: 'var(--accent-primary)', color: 'white'
                  }}>
                    {item.speaker}
                  </span>
                  {item.priority === 'high' && (
                    <span style={{
                      fontSize: '11px', padding: '2px 6px', borderRadius: '4px',
                      background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontWeight: '600'
                    }}>
                      HIGH
                    </span>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.6', color: 'var(--text-primary)' }}>
                  {item.original_intention}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unresolved Items */}
      {annotated.unresolved_items && annotated.unresolved_items.length > 0 && (
        <div style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-primary)',
          borderRadius: '8px',
          padding: '16px'
        }}>
          <h5 style={{
            fontSize: '14px', fontWeight: '600', margin: '0 0 12px 0',
            color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px'
          }}>
            <span style={{ width: '4px', height: '16px', background: '#6b7280', borderRadius: '2px' }}></span>
            Unresolved
          </h5>
          <div style={{ display: 'grid', gap: '8px' }}>
            {annotated.unresolved_items.map((item, idx) => (
              <div key={idx} style={{
                fontSize: '13px', lineHeight: '1.6', color: 'var(--text-primary)',
                padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: '6px'
              }}>
                <div>{item.original_fact}</div>
                {item.reason && (
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Reason: {item.reason}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Phase2Display;
