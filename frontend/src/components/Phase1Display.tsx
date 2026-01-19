import React from 'react';

interface Phase1Data {
  extraction_v1?: {
    basic_info?: Array<{ field: string; value: string; confidence?: string }>;
    current_state?: Array<{ summary: string; confidence?: string }>;
    strengths?: Array<{ summary: string; confidence?: string }>;
    challenges?: Array<{ summary: string; confidence?: string }>;
    physical_sensory?: Array<{ summary: string; confidence?: string }>;
    medical_development?: Array<{ summary: string; confidence?: string }>;
    family_environment?: Array<{ summary: string; confidence?: string }>;
    parent_intentions?: Array<{ summary: string; priority?: number; confidence?: string }>;
    staff_notes?: Array<{ summary: string; confidence?: string }>;
    administrative_notes?: Array<{ summary: string; confidence?: string }>;
    unresolved_items?: Array<{ summary: string; confidence?: string }>;
  };
  summary?: string;
}

interface Props {
  data: Phase1Data;
}

const Phase1Display: React.FC<Props> = ({ data }) => {
  if (!data) return null;

  let extraction = data.extraction_v1;

  // Handle wrapped JSON format: {"summary": "```json\n{...}\n```"}
  if (!extraction && (data as any).summary) {
    try {
      const summaryText = (data as any).summary;
      // Extract JSON from markdown code block
      const jsonMatch = summaryText.match(/```json\s*\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1]);
        extraction = parsed.extraction_v1;
      }
    } catch (e) {
      console.error('Failed to parse wrapped JSON:', e);
    }
  }

  if (!extraction) {
    return (
      <div style={{ padding: '12px', color: 'var(--text-secondary)' }}>
        Phase 1データが見つかりません
      </div>
    );
  }

  const renderItems = (items: Array<any> | undefined, type: 'basic' | 'list') => {
    if (!items || items.length === 0) return <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>データなし</p>;

    if (type === 'basic') {
      return (
        <div style={{ display: 'grid', gap: '8px' }}>
          {items.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '12px', fontSize: '13px' }}>
              <span style={{ fontWeight: '600', color: 'var(--text-secondary)', minWidth: '100px' }}>{item.field}:</span>
              <span style={{ color: 'var(--text-primary)' }}>{item.value}</span>
              {item.confidence && (
                <span style={{
                  fontSize: '11px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: item.confidence === 'high' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(251, 191, 36, 0.1)',
                  color: item.confidence === 'high' ? 'var(--accent-success)' : 'var(--accent-warning)'
                }}>
                  {item.confidence}
                </span>
              )}
            </div>
          ))}
        </div>
      );
    }

    return (
      <ul style={{ margin: 0, paddingLeft: '20px', display: 'grid', gap: '8px' }}>
        {items.map((item, idx) => (
          <li key={idx} style={{ fontSize: '13px', lineHeight: '1.6', color: 'var(--text-primary)' }}>
            {item.summary}
            {item.priority && (
              <span style={{
                marginLeft: '8px',
                fontSize: '11px',
                padding: '2px 6px',
                borderRadius: '4px',
                background: 'rgba(59, 130, 246, 0.1)',
                color: 'var(--accent-primary)'
              }}>
                優先度: {item.priority}
              </span>
            )}
            {item.confidence && (
              <span style={{
                marginLeft: '8px',
                fontSize: '11px',
                padding: '2px 6px',
                borderRadius: '4px',
                background: item.confidence === 'high' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(251, 191, 36, 0.1)',
                color: item.confidence === 'high' ? 'var(--accent-success)' : 'var(--accent-warning)'
              }}>
                {item.confidence}
              </span>
            )}
          </li>
        ))}
      </ul>
    );
  };

  const sections = [
    { title: '基本情報', key: 'basic_info', type: 'basic' as const },
    { title: '現在の状態', key: 'current_state', type: 'list' as const },
    { title: '強み・得意なこと', key: 'strengths', type: 'list' as const },
    { title: '課題・苦手なこと', key: 'challenges', type: 'list' as const },
    { title: '身体・感覚面', key: 'physical_sensory', type: 'list' as const },
    { title: '医療・発達', key: 'medical_development', type: 'list' as const },
    { title: '家庭環境', key: 'family_environment', type: 'list' as const },
    { title: '保護者の意向', key: 'parent_intentions', type: 'list' as const },
    { title: 'スタッフメモ', key: 'staff_notes', type: 'list' as const },
    { title: '事務的事項', key: 'administrative_notes', type: 'list' as const },
    { title: '未解決事項', key: 'unresolved_items', type: 'list' as const },
  ];

  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      {sections.map(section => {
        const items = extraction[section.key as keyof typeof extraction];
        if (!items || (Array.isArray(items) && items.length === 0)) return null;

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
            {renderItems(items as any, section.type)}
          </div>
        );
      })}
    </div>
  );
};

export default Phase1Display;
