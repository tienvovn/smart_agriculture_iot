import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { colors, fontFamily } from "./theme";

const ease = Easing.bezier(0.16, 1, 0.3, 1);

// Fades and lifts its children in, starting `delay` seconds into the scene.
export const Reveal: React.FC<{
  readonly delay?: number;
  readonly children: React.ReactNode;
  readonly style?: React.CSSProperties;
}> = ({ delay = 0, children, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div
      style={{
        opacity: interpolate(frame, [delay * fps, delay * fps + 0.6 * fps], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: ease,
        }),
        translate: interpolate(frame, [delay * fps, delay * fps + 0.6 * fps], ["0px 40px", "0px 0px"], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: ease,
        }),
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// Subtitle bar at the bottom of the frame (stands in for a voice-over).
export const Caption: React.FC<{ readonly text: string; readonly delay?: number }> = ({ text, delay = 0.4 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div
      style={{
        position: "absolute",
        left: 160,
        right: 160,
        bottom: 56,
        display: "flex",
        justifyContent: "center",
        opacity: interpolate(frame, [delay * fps, delay * fps + 0.5 * fps], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
      }}
    >
      <div
        style={{
          background: "rgba(8, 16, 12, 0.82)",
          color: colors.text,
          fontFamily,
          fontSize: 34,
          fontWeight: 500,
          lineHeight: 1.35,
          padding: "16px 32px",
          borderRadius: 14,
          textAlign: "center",
          maxWidth: 1600,
        }}
      >
        {text}
      </div>
    </div>
  );
};

export const Eyebrow: React.FC<{ readonly children: React.ReactNode; readonly color?: string }> = ({
  children,
  color = colors.green,
}) => (
  <div style={{ fontFamily, fontSize: 30, letterSpacing: 5, color, fontWeight: 700 }}>{children}</div>
);

export const Heading: React.FC<{ readonly children: React.ReactNode; readonly color?: string; readonly size?: number }> = ({
  children,
  color = colors.text,
  size = 84,
}) => (
  <h1 style={{ fontFamily, fontSize: size, fontWeight: 800, lineHeight: 1.08, color, margin: 0 }}>{children}</h1>
);

export const Scene: React.FC<{
  readonly background: string;
  readonly children: React.ReactNode;
  readonly justify?: React.CSSProperties["justifyContent"];
}> = ({ background, children, justify = "flex-start" }) => (
  <AbsoluteFill
    style={{
      background,
      fontFamily,
      padding: "110px 140px 190px",
      display: "flex",
      flexDirection: "column",
      justifyContent: justify,
      gap: 48,
    }}
  >
    {children}
  </AbsoluteFill>
);

export const Card: React.FC<{
  readonly label: string;
  readonly title: string;
  readonly body: string;
  readonly accent?: string;
  readonly delay: number;
}> = ({ label, title, body, accent = colors.green, delay }) => (
  <Reveal delay={delay} style={{ flex: 1 }}>
    <div
      style={{
        background: colors.card,
        borderTop: `8px solid ${accent}`,
        borderRadius: "0 0 24px 24px",
        padding: 40,
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}
    >
      <div style={{ fontFamily, fontSize: 28, letterSpacing: 3, color: accent, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 48, fontWeight: 700, color: colors.text, lineHeight: 1.15 }}>{title}</div>
      <div style={{ fontSize: 34, color: colors.muted, lineHeight: 1.4 }}>{body}</div>
    </div>
  </Reveal>
);
