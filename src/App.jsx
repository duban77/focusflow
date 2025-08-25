import { useEffect, useMemo, useRef, useState } from "react";

export default function App() {
  // ---------- State ----------
  const [taskText, setTaskText] = useState("");
  const [tasks, setTasks] = useState(() => {
    try { return JSON.parse(localStorage.getItem("ff_tasks")) ?? []; }
    catch { return []; }
  });

  const DURATIONS = [
    { label: "Pomodoro 25 min", seconds: 25 * 60 },
    { label: "Enfoque 15 min", seconds: 15 * 60 },
    { label: "Sprint 5 min", seconds: 5 * 60 },
  ];

  const [selectedSeconds, setSelectedSeconds] = useState(() => {
    const s = Number(localStorage.getItem("ff_selectedSeconds"));
    return Number.isFinite(s) && s > 0 ? s : DURATIONS[0].seconds;
  });

  const [secondsLeft, setSecondsLeft] = useState(selectedSeconds);
  const [running, setRunning] = useState(false);

  const MOODS = [
    { key: "😀", label: "Bien" },
    { key: "😐", label: "Normal" },
    { key: "😓", label: "Cansado" },
    { key: "🔥", label: "Motivado" },
  ];
  const [mood, setMood] = useState(() => localStorage.getItem("ff_mood") || "😀");
  const [moodLog, setMoodLog] = useState(() => {
    try { return JSON.parse(localStorage.getItem("ff_moodLog")) ?? []; }
    catch { return []; }
  });

  const tickRef = useRef(null);

  // ---------- Effects (persistencia) ----------
  useEffect(() => localStorage.setItem("ff_tasks", JSON.stringify(tasks)), [tasks]);
  useEffect(() => localStorage.setItem("ff_mood", mood), [mood]);
  useEffect(() => localStorage.setItem("ff_moodLog", JSON.stringify(moodLog)), [moodLog]);
  useEffect(() => localStorage.setItem("ff_selectedSeconds", String(selectedSeconds)), [selectedSeconds]);

  // ---------- Timer ----------
  useEffect(() => {
    if (!running) return;
    tickRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(tickRef.current);
          notifyDone();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(tickRef.current);
  }, [running]);

  const notifyDone = () => {
    // Beep simple (API Web Audio); seguro si está permitido
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 880; g.gain.value = 0.05;
      o.start(); setTimeout(() => { o.stop(); ctx.close(); }, 600);
    } catch {}
    if (document.hasFocus() === false && "Notification" in window) {
      if (Notification.permission === "granted") new Notification("⏰ FocusFlow", { body: "Tiempo cumplido" });
      else if (Notification.permission !== "denied") Notification.requestPermission();
    }
  };

  const resetTimer = () => {
    setRunning(false);
    clearInterval(tickRef.current);
    setSecondsLeft(selectedSeconds);
  };

  const onChangeDuration = (sec) => {
    setSelectedSeconds(sec);
    setSecondsLeft(sec);
    setRunning(false);
  };

  const fmt = useMemo(() => {
    const m = Math.floor(secondsLeft / 60).toString().padStart(2, "0");
    const s = (secondsLeft % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }, [secondsLeft]);

  // ---------- Tasks ----------
  const addTask = () => {
    const txt = taskText.trim();
    if (!txt) return;
    setTasks((t) => [{ id: crypto.randomUUID(), text: txt, done: false, createdAt: Date.now() }, ...t]);
    setTaskText("");
  };

  const toggleTask = (id) => setTasks((t) => t.map((x) => x.id === id ? { ...x, done: !x.done } : x));
  const removeTask = (id) => setTasks((t) => t.filter((x) => x.id !== id));
  const clearDone = () => setTasks((t) => t.filter((x) => !x.done));

  // ---------- Mood ----------
  const addMoodLog = (k) => {
    setMood(k);
    setMoodLog((m) => [{ k, at: new Date().toISOString() }, ...m].slice(0, 12));
  };

  // ---------- UI ----------
  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <h1 style={{ margin: 0 }}>FocusFlow</h1>
          <p style={{ opacity: 0.8, margin: 0 }}>Tareas rápidas + Pomodoro + Estado de ánimo</p>
        </header>

        {/* Timer */}
        <section style={styles.card}>
          <div style={styles.rowBetween}>
            <h2 style={{ margin: 0 }}>Temporizador</h2>
            <select
              value={selectedSeconds}
              onChange={(e) => onChangeDuration(Number(e.target.value))}
              style={styles.select}
            >
              {DURATIONS.map(d => (
                <option key={d.seconds} value={d.seconds}>{d.label}</option>
              ))}
            </select>
          </div>

          <div style={styles.timer}>{fmt}</div>

          <div style={styles.row}>
            {!running ? (
              <button style={styles.primary} onClick={() => secondsLeft > 0 && setRunning(true)}>Iniciar</button>
            ) : (
              <button style={styles.secondary} onClick={() => setRunning(false)}>Pausar</button>
            )}
            <button style={styles.ghost} onClick={resetTimer}>Reiniciar</button>
          </div>
        </section>

        {/* Tasks */}
        <section style={styles.card}>
          <h2 style={{ marginTop: 0 }}>Tareas</h2>
          <div style={styles.row}>
            <input
              placeholder="Nueva tarea…"
              value={taskText}
              onChange={(e) => setTaskText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTask()}
              style={styles.input}
            />
            <button style={styles.primary} onClick={addTask}>Agregar</button>
          </div>

          <ul style={{ listStyle: "none", padding: 0, marginTop: 12 }}>
            {tasks.length === 0 && <li style={{ opacity: 0.6 }}>Sin tareas aún.</li>}
            {tasks.map(t => (
              <li key={t.id} style={styles.taskItem}>
                <label style={styles.taskLabel}>
                  <input type="checkbox" checked={t.done} onChange={() => toggleTask(t.id)} />
                  <span style={{ marginLeft: 8, textDecoration: t.done ? "line-through" : "none", opacity: t.done ? 0.6 : 1 }}>
                    {t.text}
                  </span>
                </label>
                <button onClick={() => removeTask(t.id)} style={styles.deleteBtn}>✕</button>
              </li>
            ))}
          </ul>

          {tasks.some(t => t.done) && (
            <button onClick={clearDone} style={styles.ghost}>Borrar completadas</button>
          )}
        </section>

        {/* Mood */}
        <section style={styles.card}>
          <div style={styles.rowBetween}>
            <h2 style={{ margin: 0 }}>Estado de ánimo</h2>
            <div title="Actual">
              <span style={{ fontSize: 28 }}>{mood}</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            {MOODS.map(m => (
              <button key={m.key} onClick={() => addMoodLog(m.key)} style={styles.moodBtn}>
                <span style={{ fontSize: 20, marginRight: 6 }}>{m.key}</span>{m.label}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 12, fontSize: 14, opacity: 0.8 }}>
            Últimos registros:
            <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
              {moodLog.length === 0 && <span>No hay registros.</span>}
              {moodLog.map((m, i) => (
                <span key={i} title={new Date(m.at).toLocaleString()} style={styles.moodDot}>{m.k}</span>
              ))}
            </div>
          </div>
        </section>

        <footer style={{ textAlign: "center", opacity: 0.6, fontSize: 12, marginTop: 16 }}>
          Hecho con React + Vite · Guarda datos en tu navegador
        </footer>
      </div>
    </div>
  );
}

