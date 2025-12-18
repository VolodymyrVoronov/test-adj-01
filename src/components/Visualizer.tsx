import { useEffect, useRef, type RefObject } from "react";
import { useShallow } from "zustand/react/shallow";

import { useAppStore } from "@/store/app";

import { Button } from "./ui/button";
import { ButtonGroup } from "./ui/button-group";

export interface IVisualizerProps {
  analyserRef: RefObject<AnalyserNode | null>;
}

const Visualizer = ({ analyserRef }: IVisualizerProps) => {
  const [
    tracks,
    visualPreset,
    energy,
    timelinePos,
    totalDuration,
    setVisualPreset,
    setEnergy,
  ] = useAppStore(
    useShallow((state) => [
      state.tracks,
      state.visualPreset,
      state.energy,
      state.timelinePos,
      state.totalDuration,
      state.setVisualPreset,
      state.setEnergy,
    ]),
  );

  const waveformCanvasRef = useRef<HTMLCanvasElement>(null);

  const getVisualColors = () => {
    switch (visualPreset) {
      case "sunset":
        return [
          "rgba(255,94,0,",
          "rgba(255,195,113,0.15)",
          "rgba(255,94,0,0.6)",
        ];
      case "ocean":
        return [
          "rgba(0,123,255,",
          "rgba(0,200,255,0.15)",
          "rgba(0,123,255,0.6)",
        ];
      default:
        return [
          "rgba(139,92,246,",
          "rgba(59,130,246,0.15)",
          "rgba(139,92,246,0.6)",
        ];
    }
  };

  // ---------------------------------
  // Audio-reactive visuals
  // ---------------------------------

  useEffect(() => {
    if (!analyserRef || !analyserRef.current) return;

    const analyser = analyserRef.current;

    if (!analyser) return;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let raf: number;

    const tick = () => {
      analyser.getByteFrequencyData(dataArray);
      const sum = dataArray.reduce((a, b) => a + b, 0);
      setEnergy(sum / (dataArray.length * 255));
      raf = requestAnimationFrame(tick);
    };

    tick();

    return () => cancelAnimationFrame(raf);
  }, [analyserRef, setEnergy, tracks]);

  // Waveform overview of entire timeline with current playback marker
  useEffect(() => {
    if (!waveformCanvasRef || !waveformCanvasRef.current || !tracks.length)
      return;

    const canvas = waveformCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const width = canvas.width;
    const height = canvas.height;

    const mergedData: number[] = [];
    tracks.forEach((track) => {
      const raw = track.buffer.getChannelData(0);
      const step = Math.ceil(raw.length / (width / tracks.length));
      for (let i = 0; i < raw.length; i += step) {
        mergedData.push(raw[i]);
      }
    });

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      const middle = height / 2;
      const playedWidth = Math.floor((timelinePos / totalDuration) * width);

      mergedData.forEach((val, i) => {
        const y = val * middle;
        if (i <= playedWidth) {
          ctx.fillStyle = "#8B5CF6"; // bright color for played
        } else {
          ctx.fillStyle = "rgba(139,92,246,0.3)"; // dimmed color for unplayed
        }
        ctx.fillRect(i, middle - y, 1, y * 2);
      });

      requestAnimationFrame(draw);
    };

    draw();
  }, [tracks, timelinePos, totalDuration, waveformCanvasRef]);

  return (
    <div className="flex flex-col gap-2">
      <div
        className="m-10 h-40 rounded-2xl transition-all"
        style={{
          background: `radial-gradient(circle, ${
            getVisualColors()[0]
          }${energy}), ${getVisualColors()[1]})`,
          transform: `scale(${1 + energy * 0.05})`,
          boxShadow: `0 0 ${energy * 60}px ${getVisualColors()[2]}`,
        }}
      />

      <ButtonGroup className="w-full">
        <Button
          onClick={() => setVisualPreset("purple")}
          variant={visualPreset === "purple" ? "default" : "outline"}
          className="flex-1"
          size="lg"
        >
          Purple
        </Button>
        <Button
          onClick={() => setVisualPreset("sunset")}
          variant={visualPreset === "sunset" ? "default" : "outline"}
          className="flex-1"
          size="lg"
        >
          Sunset
        </Button>
        <Button
          onClick={() => setVisualPreset("ocean")}
          variant={visualPreset === "ocean" ? "default" : "outline"}
          className="flex-1"
          size="lg"
        >
          Ocean
        </Button>
      </ButtonGroup>
    </div>
  );
};

export default Visualizer;
