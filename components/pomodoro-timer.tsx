"use client";
import { apiFetch } from "@/lib/api-client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, Volume2, VolumeX, X } from "lucide-react";
import { formatTime, cn } from "@/lib/utils";

type Settings = {
  focusMinutes: number;
  shortBreakMin: number;
  longBreakMin: number;
  pomosBeforeLong: number;
  autoStartBreak: boolean;
  soundEnabled: boolean;
};

type Phase = "focus" | "short_break" | "long_break";

type Props = {
  settings: Settings;
  activeTodo: { id: string; title: string } | null;
  focusCount: number; // 今日已完成专注数
  onClearActiveTodo: () => void;
  onPomodoroCompleted: (durationMin: number) => void;
};

const SOUND_LABELS: Record<string, string> = {
  rain: "🌧️ 雨声",
  cafe: "☕ 咖啡馆",
  forest: "🌲 森林",
  ocean: "🌊 海浪",
};

// localStorage key：页面刷新后从这里恢复 timer
const TIMER_STATE_KEY = "tomato-timer-state-v1";
type TimerState = {
  phase: Phase;
  // 上次记录时的「剩余秒数」
  remainingAtSave: number;
  // 这次开始/恢复的 timestamp（ms）；paused 时为 null
  startedAt: number | null;
  // 当前阶段的总秒数（用于页面刷新后校验）
  totalAtSave: number;
};

function loadTimerState(): TimerState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(TIMER_STATE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as TimerState;
    if (!s.phase || typeof s.remainingAtSave !== "number") return null;
    return s;
  } catch {
    return null;
  }
}

function saveTimerState(s: TimerState | null) {
  if (typeof window === "undefined") return;
  try {
    if (s === null) {
      localStorage.removeItem(TIMER_STATE_KEY);
    } else {
      localStorage.setItem(TIMER_STATE_KEY, JSON.stringify(s));
    }
  } catch {}
}

/**
 * Web Audio API 合成白噪音 / 环境音
 * 零网络依赖，永远不会失效
 */
