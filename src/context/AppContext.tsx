import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { ScheduleData, Department } from '@/types';
import { api } from '@/services/api';

interface AppContextType {
  schedules: ScheduleData[];
  departments: Department[];
  loading: boolean;
  schedulesLoaded: boolean;
  departmentsLoaded: boolean;
  refreshSchedules: () => Promise<void>;
  refreshDepartments: () => Promise<void>;
  addSchedule: (schedule: ScheduleData) => void;
  updateSchedule: (schedule: ScheduleData) => void;
  removeSchedule: (id: number) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [schedules, setSchedules] = useState<ScheduleData[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [schedulesLoaded, setSchedulesLoaded] = useState(false);
  const [departmentsLoaded, setDepartmentsLoaded] = useState(false);

  const refreshSchedules = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getSchedules({});
      setSchedules(data);
      setSchedulesLoaded(true);
    } catch (err) {
      console.error('Failed to load schedules:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshDepartments = useCallback(async () => {
    try {
      const data = await api.getDepartments();
      setDepartments(data);
      setDepartmentsLoaded(true);
    } catch (err) {
      console.error('Failed to load departments:', err);
    }
  }, []);

  const addSchedule = useCallback((schedule: ScheduleData) => {
    setSchedules(prev => [schedule, ...prev]);
  }, []);

  const updateSchedule = useCallback((updatedSchedule: ScheduleData) => {
    setSchedules(prev => prev.map(s => s.id === updatedSchedule.id ? updatedSchedule : s));
  }, []);

  const removeSchedule = useCallback((id: number) => {
    setSchedules(prev => prev.filter(s => s.id !== id));
  }, []);

  useEffect(() => {
    if (!departmentsLoaded) {
      refreshDepartments();
    }
  }, [departmentsLoaded, refreshDepartments]);

  useEffect(() => {
    if (!schedulesLoaded) {
      refreshSchedules();
    }
  }, [schedulesLoaded, refreshSchedules]);

  return (
    <AppContext.Provider value={{
      schedules,
      departments,
      loading,
      schedulesLoaded,
      departmentsLoaded,
      refreshSchedules,
      refreshDepartments,
      addSchedule,
      updateSchedule,
      removeSchedule
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
