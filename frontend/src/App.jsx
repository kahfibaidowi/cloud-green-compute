import React, { useState, useEffect } from 'react';
import { Play, Cpu, HardDrive, MemoryStick, Clock, Leaf, Sliders, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';

const API_BASE = `http://${window.location.hostname}:8000/api`;

export default function App() {
  const [params, setParams] = useState({
    total_requests: 100,
    concurrency: 10,
    prime_limit: 15000,
    base_workers: 4,
    opt_workers: 2,
    opt_threads: 2,
    cpu_limit: 0.5,
    ram_limit_mb: 128
  });

  const [job, setJob] = useState({
    status: 'idle',
    step: '',
    progress: 0,
    error: null,
    result: null
  });

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/status`);
        const data = await res.json();
        setJob(data);
      } catch (err) {
        // Abaikan saat backend belum siap
      }
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const handleChange = (key, value) => {
    setParams((prev) => ({ ...prev, [key]: Number(value) }));
  };

  const handleRun = async () => {
    try {
      await fetch(`${API_BASE}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      setJob((prev) => ({ ...prev, status: 'running', step: 'Memulai orkestrasi container...', progress: 5 }));
    } catch (err) {
      alert('Gagal terhubung ke Orchestrator API di port 8000');
    }
  };

  const res = job.result;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm uppercase tracking-wider">
              <Leaf className="w-4 h-4" /> Topik 7 — Green Cloud Computing
            </div>
            <h1 className="text-3xl font-bold mt-1">Container Resource Optimization Studio</h1>
            <p className="text-slate-400 text-sm mt-1">
              Simulasi & perbandingan efisiensi CPU, RAM, Storage, dan Trade-off Latency (Baseline vs. Optimized)
            </p>
          </div>
          <div className="flex gap-3 text-xs">
            <a
              href={`http://${window.location.hostname}:9090`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 hover:border-emerald-500 transition"
            >
              Prometheus <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <a
              href={`http://${window.location.hostname}:8080`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 hover:border-emerald-500 transition"
            >
              cAdvisor <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Panel Custom Parameter */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Workload Parameters */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 font-semibold text-emerald-400">
              <Sliders className="w-4 h-4" /> Parameter Workload & Beban
            </div>
            <div>
              <label className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Total Requests</span>
                <span className="text-white font-mono">{params.total_requests} req</span>
              </label>
              <input
                type="range"
                min="20"
                max="1000"
                step="20"
                value={params.total_requests}
                onChange={(e) => handleChange('total_requests', e.target.value)}
                className="w-full accent-emerald-500"
              />
            </div>
            <div>
              <label className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Concurrency (Simultan)</span>
                <span className="text-white font-mono">{params.concurrency} users</span>
              </label>
              <input
                type="range"
                min="1"
                max="50"
                step="1"
                value={params.concurrency}
                onChange={(e) => handleChange('concurrency', e.target.value)}
                className="w-full accent-emerald-500"
              />
            </div>
            <div>
              <label className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Intensitas CPU (Prime Limit)</span>
                <span className="text-white font-mono">{params.prime_limit.toLocaleString()}</span>
              </label>
              <input
                type="range"
                min="5000"
                max="40000"
                step="2500"
                value={params.prime_limit}
                onChange={(e) => handleChange('prime_limit', e.target.value)}
                className="w-full accent-emerald-500"
              />
            </div>
          </div>

          {/* Baseline Config */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="font-semibold text-amber-400">Konfigurasi Baseline (Tanpa Limit)</div>
            <p className="text-xs text-slate-400">
              Menggunakan <code className="text-slate-200">python:3.11</code> (Debian penuh) tanpa pembatasan CPU & RAM.
            </p>
            <div>
              <label className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Gunicorn Workers (Baseline)</span>
                <span className="text-white font-mono">{params.base_workers} workers</span>
              </label>
              <input
                type="range"
                min="1"
                max="8"
                step="1"
                value={params.base_workers}
                onChange={(e) => handleChange('base_workers', e.target.value)}
                className="w-full accent-amber-500"
              />
            </div>
          </div>

          {/* Optimized Config */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="font-semibold text-sky-400">Konfigurasi Optimized (Green Tuning)</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">CPU Limit (Cores)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="4.0"
                  value={params.cpu_limit}
                  onChange={(e) => handleChange('cpu_limit', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">RAM Limit (MB)</label>
                <input
                  type="number"
                  step="16"
                  min="64"
                  max="2048"
                  value={params.ram_limit_mb}
                  onChange={(e) => handleChange('ram_limit_mb', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Workers (Alpine)</label>
                <input
                  type="number"
                  min="1"
                  max="8"
                  value={params.opt_workers}
                  onChange={(e) => handleChange('opt_workers', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Threads / Worker</label>
                <input
                  type="number"
                  min="1"
                  max="8"
                  value={params.opt_threads}
                  onChange={(e) => handleChange('opt_threads', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Action & Progress Bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="w-full md:w-2/3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-300 font-medium">
                {job.status === 'idle' && 'Siap menjalankan pengujian komparasi.'}
                {job.status === 'running' && job.step}
                {job.status === 'completed' && (
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" /> {job.step}
                  </span>
                )}
                {job.status === 'error' && (
                  <span className="flex items-center gap-1.5 text-rose-400">
                    <AlertCircle className="w-4 h-4" /> {job.step}
                  </span>
                )}
              </span>
              <span className="font-mono text-xs text-slate-400">{job.progress}%</span>
            </div>
            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full transition-all duration-500"
                style={{ width: `${job.progress}%` }}
              />
            </div>
          </div>

          <button
            onClick={handleRun}
            disabled={job.status === 'running'}
            className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 text-slate-950 font-bold transition shadow-lg shadow-emerald-500/20"
          >
            <Play className="w-4 h-4 fill-current" />
            {job.status === 'running' ? 'Sedang Menguji...' : 'Jalankan Benchmark'}
          </button>
        </div>

        {/* Hasil Perbandingan */}
        {res && (
          <div className="space-y-6">
            {/* 4 Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                icon={<HardDrive className="w-5 h-5 text-emerald-400" />}
                title="Docker Image Size"
                baseVal={res.baseline.image_size_label}
                optVal={res.optimized.image_size_label}
                pct={res.savings.image_size_pct}
              />
              <MetricCard
                icon={<MemoryStick className="w-5 h-5 text-sky-400" />}
                title="RAM Peak Usage"
                baseVal={`${res.baseline.ram_peak_mb} MB`}
                optVal={`${res.optimized.ram_peak_mb} MB`}
                pct={res.savings.ram_peak_pct}
              />
              <MetricCard
                icon={<Cpu className="w-5 h-5 text-indigo-400" />}
                title="CPU Usage Rate"
                baseVal={`${res.baseline.cpu_cores} cores`}
                optVal={`${res.optimized.cpu_cores} cores`}
                pct={res.savings.cpu_pct}
              />
              <MetricCard
                icon={<Clock className="w-5 h-5 text-amber-400" />}
                title="Average Latency"
                baseVal={`${res.baseline.avg_latency} s`}
                optVal={`${res.optimized.avg_latency} s`}
                pct={res.savings.latency_diff_pct}
                isTradeoff
              />
            </div>

            {/* Tabel Detail & Analisis Trade-off */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="p-5 border-b border-slate-800 font-semibold">
                Tabel Komparasi Lengkap ({res.baseline.success}/{res.baseline.total_requests} Req Sukses)
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-950/60 text-slate-400 uppercase text-xs">
                    <tr>
                      <th className="px-6 py-3">Metrik Evaluasi</th>
                      <th className="px-6 py-3">Baseline</th>
                      <th className="px-6 py-3">Optimized</th>
                      <th className="px-6 py-3">Efisiensi / Selisih</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    <tr>
                      <td className="px-6 py-3.5 font-medium">Ukuran Image</td>
                      <td className="px-6 py-3.5 font-mono">{res.baseline.image_size_label}</td>
                      <td className="px-6 py-3.5 font-mono">{res.optimized.image_size_label}</td>
                      <td className="px-6 py-3.5 text-emerald-400 font-semibold">Hemat {res.savings.image_size_pct}%</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-3.5 font-medium">RAM Idle</td>
                      <td className="px-6 py-3.5 font-mono">{res.baseline.ram_idle_mb} MB</td>
                      <td className="px-6 py-3.5 font-mono">{res.optimized.ram_idle_mb} MB</td>
                      <td className="px-6 py-3.5 text-emerald-400 font-semibold">Hemat {res.savings.ram_idle_pct}%</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-3.5 font-medium">RAM Peak (Beban)</td>
                      <td className="px-6 py-3.5 font-mono">{res.baseline.ram_peak_mb} MB</td>
                      <td className="px-6 py-3.5 font-mono">{res.optimized.ram_peak_mb} MB</td>
                      <td className="px-6 py-3.5 text-emerald-400 font-semibold">Hemat {res.savings.ram_peak_pct}%</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-3.5 font-medium">CPU Usage Rate</td>
                      <td className="px-6 py-3.5 font-mono">{res.baseline.cpu_cores} cores</td>
                      <td className="px-6 py-3.5 font-mono">{res.optimized.cpu_cores} cores</td>
                      <td className="px-6 py-3.5 text-emerald-400 font-semibold">Hemat {res.savings.cpu_pct}%</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-3.5 font-medium">Average Latency</td>
                      <td className="px-6 py-3.5 font-mono">{res.baseline.avg_latency} s</td>
                      <td className="px-6 py-3.5 font-mono">{res.optimized.avg_latency} s</td>
                      <td className="px-6 py-3.5 text-amber-400 font-semibold">
                        {res.savings.latency_diff_pct < 0
                          ? `Naik ${Math.abs(res.savings.latency_diff_pct)}% (Trade-off)`
                          : `Lebih cepat ${res.savings.latency_diff_pct}%`}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-6 py-3.5 font-medium">Total Waktu Eksekusi</td>
                      <td className="px-6 py-3.5 font-mono">{res.baseline.total_time} s</td>
                      <td className="px-6 py-3.5 font-mono">{res.optimized.total_time} s</td>
                      <td className="px-6 py-3.5 font-mono text-slate-400">
                        {res.optimized.success}/{res.optimized.total_requests} OK
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ icon, title, baseVal, optVal, pct, isTradeoff = false }) {
  const positive = pct >= 0;
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{title}</span>
        {icon}
      </div>
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-xs text-slate-500">Baseline</div>
          <div className="text-base font-mono text-slate-300">{baseVal}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-500">Optimized</div>
          <div className="text-xl font-bold font-mono text-white">{optVal}</div>
        </div>
      </div>
      <div className="pt-2 border-t border-slate-800/80 text-xs font-semibold">
        {isTradeoff ? (
          <span className="text-amber-400">
            {positive ? `Lebih cepat ${pct}%` : `Trade-off: +${Math.abs(pct)}% lebih lambat`}
          </span>
        ) : (
          <span className={positive ? 'text-emerald-400' : 'text-rose-400'}>
            {positive ? `Hemat ${pct}% sumber daya` : `Naik ${Math.abs(pct)}%`}
          </span>
        )}
      </div>
    </div>
  );
}