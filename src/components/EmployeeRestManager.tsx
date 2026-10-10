import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Employee,
  ActiveRestSession,
  RestLogEntry,
  RestSettings,
  SoundType,
} from '../types';
import { SOUND_OPTIONS } from '../data/presets';
import { soundEngine } from '../utils/soundEngine';
import {
  Users,
  Plus,
  Trash2,
  Edit3,
  Play,
  Pause,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Settings,
  FileText,
  Share2,
  Download,
  Upload,
  RotateCcw,
  Volume2,
  Sparkles,
  UserPlus,
  ShieldAlert,
  Sun,
  BellRing,
  Check,
  X,
} from 'lucide-react';

const STORAGE_KEYS = {
  EMPLOYEES: 'miqat_rest_employees_v1',
  LOGS: 'miqat_rest_logs_v1',
  SETTINGS: 'miqat_rest_settings_v1',
  LAST_RESET_KEY: 'miqat_rest_last_reset_day_v1',
};

const INITIAL_EMPLOYEES: Employee[] = [
  {
    id: 'emp-1',
    name: 'حسين',
    dailyAllowanceMinutes: 30,
    consumedSecondsToday: 0,
    delaySecondsToday: 0,
    hasStartedRestToday: false,
    optedOutRemainingToday: false,
    shiftStartTime: '09:00',
    shiftPreAlertMinutes: 10,
    activeSession: null,
  },
  {
    id: 'emp-2',
    name: 'أحمد',
    dailyAllowanceMinutes: 30,
    consumedSecondsToday: 0,
    delaySecondsToday: 0,
    hasStartedRestToday: false,
    optedOutRemainingToday: false,
    shiftStartTime: '09:00',
    shiftPreAlertMinutes: 10,
    activeSession: null,
  },
  {
    id: 'emp-3',
    name: 'محمد',
    dailyAllowanceMinutes: 30,
    consumedSecondsToday: 0,
    delaySecondsToday: 0,
    hasStartedRestToday: false,
    optedOutRemainingToday: false,
    shiftStartTime: '10:00',
    shiftPreAlertMinutes: 15,
    activeSession: null,
  },
];

const DEFAULT_SETTINGS: RestSettings = {
  dayResetHour: 5,
  dayResetMinute: 0,
  testModeMinuteAsSecond: false,
  wakeLockEnabled: true,
  maxConcurrentRests: 2,
  enableVoiceTTS: true,
  enableVibration: true,
  alarmSound: 'classic_pulse',
  alarmVolume: 0.85,
  enablePhase2Extras: true,
};

