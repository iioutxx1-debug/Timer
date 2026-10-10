import React, { useState, useMemo } from 'react';
import { Moon, Sun, Sparkles, Check, ArrowLeft } from 'lucide-react';

interface SleepCycleCalculatorProps {
  onApplyRecommendedTime: (time24: string, smartWindow: number) => void;
}

export const SleepCycleCalculator: React.FC<SleepCycleCalculatorProps> = ({
  onApplyRecommendedTime,
}) => {
  const [mode, setMode] = useState<'sleep_now' | 'wake_at'>('sleep_now');
  const [targetTime, setTargetTime] = useState('06:30');
  const [appliedIndex, setAppliedIndex] = useState<number | null>(null);

  const recommendations = useMemo(() => {
    // Average human takes ~14 minutes to fall asleep, each sleep cycle is 90 minutes
    const FALL_ASLEEP_MINS = 14;
    const cycles = [
      { count: 6, label: '6 دورات نوم (نوم مثالي مشبع)', hoursText: '9 ساعات', quality: 'طاقة قصوى' },
      { count: 5, label: '5 دورات نوم (المعدل الذهبي الموصى به)', hoursText: '7.5 ساعات', quality: 'مثالي جداً' },
      { count: 4, label: '4 دورات نوم (الحد الكافي للنشاط)', hoursText: '6 ساعات', quality: 'جيد ومتوازن' },
    ];

    if (mode === 'sleep_now') {
      const now = new Date();
      return cycles.map((c) => {
        const wakeDate = new Date(
          now.getTime() + (FALL_ASLEEP_MINS + c.count * 90) * 60000
        );
        const h = String(wakeDate.getHours()).padStart(2, '0');
        const m = String(wakeDate.getMinutes()).padStart(2, '0');
        return {
          ...c,
          resultTime: `${h}:${m}`,
          actionNote: 'اضبط المنبه على هذا الوقت',
        };
      });
    } else {
      const [wakeH, wakeM] = targetTime.split(':').map(Number);
      const wakeDate = new Date();
      wakeDate.setHours(wakeH || 6, wakeM || 30, 0, 0);

      return cycles.map((c) => {
        const bedDate = new Date(
          wakeDate.getTime() - (FALL_ASLEEP_MINS + c.count * 90) * 60000
        );
        const h = String(bedDate.getHours()).padStart(2, '0');
        const m = String(bedDate.getMinutes()).padStart(2, '0');
        return {
          ...c,
          resultTime: `${h}:${m}`,
          actionNote: `نم الساعة ${h}:${m} واستيقظ ${targetTime}`,
        };
      });
    }
  }, [mode, targetTime]);

  const handleSelectOption = (idx: number, resultTime: string) => {
    const alarmTimeToSet = mode === 'sleep_now' ? resultTime : targetTime;
    onApplyRecommendedTime(alarmTimeToSet, 20);
    setAppliedIndex(idx);
    setTimeout(() => setAppliedIndex(null), 2500);
  };

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-[#131B2E] p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Moon className="w-5 h-5 text-amber-400" />
            <span>حاسبة دورات النوم الذكية (90 دقيقة)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            استيقظ في نهاية دورة النوم الخفيف لتجنب الصداع والخمول الصباحي (يشمل 14 دقيقة للاستغراق في النوم).
          </p>
        </div>

        {/* Mode Segmented Control */}
        <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800 self-start">
          <button
            onClick={() => setMode('sleep_now')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              mode === 'sleep_now'
                ? 'bg-amber-500 text-slate-950 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            سأنام الآن
          </button>
          <button
            onClick={() => setMode('wake_at')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              mode === 'wake_at'
                ? 'bg-amber-500 text-slate-950 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            أريد الاستيقاظ في وقت محدد
          </button>
        </div>
      </div>

      {mode === 'wake_at' && (
        <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800/60">
          <label htmlFor="wake-target-input" className="text-sm text-slate-200 font-medium">
            حدد موعد الاستيقاظ المطلوب غداً:
          </label>
          <input
            id="wake-target-input"
            type="time"
            value={targetTime}
            onChange={(e) => setTargetTime(e.target.value)}
            className="font-mono tabular-nums text-lg font-bold bg-slate-950 text-amber-400 border border-slate-700 rounded-lg px-3.5 py-1.5 focus:outline-none focus:border-amber-400"
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {recommendations.map((rec, idx) => {
          const isApplied = appliedIndex === idx;
          return (
            <div
              key={rec.count}
              className="flex flex-col justify-between p-4 rounded-xl bg-slate-900/70 border border-slate-800/80 hover:border-amber-500/40 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span>{rec.hoursText}</span>
                  <span aria-hidden="true">·</span>
                  <span className="text-teal-400 font-medium">{rec.quality}</span>
                </div>

                <div className="flex items-baseline gap-2 my-1">
                  <span className="font-mono tabular-nums text-2xl font-bold text-white">
                    {rec.resultTime}
                  </span>
                  <span className="text-xs text-slate-400">
                    {mode === 'sleep_now' ? 'موعد الاستيقاظ' : 'موعد النوم'}
                  </span>
                </div>

                <p className="text-xs text-slate-300 mt-1">{rec.label}</p>
              </div>

              <button
                onClick={() => handleSelectOption(idx, rec.resultTime)}
                className={`mt-4 min-h-[40px] w-full px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                  isApplied
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-200'
                }`}
              >
                {isApplied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>تم ضبط المنبه الذكي!</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>
                      {mode === 'sleep_now'
                        ? `ضبط منبه ${rec.resultTime}`
                        : `اعتماد منبه ${targetTime}`}
                    </span>
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
