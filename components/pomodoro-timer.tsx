"use client";
import { apiFetch } from "@/lib/api-client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, RotateCcw, Coffee, Volume2, VolumeX, Check } from "lucide-react";
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
  none: "🔇 静音",
};

/**
 * Web Audio API 合成白噪音 / 环境音
 * 零网络依赖，永远不会失效
 */
function createNoiseSource(audioCtx: AudioContext, type: "rain" | "cafe" | "forest" | "ocean") {
  // 生成 4 秒 buffer（loop）
  const bufferSize = 4 * audioCtx.sampleRate;
  const buffer = audioCtx.createBuffer(2, bufferSize, audioCtx.sampleRate);

  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    if (type === "rain") {
      // 雨声：高频白噪音 + 低频随机 rumble
      let lastLow = 0;
      for (let i = 0; i < bufferSize; i++) {
        const high = (Math.random() * 2 - 1) * 0.35;
        const lowTarget = (Math.random() * 2 - 1) * 0.4;
        lastLow = lastLow * 0.995 + lowTarget * 0.005;
        data[i] = high + lastLow;
      }
    } else if (type === "cafe") {
      // 咖啡馆：棕色噪音（更暖）
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.09;
        b6 = white * 0.115926;
      }
    } else if (type === "forest") {
      // 森林：风声（低频调制白噪音）
      for (let i = 0; i < bufferSize; i++) {
        const wind = Math.sin((i / audioCtx.sampleRate) * 0.4) * 0.4 + 0.5;
        data[i] = ((Math.random() * 2 - 1) * 0.25) * wind;
      }
    } else { // ocean
      // 海浪：慢节奏起伏的白噪音
      for (let i = 0; i < bufferSize; i++) {
        const t = i / audioCtx.sampleRate;
        // 8 秒一个浪（约 0.125 Hz）
        const wave = (Math.sin(t * 0.785) + 1) / 2; // 0-1
        const intensity = Math.pow(wave, 1.5);
        data[i] = (Math.random() * 2 - 1) * 0.4 * intensity;
      }
    }
  }

  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;

  // 加一个低通滤波器让声音更柔
  const filter = audioCtx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = type === "rain" ? 4000 : type === "ocean" ? 2000 : 1500;
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
  const [sound, setSound] = useState<"rain" | "cafe" | "forest" | "ocean" | "none">("rain");
  const [soundOn, setSoundOn] = useState(settings.soundEnabled);
  const [completedThisSession, setCompletedThisSession] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const noiseRef = useRef<{ source: AudioBufferSourceNode; gain: GainNode; ctx: AudioContext } | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalSeconds = useCallback(() => {
    if (phase === "focus") return settings.focusMinutes * 60;
    if (phase === "short_break") return settings.shortBreakMin * 60;
    return settings.longBreakMin * 60;
  }, [phase, settings]);

  // 切 phase 时只重置 remaining 和完成状态，**不要改 running**
  // 这样手动点「短休/长休」时不会打断正在跑的 timer
  // （自动阶段切换时 handleComplete 已经会 setRunning(false)）
  useEffect(() => {
    setRemaining(totalSeconds());
    setCompletedThisSession(false);
  }, [phase, totalSeconds]);

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
      new Notification(title, { body, icon: "🍅" });
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
            durationMin: settings.focusMinutes,
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
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.connect(g);
      g.connect(audioCtx.destination);
      o.frequency.value = 880;
      o.type = "sine";
      g.gain.setValueAtTime(0, audioCtx.currentTime);
      g.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
      o.start();
      o.stop(audioCtx.currentTime + 0.6);
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
    if (!soundOn || sound === "none") return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      const { source, gain, filter } = createNoiseSource(audioCtx, sound as any);
      // 连接扬声器
      gain.connect(audioCtx.destination);
      // 淡入
      gain.gain.setValueAtTime(0, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.18, audioCtx.currentTime + 0.5);
      source.start();
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

  function handleStart() {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }
    // 恢复 AudioContext（自动播放策略）
    if (noiseRef.current && noiseRef.current.ctx.state === "suspended") {
      noiseRef.current.ctx.resume().catch(() => {});
    }
    setRunning(true);
  }

  function handleReset() {
    setRunning(false);
    setRemaining(totalSeconds());
  }

  function switchPhase(p: Phase) {
    setPhase(p);
  }

  const progress = 1 - remaining / totalSeconds();
  const R = 120;
  const C = 2 * Math.PI * R;

  const phaseLabel = phase === "focus" ? "专注" : phase === "short_break" ? "短休息" : "长休息";
  const phaseColor =
    phase === "focus"
      ? "text-tomato-600"
      : phase === "short_break"
      ? "text-leaf-500"
      : "text-sky-500";

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100">
      {/* 阶段切换 */}
      <div className="flex justify-center gap-1 mb-6 p-1 bg-gray-100/80 rounded-full w-fit mx-auto">
        {(["focus", "short_break", "long_break"] as Phase[]).map((p) => (
          <button
            key={p}
            onClick={() => switchPhase(p)}
            className={cn(
              "px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium rounded-full transition",
              phase === p
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            {p === "focus" ? "🍅 专注" : p === "short_break" ? "☕ 短休" : "🌿 长休"}
          </button>
        ))}
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
                <p className="text-lg font-medium text-leaf-600">完成！</p>
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
          onClick={handleReset}
          className="flex items-center gap-2 px-4 py-3 bg-white border border-gray-200 hover:border-gray-300 text-gray-700 font-medium rounded-2xl transition active:scale-95"
          aria-label="重置"
        >
          <RotateCcw size={18} />
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
        {(Object.keys(SOUND_LABELS) as ("rain" | "cafe" | "forest" | "ocean" | "none")[]).map((s) => (
          <button
            key={s}
            onClick={() => {
              setSound(s);
              if (s !== "none") setSoundOn(true);
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
