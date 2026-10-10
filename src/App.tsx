/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { AlarmItem, RoutineStep, RoutinePreset, SmartSuggestion } from './types';
import {
  INITIAL_ALARMS,
  ROUTINE_PRESETS,
  SMART_SUGGESTIONS,
  DAY_NAMES,
  SOUND_OPTIONS,
  CHALLENGE_OPTIONS,
} from './data/presets';
import { LiveClockHero } from './components/LiveClockHero';
import { SleepCycleCalculator } from './components/SleepCycleCalculator';
import { MorningRoutineBuilder } from './components/MorningRoutineBuilder';
import { SmartAdvisorPanel } from './components/SmartAdvisorPanel';
import { AlarmEditorModal } from './components/AlarmEditorModal';
import { ActiveAlarmModal } from './components/ActiveAlarmModal';
import { EmployeeRestManager } from './components/EmployeeRestManager';
import {
  Bell,
  Plus,
  Trash2,
  Edit3,
  Play,
  Sparkles,
  CheckCircle2,
  Moon,
  ListChecks,
  Users,
} from 'lucide-react';

type ActiveSection = 'alarms' | 'rest' | 'routine' | 'cycles' | 'advisor';

const STORAGE_KEYS = {
  ALARMS: 'miqat_fajr_alarms_v1',
  ROUTINE: 'miqat_fajr_routine_v1',
};

