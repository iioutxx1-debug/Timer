import React, { useState, useEffect, useMemo } from 'react';
import { AlarmItem } from '../types';
import { Bell, Sparkles, Play, Plus } from 'lucide-react';

interface LiveClockHeroProps {
  alarms: AlarmItem[];
  onTriggerDemoAlarm: (alarm: AlarmItem) => void;
  onOpenNewAlarm: () => void;
}

export const LiveClockHero: React.FC<LiveClockHeroProps> = ({
  alarms,
  onTriggerDemoAlarm,
  onOpenNewAlarm,
}) => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedTime = useMemo(() => {
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    const period = hours >= 12 ? 'م' : 'ص';
    const displayHours = hours % 12 || 12;
    return {
      hm: `${String(displayHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
      sec: String(seconds).padStart(2, '0'),
      period,
    };
  }, [now]);

  const arabicDate = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('ar-SA', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(now);
    } catch {
      return now.toLocaleDateString('ar');
    }
  }, [now]);

  // Calculate the next active alarm and remaining time
  const nextAlarmInfo = useMemo(() => {
    const enabledAlarms = alarms.filter((a) => a.enabled);
    if (enabledAlarms.length === 0) return null;

    let closestAlarm: AlarmItem | null = null;
    let minDiffMs = Infinity;

    enabledAlarms.forEach((alarm) => {
      const [h, m] = alarm.time.split(':').map(Number);
      for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
        const candidate = new Date(now);
        candidate.setDate(now.getDate() + dayOffset);
        candidate.setHours(h, m, 0, 0);

        const candidateDay = candidate.getDay();
        const isDayAllowed = alarm.days.length === 0 || alarm.days.includes(candidateDay);

        if (isDayAllowed && candidate.getTime() > now.getTime()) {
          const diff = candidate.getTime() - now.getTime();
          if (diff < minDiffMs) {
            minDiffMs = diff;
            closestAlarm = alarm;
          }
          break;
        }
      }
    });

    if (!closestAlarm || minDiffMs === Infinity) return null;

    const totalMinutes = Math.floor(minDiffMs / 60000);
    const hoursLeft = Math.floor(totalMinutes / 60);
    const minsLeft = totalMinutes % 60;

    // Smart window start time calculation
    const [alarmH, alarmM] = (closestAlarm as AlarmItem).time.split(':').map(Number);
    const smartStart = new Date();
    smartStart.setHours(alarmH, alarmM - (closestAlarm as AlarmItem).smartWindowMinutes, 0, 0);
    const smartStartStr = `${String(smartStart.getHours()).padStart(2, '0')}:${String(
      smartStart.getMinutes()
    ).padStart(2, '0')}`;

    return {
      alarm: closestAlarm as AlarmItem,
      hoursLeft,
      minsLeft,
      smartStartStr,
    };
  }, [alarms, now]);

  return (
    <section className="relative overflow-hidden rounded-2xl border border-slate-800/80 bg-[#131B2E] p-6 md:p-8">
      {/* Subtle Sunrise Ambient Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl animate-pulse-slow"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-28 -right-28 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl"
      />

      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
        {/* Right side (RTL): Live Digital Clock */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>التوقيت المحلي المباشر</span>
            <span aria-hidden="true">·</span>
            <span>{arabicDate}</span>
          </div>

          <div className="flex items-baseline gap-3">
            <div
              dir="ltr"
              className="font-mono tabular-nums text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight text-white"
            >
              {formattedTime.hm}
              <span className="text-2xl sm:text-3xl text-amber-400/90 ml-1.5 font-medium">
                :{formattedTime.sec}
              </span>
            </div>
            <span className="text-lg sm:text-xl font-semibold text-amber-400">
              {formattedTime.period}
            </span>
          </div>

          {nextAlarmInfo ? (
            <div className="pt-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-200">
                <Bell className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  المنبه القادم: <strong className="text-white">{nextAlarmInfo.alarm.label}</strong>
                </span>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span className="text-amber-300 font-medium">
                  يرن بعد {nextAlarmInfo.hoursLeft > 0 ? `${nextAlarmInfo.hoursLeft} ساعة و ` : ''}
                  {nextAlarmInfo.minsLeft} دقيقة
                </span>
              </div>

              {nextAlarmInfo.alarm.smartWindowMinutes > 0 && (
                <p className="text-xs text-slate-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                  <span>
                    نافذة التنبيه الذكي تبدأ من الساعة{' '}
                    <span className="font-mono tabular-nums text-teal-300">
                      {nextAlarmInfo.smartStartStr}
                    </span>{' '}
                    ({nextAlarmInfo.alarm.smartWindowMinutes} دقيقة قبل الموعد لالتقاط النوم الخفيف)
                  </span>
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-400 pt-1">
              لا توجد منبهات مفعلة حالياً · قم بتفعيل منبه أو إضافة ميقات جديد لبدء روتينك الصباحي.
            </p>
          )}
        </div>

        {/* Left side (RTL): Quick Action Controls */}
        <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
          <button
            onClick={onOpenNewAlarm}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap shadow-lg shadow-amber-500/10"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة منبه ذكي جديد</span>
          </button>

          <button
            onClick={() =>
              onTriggerDemoAlarm(
                nextAlarmInfo?.alarm ||
                  alarms[0] || {
                    id: 'demo',
                    time: '06:00',
                    label: 'تجربة الاستيقاظ الذكي',
                    days: [0, 1, 2, 3, 4],
                    enabled: true,
                    smartWindowMinutes: 20,
                    gradualFadeSeconds: 30,
                    sound: 'dawn_chimes',
                    challenge: 'math',
                    linkedRoutinePresetId: 'energized_45',
                    autoLaunchRoutine: true,
                  }
              )
            }
            className="min-h-[44px] px-5 py-2.5 rounded-xl border border-slate-700 hover:border-amber-500/50 bg-slate-900/70 hover:bg-slate-800/80 text-slate-200 font-medium text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Play className="w-4 h-4 text-amber-400" />
            <span>معاينة رنين المنبه وتحدي الاستيقاظ</span>
          </button>
        </div>
      </div>
    </section>
  );
};
