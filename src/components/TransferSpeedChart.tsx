import React, { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Activity, TrendingUp, Zap, ArrowDown, ArrowUp } from 'lucide-react';
import { SpeedSample } from '../services/peerService';
import { formatBytes } from '../services/cryptoService';

interface TransferSpeedChartProps {
  samples: SpeedSample[];
  isTransferring: boolean;
}

export const TransferSpeedChart: React.FC<TransferSpeedChartProps> = ({
  samples,
  isTransferring,
}) => {
  // Compute chart data with minimum sample points for smooth rendering
  const chartData = useMemo(() => {
    if (samples.length === 0) {
      // Default placeholder baseline
      const now = Date.now();
      return Array.from({ length: 12 }, (_, i) => ({
        time: new Date(now - (12 - i) * 1000).toLocaleTimeString([], {
          hour12: false,
          minute: '2-digit',
          second: '2-digit',
        }),
        speedMbps: 0,
        fileName: 'Idle',
      }));
    }
    // Take the last 30 samples to keep chart clean and responsive
    return samples.slice(-30);
  }, [samples]);

  // Telemetry metrics
  const { currentSpeed, peakSpeed, avgSpeed, throughputStatus } = useMemo(() => {
    if (samples.length === 0) {
      return {
        currentSpeed: 0,
        peakSpeed: 0,
        avgSpeed: 0,
        throughputStatus: 'Idle / Ready',
      };
    }

    const current = samples[samples.length - 1].speedMbps;
    const peak = Math.max(...samples.map((s) => s.speedMbps));
    const avg =
      samples.reduce((acc, s) => acc + s.speedMbps, 0) / (samples.length || 1);

    let status = 'Steady P2P Throughput';
    if (!isTransferring && current === 0) {
      status = 'Transfer Completed';
    } else if (peak > 0 && current >= peak * 0.85) {
      status = 'Peak Burst Speed 🚀';
    } else if (peak > 0 && current <= peak * 0.35) {
      status = 'Network Dip / Flow Control 📉';
    } else if (current > 0) {
      status = 'Optimal 64KB Slicing ⚡';
    }

    return {
      currentSpeed: current,
      peakSpeed: peak,
      avgSpeed: parseFloat(avg.toFixed(2)),
      throughputStatus: status,
    };
  }, [samples, isTransferring]);

  return (
    <div className="w-full bg-[#0c0c0e] border border-[#1b1c24] rounded-2xl p-4 sm:p-5 shadow-xl transition-all">
      {/* Header & Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-3 border-b border-[#181820]">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-[#14151c] border border-[#222432] text-emerald-400 shrink-0">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                Live Throughput Monitor
              </h4>
              {isTransferring && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/40 text-emerald-400 border border-emerald-800/50">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Streaming
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
              Spikes & dips via WebRTC backpressure flow control
            </p>
          </div>
        </div>

        {/* Stats Pill Badges */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Current Throughput */}
          <div className="bg-[#07070a] border border-[#1f1f28] rounded-xl px-3 py-1.5 flex items-center gap-2">
            <span className="text-[10px] text-zinc-500 uppercase font-semibold">Speed:</span>
            <span className="text-xs sm:text-sm font-mono font-bold text-emerald-400">
              {currentSpeed.toFixed(2)} MB/s
            </span>
          </div>

          {/* Peak Speed */}
          <div className="bg-[#07070a] border border-[#1f1f28] rounded-xl px-3 py-1.5 flex items-center gap-1.5">
            <ArrowUp className="w-3 h-3 text-amber-400" />
            <span className="text-[10px] text-zinc-500 uppercase font-semibold">Peak:</span>
            <span className="text-xs font-mono font-bold text-zinc-200">
              {peakSpeed.toFixed(2)} MB/s
            </span>
          </div>

          {/* Average Speed */}
          <div className="bg-[#07070a] border border-[#1f1f28] rounded-xl px-3 py-1.5 flex items-center gap-1.5">
            <TrendingUp className="w-3 h-3 text-cyan-400" />
            <span className="text-[10px] text-zinc-500 uppercase font-semibold">Avg:</span>
            <span className="text-xs font-mono font-bold text-zinc-200">
              {avgSpeed.toFixed(2)} MB/s
            </span>
          </div>
        </div>
      </div>

      {/* Recharts Area Chart */}
      <div className="w-full h-44 pt-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="speedAreaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                <stop offset="60%" stopColor="#10b981" stopOpacity={0.08} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>

            <XAxis
              dataKey="time"
              stroke="#52525b"
              fontSize={10}
              tickLine={false}
              axisLine={{ stroke: '#27272a' }}
              interval="preserveStartEnd"
              fontFamily="monospace"
            />

            <YAxis
              stroke="#52525b"
              fontSize={10}
              tickLine={false}
              axisLine={{ stroke: '#27272a' }}
              unit="M"
              domain={[0, (dataMax: number) => Math.max(1, Math.ceil(dataMax * 1.2))]}
              fontFamily="monospace"
            />

            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload as SpeedSample;
                  return (
                    <div className="bg-[#0c0c0e] border border-[#27272a] rounded-xl p-2.5 shadow-2xl text-xs font-mono">
                      <div className="text-zinc-400 text-[10px] mb-1">{data.time}</div>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span className="text-white font-bold">{data.speedMbps} MB/s</span>
                        <span className="text-zinc-500">
                          ({formatBytes(data.speedBps || data.speedMbps * 1024 * 1024)}/s)
                        </span>
                      </div>
                      {data.fileName && data.fileName !== 'Idle' && (
                        <div className="text-[10px] text-zinc-500 mt-1 truncate max-w-[180px]">
                          File: {data.fileName}
                        </div>
                      )}
                    </div>
                  );
                }
                return null;
              }}
            />

            <Area
              type="monotone"
              dataKey="speedMbps"
              stroke="#10b981"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#speedAreaGradient)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Chart Footer Indicator */}
      <div className="mt-2 pt-2 border-t border-[#14141c] flex flex-wrap items-center justify-between text-[11px] text-zinc-400">
        <div className="flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-zinc-500">Network State:</span>
          <span className="font-medium text-zinc-200">{throughputStatus}</span>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono text-zinc-500">
          <span>Resolution: 64KB Packets</span>
          <span>•</span>
          <span>Sample window: 30s</span>
        </div>
      </div>
    </div>
  );
};
