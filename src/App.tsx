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
  const eqDryGainRef = useRef<GainNode | null>(null);
  const eqWetGainRef = useRef<GainNode | null>(null);
  const limiterRef = useRef<DynamicsCompressorNode | null>(null);
  const clipperRef = useRef<WaveShaperNode | null>(null);
  const sleepTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const [eqPreset, setEqPreset] = useState<"flat" | "club" | "bass">("flat");
  const [eqMix, setEqMix] = useState(1); // 1 = full EQ
  const [visualPreset, setVisualPreset] = useState<
    "purple" | "sunset" | "ocean"
  >("purple");
  const [sleepTime, setSleepTime] = useState<number | null>(null);

  // ---------------------------------
  // Init AudioContext (user gesture)
  // ---------------------------------

  const initAudio = useCallback(() => {
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

      // Dry / Wet gains for EQ
      const dryGain = ctx.createGain();
      const wetGain = ctx.createGain();

      // Limiter (DynamicsCompressor)
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -1;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.1;

      // Soft clipper
      const clipper = ctx.createWaveShaper();
      const curve = new Float32Array(44100);
      for (let i = 0; i < curve.length; i++) {
        const x = (i * 2) / curve.length - 1;
        curve[i] = Math.tanh(x * 2);
      }
      clipper.curve = curve;
      clipper.oversample = "4x";

      const masterGain = ctx.createGain();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;

      // Wiring: Dry path
      masterGain.connect(dryGain);
      dryGain.connect(analyser);

      // Wiring: Wet path
      masterGain.connect(low);
      low.connect(mid);
      mid.connect(high);
      high.connect(limiter);
      limiter.connect(clipper);
      clipper.connect(wetGain);
      wetGain.connect(analyser);

      analyser.connect(ctx.destination);

      audioCtxRef.current = ctx;
      masterGainRef.current = masterGain;
      analyserRef.current = analyser;
      eqNodesRef.current = [low, mid, high];
      eqDryGainRef.current = dryGain;
      eqWetGainRef.current = wetGain;
      limiterRef.current = limiter;
      clipperRef.current = clipper;

      dryGain.gain.value = 1 - eqMix;
      wetGain.gain.value = eqMix;
    }
  }, [eqMix]);

  const scheduleSleepTimer = (seconds: number | null) => {
    if (sleepTimeoutRef.current) {
      clearTimeout(sleepTimeoutRef.current);
      sleepTimeoutRef.current = null;
    }
    if (seconds !== null && seconds > 0) {
      sleepTimeoutRef.current = setTimeout(() => {
        stopAll();
        setSleepTime(null);
      }, seconds * 1000);
      setSleepTime(seconds);
    }
  };

  // ---------------------------------
  // Load files
  // ---------------------------------

  const handleFiles = useCallback(
    async (files: FileList | null) => {
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
    },
    [initAudio]
  );

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
    activeSourcesRef.current.forEach((s) => {
      try {
        s.stop();
      } catch {
        console.log("Failed to stop source");
      }
    });
    activeSourcesRef.current = [];
    startTimelineRef.current = 0;
    setTimelinePos(0);
    setIsPlaying(false);
    if (sleepTimeoutRef.current) {
      clearTimeout(sleepTimeoutRef.current);
      sleepTimeoutRef.current = null;
    }
  };

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

          <div className="flex gap-2 items-center">
            <span>Sleep Timer:</span>
            <Button
              onClick={() => scheduleSleepTimer(600)}
              variant={sleepTime === 600 ? "default" : "secondary"}
            >
              10 min
            </Button>
            <Button
              onClick={() => scheduleSleepTimer(1200)}
              variant={sleepTime === 1200 ? "default" : "secondary"}
            >
              20 min
            </Button>
            <Button
              onClick={() => scheduleSleepTimer(1800)}
              variant={sleepTime === 1800 ? "default" : "secondary"}
            >
              30 min
            </Button>
            <Button
              onClick={() => scheduleSleepTimer(2400)}
              variant={sleepTime === 2400 ? "default" : "secondary"}
            >
              40 min
            </Button>
            <Button
              onClick={() => scheduleSleepTimer(3000)}
              variant={sleepTime === 3000 ? "default" : "secondary"}
            >
              50 min
            </Button>
            <Button
              onClick={() => scheduleSleepTimer(3600)}
              variant={sleepTime === 3600 ? "default" : "secondary"}
            >
              1 hour
            </Button>
            <Button
              onClick={() => scheduleSleepTimer(7200)}
              variant={sleepTime === 7200 ? "default" : "secondary"}
            >
              2 hours
            </Button>
            <Button
              onClick={() => scheduleSleepTimer(14400)}
              variant={sleepTime === 14400 ? "default" : "secondary"}
            >
              4 hours
            </Button>
          </div>

          <div className="text-sm text-muted-foreground">
            {sleepTime
              ? `Sleep timer: ${(sleepTime / 60).toFixed(0)} min`
              : "No sleep timer set"}
          </div>

          <canvas
            ref={waveformCanvasRef}
            width={800}
            height={100}
            className="rounded-2xl border w-full"
          />

          <div className="space-y-2">
            <label className="font-medium">EQ Presets</label>
            <div className="flex gap-2">
              <Button
                variant={eqPreset === "flat" ? "default" : "outline"}
                onClick={() => {
                  setEqPreset("flat");
                  eqNodesRef.current[0].gain.value = 0;
                  eqNodesRef.current[1].gain.value = 0;
                  eqNodesRef.current[2].gain.value = 0;
                }}
              >
                Flat
              </Button>

              <Button
                variant={eqPreset === "club" ? "default" : "outline"}
                onClick={() => {
                  setEqPreset("club");
                  eqNodesRef.current[0].gain.value = 4;
                  eqNodesRef.current[1].gain.value = 2;
                  eqNodesRef.current[2].gain.value = 4;
                }}
              >
                Club
              </Button>

              <Button
                variant={eqPreset === "bass" ? "default" : "outline"}
                onClick={() => {
                  setEqPreset("bass");
                  eqNodesRef.current[0].gain.value = 8;
                  eqNodesRef.current[1].gain.value = -2;
                  eqNodesRef.current[2].gain.value = 3;
                }}
              >
                Bass Boost
              </Button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm">EQ Mix (Dry / Wet)</label>
            <Slider
              min={0}
              max={1}
              step={0.01}
              value={[eqMix]}
              onValueChange={(v) => {
                const mix = v[0];
                setEqMix(mix);
                if (eqDryGainRef.current && eqWetGainRef.current) {
                  eqDryGainRef.current.gain.value = 1 - mix;
                  eqWetGainRef.current.gain.value = mix;
                }
              }}
            />
          </div>

          <div
            className="h-40 rounded-2xl transition-all"
            style={{
              background: `radial-gradient(circle, ${
                getVisualColors()[0]
              }${energy}), ${getVisualColors()[1]})`,
              transform: `scale(${1 + energy * 0.05})`,
              boxShadow: `0 0 ${energy * 60}px ${getVisualColors()[2]}`,
            }}
          />

          <div className="flex gap-2">
            <Button
              onClick={() => setVisualPreset("purple")}
              variant={visualPreset === "purple" ? "default" : "outline"}
            >
              Purple
            </Button>
            <Button
              onClick={() => setVisualPreset("sunset")}
              variant={visualPreset === "sunset" ? "default" : "outline"}
            >
              Sunset
            </Button>
            <Button
              onClick={() => setVisualPreset("ocean")}
              variant={visualPreset === "ocean" ? "default" : "outline"}
            >
              Ocean
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default App;

