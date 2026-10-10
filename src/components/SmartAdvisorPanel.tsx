import React, { useState } from 'react';
import { SmartSuggestion, RoutineStep } from '../types';
import { Sparkles, Check, ArrowLeft, Compass, Sun, ShieldCheck } from 'lucide-react';

interface SmartAdvisorPanelProps {
  suggestions: SmartSuggestion[];
  onApplySuggestion: (suggestion: SmartSuggestion) => void;
  onGenerateCustomPlan: (goal: string, wakeTime: string, minutesAvailable: number) => void;
}

export const SmartAdvisorPanel: React.FC<SmartAdvisorPanelProps> = ({
  suggestions,
  onApplySuggestion,
  onGenerateCustomPlan,
}) => {
  const [selectedGoal, setSelectedGoal] = useState<'energy' | 'focus' | 'calm'>('energy');
  const [preferredWakeTime, setPreferredWakeTime] = useState('06:15');
  const [availableMinutes, setAvailableMinutes] = useState(30);
  const [planAppliedMessage, setPlanAppliedMessage] = useState(false);

  const handleBuildSmartPlan = (e: React.FormEvent) => {
    e.preventDefault();
    onGenerateCustomPlan(selectedGoal, preferredWakeTime, availableMinutes);
    setPlanAppliedMessage(true);
    setTimeout(() => setPlanAppliedMessage(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Interactive Smart Morning Architect (Interactive Generator) */}
      <div className="rounded-2xl border border-slate-800/80 bg-[#131B2E] p-6 space-y-5">
        <div className="border-b border-slate-800/80 pb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Compass className="w-5 h-5 text-amber-400" />
            <span>مُصمم الاستيقاظ الذكي المخصص (اقتراحاتنا لتطوير صباحك)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            اختر هدفك الصباحي والوقت المتاح لديك، وسيقوم النظام بضبط المنبه الذكي مع النافذة المثالية وبناء جدول روتين صباحي متكامل بضغطة واحدة.
          </p>
        </div>

        <form onSubmit={handleBuildSmartPlan} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-5 space-y-2">
            <label className="block text-xs font-medium text-slate-300">
              ما هو تركيزك الأساسي في الصباح؟
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSelectedGoal('energy')}
                className={`min-h-[42px] px-3 py-2 rounded-xl text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                  selectedGoal === 'energy'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-semibold'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                طاقة وحيوية
              </button>
              <button
                type="button"
                onClick={() => setSelectedGoal('focus')}
                className={`min-h-[42px] px-3 py-2 rounded-xl text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                  selectedGoal === 'focus'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-semibold'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                إنجاز وتركيز
              </button>
              <button
                type="button"
                onClick={() => setSelectedGoal('calm')}
                className={`min-h-[42px] px-3 py-2 rounded-xl text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                  selectedGoal === 'calm'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-semibold'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                هدوء وصفاء
              </button>
            </div>
          </div>

          <div className="md:col-span-3 space-y-2">
            <label htmlFor="advisor-wake-time" className="block text-xs font-medium text-slate-300">
              وقت الاستيقاظ المستهدف
            </label>
            <input
              id="advisor-wake-time"
              type="time"
              value={preferredWakeTime}
              onChange={(e) => setPreferredWakeTime(e.target.value)}
              className="w-full min-h-[42px] font-mono tabular-nums bg-slate-900 border border-slate-800 rounded-xl px-3.5 text-sm text-amber-400 font-bold focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="md:col-span-2 space-y-2">
            <label htmlFor="advisor-duration" className="block text-xs font-medium text-slate-300">
              مدة الروتين المتاحة
            </label>
            <select
              id="advisor-duration"
              value={availableMinutes}
              onChange={(e) => setAvailableMinutes(Number(e.target.value))}
              className="w-full min-h-[42px] bg-slate-900 border border-slate-800 rounded-xl px-3 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
            >
              <option value={15}>15 دقيقة (سريع)</option>
              <option value={30}>30 دقيقة (متوازن)</option>
              <option value={45}>45 دقيقة (شامل)</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              className="w-full min-h-[42px] px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Sparkles className="w-4 h-4" />
              <span>توليد الخطة</span>
            </button>
          </div>
        </form>

        {planAppliedMessage && (
          <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>
              تم تحديث المنبه الذكي على الساعة{' '}
              <strong className="font-mono tabular-nums">{preferredWakeTime}</strong> مع نافذة استيقاظ ذكية وتخصيص خطوات الروتين الصباحي بنجاح!
            </span>
          </div>
        )}
      </div>

      {/* Curated Smart Suggestions List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {suggestions.map((sug) => (
          <div
            key={sug.id}
            className="flex flex-col justify-between rounded-2xl border border-slate-800/80 bg-[#131B2E] p-6 hover:border-slate-700 transition-colors"
          >
            <div className="space-y-2.5">
              {/* Unboxed Metadata with typographic separators */}
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="text-amber-400 font-medium">{sug.category}</span>
                <span aria-hidden="true">·</span>
                <span className="text-teal-400">{sug.impactMetric}</span>
              </div>

              <h3 className="text-base font-bold text-white">{sug.title}</h3>
              <p className="text-xs text-slate-300 leading-relaxed">{sug.description}</p>
            </div>

            <div className="pt-5 mt-4 border-t border-slate-800/70 flex items-center justify-between">
              <button
                onClick={() => onApplySuggestion(sug)}
                className={`min-h-[42px] w-full px-4 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                  sug.applied
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-100'
                }`}
              >
                {sug.applied ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>تم تطبيق الاقتراح بنجاح</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>{sug.actionLabel}</span>
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Educational Science Summary Strip */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-white">
              كيف يعمل التنبيه الذكي لتنظيم روتين الصباح؟
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              يجمع التطبيق بين 3 آليات مترابطة: (1) نافذة الاستيقاظ المتدرج قبل الموعد بـ 20 دقيقة لكسر خمول النوم، (2) تحدي تنشيط القشرة الجبهية للدماغ لمنع العودة للنوم، (3) التشغيل التلقائي الفوري لمؤقت العادات الصباحية فور إغلاق المنبه.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
