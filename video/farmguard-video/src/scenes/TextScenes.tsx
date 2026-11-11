import React from "react";
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Caption, Card, Eyebrow, Heading, Reveal, Scene } from "../components";
import { colors, monoFamily } from "../theme";

export const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <Scene background={colors.dark} justify="center">
      <Reveal delay={0.2}>
        <Eyebrow>ĐỘI TENET · MONGODB × DATADOG HACKATHON</Eyebrow>
      </Reveal>
      <Reveal delay={0.6}>
        <Heading size={120}>Bộ điều khiển nói “OK”.</Heading>
      </Reveal>
      <Reveal delay={2.2}>
        <Heading size={120} color={colors.orange}>
          Mô-tơ không quay.
        </Heading>
      </Reveal>
      <div
        style={{
          fontSize: 44,
          color: colors.muted,
          opacity: interpolate(frame, [4 * fps, 4.8 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      >
        FarmGuard: lệnh tưới chỉ thành công khi dữ liệu chứng minh nước đã tới đất.
      </div>
      <Caption delay={5.2} text="FarmGuard phát hiện lỗi tưới “im lặng” mà ACK của thiết bị che giấu." />
    </Scene>
  );
};

export const Problem: React.FC = () => (
  <Scene background={colors.dark}>
    <Reveal>
      <Eyebrow color={colors.orange}>VẤN ĐỀ</Eyebrow>
    </Reveal>
    <Reveal delay={0.3}>
      <Heading>Hệ thống tưới tin vào ACK</Heading>
    </Reveal>
    <div style={{ display: "flex", gap: 32 }}>
      <Card delay={1.2} accent={colors.orange} label="01" title="ACK ≠ đã tưới" body="ACK chỉ chứng minh bộ điều khiển còn sống." />
      <Card delay={2.4} accent={colors.orange} label="02" title="Lỗi im lặng" body="Mất pha, cháy cuộn dây, tắc bơm: dashboard vẫn xanh." />
      <Card delay={3.6} accent={colors.orange} label="03" title="Biết quá muộn" body="Nông dân chỉ phát hiện ở lần ra đồng tiếp theo." />
    </div>
    <Caption delay={5} text="Cảnh báo “độ ẩm thấp” chỉ báo triệu chứng, không báo lệnh tưới có chạy thật." />
  </Scene>
);

export const Definition: React.FC = () => (
  <Scene background={colors.dark}>
    <Reveal>
      <Eyebrow>Ý TƯỞNG</Eyebrow>
    </Reveal>
    <Reveal delay={0.3}>
      <Heading>Thành công cần đủ 3 bằng chứng</Heading>
    </Reveal>
    <div style={{ display: "flex", gap: 32 }}>
      <Card delay={1.2} label="01 · ACK" title="Bộ điều khiển xác nhận" body="Trong thời hạn ACK timeout" />
      <Card delay={2.2} label="02 · DÒNG ĐIỆN" title="Mô-tơ thật sự chạy" body="Kẹp dòng đo > 0.1 A" />
      <Card delay={3.2} label="03 · ĐỘ ẨM" title="Nước tới đất" body="Độ ẩm tăng lại sau lệnh" />
    </div>
    <Caption delay={4.6} text="Có ACK nhưng dòng điện ≈ 0 A, độ ẩm giảm: silent failure, FarmGuard tự mở incident." />
  </Scene>
);

const Box: React.FC<{
  readonly title: string;
  readonly lines: string[];
  readonly accent: string;
  readonly delay: number;
  readonly style?: React.CSSProperties;
}> = ({ title, lines, accent, delay, style }) => (
  <Reveal delay={delay} style={{ position: "absolute", ...style }}>
    <div style={{ background: colors.card, border: `3px solid ${accent}`, borderRadius: 24, padding: "28px 36px" }}>
      <div style={{ fontSize: 44, fontWeight: 700, color: colors.text, marginBottom: 12 }}>{title}</div>
      {lines.map((line) => (
        <div key={line} style={{ fontSize: 32, color: colors.muted, lineHeight: 1.45 }}>
          {line}
        </div>
      ))}
    </div>
  </Reveal>
);

const Arrow: React.FC<{ readonly delay: number; readonly style: React.CSSProperties; readonly color: string }> = ({
  delay,
  style,
  color,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div
      style={{
        position: "absolute",
        height: 6,
        background: color,
        transformOrigin: "left center",
        scale: `${interpolate(frame, [delay * fps, delay * fps + 0.5 * fps], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        })} 1`,
        ...style,
      }}
    />
  );
};

export const Architecture: React.FC = () => (
  <Scene background={colors.dark}>
    <Reveal>
      <Eyebrow>KIẾN TRÚC</Eyebrow>
    </Reveal>
    <Reveal delay={0.3}>
      <Heading>Một correlationId xuyên suốt</Heading>
    </Reveal>
    <div style={{ position: "relative", flex: 1 }}>
      <Box delay={0.9} accent={colors.muted} title="Ruộng" lines={["Độ ẩm", "Kẹp dòng bơm", "Bộ điều khiển"]} style={{ left: 0, top: 70, width: 360 }} />
      <Arrow delay={1.6} color={colors.muted} style={{ left: 380, top: 220, width: 120 }} />
      <Box delay={1.8} accent={colors.text} title="Backend" lines={["Phát hiện", "Lệnh + ACK", "Incident + KPI"]} style={{ left: 520, top: 70, width: 400 }} />
      <Arrow delay={2.6} color={colors.green} style={{ left: 940, top: 120, width: 120 }} />
      <Box delay={2.8} accent={colors.green} title="MongoDB" lines={["Time Series + TTL", "Change Streams · $merge"]} style={{ left: 1080, top: 0, width: 560 }} />
      <Arrow delay={3.8} color={colors.orange} style={{ left: 940, top: 330, width: 120 }} />
      <Box delay={4} accent={colors.orange} title="Datadog" lines={["Metrics · Logs · APM", "6 monitor · SLO"]} style={{ left: 1080, top: 250, width: 560 }} />
    </div>
    <Caption delay={5} text="Lệnh, telemetry, incident, log và trace đều mang cùng một correlationId." />
  </Scene>
);

export const Impact: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const count = (to: number, delay: number) =>
    Math.round(
      interpolate(frame, [delay * fps, delay * fps + 1.2 * fps], [0, to], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.bezier(0.16, 1, 0.3, 1),
      }),
    );
  const stat = (value: string, label: string, delay: number) => (
    <Reveal delay={delay} style={{ flex: 1 }}>
      <div style={{ fontSize: 150, fontWeight: 800, color: colors.dark, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 40, fontWeight: 600, color: colors.dark, marginTop: 16, lineHeight: 1.3 }}>{label}</div>
    </Reveal>
  );
  return (
    <Scene background={colors.green}>
      <Reveal>
        <Eyebrow color={colors.dark}>TÁC ĐỘNG · SỐ LIỆU LẦN CHẠY THẬT</Eyebrow>
      </Reveal>
      <Reveal delay={0.3}>
        <Heading color={colors.dark}>Từ “biết khi ra đồng” sang “biết trong vài giây”</Heading>
      </Reveal>
      <div style={{ display: "flex", gap: 60, marginTop: 40 }}>
        {stat(`${count(6, 1)} s`, "MTTD: lỗi → phát hiện", 1)}
        {stat(`${count(144, 2)} s`, "MTTR: tới khi phục hồi được chứng minh", 2)}
        {stat(`~${count(12, 3)} h`, "nếu chờ kiểm tra thủ công (giả định)", 3)}
      </div>
      <Caption delay={4.5} text="Cùng một sự cố: ruộng mất nước khoảng 2.5 phút thay vì nửa ngày." />
    </Scene>
  );
};

export const Outro: React.FC = () => (
  <Scene background={colors.dark} justify="center">
    <Reveal delay={0.2}>
      <Heading size={128}>Đừng tin ACK.</Heading>
    </Reveal>
    <Reveal delay={1.2}>
      <Heading size={128} color={colors.green}>
        Hãy tin dữ liệu.
      </Heading>
    </Reveal>
    <Reveal delay={2.4}>
      <div style={{ fontSize: 44, color: colors.muted }}>FarmGuard · Đội TENET · Nguyễn Thành Kiệt</div>
      <div style={{ fontFamily: monoFamily, fontSize: 32, color: colors.muted, marginTop: 16 }}>github.com/tienvovn/Gia_lap_IOT</div>
    </Reveal>
  </Scene>
);
