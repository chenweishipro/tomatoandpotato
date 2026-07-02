"use client";
import { useT } from "@/lib/i18n";
import { apiFetch, apiJson } from "@/lib/api-client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useSession } from "next-auth/react";

type Settings = {
  focusMinutes: number;
  shortBreakMin: number;
  longBreakMin: number;
  pomosBeforeLong: number;
  autoStartBreak: boolean;
  desktopNotif: boolean;
  soundEnabled: boolean;
  soundType: string;
};

export default function SettingsPage() {
  const { t } = useT();
  const { data: session } = useSession();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiFetch("/api/settings")
      .then((r) => r.json())
      .then(setSettings);
  }, []);

  async function save(patch: Partial<Settings>) {
    if (!settings) return;
    const next = { ...settings, ...patch };
    setSettings(next);
    setSaving(true);
    setSaved(false);
    await apiFetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  if (!settings) return <div className="text-center text-gray-400 dark:text-gray-500 py-20">加载中…</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">设置</h1>
        {saved && (
          <motion.span
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-sm text-tomato-600"
          >
            ✓ 已保存
          </motion.span>
        )}
      </div>

                                  {/* sections */}
<Section title="🍅 番茄钟时长">
        <NumberRow
          label="专注"
          suffix="分钟"
          value={settings.focusMinutes}
          min={5}
          max={90}
          step={5}
          onChange={(v) => save({ focusMinutes: v })}
        />
        <NumberRow
          label="短休息"
          suffix="分钟"
          value={settings.shortBreakMin}
          min={1}
          max={30}
          onChange={(v) => save({ shortBreakMin: v })}
        />
        <NumberRow
          label="长休息"
          suffix="分钟"
          value={settings.longBreakMin}
          min={5}
          max={60}
          step={5}
          onChange={(v) => save({ longBreakMin: v })}
        />
        <NumberRow
          label="几个番茄后长休息"
          suffix="个"
          value={settings.pomosBeforeLong}
          min={2}
          max={8}
          onChange={(v) => save({ pomosBeforeLong: v })}
        />
      </Section>


<Section title="⚙️ 行为">
        <ToggleRow
          label="自动开始休息"
          desc="番茄完成后，自动开始倒计时休息"
          checked={settings.autoStartBreak}
          onChange={(v) => save({ autoStartBreak: v })}
        />
        <ToggleRow
          label="桌面通知"
          desc="番茄完成时弹出系统通知"
          checked={settings.desktopNotif}
          onChange={(v) => save({ desktopNotif: v })}
        />
        <ToggleRow
          label="声音提醒"
          desc="番茄完成时播放提示音"
          checked={settings.soundEnabled}
          onChange={(v) => save({ soundEnabled: v })}
        />
        <TestButtons
          desktopNotif={settings.desktopNotif}
          soundEnabled={settings.soundEnabled}
        />
      </Section>

<Section title="📦 数据导出">
        <div className="flex flex-wrap gap-2">
          <a
            href="/carrot/api/export?format=json"
            className="px-3 py-1.5 text-sm rounded-lg bg-tomato-500 text-white hover:bg-tomato-600"
          >
            ⬇️ 导出 JSON
          </a>
          <a
            href="/carrot/api/export?format=csv"
            className="px-3 py-1.5 text-sm rounded-lg bg-tomato-100 text-tomato-700 hover:bg-tomato-200"
          >
            ⬇️ 导出 CSV
          </a>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-2">
          JSON 含用户/设置/所有任务/所有番茄记录; CSV 分两段表 (Todos + Pomodoros)。
        </p>
      </Section>


<Section title="⌨️ 快捷键">
        <div className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500 space-y-2">
          <div className="flex justify-between items-center">
            <span>开始 / 暂停番茄</span>
            <kbd className="px-2 py-0.5 text-xs rounded bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 font-mono">Space</kbd>
          </div>
          <div className="flex justify-between items-center">
            <span>重置当前计时器</span>
            <kbd className="px-2 py-0.5 text-xs rounded bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 font-mono">R</kbd>
          </div>
          <div className="flex justify-between items-center">
            <span>放弃番茄 / 跳过休息</span>
            <kbd className="px-2 py-0.5 text-xs rounded bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 font-mono">Esc</kbd>
          </div>
          <div className="flex justify-between items-center">
            <span>切换移动端番茄 / 任务</span>
            <span className="text-xs"><kbd className="px-2 py-0.5 text-xs rounded bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 font-mono">1</kbd> <kbd className="px-2 py-0.5 text-xs rounded bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 font-mono">2</kbd></span>
          </div>
          <div className="flex justify-between items-center">
            <span>跳到统计 / 历史</span>
            <span className="text-xs"><kbd className="px-2 py-0.5 text-xs rounded bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 font-mono">3</kbd> <kbd className="px-2 py-0.5 text-xs rounded bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 font-mono">4</kbd></span>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 pt-2 border-t border-gray-100 dark:border-slate-700">
            💡 在输入框中按快捷键不会触发, 避免干扰输入。
          </p>
        </div>
      </Section>


<ChangePasswordSection />



</div>
  );
}

