import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";

type Track = {
  id: string;
  file: File;
  buffer: AudioBuffer;
  duration: number;
};

const CROSSFADE_SECONDS = 4;

const App = () => {
  // Audio core
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const waveformCanvasRef = useRef<HTMLCanvasElement>(null);
  const eqNodesRef = useRef<BiquadFilterNode[]>([]);

  // Playback refs
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const startTimelineRef = useRef(0); // seconds
  const startedAtCtxTimeRef = useRef(0);

  // State
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timelinePos, setTimelinePos] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [energy, setEnergy] = useState(0);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(
    null
  );
  const [eq, setEq] = useState({
    low: 0,
    mid: 0,
    high: 0,
  });

  // ---------------------------------
  // Init AudioContext (user gesture)
  // ---------------------------------

  const initAudio = () => {
    if (!audioCtxRef.current) {
      const ctx = new AudioContext();

      // EQ filters
      const low = ctx.createBiquadFilter();
      low.type = "lowshelf";
      low.frequency.value = 120;

      const mid = ctx.createBiquadFilter();
      mid.type = "peaking";
      mid.frequency.value = 1000;
      mid.Q.value = 1;

      const high = ctx.createBiquadFilter();
      high.type = "highshelf";
      high.frequency.value = 6000;

      // Gain + analyser
      const gain = ctx.createGain();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;

      // Wiring:
      // source -> EQ -> gain -> analyser -> speakers
      low.connect(mid);
      mid.connect(high);
      high.connect(gain);
      gain.connect(analyser);
      analyser.connect(ctx.destination);

      audioCtxRef.current = ctx;
      masterGainRef.current = low; // sources connect here
      analyserRef.current = analyser;
      eqNodesRef.current = [low, mid, high];
    }
  };

  // ---------------------------------
  // Load files
  // ---------------------------------

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files) return;
    initAudio();

    const ctx = audioCtxRef.current!;
    const loaded: Track[] = [];

    for (const file of Array.from(files)) {
      const buf = await file.arrayBuffer();
      const audioBuf = await ctx.decodeAudioData(buf);
      loaded.push({
        id: crypto.randomUUID(),
        file,
        buffer: audioBuf,
        duration: audioBuf.duration,
      });
    }

    setTracks(loaded);

    const total = loaded.reduce((acc, t) => acc + t.duration, 0);
    setTotalDuration(total);
  }, []);

  // ---------------------------------
  // Stop all active sources
  // ---------------------------------

  const stopSources = () => {
    activeSourcesRef.current.forEach((s) => {
      try {
        s.stop();
      } catch {
        console.log("Failed to stop source");
      }
    });
    activeSourcesRef.current = [];
  };

  // ---------------------------------
  // Core playback engine (stateless)
  // ---------------------------------

  const scheduleFromTimeline = (timelineSeconds: number) => {
    if (!tracks.length) return;
    initAudio();

    const ctx = audioCtxRef.current!;
    const masterGain = masterGainRef.current!;

    stopSources();

    let cursor = timelineSeconds;
    let ctxTime = ctx.currentTime + 0.05;
    let foundCurrent = false;

    tracks.forEach((track, index) => {
      const dur = track.duration;

      if (cursor >= dur) {
        cursor -= dur;
        return;
      }

      if (!foundCurrent) {
        setCurrentTrackIndex(index);
        foundCurrent = true;
      }

      const src = ctx.createBufferSource();
      const gain = ctx.createGain();

      src.buffer = track.buffer;

      src.connect(gain);
      gain.connect(masterGain);

      const playDur = dur - cursor;

      // fades
      gain.gain.setValueAtTime(0, ctxTime);
      gain.gain.linearRampToValueAtTime(1, ctxTime + 0.05);
      gain.gain.setValueAtTime(1, ctxTime + playDur - CROSSFADE_SECONDS);
      gain.gain.linearRampToValueAtTime(0, ctxTime + playDur);

      src.start(ctxTime, cursor);

      activeSourcesRef.current.push(src);

      ctxTime += playDur - CROSSFADE_SECONDS;
      cursor = 0;
    });

    startTimelineRef.current = timelineSeconds;
    startedAtCtxTimeRef.current = ctx.currentTime;
    setIsPlaying(true);
  };

  const pausePlayback = () => {
    if (!isPlaying) return;
    const ctx = audioCtxRef.current!;
    const elapsed = ctx.currentTime - startedAtCtxTimeRef.current;
    startTimelineRef.current += elapsed;
    stopSources();
    setIsPlaying(false);
  };

  const stopAll = () => {
    stopSources();
    startTimelineRef.current = 0;
    setTimelinePos(0);
    setIsPlaying(false);
  };

  // ---------------------------------
  // Timeline tracking
  // ---------------------------------

  useEffect(() => {
    if (!isPlaying) return;

    const ctx = audioCtxRef.current!;
    const id = setInterval(() => {
      const elapsed = ctx.currentTime - startedAtCtxTimeRef.current;
      setTimelinePos(
        Math.min(startTimelineRef.current + elapsed, totalDuration)
      );
    }, 100);

    return () => clearInterval(id);
  }, [isPlaying, totalDuration]);

  // ---------------------------------
  // Audio-reactive visuals
  // ---------------------------------

  useEffect(() => {
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
  }, [tracks]);

  // Waveform overview of entire timeline with current playback marker
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

  return (
    <div className="min-h-screen p-6 bg-background">
      <Card className="max-w-4xl mx-auto">
        <CardContent className="space-y-6">
          <h1 className="text-3xl font-bold">Auto-DJ</h1>

          <input
            type="file"
            accept="audio/*"
            multiple
            onChange={(e) => handleFiles(e.target.files)}
          />

          <div className="space-y-2">
            {tracks.map((t, i) => {
              const isPlayingTrack = currentTrackIndex === i;

              return (
                <div
                  key={t.id}
                  className={`flex justify-between items-center border p-2 rounded transition
                            ${
                              isPlayingTrack
                                ? "bg-violet-500/10 border-violet-500"
                                : ""
                            }`}
                >
                  <span className="truncate max-w-[70%]">
                    {t.file.name}
                    {isPlayingTrack && "  ▶ Playing"}
                  </span>

                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      disabled={i === 0 || isPlayingTrack}
                      onClick={() => {
                        const n = [...tracks];
                        [n[i - 1], n[i]] = [n[i], n[i - 1]];
                        setTracks(n);
                      }}
                    >
                      ↑
                    </Button>

                    <Button
                      size="sm"
                      disabled={i === tracks.length - 1 || isPlayingTrack}
                      onClick={() => {
                        const n = [...tracks];
                        [n[i + 1], n[i]] = [n[i], n[i + 1]];
                        setTracks(n);
                      }}
                    >
                      ↓
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-2">
            <label>Timeline</label>
            <Slider
              key="timeline"
              min={0}
              max={totalDuration}
              step={0.1}
              value={[timelinePos]}
              onValueChange={(v) => {
                setTimelinePos(v[0]);
                scheduleFromTimeline(v[0]);
              }}
            />
            <div className="text-xs text-muted-foreground">
              {timelinePos.toFixed(1)}s / {totalDuration.toFixed(1)}s
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => scheduleFromTimeline(timelinePos)}>
              Play
            </Button>
            <Button onClick={pausePlayback} disabled={!isPlaying}>
              Pause
            </Button>
            <Button onClick={stopAll} disabled={!isPlaying}>
              Stop
            </Button>
          </div>

          <canvas
            ref={waveformCanvasRef}
            width={800}
            height={100}
            className="rounded-2xl border w-full"
          />

          <div className="space-y-4">
            <h2 className="font-semibold">Equalizer</h2>

            <div>
              <label className="text-sm">Bass</label>
              <Slider
                min={-20}
                max={20}
                step={1}
                value={[eq.low]}
                onValueChange={(v) => {
                  setEq((e) => ({ ...e, low: v[0] }));
                  if (eqNodesRef.current[0]) {
                    eqNodesRef.current[0].gain.value = v[0];
                  }
                }}
              />
            </div>

            <div>
              <label className="text-sm">Mid</label>
              <Slider
                min={-20}
                max={20}
                step={1}
                value={[eq.mid]}
                onValueChange={(v) => {
                  setEq((e) => ({ ...e, mid: v[0] }));
                  if (eqNodesRef.current[1]) {
                    eqNodesRef.current[1].gain.value = v[0];
                  }
                }}
              />
            </div>

            <div>
              <label className="text-sm">Treble</label>
              <Slider
                min={-20}
                max={20}
                step={1}
                value={[eq.high]}
                onValueChange={(v) => {
                  setEq((e) => ({ ...e, high: v[0] }));
                  if (eqNodesRef.current[2]) {
                    eqNodesRef.current[2].gain.value = v[0];
                  }
                }}
              />
            </div>
          </div>

          <div
            className="h-40 rounded-2xl transition-all"
            style={{
              background: `radial-gradient(circle, rgba(139,92,246,${energy}), rgba(59,130,246,0.15))`,
              transform: `scale(${1 + energy * 0.05})`,
              boxShadow: `0 0 ${energy * 60}px rgba(139,92,246,0.6)`,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default App;

