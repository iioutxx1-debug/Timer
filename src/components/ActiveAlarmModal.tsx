import React, { useState, useEffect, useMemo } from 'react';
import { AlarmItem } from '../types';
import { soundEngine } from '../utils/soundEngine';
import { Sun, Volume2, CheckCircle2, Sparkles, Clock } from 'lucide-react';

interface ActiveAlarmModalProps {
  alarm: AlarmItem | null;
  onDismissAndStartRoutine: (alarm: AlarmItem) => void;
  onSnooze: (alarm: AlarmItem) => void;
}

const MORNING_INTENTIONS = [
  'اليوم سأركز على أهم أولوياتي بهدوء وإنجاز',
  'صباح جديد يحمل طاقة عالية وفرصاً مميزة',
  'أختار اليقظة والنشاط والامتنان في هذا الصباح',
];

export const ActiveAlarmModal: React.FC<ActiveAlarmModalProps> = ({
  alarm,
  onDismissAndStartRoutine,
  onSnooze,
}) => {
  // Math challenge state
  const [mathAnswer, setMathAnswer] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Intention challenge state
  const [typedIntention, setTypedIntention] = useState('');

  // Memory pattern challenge state
  const [memoryTarget, setMemoryTarget] = useState<number[]>([0, 4, 8]);
  const [memorySelected, setMemorySelected] = useState<number[]>([]);

  const mathProblem = useMemo(() => {
    const a = Math.floor(Math.random() * 14) + 12; // 12..25
    const b = Math.floor(Math.random() * 9) + 6; // 6..14
    return {
      question: `${a} + ${b}`,
      solution: a + b,
    };
  }, [alarm]);

  const targetIntention = useMemo(() => {
    return MORNING_INTENTIONS[Math.floor(Math.random() * MORNING_INTENTIONS.length)];
  }, [alarm]);

  useEffect(() => {
    if (!alarm) {
      soundEngine.stop();
      return;
    }

    setMathAnswer('');
    setTypedIntention('');
    setErrorMsg('');
    setMemorySelected([]);
    // Generate 3 distinct random grid cells out of 9
    const indices: number[] = [];
    while (indices.length < 3) {
      const r = Math.floor(Math.random() * 9);
      if (!indices.includes(r)) indices.push(r);
    }
    setMemoryTarget(indices);

    // Start synthesizer alarm with gradual fade
    soundEngine.startAlarmLoop(alarm.sound, alarm.gradualFadeSeconds);

    return () => {
      soundEngine.stop();
    };
  }, [alarm]);

  if (!alarm) return null;

  const handleVerifyChallenge = (e: React.FormEvent) => {
    e.preventDefault();
    if (alarm.challenge === 'math') {
      if (Number(mathAnswer.trim()) === mathProblem.solution) {
        soundEngine.stop();
        onDismissAndStartRoutine(alarm);
      } else {
        setErrorMsg('الإجابة غير صحيحة، حاول مرة أخرى لتنشيط ذهنك!');
      }
    } else if (alarm.challenge === 'intention') {
      if (typedIntention.trim().length >= 8) {
        soundEngine.stop();
        onDismissAndStartRoutine(alarm);
      } else {
        setErrorMsg('يرجى كتابة عبارة النية الصباحية أو الضغط على زر التأكيد السريع.');
      }
    } else {
      soundEngine.stop();
      onDismissAndStartRoutine(alarm);
    }
  };

  const handleMemoryTileClick = (idx: number) => {
    if (memorySelected.includes(idx)) return;
    if (!memoryTarget.includes(idx)) {
      setErrorMsg('مربع غير مطابق! ركّز على المربعات الذهبية.');
      setMemorySelected([]);
      return;
    }
    const next = [...memorySelected, idx];
    setMemorySelected(next);
    setErrorMsg('');
    if (next.length === memoryTarget.length) {
      soundEngine.stop();
      onDismissAndStartRoutine(alarm);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4">
      <div className="relative w-full max-w-lg rounded-3xl border border-amber-500/40 bg-gradient-to-b from-[#1B243B] to-[#0F1524] p-6 sm:p-8 shadow-2xl text-center space-y-6 overflow-hidden">
        {/* Ambient Sunrise Glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-56 w-56 rounded-full bg-amber-500/25 blur-3xl animate-pulse-slow"
        />

        <div className="relative z-10 space-y-2">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
            <Sun className="w-8 h-8 animate-spin" style={{ animationDuration: '14s' }} />
          </div>

          <div className="flex items-center justify-center gap-2 text-xs text-amber-300 font-medium pt-2">
            <Volume2 className="w-4 h-4" />
            <span>تدرج صوتي نشط ({alarm.gradualFadeSeconds} ثانية)</span>
            <span aria-hidden="true">·</span>
            <span>نافذة ذكية ({alarm.smartWindowMinutes} د)</span>
          </div>

          <div className="font-mono tabular-nums text-5xl sm:text-6xl font-bold text-white tracking-tight py-1">
            {alarm.time}
          </div>

          <h2 className="text-xl font-bold text-amber-100">{alarm.label}</h2>
        </div>

        {/* Challenge Interactive Area */}
        <div className="relative z-10 rounded-2xl bg-slate-900/90 border border-slate-800 p-5 text-right space-y-4">
          {alarm.challenge === 'math' && (
            <form onSubmit={handleVerifyChallenge} className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-400">
                  تحدي تنشيط الذهن الصباحي
                </span>
                <span className="text-xs text-slate-400">احسب الناتج لإيقاف الرنين</span>
              </div>

              <div
                dir="ltr"
                className="font-mono tabular-nums text-3xl font-bold text-center py-3 rounded-xl bg-slate-950 border border-slate-800 text-white"
              >
                {mathProblem.question} = ?
              </div>

              <input
                type="number"
                autoFocus
                placeholder="أدخل الناتج هنا..."
                value={mathAnswer}
                onChange={(e) => {
                  setMathAnswer(e.target.value);
                  setErrorMsg('');
                }}
                className="w-full min-h-[48px] text-center font-mono tabular-nums text-xl font-bold bg-slate-950 border border-slate-700 rounded-xl text-amber-400 focus:outline-none focus:border-amber-400"
              />

              {errorMsg && <p className="text-xs text-rose-400 text-center">{errorMsg}</p>}

              <button
                type="submit"
                className="w-full min-h-[48px] rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>تأكيد الإجابة وبدء روتين الصباح</span>
              </button>
            </form>
          )}

          {alarm.challenge === 'intention' && (
            <form onSubmit={handleVerifyChallenge} className="space-y-4">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-amber-400">
                  تأكيد نية الصباح الواعية
                </span>
                <p className="text-xs text-slate-300">
                  اكتب العبارة التالية أو اضغط عليها لتثبيت تركيزك الصباحي:
                </p>
              </div>

              <div
                onClick={() => setTypedIntention(targetIntention)}
                className="p-3.5 rounded-xl bg-slate-950 border border-amber-500/30 text-sm font-medium text-amber-200 cursor-pointer hover:bg-slate-900 transition-colors text-center"
              >
                "{targetIntention}"
                <span className="block text-[11px] text-slate-400 mt-1">
                  (اضغط هنا لنسخ التأكيد سريعاً)
                </span>
              </div>

              <input
                type="text"
                value={typedIntention}
                onChange={(e) => {
                  setTypedIntention(e.target.value);
                  setErrorMsg('');
                }}
                placeholder="اكتب نيتك الصباحية هنا..."
                className="w-full min-h-[46px] bg-slate-950 border border-slate-700 rounded-xl px-4 text-sm text-white focus:outline-none focus:border-amber-400"
              />

              {errorMsg && <p className="text-xs text-rose-400">{errorMsg}</p>}

              <button
                type="submit"
                className="w-full min-h-[48px] rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Sparkles className="w-5 h-5" />
                <span>إيقاف المنبه والانطلاق للروتين</span>
              </button>
            </form>
          )}

          {alarm.challenge === 'memory' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-400">
                  تحدي الذاكرة البصرية
                </span>
                <span className="text-xs text-slate-400">
                  اضغط على المربعات الـ 3 المحددة باللون الذهبي
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2.5 max-w-[220px] mx-auto py-2">
                {Array.from({ length: 9 }).map((_, idx) => {
                  const isTarget = memoryTarget.includes(idx);
                  const isPicked = memorySelected.includes(idx);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleMemoryTileClick(idx)}
                      className={`h-14 rounded-xl border transition-all cursor-pointer ${
                        isPicked
                          ? 'bg-emerald-500 border-emerald-400 scale-95'
                          : isTarget
                          ? 'bg-amber-500/30 border-amber-400 hover:bg-amber-500/50'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    />
                  );
                })}
              </div>

              {errorMsg && <p className="text-xs text-rose-400 text-center">{errorMsg}</p>}
            </div>
          )}

          {alarm.challenge === 'none' && (
            <button
              onClick={() => {
                soundEngine.stop();
                onDismissAndStartRoutine(alarm);
              }}
              className="w-full min-h-[48px] rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>إيقاف المنبه وبدء روتين الصباح</span>
            </button>
          )}
        </div>

        {/* Snooze Option */}
        <div className="relative z-10 flex items-center justify-center">
          <button
            type="button"
            onClick={() => {
              soundEngine.stop();
              onSnooze(alarm);
            }}
            className="min-h-[40px] px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>غفوة ذكية قصيرة (5 دقائق)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
