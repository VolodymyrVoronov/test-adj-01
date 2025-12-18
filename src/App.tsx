import { Disc3Icon } from "lucide-react";
import { useCallback, useEffect, useRef, Suspense, lazy } from "react";
import { useShallow } from "zustand/react/shallow";

import { CROSSFADE_SECONDS } from "./constants";
import { useAppStore } from "./store/app";

import TracksUploader from "./components/TracksUploader";

// import EQ from "./components/EQ";
// import Player from "./components/Player";
// import PlayerButtons from "./components/PlayerButtons";
// import SleepTimer from "./components/SleepTimer";
// import Tracks from "./components/Tracks";
// import Visualizer from "./components/Visualizer";
// import Volume from "./components/Volume";
// import Waveform from "./components/Waveform";

const EQ = lazy(() => import("./components/EQ"));
const Player = lazy(() => import("./components/Player"));
const PlayerButtons = lazy(() => import("./components/PlayerButtons"));
const SleepTimer = lazy(() => import("./components/SleepTimer"));
const Tracks = lazy(() => import("./components/Tracks"));
const Visualizer = lazy(() => import("./components/Visualizer"));
const Volume = lazy(() => import("./components/Volume"));
const Waveform = lazy(() => import("./components/Waveform"));

const App = () => {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const eqNodesRef = useRef<BiquadFilterNode[]>([]);
  const eqDryGainRef = useRef<GainNode | null>(null);
  const eqWetGainRef = useRef<GainNode | null>(null);
  const limiterRef = useRef<DynamicsCompressorNode | null>(null);
  const clipperRef = useRef<WaveShaperNode | null>(null);
  const sleepTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const startTimelineRef = useRef(0);
  const startedAtCtxTimeRef = useRef(0);

  const [
    tracks,
    isPlaying,
    totalDuration,
    eqMix,
    setCurrentTrackIndex,
    setIsPlaying,
    setTimelinePos,
    setSleepTime,
    setSleepCountdown,
  ] = useAppStore(
    useShallow((state) => [
      state.tracks,
      state.isPlaying,
      state.totalDuration,
      state.eqMix,
      state.setCurrentTrackIndex,
      state.setIsPlaying,
      state.setTimelinePos,
      state.setSleepTime,
      state.setSleepCountdown,
    ]),
  );

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

  const scheduleFromTimeline = (timelineSeconds: number) => {
    if (!tracks.length) return;

    if (!isPlaying && timelineSeconds >= totalDuration) {
      timelineSeconds = 0;
    }

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

  const pausePlayback = () => {
    if (!isPlaying) return;
    const ctx = audioCtxRef.current!;
    const elapsed = ctx.currentTime - startedAtCtxTimeRef.current;
    startTimelineRef.current += elapsed;
    stopSources();
    setIsPlaying(false);
    setSleepTime(null);
    setSleepCountdown(null);
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
    setCurrentTrackIndex(null);
    if (sleepTimeoutRef.current) {
      clearTimeout(sleepTimeoutRef.current);
      sleepTimeoutRef.current = null;
    }

    setSleepTime(null);
    setSleepCountdown(null);
  };

  useEffect(() => {
    if (!isPlaying) {
      setSleepTime(null);
      setSleepCountdown(null);

      return;
    }

    const ctx = audioCtxRef.current!;

    const id = setInterval(() => {
      const elapsed = ctx.currentTime - startedAtCtxTimeRef.current;
      const newPos = startTimelineRef.current + elapsed;

      setTimelinePos(Math.min(newPos, totalDuration));

      if (newPos >= totalDuration) {
        setIsPlaying(false);
        stopSources();
      }
    }, 100);

    return () => clearInterval(id);
  }, [
    isPlaying,
    setIsPlaying,
    setSleepCountdown,
    setSleepTime,
    setTimelinePos,
    totalDuration,
  ]);

  return (
    <div className="mx-auto grid h-screen max-w-6xl grid-cols-2 grid-rows-[auto_1fr] gap-x-4 gap-y-10 overflow-hidden p-2">
      <h1 className="col-span-2 text-center text-3xl font-bold underline">
        Auto DJ
      </h1>

      <div className="flex flex-col gap-2 overflow-hidden">
        <TracksUploader
          audioCtxRef={audioCtxRef}
          startTimelineRef={startTimelineRef}
          initAudio={initAudio}
        />

        <Suspense
          fallback={
            <div className="flex h-full w-full flex-col items-center justify-center">
              Loading...
            </div>
          }
        >
          <Tracks startTimelineRef={startTimelineRef} />
        </Suspense>
      </div>

      <div className="flex flex-col gap-4 overflow-x-hidden">
        {tracks.length ? (
          <Suspense
            fallback={
              <div className="flex h-full w-full flex-col items-center justify-center">
                Loading...
              </div>
            }
          >
            <Player scheduleFromTimeline={scheduleFromTimeline} />
            <Waveform />
            <PlayerButtons
              scheduleFromTimeline={scheduleFromTimeline}
              pausePlayback={pausePlayback}
              stopAll={stopAll}
            />
            <Volume audioCtxRef={audioCtxRef} masterGainRef={masterGainRef} />
            <SleepTimer sleepTimeoutRef={sleepTimeoutRef} stopAll={stopAll} />
            <EQ
              eqNodesRef={eqNodesRef}
              eqDryGainRef={eqDryGainRef}
              eqWetGainRef={eqWetGainRef}
            />
            <Visualizer analyserRef={analyserRef} />
          </Suspense>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center">
            <Disc3Icon className="animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
