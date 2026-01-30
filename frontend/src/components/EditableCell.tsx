import React, { useState, useRef, useEffect } from 'react';
import './EditableCell.css';

interface EditableCellProps {
    value: string;
    field: string;
    onChange: (field: string, value: string) => void;
    isEditing: boolean;
    multiline?: boolean;
    placeholder?: string;
}

const EditableCell: React.FC<EditableCellProps> = ({
    value,
    field,
    onChange,
    isEditing,
    multiline = false,
    placeholder = '---'
}) => {
    const [localValue, setLocalValue] = useState(value);
    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

    useEffect(() => {
        setLocalValue(value);
    }, [value]);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isEditing]);

    const handleBlur = () => {
        onChange(field, localValue);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !multiline) {
            onChange(field, localValue);
        }
        if (e.key === 'Escape') {
            setLocalValue(value);
        }
    };

    if (isEditing) {
        if (multiline) {
            return (
                <textarea
                    ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                    className="editable-textarea"
                    value={localValue}
                    onChange={(e) => setLocalValue(e.target.value)}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                />
            );
        }
        return (
            <input
                ref={inputRef as React.RefObject<HTMLInputElement>}
                type="text"
                className="editable-input"
                value={localValue}
                onChange={(e) => setLocalValue(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
            />
        );
    }

    return (
        <span className="editable-display">
            {value || <span className="placeholder">{placeholder}</span>}
        </span>
    );
};

export default EditableCell;
