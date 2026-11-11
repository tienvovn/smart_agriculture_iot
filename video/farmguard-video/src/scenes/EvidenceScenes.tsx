import React from "react";
import { Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Caption, Eyebrow, Heading, Reveal, Scene } from "../components";
import { incidentSeries } from "../data/incidentSeries";
import { colors, monoFamily } from "../theme";

// ---------------------------------------------------------------- real telemetry chart

const CHART_W = 1640;
const CHART_H = 420;
const T_MAX = 200;
const series = incidentSeries.filter(([t]) => t >= 0 && t <= T_MAX);
const x = (t: number) => (t / T_MAX) * CHART_W;
const yCurrent = (a: number) => CHART_H - (a / 2.2) * CHART_H;
const yMoisture = (m: number) => CHART_H - (m / 60) * CHART_H;

const Marker: React.FC<{ readonly t: number; readonly label: string; readonly color: string; readonly top: number }> = ({
  t,
  label,
  color,
  top,
}) => (
  <>
    <div style={{ position: "absolute", left: x(t), top: 0, width: 3, height: CHART_H, background: color, opacity: 0.8 }} />
    <div
      style={{
        position: "absolute",
        left: x(t) + 14,
        top,
        fontSize: 30,
        fontWeight: 700,
        color: colors.dark,
        background: color,
        padding: "6px 14px",
        borderRadius: 10,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </div>
  </>
);

export const IncidentChart: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // The chart draws from t=0 to t=200 s of real data over 14 s of video.
  const shownT = interpolate(frame, [1.5 * fps, 15.5 * fps], [0, T_MAX], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const visible = series.filter(([t]) => t <= shownT);
  const path = (pick: (row: [number, number, number]) => number) =>
    visible.map((row, i) => `${i === 0 ? "M" : "L"}${x(row[0]).toFixed(1)},${pick(row).toFixed(1)}`).join(" ");
  const last = visible[visible.length - 1];
  const failing = shownT < 151;

  return (
    <Scene background={colors.dark}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Eyebrow color={colors.orange}>SỰ CỐ THẬT · FARM-002 · DỮ LIỆU MONGODB</Eyebrow>
          <Heading size={64}>ACK đã nhận. Ruộng vẫn khô.</Heading>
        </div>
        <div style={{ display: "flex", gap: 24 }}>
          <div style={{ background: colors.card, borderRadius: 16, padding: "16px 28px", minWidth: 280 }}>
            <div style={{ fontSize: 26, color: colors.muted }}>Dòng điện bơm</div>
            <div style={{ fontFamily: monoFamily, fontSize: 56, fontWeight: 600, color: failing ? colors.orange : colors.green }}>
              {last ? last[2].toFixed(2) : "--"} A
            </div>
          </div>
          <div style={{ background: colors.card, borderRadius: 16, padding: "16px 28px", minWidth: 280 }}>
            <div style={{ fontSize: 26, color: colors.muted }}>Độ ẩm đất</div>
            <div style={{ fontFamily: monoFamily, fontSize: 56, fontWeight: 600, color: colors.text }}>
              {last ? last[1].toFixed(1) : "--"} %
            </div>
          </div>
        </div>
      </div>
      <div style={{ position: "relative", width: CHART_W, height: CHART_H, marginTop: 10 }}>
        <svg width={CHART_W} height={CHART_H} style={{ position: "absolute", overflow: "visible" }}>
          <line x1={0} y1={CHART_H} x2={CHART_W} y2={CHART_H} stroke="#3A5546" strokeWidth={2} />
          <path d={path((r) => yMoisture(r[1]))} fill="none" stroke="#7FB5FF" strokeWidth={6} strokeLinejoin="round" />
          <path d={path((r) => yCurrent(r[2]))} fill="none" stroke={colors.orange} strokeWidth={6} strokeLinejoin="round" />
        </svg>
        <Reveal delay={1.6}>
          <Marker t={0} label="ACK nhận được" color={colors.text} top={10} />
        </Reveal>
        <Reveal delay={2.2}>
          <Marker t={6} label="T+6 s · incident mở, Datadog Alert" color={colors.orange} top={80} />
        </Reveal>
        <Reveal delay={12.3}>
          <Marker t={150} label="Lệnh sửa · 1.8 A" color={colors.green} top={10} />
        </Reveal>
        <div style={{ position: "absolute", left: 0, top: CHART_H + 14, display: "flex", gap: 40, fontSize: 28, color: colors.muted }}>
          <span>
            <span style={{ color: colors.orange, fontWeight: 700 }}>━ Dòng điện (A)</span>
          </span>
          <span>
            <span style={{ color: "#7FB5FF", fontWeight: 700 }}>━ Độ ẩm (%)</span>
          </span>
          <span>Trục ngang: 0 → 200 giây sau ACK</span>
        </div>
      </div>
      <Caption
        delay={0.6}
        text={
          shownT < 151
            ? "Có ACK, nhưng kẹp dòng chỉ đo ~0.02 A: mô-tơ không chạy."
            : "Lệnh sửa: ~1.8 A, độ ẩm tăng lại. Incident đóng có bằng chứng."
        }
      />
    </Scene>
  );
};

// ---------------------------------------------------------------- screenshots

const Highlight: React.FC<{ readonly delay: number; readonly style: React.CSSProperties }> = ({ delay, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div
      style={{
        position: "absolute",
        border: `6px solid ${colors.orange}`,
        borderRadius: 14,
        opacity: interpolate(frame, [delay * fps, delay * fps + 0.4 * fps], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
        ...style,
      }}
    />
  );
};

// app-incident.png is 1600×1000; shown at 0.74 scale (1184×740).
const S = 0.74;

export const AppProof: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <Scene background="#0B1510">
      <Reveal>
        <Eyebrow>INCIDENT CENTER · BẰNG CHỨNG TỪ AGGREGATION</Eyebrow>
      </Reveal>
      <div style={{ position: "relative", width: 1600 * S, height: 1000 * S, alignSelf: "center", marginTop: -24 }}>
        <Img
          src={staticFile("app-incident.png")}
          style={{
            width: 1600 * S,
            height: 1000 * S,
            borderRadius: 16,
            scale: interpolate(frame, [0, 12 * fps], [1, 1.04], { extrapolateRight: "clamp", easing: Easing.linear }),
          }}
        />
        <Highlight delay={1.5} style={{ left: 560 * S, top: 296 * S, width: 520 * S, height: 102 * S }} />
        <Highlight delay={5} style={{ left: 330 * S, top: 700 * S, width: 620 * S, height: 88 * S }} />
      </div>
      <Caption
        delay={0.5}
        text="MTTD, MTTR tính bằng $dateDiff + $facet. Có ACK nhưng chỉ 0.04 A."
      />
    </Scene>
  );
};

export const DatadogScene: React.FC = () => (
  <Scene background={colors.light}>
    <Reveal>
      <Eyebrow color="#B45309">DATADOG · CÙNG SỰ CỐ</Eyebrow>
    </Reveal>
    <Reveal delay={0.3}>
      <Heading color={colors.ink} size={72}>
        Metric → monitor → log → trace
      </Heading>
    </Reveal>
    <div style={{ display: "flex", gap: 48, alignItems: "flex-start" }}>
      <Reveal delay={0.9}>
        <Img
          src={staticFile("dd-outcome-missing.png")}
          style={{ width: 900, height: 386, background: "#FFFFFF", borderRadius: 16, border: "2px solid #D5DDD3" }}
        />
        <div style={{ fontFamily: monoFamily, fontSize: 28, color: "#46584D", marginTop: 14 }}>
          smartfarm.irrigation.outcome_missing
        </div>
      </Reveal>
      <div style={{ display: "flex", flexDirection: "column", gap: 18, flex: 1 }}>
        {[
          ["Monitor", "Alert khi = 1, về OK khi phục hồi"],
          ["Log", "outcome_missing + correlationId"],
          ["Trace", "simulator.tick → span MongoDB"],
          ["SLO", "95% lệnh có kết quả vật lý"],
        ].map(([title, body], i) => (
          <Reveal key={title} delay={2 + i * 1.2}>
            <div style={{ background: "#FBEFE2", borderRadius: 18, padding: "16px 26px" }}>
              <div style={{ fontSize: 34, fontWeight: 700, color: colors.ink }}>{title}</div>
              <div style={{ fontSize: 28, color: "#46584D", lineHeight: 1.3 }}>{body}</div>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
    <Caption delay={0.6} text="Từ alert đi thẳng tới log có correlationId và trace của đúng lần xử lý." />
  </Scene>
);
