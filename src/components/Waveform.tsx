import { useEffect, useRef } from "react";
import { useShallow } from "zustand/react/shallow";

import { useAppStore } from "@/store/app";

const Waveform = () => {
  const [totalDuration, tracks, timelinePos] = useAppStore(
    useShallow((state) => [
      state.totalDuration,
      state.tracks,
      state.timelinePos,
    ]),
  );

  const waveformCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!waveformCanvasRef.current || !tracks.length) return;
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
  }, [tracks, timelinePos, totalDuration]);

  if (!tracks.length) return null;

  return (
    <canvas
      ref={waveformCanvasRef}
      width={800}
      height={100}
      className="w-full rounded-2xl border"
    />
  );
};

export default Waveform;
