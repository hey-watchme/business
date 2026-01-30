import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, type Subject, type SubjectsResponse } from '../api/client';
import { useAuth } from './AuthContext';

interface SubjectContextType {
    subjects: Subject[];
    analytics: SubjectsResponse['analytics'] | null;
    loading: boolean;
    refreshSubjects: () => Promise<void>;
}

const SubjectContext = createContext<SubjectContextType | undefined>(undefined);

export const SubjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [analytics, setAnalytics] = useState<SubjectsResponse['analytics'] | null>(null);
    const [loading, setLoading] = useState(false);
    const { profile } = useAuth();

    const fetchSubjects = useCallback(async () => {
        if (!profile?.facility_id || profile.facility_id === 'temp') {
            setSubjects([]);
            setAnalytics(null);
            return;
        }

        try {
            setLoading(true);
            const response = await api.getSubjects(profile.facility_id);
            setSubjects(response.subjects);
            setAnalytics(response.analytics);
        } catch (error) {
            console.error('Failed to fetch subjects in context:', error);
        } finally {
            setLoading(false);
        }
    }, [profile?.facility_id]);

    useEffect(() => {
        fetchSubjects();
    }, [fetchSubjects]);

    return (
        <SubjectContext.Provider value={{ subjects, analytics, loading, refreshSubjects: fetchSubjects }}>
            {children}
        </SubjectContext.Provider>
    );
};

export const useSubjects = () => {
    const context = useContext(SubjectContext);
    if (context === undefined) {
        throw new Error('useSubjects must be used within a SubjectProvider');
    }
    return context;
};
