import { loadFont } from "@remotion/google-fonts/BeVietnamPro";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";

export const { fontFamily } = loadFont("normal", {
  weights: ["400", "500", "700", "800"],
  subsets: ["latin", "vietnamese"],
});

export const { fontFamily: monoFamily } = loadMono("normal", {
  weights: ["400", "600"],
  subsets: ["latin"],
});

export const colors = {
  dark: "#0F1F17",
  card: "#183326",
  light: "#F3F5EF",
  text: "#EAF2EC",
  muted: "#B7CABD",
  green: "#3FCF8E",
  orange: "#F59E42",
  ink: "#13261C",
};