function createNoiseSource(audioCtx: AudioContext, type: "rain" | "cafe" | "forest" | "ocean") {
  // 每个环境音用不同采样逻辑，4 秒 loop buffer
  const bufferSize = 4 * audioCtx.sampleRate;
  const buffer = audioCtx.createBuffer(2, bufferSize, audioCtx.sampleRate);
  const sr = audioCtx.sampleRate;

  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    if (type === "rain") {
      // 雨声: 高频白噪底 + 随机雨点 impulse + 偶尔远雷 rumbling
      // 先填 white noise
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.25;
      }
      // 叠加随机雨点 (高幅尖脉冲, 1-2ms 衰减)
      const dropCount = 400 + Math.floor(Math.random() * 200);
      for (let d = 0; d < dropCount; d++) {
        const pos = Math.floor(Math.random() * bufferSize);
        const amp = 0.3 + Math.random() * 0.4;
        const decay = 0.0005 + Math.random() * 0.001;
        for (let k = 0; k < 30; k++) {
          if (pos + k >= bufferSize) break;
          data[pos + k] += (Math.random() * 2 - 1) * amp * Math.exp(-k * decay * sr);
        }
      }
    } else if (type === "cafe") {
      // 咖啡馆: pink noise 暖底噪 + 周期性 "叮" (杯碟) + 模糊人声低频
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        let v = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.12;
        b6 = white * 0.115926;
        // 模糊人声频段 200-500Hz 低频 rumble
        const t = i / sr;
        v += Math.sin(t * 2 * Math.PI * 300) * 0.015 * Math.sin(t * 0.7);
        v += Math.sin(t * 2 * Math.PI * 220) * 0.012;
        data[i] = v;
      }
      // 4-6 个 杯碟叮 (1500-3000Hz sine burst, 30-80ms)
      const dingCount = 4 + Math.floor(Math.random() * 3);
      for (let d = 0; d < dingCount; d++) {
        const pos = Math.floor(Math.random() * (bufferSize - sr / 5));
        const freq = 1500 + Math.random() * 1500;
        const dur = (sr * (0.03 + Math.random() * 0.05)) | 0;
        for (let k = 0; k < dur; k++) {
          const env = Math.exp(-k / (sr * 0.04));
          data[pos + k] += Math.sin((k / sr) * 2 * Math.PI * freq) * 0.25 * env;
        }
      }
    } else if (type === "forest") {
      // 森林: brown noise 风声 (低频调制) + 多只鸟叫 (2-4kHz sine chirp, 随机间隔)
      for (let i = 0; i < bufferSize; i++) {
        const t = i / sr;
        // 慢风 0.3Hz 调制
        const wind = 0.5 + 0.5 * Math.sin(t * 2 * Math.PI * 0.3);
        // 轻随机
        data[i] = (Math.random() * 2 - 1) * 0.18 * wind;
      }
      // 8-12 只鸟叫 (短促 sine chirp 2500-4500Hz, 80-200ms, 带快速 frequency 滑动)
      const birdCount = 8 + Math.floor(Math.random() * 5);
      for (let d = 0; d < birdCount; d++) {
        const pos = Math.floor(Math.random() * (bufferSize - sr / 3));
        const f0 = 2500 + Math.random() * 2000;
        const f1 = f0 + (Math.random() - 0.5) * 1500;
        const dur = (sr * (0.08 + Math.random() * 0.12)) | 0;
        for (let k = 0; k < dur; k++) {
          const env = Math.exp(-k / (sr * 0.05));
          const f = f0 + (f1 - f0) * (k / dur);
          data[pos + k] += Math.sin((k / sr) * 2 * Math.PI * f) * 0.22 * env;
        }
      }
    } else { // ocean
      // 海浪: 12 秒一个浪的 slow LFO + white noise 调制 + 远处泡沫 (高频)
      for (let i = 0; i < bufferSize; i++) {
        const t = i / sr;
        // 12s 周期 (0.083Hz)
        const wave = (Math.sin(t * 2 * Math.PI * 0.083) + 1) / 2;
        // 用 pow 让浪更尖锐 (浪头快起慢落)
        const intensity = Math.pow(wave, 1.8);
        let v = (Math.random() * 2 - 1) * 0.4 * intensity;
        // 远处泡沫高频 (5% 概率)
        if (Math.random() < 0.005) v += (Math.random() * 2 - 1) * 0.2;
        data[i] = v;
      }
    }
  }

  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;

  // 不同声音不同滤波
  const filter = audioCtx.createBiquadFilter();
  if (type === "rain") {
    filter.type = "highpass";
    filter.frequency.value = 600;
  } else if (type === "cafe") {
    filter.type = "lowpass";
    filter.frequency.value = 2500;
  } else if (type === "forest") {
    filter.type = "lowpass";
    filter.frequency.value = 5000;
  } else {
    filter.type = "lowpass";
    filter.frequency.value = 1800;
  }
  filter.Q.value = 0.5;

  // gain
  const gain = audioCtx.createGain();
  gain.gain.value = 0;

  source.connect(filter);
  filter.connect(gain);

  return { source, gain, filter, audioCtx };
}