export default function App() {
  const [activeSection, setActiveSection] = useState<ActiveSection>('alarms');

  // Alarms State with LocalStorage Persistence
  const [alarms, setAlarms] = useState<AlarmItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ALARMS);
      return saved ? JSON.parse(saved) : INITIAL_ALARMS;
    } catch {
      return INITIAL_ALARMS;
    }
  });

  // Morning Routine Steps State with LocalStorage Persistence
  const [routineSteps, setRoutineSteps] = useState<RoutineStep[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ROUTINE);
      return saved ? JSON.parse(saved) : ROUTINE_PRESETS[0].steps;
    } catch {
      return ROUTINE_PRESETS[0].steps;
    }
  });

  const [suggestions, setSuggestions] = useState<SmartSuggestion[]>(SMART_SUGGESTIONS);

  // Modals State
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingAlarm, setEditingAlarm] = useState<AlarmItem | null>(null);
  const [ringingAlarm, setRingingAlarm] = useState<AlarmItem | null>(null);
  const [toastBanner, setToastBanner] = useState<string | null>(null);

  const lastTriggeredMinuteRef = useRef<string>('');

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ALARMS, JSON.stringify(alarms));
    } catch {
      // Ignore storage quota errors
    }
  }, [alarms]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ROUTINE, JSON.stringify(routineSteps));
    } catch {
      // Ignore storage quota errors
    }
  }, [routineSteps]);

  // Real-time background alarm trigger check every second
  useEffect(() => {
    const checkAlarms = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const currentHM = `${h}:${m}`;
      const currentDay = now.getDay();

      if (lastTriggeredMinuteRef.current === currentHM) return;

      const matched = alarms.find((alarm) => {
        if (!alarm.enabled) return false;
        const dayOk = alarm.days.length === 0 || alarm.days.includes(currentDay);
        return dayOk && alarm.time === currentHM;
      });

      if (matched) {
        lastTriggeredMinuteRef.current = currentHM;
        setRingingAlarm(matched);
      }
    };

    const interval = setInterval(checkAlarms, 1000);
    return () => clearInterval(interval);
  }, [alarms]);

  const showToast = (msg: string) => {
    setToastBanner(msg);
    setTimeout(() => setToastBanner(null), 4000);
  };

  // Handlers for Alarms
  const handleToggleAlarm = (id: string) => {
    setAlarms((prev) =>
      prev.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a))
    );
  };

  const handleSaveAlarm = (saved: AlarmItem) => {
    setAlarms((prev) => {
      const exists = prev.some((a) => a.id === saved.id);
      if (exists) {
        return prev.map((a) => (a.id === saved.id ? saved : a));
      }
      return [saved, ...prev];
    });
    showToast(`تم حفظ المنبه الذكي على الساعة ${saved.time}`);
  };

  const handleDeleteAlarm = (id: string) => {
    setAlarms((prev) => prev.filter((a) => a.id !== id));
    showToast('تم حذف المنبه');
  };

  // Handlers for Sleep Cycle Calculator
  const handleApplyRecommendedWakeTime = (time24: string, smartWindow: number) => {
    const newAlarm: AlarmItem = {
      id: `alarm-${Date.now()}`,
      time: time24,
      label: 'منبه دورة النوم الذكية (90 دقيقة)',
      days: [0, 1, 2, 3, 4, 5, 6],
      enabled: true,
      smartWindowMinutes: smartWindow,
      gradualFadeSeconds: 60,
      sound: 'dawn_chimes',
      challenge: 'math',
      linkedRoutinePresetId: 'energized_45',
      autoLaunchRoutine: true,
    };
    setAlarms((prev) => [newAlarm, ...prev]);
    showToast(`تم إنشاء منبه ذكي جديد على الساعة ${time24} مع نافذة استيقاظ ${smartWindow} دقيقة`);
  };

  // Handlers for Smart Suggestions & Advisor
  const handleApplySuggestion = (sug: SmartSuggestion) => {
    if (sug.actionType === 'enable_smart_window') {
      const win = sug.payload.smartWindow || 20;
      setAlarms((prev) =>
        prev.map((a, idx) => (idx === 0 ? { ...a, smartWindowMinutes: win, enabled: true } : a))
      );
      showToast(`تم تفعيل نافذة الاستيقاظ الذكي (${win} دقيقة) على منبهك الرئيسي`);
    } else if (sug.actionType === 'add_habit_step' && sug.payload.habitStep) {
      const step = sug.payload.habitStep;
      setRoutineSteps((prev) => {
        if (prev.some((s) => s.id === step.id)) return prev;
        return [step, ...prev];
      });
      showToast(`تمت إضافة "${step.title}" إلى روتينك الصباحي`);
    } else if (sug.actionType === 'apply_routine' && sug.payload.presetId) {
      const found = ROUTINE_PRESETS.find((p) => p.id === sug.payload.presetId);
      if (found) {
        setRoutineSteps(found.steps);
        showToast(`تم اعتماد قالب "${found.name}" لروتينك الصباحي`);
      }
    } else if (sug.actionType === 'apply_alarm' && sug.payload.time) {
      const newAlarm: AlarmItem = {
        id: `alarm-${Date.now()}`,
        time: sug.payload.time,
        label: 'منبه الساعة الذهبية الصباحي',
        days: [0, 1, 2, 3, 4],
        enabled: true,
        smartWindowMinutes: sug.payload.smartWindow || 20,
        gradualFadeSeconds: 60,
        sound: 'zen_bowl',
        challenge: 'intention',
        linkedRoutinePresetId: sug.payload.presetId || 'calm_dawn_30',
        autoLaunchRoutine: true,
      };
      setAlarms((prev) => [newAlarm, ...prev]);
      showToast(`تمت إضافة منبه الساعة الذهبية (${sug.payload.time})`);
    }

    setSuggestions((prev) =>
      prev.map((item) => (item.id === sug.id ? { ...item, applied: true } : item))
    );
  };

  const handleGenerateCustomPlan = (
    goal: string,
    wakeTime: string,
    minutesAvailable: number
  ) => {
    let preset = ROUTINE_PRESETS[0];
    if (minutesAvailable <= 15) {
      preset = ROUTINE_PRESETS[1];
    } else if (goal === 'calm' || minutesAvailable === 30) {
      preset = ROUTINE_PRESETS[2];
    }

    setRoutineSteps(preset.steps);

    const goalTitle =
      goal === 'energy'
        ? 'منبه الطاقة والحيوية الذكي'
        : goal === 'focus'
        ? 'منبه التركيز والإنجاز الصباحي'
        : 'منبه الصفاء والهدوء الصباحي';

    const customAlarm: AlarmItem = {
      id: `alarm-plan-${Date.now()}`,
      time: wakeTime,
      label: goalTitle,
      days: [0, 1, 2, 3, 4],
      enabled: true,
      smartWindowMinutes: 20,
      gradualFadeSeconds: 60,
      sound: goal === 'calm' ? 'zen_bowl' : 'dawn_chimes',
      challenge: goal === 'focus' ? 'math' : 'intention',
      linkedRoutinePresetId: preset.id,
      autoLaunchRoutine: true,
    };

    setAlarms((prev) => [customAlarm, ...prev]);
  };

  // Handlers for Active Alarm Dismissal & Snooze
  const handleDismissAlarm = (alarm: AlarmItem) => {
    setRingingAlarm(null);
    if (alarm.autoLaunchRoutine) {
      const linkedPreset = ROUTINE_PRESETS.find(
        (p) => p.id === alarm.linkedRoutinePresetId
      );
      if (linkedPreset && routineSteps.length === 0) {
        setRoutineSteps(linkedPreset.steps);
      }
      setActiveSection('routine');
      showToast('صباح النور والنشاط! بدأ الآن جدول روتينك الصباحي المنظم.');
    } else {
      showToast('صباح الخير! تم إيقاف المنبه الذكي بنجاح.');
    }
  };

  const handleSnoozeAlarm = (alarm: AlarmItem) => {
    setRingingAlarm(null);
    const now = new Date(Date.now() + 5 * 60000);
    const snoozeTime = `${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}`;
    showToast(`تم تفعيل غفوة ذكية لمدة 5 دقائق (يرن الساعة ${snoozeTime})`);
    // Update or create snooze alarm
    setAlarms((prev) =>
      prev.map((a) => (a.id === alarm.id ? { ...a, time: snoozeTime, enabled: true } : a))
    );
  };

  const primaryActiveWakeTime =
    alarms.find((a) => a.enabled)?.time || alarms[0]?.time || '06:00';

  const getSoundName = (id: AlarmItem['sound']) =>
    SOUND_OPTIONS.find((s) => s.id === id)?.name || 'أجراس الفجر';

  const getChallengeName = (id: AlarmItem['challenge']) =>
    CHALLENGE_OPTIONS.find((c) => c.id === id)?.name || 'بدون تحدٍ';

  const formatDaysLabel = (days: number[]) => {
    if (days.length === 7 || days.length === 0) return 'يومياً';
    if (days.length === 5 && [0, 1, 2, 3, 4].every((d) => days.includes(d))) {
      return 'أيام الأسبوع (الأحد - الخميس)';
    }
    if (days.length === 2 && days.includes(5) && days.includes(6)) {
      return 'عطلة نهاية الأسبوع';
    }
    return days
      .map((d) => DAY_NAMES.find((dn) => dn.index === d)?.short)
      .filter(Boolean)
      .join(' ، ');
  };

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col">
      {/* Top Bar Contract: Strictly 3 zones (Brand wordmark, 4 nav links, 1 primary action) */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-4 sm:px-8 py-4 border-b border-slate-800/80 bg-[#0B0F17]/90 backdrop-blur-md">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveSection('alarms');
          }}
          className="text-lg sm:text-xl font-bold tracking-tight text-amber-400 font-display whitespace-nowrap"
        >
          ميقات الفجر
        </a>

        {/* Zone 2: 5 clean text navigation links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300">
          <button
            onClick={() => setActiveSection('alarms')}
            className={`hover:text-amber-400 transition-colors cursor-pointer whitespace-nowrap ${
              activeSection === 'alarms'
                ? 'text-amber-400 underline underline-offset-8 decoration-2'
                : ''
            }`}
          >
            المنبهات الذكية
          </button>
          <button
            onClick={() => setActiveSection('rest')}
            className={`hover:text-amber-400 transition-colors cursor-pointer whitespace-nowrap ${
              activeSection === 'rest'
                ? 'text-amber-400 underline underline-offset-8 decoration-2'
                : ''
            }`}
          >
            استراحات الموظفين (ريست)
          </button>
          <button
            onClick={() => setActiveSection('routine')}
            className={`hover:text-amber-400 transition-colors cursor-pointer whitespace-nowrap ${
              activeSection === 'routine'
                ? 'text-amber-400 underline underline-offset-8 decoration-2'
                : ''
            }`}
          >
            روتين الصباح
          </button>
          <button
            onClick={() => setActiveSection('cycles')}
            className={`hover:text-amber-400 transition-colors cursor-pointer whitespace-nowrap ${
              activeSection === 'cycles'
                ? 'text-amber-400 underline underline-offset-8 decoration-2'
                : ''
            }`}
          >
            حاسبة النوم
          </button>
          <button
            onClick={() => setActiveSection('advisor')}
            className={`hover:text-amber-400 transition-colors cursor-pointer whitespace-nowrap ${
              activeSection === 'advisor'
                ? 'text-amber-400 underline underline-offset-8 decoration-2'
                : ''
            }`}
          >
            اقتراحات ذكية
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setEditingAlarm(null);
              setEditorOpen(true);
            }}
            className="min-h-[40px] px-4 py-2 text-xs font-bold text-slate-950 bg-amber-500 rounded-xl hover:bg-amber-400 transition-colors whitespace-nowrap cursor-pointer"
          >
            + منبه جديد
          </button>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8">
        {/* Toast Notification Banner */}
        {toastBanner && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/70 px-4 py-3 text-xs text-emerald-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{toastBanner}</span>
            </div>
            <button
              onClick={() => setToastBanner(null)}
              className="text-emerald-300 hover:text-white text-xs font-medium cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        )}

        {/* Dominant Visual Anchor: Live Digital Clock & Next Smart Alarm */}
        <LiveClockHero
          alarms={alarms}
          onTriggerDemoAlarm={(alarm) => setRingingAlarm(alarm)}
          onOpenNewAlarm={() => {
            setEditingAlarm(null);
            setEditorOpen(true);
          }}
        />

        {/* Mobile Segmented Navigation Switcher (Visible on screens < md) */}
        <div className="grid grid-cols-5 gap-1.5 p-1.5 bg-[#131B2E] border border-slate-800 rounded-2xl md:hidden">
          <button
            onClick={() => setActiveSection('alarms')}
            className={`min-h-[42px] rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer whitespace-nowrap ${
              activeSection === 'alarms'
                ? 'bg-amber-500 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>المنبهات</span>
          </button>
          <button
            onClick={() => setActiveSection('rest')}
            className={`min-h-[42px] rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer whitespace-nowrap ${
              activeSection === 'rest'
                ? 'bg-amber-500 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>الريست</span>
          </button>
          <button
            onClick={() => setActiveSection('routine')}
            className={`min-h-[42px] rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer whitespace-nowrap ${
              activeSection === 'routine'
                ? 'bg-amber-500 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <ListChecks className="w-3.5 h-3.5" />
            <span>الروتين</span>
          </button>
          <button
            onClick={() => setActiveSection('cycles')}
            className={`min-h-[42px] rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer whitespace-nowrap ${
              activeSection === 'cycles'
                ? 'bg-amber-500 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Moon className="w-3.5 h-3.5" />
            <span>النوم</span>
          </button>
          <button
            onClick={() => setActiveSection('advisor')}
            className={`min-h-[42px] rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer whitespace-nowrap ${
              activeSection === 'advisor'
                ? 'bg-amber-500 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>اقتراحات</span>
          </button>
        </div>

        {/* SECTION: Employee Rest Manager (إدارة استراحات الموظفين - ريست) */}
        {activeSection === 'rest' && <EmployeeRestManager />}

        {/* SECTION 1: Smart Alarms Dashboard + Integrated Overview */}
        {activeSection === 'alarms' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Right Column (7 cols): Smart Alarms List */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">جدول المنبهات الذكية</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    كل منبه مزود بنافذة إيقاظ ذكية وتحدٍ صباحي وربط مباشر بروتينك.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setEditingAlarm(null);
                    setEditorOpen(true);
                  }}
                  className="min-h-[40px] px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة منبه</span>
                </button>
              </div>

              {alarms.length === 0 ? (
                <div className="rounded-2xl border border-slate-800/80 bg-[#131B2E] p-8 text-center space-y-4">
                  <p className="text-sm text-slate-300">
                    لا توجد منبهات مضافة حالياً. ابدأ بإنشاء أول منبه ذكي لتنظيم صباحك.
                  </p>
                  <button
                    onClick={() => {
                      setEditingAlarm(null);
                      setEditorOpen(true);
                    }}
                    className="min-h-[44px] px-5 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>إضافة أول منبه ذكي</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {alarms.map((alarm) => {
                    const [h, m] = alarm.time.split(':').map(Number);
                    const period = h >= 12 ? 'مساءً' : 'صباحاً';
                    const displayH = String(h % 12 || 12).padStart(2, '0');
                    const displayM = String(m).padStart(2, '0');

                    return (
                      <div
                        key={alarm.id}
                        className={`rounded-2xl border p-5 transition-colors ${
                          alarm.enabled
                            ? 'bg-[#131B2E] border-slate-800 hover:border-slate-700'
                            : 'bg-slate-900/40 border-slate-800/50 opacity-70'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-2">
                            <div className="flex items-baseline gap-2.5">
                              <span
                                dir="ltr"
                                className="font-mono tabular-nums text-3xl sm:text-4xl font-bold text-white"
                              >
                                {displayH}:{displayM}
                              </span>
                              <span className="text-xs font-semibold text-amber-400">
                                {period}
                              </span>
                              <span aria-hidden="true" className="text-slate-600">
                                ·
                              </span>
                              <span className="text-sm font-bold text-slate-100">
                                {alarm.label}
                              </span>
                            </div>

                            {/* Clean Unboxed Metadata with typographic separators */}
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                              <span>{formatDaysLabel(alarm.days)}</span>
                              <span aria-hidden="true">·</span>
                              <span className="text-teal-400">
                                {alarm.smartWindowMinutes > 0
                                  ? `نافذة ذكية ${alarm.smartWindowMinutes} د`
                                  : 'رنين مباشر'}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>{getSoundName(alarm.sound)}</span>
                              <span aria-hidden="true">·</span>
                              <span>{getChallengeName(alarm.challenge)}</span>
                            </div>
                          </div>

                          {/* Enable / Disable Toggle Switch */}
                          <button
                            type="button"
                            role="switch"
                            aria-checked={alarm.enabled}
                            onClick={() => handleToggleAlarm(alarm.id)}
                            className={`min-h-[36px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                              alarm.enabled
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}
                          >
                            {alarm.enabled ? 'مُفعّل' : 'مُعطّل'}
                          </button>
                        </div>

                        {/* Bottom Action Row */}
                        <div className="mt-4 pt-3.5 border-t border-slate-800/70 flex items-center justify-between gap-2">
                          <div className="text-xs text-slate-400">
                            {alarm.autoLaunchRoutine
                              ? 'يشغّل روتين الصباح تلقائياً بعد الاستيقاظ'
                              : 'بدون تشغيل تلقائي للروتين'}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setRingingAlarm(alarm)}
                              className="min-h-[36px] px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-200 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                              title="تجربة رنين هذا المنبه الآن"
                            >
                              <Play className="w-3.5 h-3.5" />
                              <span>تجربة</span>
                            </button>

                            <button
                              onClick={() => {
                                setEditingAlarm(alarm);
                                setEditorOpen(true);
                              }}
                              className="min-h-[36px] px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>تعديل</span>
                            </button>

                            <button
                              onClick={() => handleDeleteAlarm(alarm.id)}
                              className="min-h-[36px] min-w-[36px] rounded-lg bg-slate-900 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 flex items-center justify-center transition-colors cursor-pointer"
                              title="حذف المنبه"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Left Column (5 cols): Quick Morning Routine Preview + Top Smart Suggestion */}
            <div className="lg:col-span-5 space-y-6">
              {/* Quick Routine Preview Card */}
              <div className="rounded-2xl border border-slate-800/80 bg-[#131B2E] p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3.5">
                  <div>
                    <h3 className="text-base font-bold text-white">
                      ملخص روتين الصباح المرتبط
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      يبدأ الساعة{' '}
                      <span className="font-mono tabular-nums text-amber-400">
                        {primaryActiveWakeTime}
                      </span>{' '}
                      ({routineSteps.reduce((acc, s) => acc + s.durationMinutes, 0)} دقيقة إجمالاً)
                    </p>
                  </div>

                  <button
                    onClick={() => setActiveSection('routine')}
                    className="text-xs font-semibold text-amber-400 hover:underline cursor-pointer whitespace-nowrap"
                  >
                    إدارة الروتين ←
                  </button>
                </div>

                <div className="divide-y divide-slate-800/70">
                  {routineSteps.slice(0, 4).map((step, i) => (
                    <div
                      key={step.id}
                      className="py-2.5 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono tabular-nums text-slate-500 font-semibold">
                          0{i + 1}.
                        </span>
                        <span
                          className={
                            step.completed
                              ? 'line-through text-slate-500'
                              : 'text-slate-200 font-medium'
                          }
                        >
                          {step.title}
                        </span>
                      </div>
                      <span className="font-mono tabular-nums text-amber-300/90 shrink-0">
                        {step.durationMinutes} د
                      </span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setActiveSection('routine')}
                  className="w-full min-h-[42px] rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-200 flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <ListChecks className="w-4 h-4 text-amber-400" />
                  <span>فتح المؤقت التفاعلي وتعديل خطوات الصباح</span>
                </button>
              </div>

              {/* Featured Smart Suggestion Highlight */}
              <div className="rounded-2xl border border-slate-800/80 bg-[#131B2E] p-6 space-y-3.5">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="text-amber-400 font-semibold flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" />
                    <span>اقتراح ذكي لتطوير صباحك</span>
                  </span>
                  <button
                    onClick={() => setActiveSection('advisor')}
                    className="hover:text-white transition-colors cursor-pointer"
                  >
                    عرض كل الاقتراحات ({suggestions.length}) ←
                  </button>
                </div>

                <h4 className="text-sm font-bold text-white">
                  {suggestions[0].title}
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {suggestions[0].description}
                </p>

                <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                  <button
                    onClick={() => handleApplySuggestion(suggestions[0])}
                    className="flex-1 min-h-[40px] px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {suggestions[0].applied ? 'تم التفعيل بنجاح ✓' : suggestions[0].actionLabel}
                  </button>
                  <button
                    onClick={() => setActiveSection('cycles')}
                    className="min-h-[40px] px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
                  >
                    حاسبة دورات النوم
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 2: Interactive Morning Routine Builder & Live Timer */}
        {activeSection === 'routine' && (
          <MorningRoutineBuilder
            steps={routineSteps}
            activeWakeTime={primaryActiveWakeTime}
            onUpdateSteps={setRoutineSteps}
            onSelectPreset={(preset: RoutinePreset) => {
              setRoutineSteps(preset.steps);
              showToast(`تم تحميل "${preset.name}" (${preset.totalMinutes} دقيقة)`);
            }}
          />
        )}

        {/* SECTION 3: 90-Minute Sleep Cycle Calculator */}
        {activeSection === 'cycles' && (
          <SleepCycleCalculator
            onApplyRecommendedTime={handleApplyRecommendedWakeTime}
          />
        )}

        {/* SECTION 4: Curated Smart Suggestions & Custom Plan Architect */}
        {activeSection === 'advisor' && (
          <SmartAdvisorPanel
            suggestions={suggestions}
            onApplySuggestion={handleApplySuggestion}
            onGenerateCustomPlan={handleGenerateCustomPlan}
          />
        )}
      </main>

      {/* Quiet Minimal Footer */}
      <footer className="mt-auto border-t border-slate-800/60 py-5 px-4 sm:px-8 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-3">
        <span>ميقات الفجر — نظام التنبيه الذكي وتنظيم الروتين الصباحي</span>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setActiveSection('alarms')}
            className="hover:text-slate-300 cursor-pointer"
          >
            المنبهات
          </button>
          <span aria-hidden="true">·</span>
          <button
            onClick={() => setActiveSection('routine')}
            className="hover:text-slate-300 cursor-pointer"
          >
            روتين الصباح
          </button>
          <span aria-hidden="true">·</span>
          <button
            onClick={() => setActiveSection('cycles')}
            className="hover:text-slate-300 cursor-pointer"
          >
            حاسبة دورات النوم
          </button>
        </div>
      </footer>

      {/* Alarm Editor Modal */}
      <AlarmEditorModal
        isOpen={editorOpen}
        initialAlarm={editingAlarm}
        onClose={() => setEditorOpen(false)}
        onSave={handleSaveAlarm}
      />

      {/* Active Ringing & Wake-up Challenge Modal */}
      <ActiveAlarmModal
        alarm={ringingAlarm}
        onDismissAndStartRoutine={handleDismissAlarm}
        onSnooze={handleSnoozeAlarm}
      />
    </div>
  );
}
