import React, { useState, useRef, useEffect } from 'react';
import './EditableField.css';

interface EditableFieldProps {
    planId: string;
    field: string;
    value: string | null;
    aiValue: string | null;
    type: 'text' | 'textarea' | 'date' | 'list';
    label?: string;
    placeholder?: string;
    onSave: (field: string, value: string) => Promise<void>;
}

const EditableField: React.FC<EditableFieldProps> = ({
    planId: _planId,  // Reserved for future use
    field,
    value,
    aiValue,
    type,
    label,
    placeholder = '---',
    onSave
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const displayValue = value ?? aiValue ?? '';
    const [localValue, setLocalValue] = useState(displayValue);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

    // Check if value has been edited from AI-generated value
    const isEdited = value !== null && value !== aiValue;
    const hasChanges = localValue !== displayValue;

    useEffect(() => {
        setLocalValue(displayValue);
    }, [displayValue]);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            // Place cursor at end
            if (inputRef.current instanceof HTMLTextAreaElement) {
                inputRef.current.selectionStart = inputRef.current.value.length;
            }
        }
    }, [isEditing]);

    const handleSave = async () => {
        if (!hasChanges) {
            setIsEditing(false);
            return;
        }

        setIsSaving(true);
        setError(null);

        try {
            await onSave(field, localValue);
            setIsEditing(false);
        } catch (err) {
            console.error('Save failed:', err);
            setError('Save failed. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        setLocalValue(displayValue);
        setIsEditing(false);
        setError(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && type !== 'textarea') {
            e.preventDefault();
            handleSave();
        }
        if (e.key === 'Escape') {
            handleCancel();
        }
    };

    // Display mode
    if (!isEditing) {
        return (
            <div className="editable-field-display">
                <span className={`field-value ${!displayValue ? 'placeholder' : ''} ${isEdited ? 'edited' : ''}`}>
                    {displayValue || placeholder}
                </span>
                <button
                    className="edit-icon-btn"
                    onClick={() => setIsEditing(true)}
                    title="Edit"
                    aria-label={`Edit ${label || field}`}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                </button>
                {isEdited && <span className="edited-badge">Edited</span>}
            </div>
        );
    }

    // Edit mode
    return (
        <div className="editable-field-edit">
            {type === 'textarea' ? (
                <textarea
                    ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                    className="field-textarea"
                    value={localValue}
                    onChange={(e) => setLocalValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    disabled={isSaving}
                />
            ) : type === 'date' ? (
                <input
                    ref={inputRef as React.RefObject<HTMLInputElement>}
                    type="date"
                    className="field-input"
                    value={localValue}
                    onChange={(e) => setLocalValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isSaving}
                />
            ) : (
                <input
                    ref={inputRef as React.RefObject<HTMLInputElement>}
                    type="text"
                    className="field-input"
                    value={localValue}
                    onChange={(e) => setLocalValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    disabled={isSaving}
                />
            )}

            {error && <div className="field-error">{error}</div>}

            <div className="field-actions">
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
                    {isSaving ? 'Saving...' : 'Save'}
                </button>
            </div>
        </div>
    );
};

export default EditableField;
