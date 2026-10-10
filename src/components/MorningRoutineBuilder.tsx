import React, { useState, useEffect } from 'react';
import { RoutineStep, RoutinePreset } from '../types';
import { ROUTINE_PRESETS } from '../data/presets';
import { soundEngine } from '../utils/soundEngine';
import {
  Play,
  Pause,
  RotateCcw,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

interface MorningRoutineBuilderProps {
  steps: RoutineStep[];
  activeWakeTime: string;
  onUpdateSteps: (steps: RoutineStep[]) => void;
  onSelectPreset: (preset: RoutinePreset) => void;
}

export const MorningRoutineBuilder: React.FC<MorningRoutineBuilderProps> = ({
  steps,
  activeWakeTime,
  onUpdateSteps,
  onSelectPreset,
}) => {
  const [newTitle, setNewTitle] = useState('');
  const [newDuration, setNewDuration] = useState(10);
  const [newCategory, setNewCategory] = useState<RoutineStep['category']>('health');

  // Interactive Live Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(
    (steps[0]?.durationMinutes || 5) * 60
  );

  const totalMinutes = steps.reduce((acc, s) => acc + s.durationMinutes, 0);
  const completedCount = steps.filter((s) => s.completed).length;

  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          soundEngine.playStepCompleteChime();
          // Mark current step completed and advance
          const updated = steps.map((s, idx) =>
            idx === activeStepIndex ? { ...s, completed: true } : s
          );
          onUpdateSteps(updated);

          if (activeStepIndex + 1 < steps.length) {
            const nextIdx = activeStepIndex + 1;
            setActiveStepIndex(nextIdx);
            return steps[nextIdx].durationMinutes * 60;
          } else {
            setIsPlaying(false);
            return 0;
          }
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isPlaying, activeStepIndex, steps, onUpdateSteps]);

  // Calculate exact timeline timestamp for each step starting from activeWakeTime
  const getStepTimeRange = (index: number) => {
    const [startH, startM] = activeWakeTime.split(':').map(Number);
    let offsetMinutes = 0;
    for (let i = 0; i < index; i++) {
      offsetMinutes += steps[i].durationMinutes;
    }
    const stepStart = new Date();
    stepStart.setHours(startH || 6, (startM || 0) + offsetMinutes, 0, 0);

    const stepEnd = new Date(
      stepStart.getTime() + steps[index].durationMinutes * 60000
    );

    const fmt = (d: Date) =>
      `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    return `${fmt(stepStart)} - ${fmt(stepEnd)}`;
  };

  const handleToggleComplete = (id: string) => {
    const updated = steps.map((s) =>
      s.id === id ? { ...s, completed: !s.completed } : s
    );
    onUpdateSteps(updated);
  };

  const handleAddStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const newStep: RoutineStep = {
      id: `custom-${Date.now()}`,
      title: newTitle.trim(),
      durationMinutes: Math.max(1, Math.min(120, Number(newDuration) || 5)),
      category: newCategory,
      description: 'عادة صباحية مخصصة ضمن جدولك اليومي.',
      completed: false,
    };
    onUpdateSteps([...steps, newStep]);
    setNewTitle('');
  };

  const handleDeleteStep = (id: string) => {
    onUpdateSteps(steps.filter((s) => s.id !== id));
  };

  const handleMoveStep = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= steps.length) return;
    const copy = [...steps];
    const temp = copy[index];
    copy[index] = copy[targetIndex];
    copy[targetIndex] = temp;
    onUpdateSteps(copy);
  };

  const startStepTimer = (index: number) => {
    setActiveStepIndex(index);
    setSecondsLeft(steps[index].durationMinutes * 60);
    setIsPlaying(true);
  };

  const formatTimer = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const categoryLabel = (cat: RoutineStep['category']) => {
    switch (cat) {
      case 'health':
        return 'صحة وحيوية';
      case 'mindfulness':
        return 'صفاء ذهني';
      case 'focus':
        return 'تركيز عميق';
      case 'planning':
        return 'تخطيط اليوم';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Preset Selector */}
      <div className="rounded-2xl border border-slate-800/80 bg-[#131B2E] p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div>
            <h2 className="text-xl font-bold text-white">
              مُنظّم الروتين الصباحي الذكي (مرتبط بموعد الاستيقاظ{' '}
              <span className="font-mono tabular-nums text-amber-400">
                {activeWakeTime}
              </span>
              )
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              يبدأ جدولك الصباحي تلقائياً فور إيقاف المنبه الذكي لضمان تسلسل العادات بدون تشتت.
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-300 shrink-0">
            <span>إجمالي المدة: {totalMinutes} دقيقة</span>
            <span aria-hidden="true">·</span>
            <span className="text-emerald-400 font-medium">
              أُنجز {completedCount} من {steps.length}
            </span>
          </div>
        </div>

        {/* Ready-made Curated Presets */}
        <div className="space-y-2.5">
          <p className="text-xs font-medium text-slate-400">
            اختر قالباً جاهزاً أو خصص خطواتك بالأسفل:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {ROUTINE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => {
                  onSelectPreset(preset);
                  setActiveStepIndex(0);
                  setSecondsLeft((preset.steps[0]?.durationMinutes || 5) * 60);
                  setIsPlaying(false);
                }}
                className="text-right p-4 rounded-xl border border-slate-800 bg-slate-900/60 hover:border-amber-500/50 hover:bg-slate-900 transition-colors cursor-pointer group"
              >
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span>{preset.totalMinutes} دقيقة</span>
                  <span aria-hidden="true">·</span>
                  <span className="text-amber-400 group-hover:underline">
                    تفعيل القالب
                  </span>
                </div>
                <h3 className="text-sm font-bold text-white">{preset.name}</h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                  {preset.benefitText}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Live Interactive Routine Player Bar */}
        {steps.length > 0 && (
          <div className="rounded-xl bg-slate-950/90 border border-amber-500/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-amber-400">
                <Sparkles className="w-3.5 h-3.5" />
                <span>المؤقت التفاعلي للعادة الحالية ({activeStepIndex + 1}/{steps.length})</span>
              </div>
              <p className="text-base font-bold text-white">
                {steps[activeStepIndex]?.title || steps[0].title}
              </p>
            </div>

            <div className="flex items-center gap-3 self-end sm:self-center">
              <div className="font-mono tabular-nums text-2xl font-bold text-amber-400 bg-slate-900 px-3.5 py-1.5 rounded-lg border border-slate-800">
                {formatTimer(secondsLeft)}
              </div>

              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-4 h-4" />
                    <span>إيقاف مؤقت</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    <span>بدء المؤقت</span>
                  </>
                )}
              </button>

              <button
                onClick={() => {
                  setIsPlaying(false);
                  setSecondsLeft(
                    (steps[activeStepIndex]?.durationMinutes || 5) * 60
                  );
                }}
                title="إعادة ضبط مؤقت الخطوة"
                className="min-h-[44px] min-w-[44px] rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step-by-Step Timeline List */}
        <div className="divide-y divide-slate-800/70">
          {steps.map((step, idx) => {
            const isCurrent = idx === activeStepIndex;
            return (
              <div
                key={step.id}
                className={`py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                  isCurrent ? 'bg-amber-500/5 -mx-3 px-3 rounded-xl' : ''
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <button
                    onClick={() => handleToggleComplete(step.id)}
                    className={`mt-0.5 min-h-[36px] min-w-[36px] rounded-lg flex items-center justify-center border transition-colors cursor-pointer ${
                      step.completed
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-amber-400'
                    }`}
                    title="تحديد كمكتمل"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                  </button>

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span className="font-mono tabular-nums text-amber-300 font-medium">
                        {getStepTimeRange(idx)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{step.durationMinutes} دقائق</span>
                      <span aria-hidden="true">·</span>
                      <span>{categoryLabel(step.category)}</span>
                    </div>

                    <h4
                      className={`text-sm font-semibold ${
                        step.completed
                          ? 'line-through text-slate-500'
                          : 'text-white'
                      }`}
                    >
                      {step.title}
                    </h4>
                    <p className="text-xs text-slate-400">{step.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                  <button
                    onClick={() => startStepTimer(idx)}
                    className="min-h-[38px] px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-amber-300 font-medium flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>تشغيل</span>
                  </button>

                  <button
                    onClick={() => handleMoveStep(idx, 'up')}
                    disabled={idx === 0}
                    className="min-h-[38px] min-w-[38px] rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-slate-400 flex items-center justify-center cursor-pointer"
                    title="تحريك لأعلى"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleMoveStep(idx, 'down')}
                    disabled={idx === steps.length - 1}
                    className="min-h-[38px] min-w-[38px] rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-slate-400 flex items-center justify-center cursor-pointer"
                    title="تحريك لأسفل"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleDeleteStep(step.id)}
                    className="min-h-[38px] min-w-[38px] rounded-lg bg-slate-900 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 flex items-center justify-center transition-colors cursor-pointer"
                    title="حذف الخطوة"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add Custom Routine Step Form */}
        <form
          onSubmit={handleAddStep}
          className="pt-4 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-12 gap-3"
        >
          <div className="sm:col-span-6">
            <input
              type="text"
              placeholder="أضف عادة صباحية جديدة (مثال: قراءة 5 صفحات، تمارين تنفس...)"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full min-h-[44px] bg-slate-900 border border-slate-800 rounded-xl px-3.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="sm:col-span-2">
            <div className="relative flex items-center">
              <input
                type="number"
                min={1}
                max={90}
                value={newDuration}
                onChange={(e) => setNewDuration(Number(e.target.value))}
                className="w-full min-h-[44px] font-mono tabular-nums bg-slate-900 border border-slate-800 rounded-xl px-3 text-sm text-white focus:outline-none focus:border-amber-400"
              />
              <span className="absolute left-3 text-xs text-slate-400 pointer-events-none">
                دقيقة
              </span>
            </div>
          </div>

          <div className="sm:col-span-2">
            <select
              value={newCategory}
              onChange={(e) =>
                setNewCategory(e.target.value as RoutineStep['category'])
              }
              className="w-full min-h-[44px] bg-slate-900 border border-slate-800 rounded-xl px-3 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
            >
              <option value="health">صحة وحيوية</option>
              <option value="mindfulness">صفاء ذهني</option>
              <option value="focus">تركيز عميق</option>
              <option value="planning">تخطيط اليوم</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <button
              type="submit"
              className="w-full min-h-[44px] rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة للروتين</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