export function PomodoroTimer({
  settings,
  activeTodo,
  focusCount,
  onClearActiveTodo,
  onPomodoroCompleted,
}: Props) {
  const [phase, setPhase] = useState<Phase>("focus");
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(settings.focusMinutes * 60);
  // sessionStartedTotal: 启动当前 session 时的总秒数（锁定）。
  // 用途：handleComplete 计算 durationMin = sessionStartedTotal / 60
  // （不记新设置的分钟数, 记实际启动时计划的）。
  // progress 不用这个, progress 直接用 totalSeconds() (新 settings),
  // 调设置后 progress 环立即变, 让你看到“设了变了”。
  const [sessionStartedTotal, setSessionStartedTotal] = useState(settings.focusMinutes * 60);
  const [sound, setSound] = useState<"rain" | "cafe" | "forest" | "ocean">("rain");
  const [soundOn, setSoundOn] = useState(settings.soundEnabled);
  const [completedThisSession, setCompletedThisSession] = useState(false);
  const [hydrated, setHydrated] = useState(false); // 避免 SSR / hydration mismatch

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const noiseRef = useRef<{ source: AudioBufferSourceNode; gain: GainNode; ctx: AudioContext } | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalSeconds = useCallback(() => {
    if (phase === "focus") return settings.focusMinutes * 60;
    if (phase === "short_break") return settings.shortBreakMin * 60;
    return settings.longBreakMin * 60;
  }, [phase, settings]);

  // 切 phase 时只重置 remaining/completed/sessionStartedTotal，**不要改 running**
  // 这样手动点「短休/长休」时不会打断正在跑的 timer
  // （自动阶段切换时 handleComplete 已经会 setRunning(false)）
  // 关键：依赖只有 phase，不是 totalSeconds。否则 settings 重新加载时
  // totalSeconds 引用变化会触发 effect，重置正在跑的 timer。
  useEffect(() => {
    const newTotal = totalSeconds();
    setRemaining(newTotal);
    setSessionStartedTotal(newTotal);
    setCompletedThisSession(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // settings 变化时同步 fresh / reset 状态的 remaining。
  // 场景：没在跑番茄时（没打开番茄）调专注时长 → 期望 timer 立刻用新值。
  // 但如果正在跑 或 已跑过部分（remaining != sessionStartedTotal）→ 不动，不打断。
  useEffect(() => {
    if (!hydrated) return;
    if (running) return;
    if (remaining !== sessionStartedTotal) return; // 跑过 / 暂停中有剩余
    const newTotal = totalSeconds();
    if (newTotal !== sessionStartedTotal) {
      setRemaining(newTotal);
      setSessionStartedTotal(newTotal);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, settings.focusMinutes, settings.shortBreakMin, settings.longBreakMin, totalSeconds]);

  // 页面刷新后从 localStorage 恢复 timer 状态
  useEffect(() => {
    const s = loadTimerState();
    if (s) {
      const totalForPhase = s.phase === "focus" ? settings.focusMinutes * 60
        : s.phase === "short_break" ? settings.shortBreakMin * 60
        : settings.longBreakMin * 60;
      // 关键：调设置后 s.totalAtSave 跟 totalForPhase 不一致，
      // 也要用 s.totalAtSave (session 启动时锁的总秒数) 跟 s.remainingAtSave (原剩余)。
      // 不这样调设置后回主页会看到 timer 变成新设置的总秒数（重置）。
      // 如果存的时候 running 且有 startedAt，用现在时间减去当时时间算真正剩余
      if (s.startedAt && s.totalAtSave > 0) {
        const elapsed = Math.floor((Date.now() - s.startedAt) / 1000);
        const realRemaining = Math.max(0, s.remainingAtSave - elapsed);
        setPhase(s.phase);
        setRemaining(realRemaining);
        // 锁住 session 启动时的总时长（调设置后 sessionStartedTotal 不变）
        setSessionStartedTotal(s.totalAtSave);
        setRunning(realRemaining > 0);
        if (realRemaining > 0) {
          saveTimerState({ phase: s.phase, remainingAtSave: realRemaining, startedAt: Date.now(), totalAtSave: s.totalAtSave });
        } else {
          // 已经超期了，清理
          saveTimerState(null);
        }
      } else {
        // paused 状态或 phase 不一致
        setPhase(s.phase);
        // 保留老 session 的 remaining，不动 s.remainingAtSave
        setRemaining(s.remainingAtSave);
        // 锁定老 session total，防止调设置后篡改
        setSessionStartedTotal(s.totalAtSave || totalForPhase);
        setRunning(false);
      }
    }
    setHydrated(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // running/remaining/phase 变化时存 localStorage（hydrated 之前不存避免覆盖）
  // 存的是 sessionStartedTotal（启动时锁定的总秒数），不是 totalSeconds()。
  // 这样调设置后存的不被污染。
  // 注意：不依赖 totalSeconds/settings，避免 settings 变化时重置正在跑的 timer
  useEffect(() => {
    if (!hydrated) return;
    if (running) {
      saveTimerState({ phase, remainingAtSave: remaining, startedAt: Date.now(), totalAtSave: sessionStartedTotal });
    } else {
      // 不跑时也存 remaining 状态，让刷新后能恢复
      saveTimerState({ phase, remainingAtSave: remaining, startedAt: null, totalAtSave: sessionStartedTotal });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, remaining, phase, hydrated]);

  // 滴答
  useEffect(() => {
    if (!running) {
      if (tickRef.current) clearInterval(tickRef.current);
      return;
    }
    tickRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          handleComplete();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  // 通知
  function notify(title: string, body: string) {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "granted") {
      try {
        new Notification(title, { body, icon: "🍅", badge: "🍅" });
      } catch {}
    }
  }

  // 完成
  async function handleComplete() {
    setRunning(false);
    setCompletedThisSession(true);

    // 声音反馈
    if (soundOn) playChime();

    if (phase === "focus") {
      // 写库
      try {
        await apiFetch("/api/pomodoros/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "focus",
            durationMin: Math.round(sessionStartedTotal / 60),
            todoId: activeTodo?.id ?? null,
          }),
        });
        onPomodoroCompleted(settings.focusMinutes);
      } catch (e) {
        console.error("failed to record pomodoro", e);
      }
      notify("🍅 番茄完成", "休息一下吧～");

      // 决定下一个 phase
      const newCount = focusCount + 1;
      const isLong = newCount % settings.pomosBeforeLong === 0;
      const next: Phase = isLong ? "long_break" : "short_break";
      setPhase(next);
      if (settings.autoStartBreak) {
        setTimeout(() => setRunning(true), 800);
      }
    } else {
      notify("✨ 休息结束", "继续开干！");
      setPhase("focus");
      if (settings.autoStartBreak) {
        setTimeout(() => setRunning(true), 800);
      }
    }
  }

  function playChime() {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      // 三和弦提示音: C5 (523Hz) → E5 (659Hz) → G5 (784Hz), 每个 200ms, 总 0.8s
      const notes = [
        { freq: 523.25, delay: 0.00, dur: 0.30 },
        { freq: 659.25, delay: 0.18, dur: 0.30 },
        { freq: 783.99, delay: 0.36, dur: 0.60 },
      ];
      for (const n of notes) {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.connect(g);
        g.connect(audioCtx.destination);
        o.type = "sine";
        o.frequency.value = n.freq;
        const t0 = audioCtx.currentTime + n.delay;
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(0.35, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + n.dur);
        o.start(t0);
        o.stop(t0 + n.dur);
      }
    } catch {}
  }

  // 白噪音（Web Audio API 合成，零网络依赖）
  useEffect(() => {
    // 清理旧噪音
    if (noiseRef.current) {
      try {
        noiseRef.current.source.stop();
      } catch {}
      noiseRef.current.ctx.close().catch(() => {});
      noiseRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (!soundOn) return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      const { source, gain, filter } = createNoiseSource(audioCtx, sound as any);
      // 连接扬声器
      gain.connect(audioCtx.destination);
      // 淡入 (iOS 17 上默认音量太小声会被环境噪音埋, 默认 0.4, 上限 1.0)
      gain.gain.setValueAtTime(0, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.4, audioCtx.currentTime + 0.5);
      source.start();
      // iOS 17 Safari 严格策略: audioCtx 可能创建后自动 suspended, 需要在 user gesture 内 resume
      if (audioCtx.state === "suspended") {
        audioCtx.resume().catch(() => {});
      }
      noiseRef.current = { source, gain, ctx: audioCtx };
    } catch (e) {
      console.error("noise init failed", e);
    }

    return () => {
      if (noiseRef.current) {
        try { noiseRef.current.source.stop(); } catch {}
        noiseRef.current.ctx.close().catch(() => {});
        noiseRef.current = null;
      }
    };
  }, [sound, soundOn]);

  // iOS 17/26: 页面切走后 AudioContext 自动 suspended, 回来后需要 resume
  useEffect(() => {
    if (typeof document === "undefined") return;
    const handler = () => {
      if (document.visibilityState === "visible" && noiseRef.current) {
        const ctx = noiseRef.current.ctx;
        if (ctx.state === "suspended") {
          ctx.resume().catch(() => {});
        }
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  // iOS 26: 告诉系统这是媒体音频, Personalized Volume 才会听控制中心
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    if (!soundOn) {
      navigator.mediaSession.metadata = null;
      return;
    }
    const names: Record<string, string> = {
      rain: "雨声 · 番茄土豆",
      cafe: "咖啡馆 · 番茄土豆",
      forest: "森林 · 番茄土豆",
      ocean: "海浪 · 番茄土豆",
    };
    navigator.mediaSession.metadata = new MediaMetadata({
      title: names[sound] || "环境音乐",
      artist: "番茄土豆专注",
      album: "Pomodoro Ambience",
    });
    return () => {
      navigator.mediaSession.metadata = null;
    };
  }, [sound, soundOn]);

  function handleStart() {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }
    // 恢复 AudioContext（iOS 17 Safari 自动播放策略）
    if (noiseRef.current) {
      const ctx = noiseRef.current.ctx;
      // 多次重试 resume: iOS Safari 第一次 gesture 内 resume 可能失败
      const tryResume = () => {
        if (ctx.state === "suspended") {
          ctx.resume().then(() => {
            // 成功后再确保 source 在跑 (iOS pause 后可能停了)
            try {
              const src = noiseRef.current?.source as any;
              if (src && (src.playbackState === "suspended" || src.playbackState === "finished")) {
                src.start();
              }
            } catch {}
          }).catch(() => {
            // 1s 后重试
            setTimeout(tryResume, 1000);
          });
        }
      };
      tryResume();
    }
    setRunning(true);
  }

  function handleReset() {
    setRunning(false);
    const t = totalSeconds();
    setRemaining(t);
    setSessionStartedTotal(t);
    setCompletedThisSession(false);
    saveTimerState(null);
  }

  // 「放弃/跳过」按钮：
  //   - 专注阶段：放弃本次番茄，剩余时间抹零（不记完成）
  //   - 短/长休阶段：跳过休息，强制切回专注
  function handleAbandon() {
    if (phase === "focus") {
      if (remaining < totalSeconds()) {
        if (!confirm("确定放弃这个番茄？本次专注不会记入完成数。")) return;
      }
      setRunning(false);
      const t = totalSeconds();
      setRemaining(t);
      setSessionStartedTotal(t);
      setCompletedThisSession(false);
      saveTimerState(null);
    } else {
      // 休息阶段：跳过休息，强制切回专注
      // [phase] effect 会自动重置 remaining/completedThisSession
      setRunning(false);
      setPhase("focus");
      saveTimerState(null);
    }
  }

  // progress 用 totalSeconds() (新 settings)，调设置后环立刻变
  const progress = totalSeconds() > 0 ? 1 - remaining / totalSeconds() : 0;
  const R = 120;
  const C = 2 * Math.PI * R;

  const phaseLabel = phase === "focus" ? "专注" : phase === "short_break" ? "短休息" : "长休息";
  const phaseColor =
    phase === "focus"
      ? "text-tomato-600"
      : phase === "short_break"
      ? "text-tomato-500"
      : "text-sky-500";

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100">
      {/* 阶段标签（仅作显示，不提供切换） */}
      <div className="flex justify-center mb-4">
        <div className={cn(
          "px-4 py-1.5 text-sm font-medium rounded-full",
          phase === "focus" ? "bg-tomato-50 text-tomato-600" : "bg-tomato-50 text-tomato-600"
        )}>
          {phase === "focus" ? "🍅 专注时间" : phase === "short_break" ? "☕ 短休息" : "🌿 长休息"}
        </div>
      </div>

      {/* 当前 Todo */}
      <div className="text-center mb-4 min-h-[2.5rem] flex items-center justify-center">
        {activeTodo ? (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-tomato-50 text-tomato-700 rounded-full text-sm">
            <span>📌</span>
            <span className="max-w-[200px] sm:max-w-[300px] truncate">{activeTodo.title}</span>
            <button
              onClick={onClearActiveTodo}
              className="ml-1 text-tomato-500 hover:text-tomato-700"
              aria-label="清除选中"
            >
              ×
            </button>
          </div>
        ) : (
          <p className="text-sm text-gray-400">没有选中 Todo？纯专注也行</p>
        )}
      </div>

      {/* 圆形进度 + 时间 */}
      <div className="relative w-72 h-72 sm:w-80 sm:h-80 mx-auto my-4">
        <svg className="w-full h-full timer-ring" viewBox="0 0 280 280">
          <circle
            cx="140"
            cy="140"
            r={R}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-gray-100"
          />
          <circle
            cx="140"
            cy="140"
            r={R}
            fill="none"
            stroke="currentColor"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - progress)}
            className={cn("timer-ring__progress", phaseColor)}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <AnimatePresence mode="wait">
            {completedThisSession ? (
              <motion.div
                key="done"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center"
              >
                <div className="text-6xl mb-2">🎉</div>
                <p className="text-lg font-medium text-tomato-600">完成！</p>
              </motion.div>
            ) : (
              <motion.div
                key="time"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center"
              >
                <div className="text-xs uppercase tracking-widest text-gray-400 mb-2">
                  {phaseLabel}
                </div>
                <div className="text-6xl sm:text-7xl font-light tabular-nums text-gray-900">
                  {formatTime(remaining)}
                </div>
                <div className="text-xs text-gray-400 mt-2">
                  今日已完成 {focusCount} 🍅
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* 控制按钮 */}
      <div className="flex justify-center gap-3 mt-2">
        {!running ? (
          <button
            onClick={handleStart}
            className="flex items-center gap-2 px-7 py-3 bg-tomato-500 hover:bg-tomato-600 text-white font-medium rounded-2xl transition active:scale-95 shadow-md shadow-tomato-200"
          >
            <Play size={18} fill="currentColor" />
            {remaining === totalSeconds() ? "开始" : "继续"}
          </button>
        ) : (
          <button
            onClick={() => setRunning(false)}
            className="flex items-center gap-2 px-7 py-3 bg-gray-800 hover:bg-gray-900 text-white font-medium rounded-2xl transition active:scale-95"
          >
            <Pause size={18} fill="currentColor" />
            暂停
          </button>
        )}
        <button
          onClick={handleAbandon}
          className="flex items-center gap-2 px-4 py-3 bg-white border border-gray-200 hover:border-gray-300 text-gray-700 font-medium rounded-2xl transition active:scale-95"
          aria-label={phase === "focus" ? "放弃番茄" : "跳过休息"}
          title={phase === "focus" ? "放弃番茄（本次专注不计入完成数）" : "跳过休息，强制切回专注"}
        >
          <X size={18} />
          <span className="hidden sm:inline">
            {phase === "focus" ? "放弃番茄" : "跳过休息"}
          </span>
        </button>
      </div>

      {/* 白噪音 */}
      <div className="mt-6 flex items-center justify-center gap-2 flex-wrap text-sm">
        <button
          onClick={() => setSoundOn(!soundOn)}
          className="flex items-center gap-1 px-2.5 py-1 text-gray-500 hover:text-gray-700"
        >
          {soundOn ? <Volume2 size={14} /> : <VolumeX size={14} />}
        </button>
        {(Object.keys(SOUND_LABELS) as ("rain" | "cafe" | "forest" | "ocean")[]).map((s) => (
          <button
            key={s}
            onClick={() => {
              setSound(s);
              setSoundOn(true);
            }}
            className={cn(
              "px-2.5 py-1 rounded-full text-xs transition",
              sound === s
                ? "bg-tomato-100 text-tomato-700"
                : "text-gray-500 hover:bg-gray-100"
            )}
          >
            {SOUND_LABELS[s]}
          </button>
        ))}
      </div>
    </div>
  );
}