// Computes the logical operational "Work Day Key" based on the configured reset hour (e.g. 05:00 AM)
function computeOperationalDayKey(now: Date, resetHour: number, resetMinute: number): string {
  const shifted = new Date(now);
  const currentTotalMins = now.getHours() * 60 + now.getMinutes();
  const resetTotalMins = resetHour * 60 + resetMinute;
  if (currentTotalMins < resetTotalMins) {
    shifted.setDate(shifted.getDate() - 1);
  }
  const y = shifted.getFullYear();
  const m = String(shifted.getMonth() + 1).padStart(2, '0');
  const d = String(shifted.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Formats a duration in seconds or test units into Arabic human-readable text
function formatDurationArabic(totalSeconds: number, isTestMode: boolean): string {
  // In test mode, 1 second of real time represents 1 simulated minute
  if (isTestMode) {
    const simulatedMinutes = Math.floor(totalSeconds);
    const remainderSub = Math.round((totalSeconds - simulatedMinutes) * 60);
    if (simulatedMinutes > 0 && remainderSub > 0) {
      return `${simulatedMinutes} دقيقة و ${remainderSub} ثانية`;
    }
    if (simulatedMinutes > 0) {
      return `${simulatedMinutes} دقيقة`;
    }
    return `${Math.max(1, remainderSub)} ثانية`;
  }

  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  if (mins > 0 && secs > 0) {
    return `${mins} دقيقة و ${secs} ثانية`;
  }
  if (mins > 0) {
    return `${mins} دقيقة`;
  }
  return `${secs} ثانية`;
}

export const EmployeeRestManager: React.FC = () => {
  // State: Settings
  const [settings, setSettings] = useState<RestSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  // State: Employees
  const [employees, setEmployees] = useState<Employee[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.EMPLOYEES);
      return saved ? JSON.parse(saved) : INITIAL_EMPLOYEES;
    } catch {
      return INITIAL_EMPLOYEES;
    }
  });

  // State: Logs
  const [logs, setLogs] = useState<RestLogEntry[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.LOGS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Sub-navigation inside Employee Rest Manager
  const [subTab, setSubTab] = useState<'board' | 'employees' | 'logs' | 'settings'>('board');

  // High-frequency tick for accurate absolute timestamp calculations
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  // Prominent Return Banner Modal / Alert (Section 5)
  const [returnBannerMessages, setReturnBannerMessages] = useState<
    { id: string; employeeName: string; lines: string[]; timestamp: string; isLate: boolean }[]
  >([]);

  // Start Rest Modal State (Section 2)
  const [startingEmployee, setStartingEmployee] = useState<Employee | null>(null);
  const [customMinutesInput, setCustomMinutesInput] = useState<number>(15);
  const [confirmExceedModal, setConfirmExceedModal] = useState<{
    employee: Employee;
    requestedMinutes: number;
    remainingMinutes: number;
    exceedConcurrentWarning: boolean;
  } | null>(null);

  // Employee CRUD Modals (Section 1)
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpAllowance, setNewEmpAllowance] = useState(30);
  const [bulkText, setBulkText] = useState('');
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [deletingEmployee, setDeletingEmployee] = useState<Employee | null>(null);
  const [confirmNewDayModal, setConfirmNewDayModal] = useState(false);

  // Shift Pre-Alert Banner
  const [shiftAlertMessage, setShiftAlertMessage] = useState<string | null>(null);
  const triggeredShiftAlertsRef = useRef<Set<string>>(new Set());

  // Long-press ref for Quick Start (Section 7)
  const longPressTimerRef = useRef<number | null>(null);

  // Wake Lock Ref (Section 3)
  const wakeLockRef = useRef<any>(null);
  const [wakeLockActiveStatus, setWakeLockActiveStatus] = useState<boolean>(false);

  // Selected Day Key for Reports (Section 7)
  const currentOpDayKey = useMemo(
    () => computeOperationalDayKey(new Date(nowMs), settings.dayResetHour, settings.dayResetMinute),
    [nowMs, settings.dayResetHour, settings.dayResetMinute]
  );
  const [selectedReportDay, setSelectedReportDay] = useState<string>(currentOpDayKey);

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(employees));
    } catch {
      // ignore
    }
  }, [employees]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs));
    } catch {
      // ignore
    }
  }, [logs]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch {
      // ignore
    }
  }, [settings]);

  // 250ms ticker using absolute Date.now()
  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 250);
    return () => clearInterval(interval);
  }, []);

  // Wake Lock Management
  useEffect(() => {
    const requestWakeLock = async () => {
      if (!settings.wakeLockEnabled) {
        if (wakeLockRef.current) {
          try {
            await wakeLockRef.current.release();
          } catch {}
          wakeLockRef.current = null;
        }
        setWakeLockActiveStatus(false);
        return;
      }

      if ('wakeLock' in navigator) {
        try {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
          setWakeLockActiveStatus(true);
          wakeLockRef.current.addEventListener('release', () => {
            setWakeLockActiveStatus(false);
          });
        } catch {
          setWakeLockActiveStatus(false);
        }
      }
    };

    requestWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && settings.wakeLockEnabled) {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [settings.wakeLockEnabled]);

  // Automatic Daily Reset at configured hour (default 05:00 AM) (Section 8)
  useEffect(() => {
    const savedDayKey = localStorage.getItem(STORAGE_KEYS.LAST_RESET_KEY);
    if (!savedDayKey) {
      localStorage.setItem(STORAGE_KEYS.LAST_RESET_KEY, currentOpDayKey);
      return;
    }
    if (savedDayKey !== currentOpDayKey) {
      // Perform automatic daily reset while keeping active sessions safe or resetting daily counters
      setEmployees((prev) =>
        prev.map((emp) => ({
          ...emp,
          consumedSecondsToday: 0,
          delaySecondsToday: 0,
          hasStartedRestToday: emp.activeSession !== null,
          optedOutRemainingToday: false,
        }))
      );
      localStorage.setItem(STORAGE_KEYS.LAST_RESET_KEY, currentOpDayKey);
      setSelectedReportDay(currentOpDayKey);
    }
  }, [currentOpDayKey]);

  // Check if any employee's rest timer has hit 0 and needs loud ringing (Section 4)
  const unacknowledgedExpiredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      if (!emp.activeSession || emp.activeSession.isPaused) return false;
      const remainingMs = emp.activeSession.targetEndMs - nowMs;
      return remainingMs <= 0 && !emp.activeSession.alarmAcknowledged;
    });
  }, [employees, nowMs]);

  const ringingNamesKey = unacknowledgedExpiredEmployees.map((e) => e.id).join(',');

  useEffect(() => {
    if (unacknowledgedExpiredEmployees.length > 0) {
      const names = unacknowledgedExpiredEmployees.map((e) => e.name).join(' و ');
      const ttsPhrase =
        settings.enablePhase2Extras && settings.enableVoiceTTS
          ? `انتهت استراحة ${names}`
          : undefined;

      soundEngine.startRestExpiredLoop(
        settings.alarmSound,
        settings.alarmVolume,
        settings.enableVibration,
        ttsPhrase
      );

      // Browser Notification if granted
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(`انتهت استراحة ${names}`, {
            body: `يرجى الضغط على "تم" أو تسجيل رجوع الموظف (${names}).`,
          });
        } catch {}
      }
    } else {
      soundEngine.stop();
    }
  }, [
    ringingNamesKey,
    settings.alarmSound,
    settings.alarmVolume,
    settings.enableVibration,
    settings.enableVoiceTTS,
    settings.enablePhase2Extras,
  ]);

  // Check Optional Shift Pre-Alert (Section 7)
  useEffect(() => {
    if (!settings.enablePhase2Extras) return;
    const now = new Date(nowMs);
    employees.forEach((emp) => {
      if (!emp.shiftStartTime) return;
      const [sh, sm] = emp.shiftStartTime.split(':').map(Number);
      const preMins = emp.shiftPreAlertMinutes ?? 10;
      const shiftDate = new Date(now);
      shiftDate.setHours(sh, sm - preMins, 0, 0);

      const alertKey = `${currentOpDayKey}-${emp.id}-${emp.shiftStartTime}`;
      if (
        now.getHours() === shiftDate.getHours() &&
        now.getMinutes() === shiftDate.getMinutes() &&
        !triggeredShiftAlertsRef.current.has(alertKey)
      ) {
        triggeredShiftAlertsRef.current.add(alertKey);
        setShiftAlertMessage(
          `تنبيه مباشرة الدوام: يبدأ دوام الموظف "${emp.name}" بعد ${preMins} دقائق (الساعة ${emp.shiftStartTime})`
        );
        soundEngine.playStepCompleteChime();
      }
    });
  }, [nowMs, employees, currentOpDayKey, settings.enablePhase2Extras]);

  // Helper: Get Employee's Remaining Allowance in "Units" (Minutes in normal mode, or simulated minutes in test mode)
  const getEmployeeRemainingUnits = (emp: Employee): number => {
    const unitSec = settings.testModeMinuteAsSecond ? 1 : 60;
    const consumedUnits = emp.consumedSecondsToday / unitSec;
    return Math.max(0, Math.round((emp.dailyAllowanceMinutes - consumedUnits) * 10) / 10);
  };

  // Helper: Get Employee Status
  const getEmployeeStatus = (
    emp: Employee
  ): 'available' | 'in_rest' | 'late' | 'finished' => {
    if (emp.activeSession) {
      const effectiveNow = emp.activeSession.isPaused
        ? emp.activeSession.pausedAtMs || nowMs
        : nowMs;
      if (effectiveNow > emp.activeSession.targetEndMs) {
        return 'late';
      }
      return 'in_rest';
    }
    const remUnits = getEmployeeRemainingUnits(emp);
    if (remUnits <= 0 || emp.optedOutRemainingToday) {
      return 'finished';
    }
    return 'available';
  };

  // Count currently active rests
  const activeRestCount = useMemo(
    () => employees.filter((e) => e.activeSession !== null).length,
    [employees]
  );

  // Open Start Rest Modal
  const openStartRestModal = (emp: Employee) => {
    const rem = getEmployeeRemainingUnits(emp);
    const defaultDuration = rem > 0 ? Math.ceil(rem) : 5;
    setStartingEmployee(emp);
    setCustomMinutesInput(defaultDuration);
  };

  // Execute starting a rest session
  const executeStartRest = (emp: Employee, durationUnits: number) => {
    const unitMs = settings.testModeMinuteAsSecond ? 1000 : 60000;
    const startMs = Date.now();
    const session: ActiveRestSession = {
      startedAtMs: startMs,
      targetEndMs: startMs + durationUnits * unitMs,
      allocatedUnits: durationUnits,
      unitMs,
      isPaused: false,
      pausedAtMs: null,
      totalPausedMs: 0,
      alarmAcknowledged: false,
    };

    setEmployees((prev) =>
      prev.map((item) =>
        item.id === emp.id
          ? {
              ...item,
              hasStartedRestToday: true,
              optedOutRemainingToday: false,
              activeSession: session,
            }
          : item
      )
    );
    setStartingEmployee(null);
    setConfirmExceedModal(null);

    // Request Notification permission gently if available
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  };

  // Request Start Rest with validation for exceeding allowance or concurrent limit
  const requestStartRest = (emp: Employee, requestedUnits: number) => {
    if (requestedUnits <= 0) return;
    const remUnits = getEmployeeRemainingUnits(emp);
    const exceedsAllowance = requestedUnits > remUnits;
    const exceedsConcurrent =
      settings.enablePhase2Extras &&
      settings.maxConcurrentRests > 0 &&
      activeRestCount >= settings.maxConcurrentRests;

    if (exceedsAllowance || exceedsConcurrent) {
      setConfirmExceedModal({
        employee: emp,
        requestedMinutes: requestedUnits,
        remainingMinutes: remUnits,
        exceedConcurrentWarning: exceedsConcurrent,
      });
      return;
    }

    executeStartRest(emp, requestedUnits);
  };

  // Timer Controls: Pause / Resume
  const handleTogglePause = (empId: string) => {
    const currentNow = Date.now();
    setEmployees((prev) =>
      prev.map((emp) => {
        if (emp.id !== empId || !emp.activeSession) return emp;
        const sess = emp.activeSession;
        if (!sess.isPaused) {
          // Pause now
          return {
            ...emp,
            activeSession: {
              ...sess,
              isPaused: true,
              pausedAtMs: currentNow,
            },
          };
        } else {
          // Resume: shift targetEndMs by the paused duration
          const pausedDelta = sess.pausedAtMs ? currentNow - sess.pausedAtMs : 0;
          return {
            ...emp,
            activeSession: {
              ...sess,
              isPaused: false,
              pausedAtMs: null,
              totalPausedMs: sess.totalPausedMs + pausedDelta,
              targetEndMs: sess.targetEndMs + pausedDelta,
            },
          };
        }
      })
    );
  };

  // Timer Controls: +5 Minutes
  const handleAddFiveMinutes = (empId: string) => {
    setEmployees((prev) =>
      prev.map((emp) => {
        if (emp.id !== empId || !emp.activeSession) return emp;
        const sess = emp.activeSession;
        const addMs = 5 * sess.unitMs;
        return {
          ...emp,
          activeSession: {
            ...sess,
            allocatedUnits: sess.allocatedUnits + 5,
            targetEndMs: sess.targetEndMs + addMs,
            alarmAcknowledged: false,
          },
        };
      })
    );
  };

  // Timer Controls: Cancel Rest (without recording consumption)
  const handleCancelRest = (empId: string) => {
    setEmployees((prev) =>
      prev.map((emp) => {
        if (emp.id !== empId) return emp;
        return {
          ...emp,
          activeSession: null,
          hasStartedRestToday: emp.consumedSecondsToday > 0,
        };
      })
    );
  };

  // Timer Controls: Acknowledge Ringing Alarm ("تم") -> stops ringing, red overtime counter continues until "رجع"
  const handleAcknowledgeAlarm = (empId: string) => {
    setEmployees((prev) =>
      prev.map((emp) => {
        if (emp.id !== empId || !emp.activeSession) return emp;
        return {
          ...emp,
          activeSession: {
            ...emp.activeSession,
            alarmAcknowledged: true,
          },
        };
      })
    );
  };

  // Employee Returned ("رجع") - Section 5 Exact Logic & Acceptance Criteria
  const handleEmployeeReturned = (emp: Employee) => {
    if (!emp.activeSession) return;
    const sess = emp.activeSession;
    const endMs = sess.isPaused && sess.pausedAtMs ? sess.pausedAtMs : Date.now();
    const totalActiveMs = Math.max(1000, endMs - sess.startedAtMs - sess.totalPausedMs);

    const isTestOption = sess.unitMs === 1000;
    const unitSec = isTestOption ? 1 : 60;

    // Actual elapsed seconds
    const actualElapsedSeconds = Math.round(totalActiveMs / 1000);
    const allocatedSeconds = Math.round(sess.allocatedUnits * unitSec);

    // Overtime / delay on THIS session
    const sessionDelaySeconds = Math.max(0, actualElapsedSeconds - allocatedSeconds);

    // If employee returned after targetEndMs or right at targetEndMs without major early stop,
    // let's compute exact units for clear Arabic messaging:
    const newTotalConsumedSeconds = emp.consumedSecondsToday + actualElapsedSeconds;
    const newTotalDelaySeconds = emp.delaySecondsToday + sessionDelaySeconds;

    const allowanceTotalSeconds = emp.dailyAllowanceMinutes * unitSec;
    const remainingAfterSeconds = allowanceTotalSeconds - newTotalConsumedSeconds;

    // Convert to whole minutes (or simulated minutes in test mode) for the exact headline phrases,
    // while also keeping exact minutes & seconds details.
    const takenUnitsRounded = Math.max(1, Math.round(actualElapsedSeconds / unitSec));
    const remainingUnitsRounded = Math.round(remainingAfterSeconds / unitSec);
    const delayUnitsRounded = Math.round(sessionDelaySeconds / unitSec);
    const exceededTotalUnitsRounded = Math.round(
      Math.max(0, newTotalConsumedSeconds - allowanceTotalSeconds) / unitSec
    );

    const messageLines: string[] = [];
    let isLateOrExceeded = false;

    if (sessionDelaySeconds > 0 || remainingAfterSeconds < 0) {
      isLateOrExceeded = true;
      if (sessionDelaySeconds > 0) {
        const delayFormatted =
          delayUnitsRounded > 0
            ? `${delayUnitsRounded} دقائق`
            : formatDurationArabic(sessionDelaySeconds, isTestOption);
        messageLines.push(
          `${emp.name} تأخر ${delayFormatted} زيادة على ريسته (${formatDurationArabic(
            sessionDelaySeconds,
            isTestOption
          )})`
        );
      }
      if (remainingAfterSeconds < 0) {
        const exceedFormatted =
          exceededTotalUnitsRounded > 0
            ? `${exceededTotalUnitsRounded} دقائق`
            : formatDurationArabic(Math.abs(remainingAfterSeconds), isTestOption);
        messageLines.push(`تجاوز رصيده بـ ${exceedFormatted}`);
      } else if (remainingAfterSeconds > 0) {
        messageLines.push(`بقي له ${ Math.max(1, remainingUnitsRounded) } دقائق من رصيده اليومي`);
      } else {
        messageLines.push(`${emp.name} أنهى رصيد استراحته`);
      }
    } else if (remainingUnitsRounded <= 0) {
      // Consumed exact daily balance
      messageLines.push(`${emp.name} أنهى رصيد استراحته`);
    } else {
      // Took less than daily balance
      messageLines.push(
        `${emp.name} أخذ ${takenUnitsRounded} دقيقة، بقي له ${remainingUnitsRounded} دقائق`
      );
    }

    const summaryText = messageLines.join(' — ');

    // Create Log Entry
    const newLog: RestLogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      dayKey: currentOpDayKey,
      employeeId: emp.id,
      employeeName: emp.name,
      startedAtIso: new Date(sess.startedAtMs).toISOString(),
      endedAtIso: new Date(endMs).toISOString(),
      allocatedMinutes: sess.allocatedUnits,
      actualSeconds: actualElapsedSeconds,
      delaySeconds: sessionDelaySeconds,
      remainingAfterSeconds: Math.max(0, remainingAfterSeconds),
      summaryMessage: summaryText,
      wasTestMode: isTestOption,
    };

    setLogs((prev) => [newLog, ...prev]);

    // Update Employee state
    setEmployees((prev) =>
      prev.map((item) =>
        item.id === emp.id
          ? {
              ...item,
              consumedSecondsToday: newTotalConsumedSeconds,
              delaySecondsToday: newTotalDelaySeconds,
              hasStartedRestToday: true,
              activeSession: null,
            }
          : item
      )
    );

    // Show big persistent Arabic banner until dismissed
    setReturnBannerMessages((prev) => [
      {
        id: newLog.id,
        employeeName: emp.name,
        lines: messageLines,
        timestamp: new Date(endMs).toLocaleTimeString('ar-SA', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        isLate: isLateOrExceeded,
      },
      ...prev,
    ]);
  };

  // Mark Employee "اكتفى" (Opt out of remaining rest today) - Section 6
  const handleMarkSatisfied = (empId: string) => {
    setEmployees((prev) =>
      prev.map((emp) =>
        emp.id === empId ? { ...emp, optedOutRemainingToday: true } : emp
      )
    );
  };

  // Employee Management CRUD (Section 1)
  const handleAddSingleEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmpName.trim()) return;
    const created: Employee = {
      id: `emp-${Date.now()}`,
      name: newEmpName.trim(),
      dailyAllowanceMinutes: Math.max(1, Number(newEmpAllowance) || 30),
      consumedSecondsToday: 0,
      delaySecondsToday: 0,
      hasStartedRestToday: false,
      optedOutRemainingToday: false,
      activeSession: null,
    };
    setEmployees((prev) => [...prev, created]);
    setNewEmpName('');
    setNewEmpAllowance(30);
  };

  const handleBulkAddEmployees = (e: React.FormEvent) => {
    e.preventDefault();
    const lines = bulkText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;

    const nowStamp = Date.now();
    const newItems: Employee[] = lines.map((name, idx) => ({
      id: `emp-${nowStamp}-${idx}`,
      name,
      dailyAllowanceMinutes: 30,
      consumedSecondsToday: 0,
      delaySecondsToday: 0,
      hasStartedRestToday: false,
      optedOutRemainingToday: false,
      activeSession: null,
    }));

    setEmployees((prev) => [...prev, ...newItems]);
    setBulkText('');
    setShowBulkModal(false);
  };

  const handleSaveEditedEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee || !editingEmployee.name.trim()) return;
    setEmployees((prev) =>
      prev.map((item) =>
        item.id === editingEmployee.id ? editingEmployee : item
      )
    );
    setEditingEmployee(null);
  };

  const handleConfirmDeleteEmployee = () => {
    if (!deletingEmployee) return;
    setEmployees((prev) => prev.filter((item) => item.id !== deletingEmployee.id));
    setDeletingEmployee(null);
  };

  // Manual Start New Day (Section 8)
  const handleStartNewDayNow = () => {
    setEmployees((prev) =>
      prev.map((emp) => ({
        ...emp,
        consumedSecondsToday: 0,
        delaySecondsToday: 0,
        hasStartedRestToday: false,
        optedOutRemainingToday: false,
        activeSession: null,
      }))
    );
    localStorage.setItem(STORAGE_KEYS.LAST_RESET_KEY, currentOpDayKey);
    setConfirmNewDayModal(false);
    setReturnBannerMessages([]);
  };

  // Export & Import JSON Backup (Section 7)
  const handleExportBackup = () => {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      employees,
      logs,
      settings,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `miqat-rest-backup-${currentOpDayKey}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(String(event.target?.result || '{}'));
        if (Array.isArray(parsed.employees)) setEmployees(parsed.employees);
        if (Array.isArray(parsed.logs)) setLogs(parsed.logs);
        if (parsed.settings) setSettings({ ...DEFAULT_SETTINGS, ...parsed.settings });
      } catch {
        // Invalid JSON
      }
    };
    reader.readAsText(file);
  };

  // Generate WhatsApp / Text Report (Section 7)
  const generateFormattedArabicReport = (dayKey: string): string => {
    const dayLogs = logs.filter((l) => l.dayKey === dayKey);
    const lines: string[] = [
      `📋 *تقرير استراحات الموظفين (ريست)*`,
      `📅 التاريخ: ${dayKey}`,
      `────────────────────`,
    ];

    employees.forEach((emp) => {
      const empLogs = dayLogs.filter((l) => l.employeeId === emp.id);
      const remUnits = getEmployeeRemainingUnits(emp);
      const unitSec = settings.testModeMinuteAsSecond ? 1 : 60;
      const delayMins = Math.round((emp.delaySecondsToday / unitSec) * 10) / 10;

      lines.push(
        `👤 *${emp.name}* (الرصيد: ${emp.dailyAllowanceMinutes} د | المتبقي: ${remUnits} د${
          delayMins > 0 ? ` | التأخير: ${delayMins} د` : ''
        })`
      );

      if (empLogs.length === 0) {
        lines.push(`   • لم يأخذ استراحة في هذا اليوم`);
      } else {
        empLogs.forEach((l, idx) => {
          const startStr = new Date(l.startedAtIso).toLocaleTimeString('ar-SA', {
            hour: '2-digit',
            minute: '2-digit',
          });
          const endStr = new Date(l.endedAtIso).toLocaleTimeString('ar-SA', {
            hour: '2-digit',
            minute: '2-digit',
          });
          lines.push(
            `   ${idx + 1}) من ${startStr} إلى ${endStr} — ${l.summaryMessage}`
          );
        });
      }
    });

    return lines.join('\n');
  };

  const [copiedReportMsg, setCopiedReportMsg] = useState(false);
  const handleShareReport = async () => {
    const text = generateFormattedArabicReport(selectedReportDay);
    if (navigator.share) {
      try {
        await navigator.share({
          title: `تقرير استراحات الموظفين - ${selectedReportDay}`,
          text,
        });
        return;
      } catch {}
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopiedReportMsg(true);
      setTimeout(() => setCopiedReportMsg(false), 3000);
    } catch {}
  };

  // Section 6 Categorization:
  // 1) "لم يبدؤوا أي استراحة اليوم": Employees who haven't taken any seconds today AND have remaining > 0 AND not opted out
  //    (If currently in rest for their first time, they show "في استراحة")
  const notStartedEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const rem = getEmployeeRemainingUnits(emp);
      if (rem <= 0 || emp.optedOutRemainingToday) return false;
      return emp.consumedSecondsToday === 0;
    });
  }, [employees, settings.testModeMinuteAsSecond]);

  // 2) "لهم رصيد متبقٍ": Employees who have already taken at least one partial rest (consumedSecondsToday > 0) AND still have remaining > 0 AND not opted out
  const partialRemainingEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const rem = getEmployeeRemainingUnits(emp);
      if (rem <= 0 || emp.optedOutRemainingToday) return false;
      return emp.consumedSecondsToday > 0;
    });
  }, [employees, settings.testModeMinuteAsSecond]);

  // Summary counts for color-coded status strip
  const statusCounts = useMemo(() => {
    let greenFinished = 0;
    let orangePartial = 0;
    let grayNotTaken = 0;
    let redLate = 0;

    employees.forEach((emp) => {
      const st = getEmployeeStatus(emp);
      if (st === 'late' || emp.delaySecondsToday > 0) {
        redLate++;
      }
      if (st === 'finished') {
        greenFinished++;
      } else if (emp.consumedSecondsToday > 0) {
        orangePartial++;
      } else {
        grayNotTaken++;
      }
    });

    return { greenFinished, orangePartial, grayNotTaken, redLate };
  }, [employees, nowMs, settings.testModeMinuteAsSecond]);

  // Available historical days in logs
  const availableLogDays = useMemo(() => {
    const set = new Set<string>([currentOpDayKey]);
    logs.forEach((l) => set.add(l.dayKey));
    return Array.from(set).sort().reverse();
  }, [logs, currentOpDayKey]);

  return (
    <div className="space-y-6">
      {/* Top Status & Mode Bar */}
      <div className="rounded-2xl border border-slate-800/80 bg-[#131B2E] p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-400" />
              <span>نظام إدارة استراحات الموظفين (الريست اليومي)</span>
            </h2>
            {settings.testModeMinuteAsSecond && (
              <span className="text-xs font-bold text-amber-300 bg-amber-500/15 border border-amber-500/40 px-2.5 py-1 rounded-lg">
                وضع الاختبار السريع مفعّل (الدقيقة = ثانية)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400">
            يوم العمل الحالي:{' '}
            <span className="font-mono tabular-nums text-slate-200">{currentOpDayKey}</span>
            <span aria-hidden="true" className="mx-1.5">·</span>
            تصفير الأرصدة تلقائياً الساعة{' '}
            <span className="font-mono tabular-nums text-amber-400">
              {String(settings.dayResetHour).padStart(2, '0')}:
              {String(settings.dayResetMinute).padStart(2, '0')} ص
            </span>
            <span aria-hidden="true" className="mx-1.5">·</span>
            <span>
              حالة الشاشة:{' '}
              {wakeLockActiveStatus ? 'مضاءة دائماً (Wake Lock)' : 'عادية'}
            </span>
          </p>
        </div>

        {/* Sub-Navigation Buttons (Large Touch-Friendly) */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSubTab('board')}
            className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              subTab === 'board'
                ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>لوحة الاستراحات والمؤقتات</span>
          </button>

          <button
            onClick={() => setSubTab('employees')}
            className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              subTab === 'employees'
                ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>الموظفون ({employees.length})</span>
          </button>

          <button
            onClick={() => setSubTab('logs')}
            className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              subTab === 'logs'
                ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>سجل اليوم والتقرير</span>
          </button>

          <button
            onClick={() => setSubTab('settings')}
            className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              subTab === 'settings'
                ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>الإعدادات ووضع الاختبار</span>
          </button>
        </div>
      </div>

      {/* Quick Test Mode Toggle Bar for Easy Verification */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-xs">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-slate-300">
            للتجربة السريعة: يمكنك تفعيل <strong>وضع الاختبار (الدقيقة = ثانية)</strong> أو بدء يوم عمل جديد بضغطة واحدة.
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() =>
              setSettings((prev) => ({
                ...prev,
                testModeMinuteAsSecond: !prev.testModeMinuteAsSecond,
              }))
            }
            className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer whitespace-nowrap ${
              settings.testModeMinuteAsSecond
                ? 'bg-amber-500 text-slate-950 border-amber-400'
                : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
            }`}
          >
            {settings.testModeMinuteAsSecond
              ? '✓ وضع الاختبار مفعّل (1 د = 1 ث)'
              : 'تفعيل وضع الاختبار (1 د = 1 ث)'}
          </button>

          <button
            onClick={() => setConfirmNewDayModal(true)}
            className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
            <span>بدء يوم جديد</span>
          </button>
        </div>
      </div>

      {/* Optional Shift Start Pre-Alert Banner */}
      {shiftAlertMessage && (
        <div className="rounded-2xl border border-amber-500 bg-amber-950/80 p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-sm font-bold text-amber-200">
            <BellRing className="w-5 h-5 text-amber-400 shrink-0" />
            <span>{shiftAlertMessage}</span>
          </div>
          <button
            onClick={() => setShiftAlertMessage(null)}
            className="min-h-[40px] px-4 py-1.5 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold cursor-pointer"
          >
            إغلاق التنبيه
          </button>
        </div>
      )}

      {/* LOUD PERSISTENT ALARM BANNER WHEN ANY REST HITS ZERO (Section 4) */}
      {unacknowledgedExpiredEmployees.length > 0 && (
        <div className="rounded-2xl border-2 border-rose-500 bg-rose-950/90 p-6 shadow-2xl space-y-4 animate-pulse">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Volume2 className="w-8 h-8 text-rose-400 shrink-0" />
              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-white">
                  تنبيه صوتي مستمر: انتهت استراحة{' '}
                  {unacknowledgedExpiredEmployees.map((e) => e.name).join(' ، ')}!
                </h3>
                <p className="text-sm text-rose-200 mt-1">
                  اضغط على زر "تم (إيقاف الصوت)" لإسكات الرنين مع استمرار عدّاد التأخير الأحمر حتى يرجع الموظف.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {unacknowledgedExpiredEmployees.map((emp) => (
                <button
                  key={emp.id}
                  onClick={() => handleAcknowledgeAlarm(emp.id)}
                  className="min-h-[52px] px-6 py-3 rounded-xl bg-white hover:bg-slate-100 text-rose-950 font-bold text-base flex items-center gap-2 shadow-lg cursor-pointer whitespace-nowrap"
                >
                  <Check className="w-5 h-5" />
                  <span>تم — إيقاف رنين {emp.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* BIG PERSISTENT ARABIC RETURN SUMMARY CARDS (Section 5) */}
      {returnBannerMessages.length > 0 && (
        <div className="space-y-3">
          {returnBannerMessages.map((msg) => (
            <div
              key={msg.id}
              className={`rounded-2xl border-2 p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                msg.isLate
                  ? 'border-rose-500/80 bg-rose-950/75 text-white'
                  : 'border-emerald-500/80 bg-emerald-950/75 text-white'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <span>إشعار رجوع موظف (محفوظ في السجل)</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">{msg.timestamp}</span>
                </div>
                {msg.lines.map((line, idx) => (
                  <p key={idx} className="text-xl sm:text-2xl font-bold leading-snug">
                    {line}
                  </p>
                ))}
              </div>

              <button
                onClick={() =>
                  setReturnBannerMessages((prev) =>
                    prev.filter((item) => item.id !== msg.id)
                  )
                }
                className="min-h-[48px] px-6 py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-white font-bold text-sm border border-white/20 self-end sm:self-center cursor-pointer whitespace-nowrap"
              >
                إغلاق الرسالة
              </button>
            </div>
          ))}
        </div>
      )}

      {/* =========================================================
          SUB-TAB 1: MAIN REST BOARD & TIMERS (Sections 2, 3, 4, 5, 6)
         ========================================================= */}
      {subTab === 'board' && (
        <div className="space-y-6">
          {/* SECTION 6: Top Queue "لم يأخذوا الريست بعد" & "لهم رصيد متبقٍ" */}
          <div className="rounded-2xl border border-slate-800/80 bg-[#131B2E] p-6 space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white">
                  قائمة المتابعة الفورية: لم يأخذوا الريست بعد ولهم رصيد متبقٍ
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  اضغط على زر "بدء استراحة" أو اضغط مطولاً على اسم الموظف للبدء السريع بالرصيد المتبقي.
                </p>
              </div>

              {/* Color Legend & Counts */}
              <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
                <span className="text-slate-300">
                  رمادي (لم يأخذ): <strong className="font-mono tabular-nums text-white">{statusCounts.grayNotTaken}</strong>
                </span>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span className="text-amber-400">
                  برتقالي (له رصيد متبقٍ): <strong className="font-mono tabular-nums">{statusCounts.orangePartial}</strong>
                </span>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span className="text-emerald-400">
                  أخضر (أخذ كاملاً): <strong className="font-mono tabular-nums">{statusCounts.greenFinished}</strong>
                </span>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span className="text-rose-400">
                  أحمر (متأخر): <strong className="font-mono tabular-nums">{statusCounts.redLate}</strong>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Part A: لم يبدؤوا أي استراحة اليوم */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <span className="text-sm font-bold text-slate-200">
                    1. لم يبدؤوا أي استراحة اليوم
                  </span>
                  <span className="font-mono tabular-nums text-xs font-bold text-slate-300 bg-slate-800 px-2.5 py-1 rounded-lg">
                    العدد: {notStartedEmployees.length}
                  </span>
                </div>

                {notStartedEmployees.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center">
                    جميع الموظفين بدأوا استراحاتهم أو أنهوا رصيدهم اليوم.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {notStartedEmployees.map((emp) => {
                      const inRestNow = emp.activeSession !== null;
                      const st = getEmployeeStatus(emp);
                      return (
                        <div
                          key={emp.id}
                          className={`p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${
                            st === 'late'
                              ? 'border-rose-500/60 bg-rose-950/30'
                              : inRestNow
                              ? 'border-amber-500/50 bg-amber-500/10'
                              : 'border-slate-800 bg-slate-900'
                          }`}
                        >
                          <div
                            onMouseDown={() => {
                              if (!settings.enablePhase2Extras || inRestNow) return;
                              longPressTimerRef.current = window.setTimeout(() => {
                                requestStartRest(emp, getEmployeeRemainingUnits(emp));
                              }, 600);
                            }}
                            onMouseUp={() => {
                              if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                            }}
                            onTouchStart={() => {
                              if (!settings.enablePhase2Extras || inRestNow) return;
                              longPressTimerRef.current = window.setTimeout(() => {
                                requestStartRest(emp, getEmployeeRemainingUnits(emp));
                              }, 600);
                            }}
                            onTouchEnd={() => {
                              if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                            }}
                            className="flex items-center gap-2.5 select-none cursor-pointer"
                            title="اضغط مطولاً للبدء السريع بالرصيد الكامل"
                          >
                            <span
                              className={`w-3 h-3 rounded-full shrink-0 ${
                                st === 'late'
                                  ? 'bg-rose-500'
                                  : inRestNow
                                  ? 'bg-amber-400 animate-ping'
                                  : 'bg-slate-400'
                              }`}
                            />
                            <span className="text-base font-bold text-white">{emp.name}</span>
                            <span className="text-xs text-slate-400">
                              (الرصيد الكامل: {emp.dailyAllowanceMinutes} د)
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {inRestNow ? (
                              <span className="text-xs font-bold text-amber-300 px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40">
                                في استراحة الآن
                              </span>
                            ) : (
                              <>
                                <button
                                  onClick={() => openStartRestModal(emp)}
                                  className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                                >
                                  <Play className="w-3.5 h-3.5" />
                                  <span>بدء استراحة</span>
                                </button>
                                <button
                                  onClick={() => handleMarkSatisfied(emp.id)}
                                  className="min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer whitespace-nowrap"
                                  title="استبعاد من القائمة لعدم رغبته بأخذ استراحة اليوم"
                                >
                                  اكتفى
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Part B: لهم رصيد متبقٍ */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <span className="text-sm font-bold text-amber-400">
                    2. لهم رصيد متبقٍ (أخذوا جزءاً من الاستراحة)
                  </span>
                  <span className="font-mono tabular-nums text-xs font-bold text-amber-300 bg-amber-500/15 px-2.5 py-1 rounded-lg">
                    العدد: {partialRemainingEmployees.length}
                  </span>
                </div>

                {partialRemainingEmployees.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center">
                    لا يوجد موظفون برصيد جزئي متبقٍ حالياً.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {partialRemainingEmployees.map((emp) => {
                      const remUnits = getEmployeeRemainingUnits(emp);
                      const inRestNow = emp.activeSession !== null;
                      const st = getEmployeeStatus(emp);

                      return (
                        <div
                          key={emp.id}
                          className={`p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${
                            st === 'late'
                              ? 'border-rose-500/60 bg-rose-950/30'
                              : 'border-amber-500/40 bg-amber-500/5'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`w-3 h-3 rounded-full shrink-0 ${
                                st === 'late' ? 'bg-rose-500' : 'bg-amber-400'
                              }`}
                            />
                            <span className="text-base font-bold text-white">{emp.name}</span>
                            <span className="text-xs font-bold text-amber-300">
                              متبقٍ له: {remUnits} دقيقة
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {inRestNow ? (
                              <span className="text-xs font-bold text-amber-300 px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40">
                                في استراحة الآن
                              </span>
                            ) : (
                              <>
                                <button
                                  onClick={() => openStartRestModal(emp)}
                                  className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                                >
                                  <Play className="w-3.5 h-3.5" />
                                  <span>خذ المتبقي ({remUnits} د)</span>
                                </button>
                                <button
                                  onClick={() => handleMarkSatisfied(emp.id)}
                                  className="min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer whitespace-nowrap"
                                >
                                  اكتفى
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Concurrent Rests Warning Bar (Section 7) */}
          {settings.enablePhase2Extras &&
            settings.maxConcurrentRests > 0 &&
            activeRestCount > settings.maxConcurrentRests && (
              <div className="rounded-xl border border-amber-500/60 bg-amber-950/60 p-4 flex items-center gap-3 text-xs text-amber-200">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                <span>
                  تنبيه الحد الأقصى: يوجد حالياً <strong>{activeRestCount} موظفين</strong> في استراحة في نفس الوقت، وهو يتجاوز الحد المسموح به في الإعدادات ({settings.maxConcurrentRests}).
                </span>
              </div>
            )}

          {/* SECTION 3, 4, 5: Employee Cards & Live Absolute-Timestamp Timers */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">
                بطاقات الموظفين والمؤقتات الحية ({employees.length})
              </h3>
              <button
                onClick={() => setSubTab('employees')}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>إضافة أو تعديل الموظفين</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {employees.map((emp) => {
                const status = getEmployeeStatus(emp);
                const remUnits = getEmployeeRemainingUnits(emp);
                const unitSec = settings.testModeMinuteAsSecond ? 1 : 60;
                const consumedUnits =
                  Math.round((emp.consumedSecondsToday / unitSec) * 10) / 10;

                // Calculate Live Timer from absolute targetEndMs
                let timerDisplay = '00:00';
                let isOvertime = false;
                if (emp.activeSession) {
                  const sess = emp.activeSession;
                  const effectiveNow = sess.isPaused
                    ? sess.pausedAtMs || nowMs
                    : nowMs;
                  const diffMs = sess.targetEndMs - effectiveNow;

                  if (diffMs >= 0) {
                    const totalSecsLeft = Math.ceil(diffMs / 1000);
                    const m = Math.floor(totalSecsLeft / 60);
                    const s = totalSecsLeft % 60;
                    timerDisplay = `${String(m).padStart(2, '0')}:${String(s).padStart(
                      2,
                      '0'
                    )}`;
                  } else {
                    isOvertime = true;
                    const overSecs = Math.floor(Math.abs(diffMs) / 1000);
                    const m = Math.floor(overSecs / 60);
                    const s = overSecs % 60;
                    timerDisplay = `+${String(m).padStart(2, '0')}:${String(s).padStart(
                      2,
                      '0'
                    )}`;
                  }
                }

                // Determine card border and status label
                let statusText = 'متاح';
                let statusColorClass = 'text-slate-300';
                let cardBorderClass = 'border-slate-800 bg-[#131B2E]';

                if (status === 'late') {
                  statusText = 'متأخر عن الاستراحة';
                  statusColorClass = 'text-rose-400 font-bold';
                  cardBorderClass = 'border-rose-500/80 bg-rose-950/25';
                } else if (status === 'in_rest') {
                  statusText = emp.activeSession?.isPaused
                    ? 'في استراحة (مؤقت متوقف)'
                    : 'في استراحة الآن';
                  statusColorClass = 'text-amber-400 font-bold';
                  cardBorderClass = 'border-amber-500/60 bg-[#172138]';
                } else if (status === 'finished') {
                  statusText = emp.optedOutRemainingToday
                    ? 'اكتفى اليوم'
                    : 'أنهى رصيده';
                  statusColorClass = 'text-emerald-400 font-bold';
                  cardBorderClass = 'border-emerald-500/40 bg-[#131B2E]/90';
                } else if (emp.consumedSecondsToday > 0) {
                  statusText = 'متاح (له رصيد متبقٍ)';
                  statusColorClass = 'text-amber-300 font-semibold';
                }

                return (
                  <div
                    key={emp.id}
                    className={`rounded-2xl border p-5 flex flex-col justify-between gap-4 transition-colors ${cardBorderClass}`}
                  >
                    {/* Header Info */}
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-xl font-bold text-white">{emp.name}</h4>
                        <span className={`text-xs ${statusColorClass}`}>
                          {statusText}
                        </span>
                      </div>

                      {/* Unboxed Metadata Balance Line */}
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        <span>الرصيد: {emp.dailyAllowanceMinutes} د</span>
                        <span aria-hidden="true">·</span>
                        <span>استهلك: {consumedUnits} د</span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={
                            remUnits > 0
                              ? 'text-amber-300 font-bold'
                              : 'text-emerald-400 font-bold'
                          }
                        >
                          المتبقي: {remUnits} د
                        </span>
                      </div>
                    </div>

                    {/* Active Timer Section */}
                    {emp.activeSession ? (
                      <div className="rounded-xl bg-slate-950/90 border border-slate-800 p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-400">
                            {isOvertime
                              ? 'عدّاد التأخير والتجاوز:'
                              : `الوقت المتبقي (${emp.activeSession.allocatedUnits} د):`}
                          </span>
                          {isOvertime && !emp.activeSession.alarmAcknowledged && (
                            <button
                              onClick={() => handleAcknowledgeAlarm(emp.id)}
                              className="px-3 py-1 rounded-lg bg-rose-500 text-white text-xs font-bold cursor-pointer"
                            >
                              تم (إيقاف الصوت)
                            </button>
                          )}
                        </div>

                        <div
                          dir="ltr"
                          className={`font-mono tabular-nums text-4xl sm:text-5xl font-bold text-center py-1 ${
                            isOvertime ? 'text-rose-500' : 'text-amber-400'
                          }`}
                        >
                          {timerDisplay}
                        </div>

                        {/* Big Primary "رجع" Button */}
                        <button
                          onClick={() => handleEmployeeReturned(emp)}
                          className="w-full min-h-[52px] rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-base flex items-center justify-center gap-2 shadow-lg cursor-pointer transition-colors"
                        >
                          <CheckCircle2 className="w-5 h-5" />
                          <span>رجع من الاستراحة</span>
                        </button>

                        {/* Secondary Timer Controls: Pause/Resume, +5m, Cancel */}
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            onClick={() => handleTogglePause(emp.id)}
                            className="min-h-[42px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer"
                          >
                            {emp.activeSession.isPaused ? (
                              <>
                                <Play className="w-3.5 h-3.5 text-amber-400" />
                                <span>استئناف</span>
                              </>
                            ) : (
                              <>
                                <Pause className="w-3.5 h-3.5 text-amber-400" />
                                <span>إيقاف مؤقت</span>
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => handleAddFiveMinutes(emp.id)}
                            className="min-h-[42px] rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold flex items-center justify-center cursor-pointer"
                          >
                            +5 دقائق
                          </button>

                          <button
                            onClick={() => handleCancelRest(emp.id)}
                            className="min-h-[42px] rounded-xl bg-slate-900 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>إلغاء</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Idle Controls when not in active rest */
                      <div className="pt-2 space-y-2.5">
                        <button
                          onClick={() => openStartRestModal(emp)}
                          className={`w-full min-h-[48px] rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                            remUnits > 0
                              ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                          }`}
                        >
                          <Play className="w-4 h-4" />
                          <span>
                            {remUnits > 0
                              ? `بدء استراحة (المتبقي ${remUnits} د)`
                              : 'بدء استراحة إضافية (بتأكيد)'}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          SUB-TAB 2: EMPLOYEES SCREEN (Section 1)
         ========================================================= */}
      {subTab === 'employees' && (
        <div className="space-y-6">
          {/* Add Single Employee & Bulk Add */}
          <div className="rounded-2xl border border-slate-800/80 bg-[#131B2E] p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white">إدارة قائمة الموظفين وأرصدتهم</h3>
                <p className="text-xs text-slate-400 mt-1">
                  الرصيد الافتراضي 30 دقيقة يومياً، ويمكنك تعديله لكل موظف على حدة أو لصق قائمة موظفين دفعة واحدة.
                </p>
              </div>

              <button
                onClick={() => setShowBulkModal(true)}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-xs flex items-center gap-2 border border-slate-700 cursor-pointer whitespace-nowrap"
              >
                <UserPlus className="w-4 h-4" />
                <span>إضافة قائمة دفعة واحدة (لصق أسماء)</span>
              </button>
            </div>

            <form
              onSubmit={handleAddSingleEmployee}
              className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
            >
              <div className="sm:col-span-6 space-y-1.5">
                <label className="block text-xs text-slate-300 font-medium">
                  اسم الموظف الجديد
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: حسين، عبد الله، خالد..."
                  value={newEmpName}
                  onChange={(e) => setNewEmpName(e.target.value)}
                  className="w-full min-h-[46px] bg-slate-900 border border-slate-700 rounded-xl px-4 text-sm text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="sm:col-span-3 space-y-1.5">
                <label className="block text-xs text-slate-300 font-medium">
                  الرصيد اليومي (بالدقائق)
                </label>
                <input
                  type="number"
                  min={1}
                  max={240}
                  value={newEmpAllowance}
                  onChange={(e) => setNewEmpAllowance(Number(e.target.value))}
                  className="w-full min-h-[46px] font-mono tabular-nums bg-slate-900 border border-slate-700 rounded-xl px-4 text-sm text-amber-400 font-bold focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="sm:col-span-3">
                <button
                  type="submit"
                  className="w-full min-h-[46px] rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة موظف</span>
                </button>
              </div>
            </form>

            {/* Employees Table / List */}
            <div className="divide-y divide-slate-800 pt-2">
              {employees.map((emp) => {
                const remUnits = getEmployeeRemainingUnits(emp);
                return (
                  <div
                    key={emp.id}
                    className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <span className="text-base font-bold text-white">{emp.name}</span>
                        <span className="text-xs text-slate-400">
                          الرصيد اليومي: <strong className="text-amber-400">{emp.dailyAllowanceMinutes} دقيقة</strong>
                        </span>
                        <span aria-hidden="true" className="text-slate-600">·</span>
                        <span className="text-xs text-emerald-400">
                          المتبقي اليوم: {remUnits} د
                        </span>
                      </div>
                      {settings.enablePhase2Extras && emp.shiftStartTime && (
                        <p className="text-xs text-slate-400">
                          وقت المباشرة: <span className="font-mono">{emp.shiftStartTime}</span> (تنبيه قبل {emp.shiftPreAlertMinutes || 10} د)
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditingEmployee({ ...emp })}
                        className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                        <span>تعديل الاسم والرصيد</span>
                      </button>

                      <button
                        onClick={() => setDeletingEmployee(emp)}
                        className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 text-xs font-semibold flex items-center gap-1.5 border border-slate-800 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>حذف</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          SUB-TAB 3: DAILY LOGS & WHATSAPP REPORT (Section 7)
         ========================================================= */}
      {subTab === 'logs' && (
        <div className="rounded-2xl border border-slate-800/80 bg-[#131B2E] p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-lg font-bold text-white">سجل الاستراحات اليومي والتقارير المحفوظة</h3>
              <p className="text-xs text-slate-400 mt-1">
                يُحفظ سجل كل استراحة (وقت البدء، الانتهاء، المدة الفعلية، التأخير، والمتبقي) ويمكنك مشاركته كنص مرتب على واتساب.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <select
                value={selectedReportDay}
                onChange={(e) => setSelectedReportDay(e.target.value)}
                className="min-h-[42px] bg-slate-900 border border-slate-700 rounded-xl px-3 text-xs text-white font-mono"
              >
                {availableLogDays.map((day) => (
                  <option key={day} value={day}>
                    تاريخ: {day} {day === currentOpDayKey ? '(اليوم)' : ''}
                  </option>
                ))}
              </select>

              <button
                onClick={handleShareReport}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-2 cursor-pointer whitespace-nowrap"
              >
                <Share2 className="w-4 h-4" />
                <span>
                  {copiedReportMsg
                    ? '✓ تم نسخ التقرير للحافظة!'
                    : 'مشاركة التقرير (واتساب / نسخ)'}
                </span>
              </button>
            </div>
          </div>

          {/* Formatted Report Preview Box */}
          <div className="rounded-xl bg-slate-950 border border-slate-800 p-4 space-y-2">
            <div className="text-xs text-amber-400 font-semibold">
              معاينة نص التقرير الجاهز للإرسال على واتساب:
            </div>
            <pre className="text-xs text-slate-200 whitespace-pre-wrap font-sans leading-relaxed">
              {generateFormattedArabicReport(selectedReportDay)}
            </pre>
          </div>

          {/* Detailed Log Entries List */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-white">
              تفاصيل الحركات المسجلة لتاريخ {selectedReportDay}:
            </h4>
            {logs.filter((l) => l.dayKey === selectedReportDay).length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                لا توجد استراحات مكتملة مسجلة في هذا التاريخ حتى الآن.
              </p>
            ) : (
              <div className="divide-y divide-slate-800">
                {logs
                  .filter((l) => l.dayKey === selectedReportDay)
                  .map((entry) => (
                    <div
                      key={entry.id}
                      className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">
                            {entry.employeeName}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span
                            className={
                              entry.delaySeconds > 0
                                ? 'text-rose-400 font-bold'
                                : 'text-emerald-400 font-semibold'
                            }
                          >
                            {entry.summaryMessage}
                          </span>
                        </div>
                        <div className="text-slate-400 flex flex-wrap items-center gap-2">
                          <span>
                            بدأ:{' '}
                            <strong className="font-mono text-slate-300">
                              {new Date(entry.startedAtIso).toLocaleTimeString('ar-SA')}
                            </strong>
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>
                            رجع:{' '}
                            <strong className="font-mono text-slate-300">
                              {new Date(entry.endedAtIso).toLocaleTimeString('ar-SA')}
                            </strong>
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>
                            المدة الفعلية:{' '}
                            {formatDurationArabic(entry.actualSeconds, entry.wasTestMode)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================
          SUB-TAB 4: SETTINGS, TEST MODE & BACKUP (Sections 7, 8, 9)
         ========================================================= */}
      {subTab === 'settings' && (
        <div className="rounded-2xl border border-slate-800/80 bg-[#131B2E] p-6 space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <h3 className="text-lg font-bold text-white">
              إعدادات استراحات الموظفين ووضع الاختبار
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              تحكم في ساعة بداية اليوم الجديد، وضع الاختبار السريع، الصوت والاهتزاز، والنسخ الاحتياطي.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Test Mode & Daily Reset Time */}
            <div className="space-y-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <h4 className="text-sm font-bold text-amber-400">
                1. بداية اليوم الجديد ووضع الاختبار
              </h4>

              <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.testModeMinuteAsSecond}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      testModeMinuteAsSecond: e.target.checked,
                    }))
                  }
                  className="w-5 h-5 mt-0.5 accent-amber-500"
                />
                <div>
                  <span className="text-sm font-bold text-white block">
                    وضع الاختبار السريع (الدقيقة = ثانية واحدة)
                  </span>
                  <span className="text-xs text-slate-400">
                    عند التفعيل، استراحة 20 دقيقة تنتهي خلال 20 ثانية لتتمكن من اختبار جميع الحالات فوراً.
                  </span>
                </div>
              </label>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-300">
                  ساعة التصفير التلقائي لبداية اليوم الجديد (الافتراضي 05:00 صباحاً)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={settings.dayResetHour}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        dayResetHour: Math.max(0, Math.min(23, Number(e.target.value))),
                      }))
                    }
                    className="w-24 min-h-[42px] font-mono tabular-nums bg-slate-950 border border-slate-700 rounded-xl px-3 text-sm text-amber-400 font-bold"
                  />
                  <span className="text-xs text-slate-400">صباحاً (نظام 24 ساعة)</span>
                </div>
              </div>

              <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.wakeLockEnabled}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      wakeLockEnabled: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 accent-amber-500"
                />
                <span className="text-xs text-slate-200">
                  إبقاء الشاشة مضاءة أثناء عمل المؤقتات (Screen Wake Lock)
                </span>
              </label>
            </div>

            {/* Sound, TTS, Max Concurrent & Backup */}
            <div className="space-y-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <h4 className="text-sm font-bold text-amber-400">
                2. التنبيه الصوتي والحد الأقصى والنسخ الاحتياطي
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    نغمة انتهاء الاستراحة
                  </label>
                  <select
                    value={settings.alarmSound}
                    onChange={(e) => {
                      const s = e.target.value as SoundType;
                      setSettings((prev) => ({ ...prev, alarmSound: s }));
                      soundEngine.playPreview(s);
                    }}
                    className="w-full min-h-[42px] bg-slate-950 border border-slate-700 rounded-xl px-3 text-xs text-white"
                  >
                    {SOUND_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    الحد الأقصى للمستريحين معاً
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={settings.maxConcurrentRests}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        maxConcurrentRests: Math.max(1, Number(e.target.value) || 2),
                      }))
                    }
                    className="w-full min-h-[42px] font-mono bg-slate-950 border border-slate-700 rounded-xl px-3 text-sm text-amber-400 font-bold"
                  />
                </div>
              </div>

              <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.enableVoiceTTS}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      enableVoiceTTS: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 accent-amber-500"
                />
                <span className="text-xs text-slate-200">
                  تفعيل النطق الصوتي بالعربية عند انتهاء الاستراحة ("انتهت استراحة فلان")
                </span>
              </label>

              {/* JSON Backup Export / Import */}
              <div className="pt-2 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleExportBackup}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-4 h-4 text-amber-400" />
                  <span>تصدير نسخة احتياطية (JSON)</span>
                </button>

                <label className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer">
                  <Upload className="w-4 h-4 text-teal-400" />
                  <span>استعادة نسخة احتياطية</span>
                  <input
                    type="file"
                    accept="application/json"
                    onChange={handleImportBackup}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL 1: START REST DURATION PICKER (Section 2)
         ========================================================= */}
      {startingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#131B2E] p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white">
                بدء استراحة: {startingEmployee.name}
              </h3>
              <button
                onClick={() => setStartingEmployee(null)}
                className="min-h-[38px] min-w-[38px] rounded-xl bg-slate-900 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-300">الرصيد المتبقي اليوم:</span>
              <span className="font-mono tabular-nums text-base font-bold text-amber-400">
                {getEmployeeRemainingUnits(startingEmployee)} دقيقة
              </span>
            </div>

            {/* Button: Take All Remaining */}
            {getEmployeeRemainingUnits(startingEmployee) > 0 && (
              <button
                onClick={() =>
                  requestStartRest(
                    startingEmployee,
                    getEmployeeRemainingUnits(startingEmployee)
                  )
                }
                className="w-full min-h-[50px] rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg cursor-pointer"
              >
                <Play className="w-4 h-4" />
                <span>
                  خذ المتبقي بالكامل ({getEmployeeRemainingUnits(startingEmployee)} دقيقة)
                </span>
              </button>
            )}

            {/* Quick Duration Buttons: 5, 10, 15, 20, 30 */}
            <div className="space-y-2">
              <span className="text-xs text-slate-400 block">
                أو اختر مدة سريعة (بالدقائق):
              </span>
              <div className="grid grid-cols-5 gap-2">
                {[5, 10, 15, 20, 30].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => requestStartRest(startingEmployee, mins)}
                    className="min-h-[46px] rounded-xl bg-slate-900 hover:bg-amber-500 hover:text-slate-950 text-white font-mono font-bold text-sm border border-slate-700 transition-colors cursor-pointer"
                  >
                    {mins}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Duration Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                requestStartRest(startingEmployee, Number(customMinutesInput) || 5);
              }}
              className="pt-2 border-t border-slate-800 flex items-end gap-2.5"
            >
              <div className="flex-1 space-y-1">
                <label className="block text-xs text-slate-300">
                  إدخال مدة مخصصة (دقائق):
                </label>
                <input
                  type="number"
                  min={1}
                  max={180}
                  value={customMinutesInput}
                  onChange={(e) => setCustomMinutesInput(Number(e.target.value))}
                  className="w-full min-h-[44px] font-mono text-base font-bold bg-slate-950 border border-slate-700 rounded-xl px-3.5 text-amber-400"
                />
              </div>
              <button
                type="submit"
                className="min-h-[44px] px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer"
              >
                بدء بالمخصص
              </button>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL 2: CONFIRM EXCEED ALLOWANCE OR CONCURRENT LIMIT (Section 2 & 7)
         ========================================================= */}
      {confirmExceedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-amber-500/60 bg-[#131B2E] p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-lg font-bold text-white">تأكيد بدء الاستراحة</h3>
            </div>

            <div className="space-y-2 text-sm text-slate-200 leading-relaxed">
              {confirmExceedModal.requestedMinutes >
                confirmExceedModal.remainingMinutes && (
                <p>
                  • المدة المطلوبة لـ <strong>{confirmExceedModal.employee.name}</strong> هي{' '}
                  <strong className="text-amber-400">
                    {confirmExceedModal.requestedMinutes} دقيقة
                  </strong>{' '}
                  بينما رصيده المتبقي اليوم هو{' '}
                  <strong className="text-rose-400">
                    {confirmExceedModal.remainingMinutes} دقيقة
                  </strong>{' '}
                  فقط.
                </p>
              )}
              {confirmExceedModal.exceedConcurrentWarning && (
                <p>
                  • يوجد حالياً <strong>{activeRestCount} موظفين</strong> في استراحة، وهو يصل للحد الأقصى المتزامن ({settings.maxConcurrentRests}).
                </p>
              )}
              <p className="text-xs text-slate-400 pt-1">
                هل تريد السماح ببدء الاستراحة وتجاوز الحد؟
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setConfirmExceedModal(null)}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                onClick={() =>
                  executeStartRest(
                    confirmExceedModal.employee,
                    confirmExceedModal.requestedMinutes
                  )
                }
                className="min-h-[44px] px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer"
              >
                نعم، ابدأ الاستراحة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL 3: BULK PASTE EMPLOYEES (Section 1)
         ========================================================= */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <form
            onSubmit={handleBulkAddEmployees}
            className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#131B2E] p-6 shadow-2xl space-y-4"
          >
            <h3 className="text-lg font-bold text-white">
              إضافة قائمة موظفين دفعة واحدة
            </h3>
            <p className="text-xs text-slate-400">
              الصق أسماء الموظفين هنا (اسم واحد في كل سطر)، وسيتم إضافتهم برصيد افتراضي 30 دقيقة:
            </p>
            <textarea
              rows={6}
              required
              placeholder={'حسين\nأحمد\nسارة\nمحمود'}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              className="w-full rounded-xl bg-slate-950 border border-slate-700 p-3.5 text-sm text-white focus:outline-none focus:border-amber-400"
            />
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-900 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="min-h-[42px] px-5 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold cursor-pointer"
              >
                إضافة الجميع
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =========================================================
          MODAL 4: EDIT EMPLOYEE (Section 1 & 7)
         ========================================================= */}
      {editingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <form
            onSubmit={handleSaveEditedEmployee}
            className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#131B2E] p-6 shadow-2xl space-y-4"
          >
            <h3 className="text-lg font-bold text-white">تعديل بيانات الموظف</h3>

            <div className="space-y-1.5">
              <label className="block text-xs text-slate-300">اسم الموظف</label>
              <input
                type="text"
                required
                value={editingEmployee.name}
                onChange={(e) =>
                  setEditingEmployee({ ...editingEmployee, name: e.target.value })
                }
                className="w-full min-h-[44px] bg-slate-950 border border-slate-700 rounded-xl px-3.5 text-sm text-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs text-slate-300">
                رصيد الاستراحة اليومي (بالدقائق)
              </label>
              <input
                type="number"
                min={1}
                max={240}
                value={editingEmployee.dailyAllowanceMinutes}
                onChange={(e) =>
                  setEditingEmployee({
                    ...editingEmployee,
                    dailyAllowanceMinutes: Math.max(1, Number(e.target.value) || 30),
                  })
                }
                className="w-full min-h-[44px] font-mono bg-slate-950 border border-slate-700 rounded-xl px-3.5 text-sm text-amber-400 font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-xs text-slate-300">
                  وقت المباشرة (اختياري)
                </label>
                <input
                  type="time"
                  value={editingEmployee.shiftStartTime || ''}
                  onChange={(e) =>
                    setEditingEmployee({
                      ...editingEmployee,
                      shiftStartTime: e.target.value,
                    })
                  }
                  className="w-full min-h-[44px] font-mono bg-slate-950 border border-slate-700 rounded-xl px-3 text-sm text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs text-slate-300">
                  التنبيه المسبق (دقائق)
                </label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={editingEmployee.shiftPreAlertMinutes ?? 10}
                  onChange={(e) =>
                    setEditingEmployee({
                      ...editingEmployee,
                      shiftPreAlertMinutes: Number(e.target.value) || 10,
                    })
                  }
                  className="w-full min-h-[44px] font-mono bg-slate-950 border border-slate-700 rounded-xl px-3 text-sm text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditingEmployee(null)}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-900 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="min-h-[42px] px-5 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold cursor-pointer"
              >
                حفظ التعديلات
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =========================================================
          MODAL 5: DELETE EMPLOYEE CONFIRMATION (Section 1)
         ========================================================= */}
      {deletingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-rose-500/50 bg-[#131B2E] p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">تأكيد حذف الموظف</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              هل أنت متأكد من حذف الموظف <strong>"{deletingEmployee.name}"</strong>؟ سيبقى السجل التاريخي محفوظاً ولكن سيتم إزالته من قائمة الموظفين النشطين.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeletingEmployee(null)}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-900 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                تراجع
              </button>
              <button
                onClick={handleConfirmDeleteEmployee}
                className="min-h-[42px] px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
              >
                تأكيد الحذف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL 6: CONFIRM START NEW DAY MANUALLY (Section 8)
         ========================================================= */}
      {confirmNewDayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-amber-500/50 bg-[#131B2E] p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">تأكيد بدء يوم عمل جديد</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              سيتم تصفير استهلاك اليوم وإعادة الرصيد اليومي الكامل لجميع الموظفين (مع الاحتفاظ بالسجلات السابقة في الأرشيف). هل تريد المتابعة؟
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setConfirmNewDayModal(false)}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-900 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                onClick={handleStartNewDayNow}
                className="min-h-[42px] px-5 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold cursor-pointer"
              >
                نعم، ابدأ يوماً جديداً
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