function TestButtons({ desktopNotif, soundEnabled }: { desktopNotif: boolean; soundEnabled: boolean }) {
  const [notifPerm, setNotifPerm] = useState<NotificationPermission | "unsupported">("default");
  const { t } = useT();

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotifPerm(Notification.permission);
    } else {
      setNotifPerm("unsupported");
    }
  }, []);

  async function requestNotif() {
    if (!("Notification" in window)) return;
    const perm = await Notification.requestPermission();
    setNotifPerm(perm);
    if (perm === "granted") {
      new Notification("🥕 胡萝卜", { body: "通知已开启！番茄完成时会提醒你。", icon: "🍅" });
    }
  }

  function playTestChime() {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const notes = [
        { freq: 523.25, delay: 0, dur: 0.3 },
        { freq: 659.25, delay: 0.18, dur: 0.3 },
        { freq: 783.99, delay: 0.36, dur: 0.6 },
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

  return (
    <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100 dark:border-slate-700 mt-3">
      <button
        onClick={playTestChime}
        disabled={!soundEnabled}
        className="px-3 py-1.5 text-xs rounded-lg bg-tomato-50 text-tomato-700 hover:bg-tomato-100 disabled:opacity-40"
      >
        🔔 试听提示音
      </button>
      <button
        onClick={requestNotif}
        disabled={!desktopNotif || notifPerm === "unsupported"}
        className="px-3 py-1.5 text-xs rounded-lg bg-tomato-50 text-tomato-700 hover:bg-tomato-100 disabled:opacity-40"
      >
        🔔 开启桌面通知 {notifPerm === "granted" ? "✓" : notifPerm === "denied" ? "✗" : ""}
      </button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-3xl p-5 sm:p-6 shadow-sm border border-gray-100 dark:border-slate-700">
      <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">
        {title}
      </h2>
      <div className="divide-y divide-gray-100 dark:divide-slate-700">{children}</div>
    </div>
  );
}

function NumberRow({
  label,
  suffix,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  suffix: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="text-sm text-gray-700 dark:text-gray-300">{label}</div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(Math.max(min, value - step))}
          disabled={value <= min}
          className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 disabled:opacity-30 transition"
        >
          −
        </button>
        <div className="w-16 text-center">
          <span className="text-lg font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{value}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 ml-1">{suffix}</span>
        </div>
        <button
          onClick={() => onChange(Math.min(max, value + step))}
          disabled={value >= max}
          className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 disabled:opacity-30 transition"
        >
          +
        </button>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <div className="text-sm text-gray-700 dark:text-gray-300">{label}</div>
        {desc && <div className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-0.5">{desc}</div>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={
          "relative w-11 h-6 rounded-full transition " +
          (checked ? "bg-tomato-500" : "bg-gray-200")
        }
      >
        <motion.div
          animate={{ x: checked ? 22 : 2 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className="absolute top-0.5 w-5 h-5 bg-white dark:bg-slate-900 rounded-full shadow-sm"
        />
      </button>
    </div>
  );
}

function ChangePasswordSection() {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [oldP, setOldP] = useState("");
  const [newP, setNewP] = useState("");
  const [confirmP, setConfirmP] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (newP.length < 6) return setMsg({ type: "err", text: "新密码至少 6 位" });
    if (newP !== confirmP) return setMsg({ type: "err", text: "两次密码不一致" });
    setLoading(true);
    try {
      const res = await apiFetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword: oldP, newPassword: newP }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ type: "ok", text: "密码已修改" });
        setOldP(""); setNewP(""); setConfirmP("");
        setTimeout(() => { setOpen(false); setMsg(null); }, 1500);
      } else {
        setMsg({ type: "err", text: data.error || "修改失败" });
      }
    } catch {
      setMsg({ type: "err", text: "网络错误" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-3xl p-5 sm:p-6 shadow-sm border border-gray-100 dark:border-slate-700">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t("settings.security")}</h2>
        <button
          onClick={() => { setOpen(!open); setMsg(null); }}
          className="text-sm text-tomato-600 hover:text-tomato-700"
        >
          {open ? "取消" : "修改密码"}
        </button>
      </div>
      {open && (
        <form onSubmit={submit} className="mt-4 space-y-3">
          <input
            type="password"
            required
            placeholder="当前密码"
            value={oldP}
            onChange={(e) => setOldP(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-tomato-400 outline-none text-sm"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="新密码（至少 6 位）"
            value={newP}
            onChange={(e) => setNewP(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-tomato-400 outline-none text-sm"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="确认新密码"
            value={confirmP}
            onChange={(e) => setConfirmP(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-tomato-400 outline-none text-sm"
          />
          {msg && (
            <p className={"text-sm " + (msg.type === "ok" ? "text-tomato-600" : "text-red-500")}>
              {msg.text}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-tomato-500 hover:bg-tomato-600 disabled:opacity-60 text-white font-medium rounded-xl text-sm transition"
          >
            {loading ? "提交中..." : "确认修改"}
          </button>
        </form>
      )}
    </div>
  );
}
