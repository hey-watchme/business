import React, { useState, useEffect } from 'react';
import './EditableTableRow.css';

// SupportItem structure matching assessment_v1.support_items[]
export interface SupportItem {
    category: string;      // Domain (5 areas)
    target: string;        // Specific goal
    methods: string[];     // Support methods
    timeline: string;      // Achievement timeline
    staff: string;         // Responsible staff
    notes: string;         // Remarks
    priority: number;      // Priority (1-5)
}

interface EditableTableRowProps {
    planId: string;
    index: number;
    item: SupportItem;
    aiItem?: SupportItem;
    onSave: (index: number, item: SupportItem) => Promise<void>;
    onDelete?: (index: number) => Promise<void>;
}

const DOMAIN_OPTIONS = [
    'Health/Life',
    'Motor/Sensory',
    'Cognition/Behavior',
    'Language/Communication',
    'Relationships/Social',
    'Family Support',
    'Transition Support'
];

const EditableTableRow: React.FC<EditableTableRowProps> = ({
    planId: _planId,  // Reserved for future use
    index,
    item,
    aiItem,
    onSave,
    onDelete
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [localItem, setLocalItem] = useState<SupportItem>(item);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Check if row has been edited from AI
    const isEdited = aiItem && JSON.stringify(item) !== JSON.stringify(aiItem);

    useEffect(() => {
        setLocalItem(item);
    }, [item]);

    const handleFieldChange = (field: keyof SupportItem, value: string | string[] | number) => {
        setLocalItem(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleMethodsChange = (value: string) => {
        // Convert newline-separated text to array
        const methods = value.split('\n').filter(m => m.trim());
        setLocalItem(prev => ({
            ...prev,
            methods
        }));
    };

    const hasChanges = JSON.stringify(localItem) !== JSON.stringify(item);

    const handleSave = async () => {
        if (!hasChanges) {
            setIsEditing(false);
            return;
        }

        setIsSaving(true);
        setError(null);

        try {
            await onSave(index, localItem);
            setIsEditing(false);
        } catch (err) {
            console.error('Save failed:', err);
            setError('Save failed. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        setLocalItem(item);
        setIsEditing(false);
        setError(null);
    };

    const handleDelete = async () => {
        if (!onDelete) return;
        if (!window.confirm('Delete this support item?')) return;

        setIsSaving(true);
        try {
            await onDelete(index);
        } catch (err) {
            console.error('Delete failed:', err);
            setError('Delete failed.');
        } finally {
            setIsSaving(false);
        }
    };

    // Display mode
    if (!isEditing) {
        return (
            <tr className={`support-table-row ${isEdited ? 'edited' : ''}`}>
                <td className="cell-category">{item.category || '---'}</td>
                <td className="cell-target">{item.target || '---'}</td>
                <td className="cell-methods">
                    {item.methods?.length > 0 ? (
                        <ul className="methods-list">
                            {item.methods.map((method, i) => (
                                <li key={i}>{method}</li>
                            ))}
                        </ul>
                    ) : '---'}
                </td>
                <td className="cell-timeline">{item.timeline || '---'}</td>
                <td className="cell-staff">{item.staff || '---'}</td>
                <td className="cell-notes">{item.notes || '---'}</td>
                <td className="cell-priority">{item.priority || '---'}</td>
                <td className="cell-actions">
                    <button
                        className="row-edit-btn"
                        onClick={() => setIsEditing(true)}
                        title="Edit row"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                    </button>
                </td>
            </tr>
        );
    }

    // Edit mode
    return (
        <>
            <tr className="support-table-row editing">
                <td className="cell-category">
                    <select
                        value={localItem.category}
                        onChange={(e) => handleFieldChange('category', e.target.value)}
                        disabled={isSaving}
                        className="field-select"
                    >
                        <option value="">Select domain</option>
                        {DOMAIN_OPTIONS.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                        ))}
                    </select>
                </td>
                <td className="cell-target">
                    <textarea
                        value={localItem.target}
                        onChange={(e) => handleFieldChange('target', e.target.value)}
                        disabled={isSaving}
                        className="field-textarea"
                        placeholder="Specific goal"
                        rows={3}
                    />
                </td>
                <td className="cell-methods">
                    <textarea
                        value={localItem.methods?.join('\n') || ''}
                        onChange={(e) => handleMethodsChange(e.target.value)}
                        disabled={isSaving}
                        className="field-textarea"
                        placeholder="Support methods (one per line)"
                        rows={4}
                    />
                </td>
                <td className="cell-timeline">
                    <input
                        type="text"
                        value={localItem.timeline}
                        onChange={(e) => handleFieldChange('timeline', e.target.value)}
                        disabled={isSaving}
                        className="field-input"
                        placeholder="6 months"
                    />
                </td>
                <td className="cell-staff">
                    <input
                        type="text"
                        value={localItem.staff}
                        onChange={(e) => handleFieldChange('staff', e.target.value)}
                        disabled={isSaving}
                        className="field-input"
                        placeholder="Staff name"
                    />
                </td>
                <td className="cell-notes">
                    <textarea
                        value={localItem.notes}
                        onChange={(e) => handleFieldChange('notes', e.target.value)}
                        disabled={isSaving}
                        className="field-textarea"
                        placeholder="Remarks"
                        rows={2}
                    />
                </td>
                <td className="cell-priority">
                    <input
                        type="number"
                        min="1"
                        max="5"
                        value={localItem.priority}
                        onChange={(e) => handleFieldChange('priority', parseInt(e.target.value) || 1)}
                        disabled={isSaving}
                        className="field-input priority-input"
                    />
                </td>
                <td className="cell-actions editing">
                    {onDelete && (
                        <button
                            className="row-delete-btn"
                            onClick={handleDelete}
                            disabled={isSaving}
                            title="Delete row"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                        </button>
                    )}
                </td>
            </tr>
            <tr className="row-actions-row">
                <td colSpan={8}>
                    {error && <div className="row-error">{error}</div>}
                    <div className="row-actions">
                        <button
                            className="cancel-btn"
                            onClick={handleCancel}
                            disabled={isSaving}
                        >
                            Cancel
                        </button>
                        <button
                            className={`save-btn ${hasChanges ? 'active' : ''}`}
                            onClick={handleSave}
                            disabled={!hasChanges || isSaving}
                        >
                            {isSaving ? 'Saving...' : 'Save Row'}
                        </button>
                    </div>
                </td>
            </tr>
        </>
    );
};

export default EditableTableRow;