// ---------- estilos inline minimalistas ----------
const styles = {
  page: { minHeight: "100vh", background: "linear-gradient(180deg,#0f172a,#111827)", color: "#e5e7eb", padding: 24 },
  container: { maxWidth: 860, margin: "0 auto" },
  header: { marginBottom: 16 },
  card: { background: "rgba(17,24,39,.6)", border: "1px solid rgba(255,255,255,.06)", padding: 16, borderRadius: 16, boxShadow: "0 10px 30px rgba(0,0,0,.25)", marginTop: 12 },
  row: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" },
  rowBetween: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" },
  input: { flex: 1, padding: "10px 12px", borderRadius: 12, border: "1px solid #334155", background: "#0b1220", color: "#e5e7eb" },
  select: { padding: "8px 10px", borderRadius: 10, border: "1px solid #334155", background: "#0b1220", color: "#e5e7eb" },
  primary: { padding: "10px 14px", borderRadius: 12, border: "none", background: "#3b82f6", color: "white", cursor: "pointer" },
  secondary: { padding: "10px 14px", borderRadius: 12, border: "none", background: "#22c55e", color: "white", cursor: "pointer" },
  ghost: { padding: "10px 14px", borderRadius: 12, background: "transparent", border: "1px solid #334155", color: "#e5e7eb", cursor: "pointer" },
  timer: { fontSize: 64, textAlign: "center", margin: "10px 0 14px 0", fontVariantNumeric: "tabular-nums" },
  taskItem: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderRadius: 12, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)", marginBottom: 8 },
  taskLabel: { display: "flex", alignItems: "center" },
  deleteBtn: { background: "transparent", border: "1px solid #ef4444", color: "#ef4444", borderRadius: 10, padding: "6px 10px", cursor: "pointer" },
  moodBtn: { background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", color: "#e5e7eb", padding: "8px 12px", borderRadius: 12, cursor: "pointer" },
  moodDot: { background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", padding: "6px 10px", borderRadius: 10 }
};
