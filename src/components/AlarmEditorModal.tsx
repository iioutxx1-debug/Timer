import React, { useState, useEffect } from 'react';
import { AlarmItem, SoundType, ChallengeType } from '../types';
import { DAY_NAMES, SOUND_OPTIONS, CHALLENGE_OPTIONS, ROUTINE_PRESETS } from '../data/presets';
import { soundEngine } from '../utils/soundEngine';
import { X, Volume2, Sparkles, Check } from 'lucide-react';

interface AlarmEditorModalProps {
  isOpen: boolean;
  initialAlarm: AlarmItem | null;
  onClose: () => void;
  onSave: (alarm: AlarmItem) => void;
}

export const AlarmEditorModal: React.FC<AlarmEditorModalProps> = ({
  isOpen,
  initialAlarm,
  onClose,
  onSave,
}) => {
  const [time, setTime] = useState('06:30');
  const [label, setLabel] = useState('منبه الصباح الذكي');
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4]);
  const [smartWindowMinutes, setSmartWindowMinutes] = useState(20);
  const [gradualFadeSeconds, setGradualFadeSeconds] = useState(60);
  const [sound, setSound] = useState<SoundType>('dawn_chimes');
  const [challenge, setChallenge] = useState<ChallengeType>('math');
  const [linkedRoutinePresetId, setLinkedRoutinePresetId] = useState('energized_45');
  const [autoLaunchRoutine, setAutoLaunchRoutine] = useState(true);

  useEffect(() => {
    if (initialAlarm) {
      setTime(initialAlarm.time);
      setLabel(initialAlarm.label);
      setDays(initialAlarm.days);
      setSmartWindowMinutes(initialAlarm.smartWindowMinutes);
      setGradualFadeSeconds(initialAlarm.gradualFadeSeconds);
      setSound(initialAlarm.sound);
      setChallenge(initialAlarm.challenge);
      setLinkedRoutinePresetId(initialAlarm.linkedRoutinePresetId);
      setAutoLaunchRoutine(initialAlarm.autoLaunchRoutine);
    } else {
      setTime('06:30');
      setLabel('منبه النشاط الصباحي');
      setDays([0, 1, 2, 3, 4]);
      setSmartWindowMinutes(20);
      setGradualFadeSeconds(60);
      setSound('dawn_chimes');
      setChallenge('math');
      setLinkedRoutinePresetId('energized_45');
      setAutoLaunchRoutine(true);
    }
  }, [initialAlarm, isOpen]);

  if (!isOpen) return null;

  const toggleDay = (dayIdx: number) => {
    setDays((prev) =>
      prev.includes(dayIdx) ? prev.filter((d) => d !== dayIdx) : [...prev, dayIdx].sort()
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    soundEngine.stop();
    onSave({
      id: initialAlarm ? initialAlarm.id : `alarm-${Date.now()}`,
      time,
      label: label.trim() || 'منبه الصباح',
      days,
      enabled: true,
      smartWindowMinutes,
      gradualFadeSeconds,
      sound,
      challenge,
      linkedRoutinePresetId,
      autoLaunchRoutine,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-xl rounded-2xl border border-slate-800 bg-[#131B2E] p-6 shadow-2xl my-8">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
          <h3 className="text-lg font-bold text-white">
            {initialAlarm ? 'تعديل إعدادات المنبه الذكي' : 'إضافة منبه ذكي جديد'}
          </h3>
          <button
            type="button"
            onClick={() => {
              soundEngine.stop();
              onClose();
            }}
            className="min-h-[40px] min-w-[40px] rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Time and Label Row */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
            <div className="sm:col-span-5">
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                وقت الاستيقاظ
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
                className="w-full min-h-[48px] font-mono tabular-nums text-2xl font-bold bg-slate-950 border border-slate-700 rounded-xl px-4 text-amber-400 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="sm:col-span-7">
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                عنوان المنبه والهدف الصباحي
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="مثال: استيقاظ الفجر والرياضة"
                className="w-full min-h-[48px] bg-slate-950 border border-slate-700 rounded-xl px-4 text-sm text-white focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          {/* Days Selector */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">
              أيام التكرار الأسبوعية
            </label>
            <div className="grid grid-cols-7 gap-1.5">
              {DAY_NAMES.map((d) => {
                const active = days.includes(d.index);
                return (
                  <button
                    key={d.index}
                    type="button"
                    onClick={() => toggleDay(d.index)}
                    className={`min-h-[40px] rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                      active
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    {d.short}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Smart Wake-Up Window & Gradual Volume */}
          <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-teal-400">
              <Sparkles className="w-4 h-4" />
              <span>إعدادات الإيقاظ الذكي والتدرج الصوتي</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-300 mb-1.5">
                  نافذة الاستيقاظ الذكي (قبل الموعد)
                </label>
                <select
                  value={smartWindowMinutes}
                  onChange={(e) => setSmartWindowMinutes(Number(e.target.value))}
                  className="w-full min-h-[42px] bg-slate-950 border border-slate-800 rounded-xl px-3 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                >
                  <option value={0}>إيقاف (رنين في الوقت المحدد تماماً)</option>
                  <option value={10}>10 دقائق (تدرج تمهيدي سريع)</option>
                  <option value={20}>20 دقيقة (موصى به لدورات النوم الخفيف)</option>
                  <option value={30}>30 دقيقة (انتقال هادئ جداً)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1.5">
                  مدة التدرج الصوتي (تصاعد الصوت)
                </label>
                <select
                  value={gradualFadeSeconds}
                  onChange={(e) => setGradualFadeSeconds(Number(e.target.value))}
                  className="w-full min-h-[42px] bg-slate-950 border border-slate-800 rounded-xl px-3 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                >
                  <option value={15}>15 ثانية</option>
                  <option value={30}>30 ثانية (متوازن)</option>
                  <option value={60}>60 ثانية (هادئ ولطيف)</option>
                  <option value={120}>دقيقتان (فائق اللطف)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Sound Selection with Live Web Audio Preview */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">
              نغمة التنبيه الصباحي (اضغط للاستماع المباشر)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {SOUND_OPTIONS.map((opt) => {
                const isSelected = sound === opt.id;
                return (
                  <div
                    key={opt.id}
                    onClick={() => {
                      setSound(opt.id);
                      soundEngine.playPreview(opt.id);
                    }}
                    className={`p-3 rounded-xl border cursor-pointer transition-colors flex items-center justify-between ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-500 text-white'
                        : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <p className="text-xs font-bold">{opt.name}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{opt.desc}</p>
                    </div>
                    <Volume2
                      className={`w-4 h-4 shrink-0 ${
                        isSelected ? 'text-amber-400' : 'text-slate-500'
                      }`}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Wake-Up Challenge & Linked Morning Routine */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                تحدي إيقاف المنبه (ضد الغفوة)
              </label>
              <select
                value={challenge}
                onChange={(e) => setChallenge(e.target.value as ChallengeType)}
                className="w-full min-h-[42px] bg-slate-950 border border-slate-800 rounded-xl px-3 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
              >
                {CHALLENGE_OPTIONS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                الروتين الصباحي المرتبط
              </label>
              <select
                value={linkedRoutinePresetId}
                onChange={(e) => setLinkedRoutinePresetId(e.target.value)}
                className="w-full min-h-[42px] bg-slate-950 border border-slate-800 rounded-xl px-3 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
              >
                {ROUTINE_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.totalMinutes} د)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Auto-launch routine checkbox */}
          <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/50 border border-slate-800/80 cursor-pointer">
            <input
              type="checkbox"
              checked={autoLaunchRoutine}
              onChange={(e) => setAutoLaunchRoutine(e.target.checked)}
              className="w-4 h-4 accent-amber-500 rounded"
            />
            <span className="text-xs text-slate-200">
              فتح قائمة مهام الروتين الصباحي تلقائياً فور اجتياز تحدي الاستيقاظ
            </span>
          </label>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => {
                soundEngine.stop();
                onClose();
              }}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-medium cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="min-h-[44px] px-6 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>حفظ المنبه الذكي</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
