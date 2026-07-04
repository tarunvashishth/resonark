"use client";

import { Line, LineChart, Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";

export function TrendChart({ data }: { data: { date: string; visibility: number }[] }) {
  if (data.length < 2) {
    return <p className="text-sm text-muted-foreground">Run a few more days to see a trend line.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="date" fontSize={12} tickLine={false} />
        <YAxis domain={[0, 100]} fontSize={12} tickLine={false} width={32} />
        <Tooltip formatter={(v) => [`${v}%`, "Visibility"]} />
        <Line type="monotone" dataKey="visibility" stroke="var(--color-primary, #6366f1)" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ShareOfVoiceChart({
  data,
}: {
  data: { name: string; isOwnBrand: boolean; mentions: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(120, data.length * 40)}>
      <BarChart data={data} layout="vertical" margin={{ left: 24 }}>
        <XAxis type="number" dataKey="mentions" hide domain={[0, "dataMax"]} />
        <YAxis type="category" dataKey="name" fontSize={12} tickLine={false} width={100} />
        <Tooltip />
        <Bar dataKey="mentions" radius={4}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.isOwnBrand ? "#6366f1" : "#cbd5e1"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
