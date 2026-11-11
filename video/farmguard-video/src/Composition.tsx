import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { Composition, useVideoConfig } from "remotion";
import { AppProof, DatadogScene, IncidentChart } from "./scenes/EvidenceScenes";
import { Architecture, Definition, Hook, Impact, Outro, Problem } from "./scenes/TextScenes";

const FPS = 30;
const T = 15; // transition length in frames
// Scene lengths in seconds: 10 + 11 + 11 + 12 + 20 + 14 + 16 + 12 + 9 = 115 s, minus 8 transitions × 0.5 s = 111 s.
const TOTAL = (10 + 11 + 11 + 12 + 20 + 14 + 16 + 12 + 9) * FPS - 8 * T;

export const FarmGuardVideo: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence name="Hook" durationInFrames={10 * fps}>
        <Hook />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: T })} />
      <TransitionSeries.Sequence name="Problem" durationInFrames={11 * fps}>
        <Problem />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: T })} />
      <TransitionSeries.Sequence name="Definition" durationInFrames={11 * fps}>
        <Definition />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: T })} />
      <TransitionSeries.Sequence name="Architecture" durationInFrames={12 * fps}>
        <Architecture />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={linearTiming({ durationInFrames: T })} />
      <TransitionSeries.Sequence name="Incident chart" durationInFrames={20 * fps}>
        <IncidentChart />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: T })} />
      <TransitionSeries.Sequence name="App proof" durationInFrames={14 * fps}>
        <AppProof />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={linearTiming({ durationInFrames: T })} />
      <TransitionSeries.Sequence name="Datadog" durationInFrames={16 * fps}>
        <DatadogScene />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: T })} />
      <TransitionSeries.Sequence name="Impact" durationInFrames={12 * fps}>
        <Impact />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: T })} />
      <TransitionSeries.Sequence name="Outro" durationInFrames={9 * fps}>
        <Outro />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};

export const MyComposition = () => {
  return (
    <Composition
      id="FarmGuard"
      component={FarmGuardVideo}
      durationInFrames={TOTAL}
      fps={FPS}
      width={1920}
      height={1080}
    />
  );
};
