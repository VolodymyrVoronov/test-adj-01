import { produce } from "immer";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

import type { EqPreset, ITrack, VisualPreset } from "@/types";

export interface IAppStoreState {
  tracks: ITrack[];
  isPlaying: boolean;
  timelinePos: number;
  totalDuration: number;
  energy: number;
  currentTrackIndex: number | null;
  eqPreset: EqPreset;
  eqMix: number;
  visualPreset: VisualPreset;
  volume: number;
  sleepTime: number | null;
  sleepCountdown: number | null;
}

export interface IAppStoreActions {
  setTracks: (tracks: ITrack[]) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setTimelinePos: (timelinePos: number) => void;
  setTotalDuration: (totalDuration: number) => void;
  setEnergy: (energy: number) => void;
  setCurrentTrackIndex: (currentTrackIndex: number | null) => void;
  setEqPreset: (eqPreset: EqPreset) => void;
  setEqMix: (eqMix: number) => void;
  setVisualPreset: (visualPreset: VisualPreset) => void;
  setVolume: (volume: number) => void;
  setSleepTime: (sleepTime: number | null) => void;
  setSleepCountdown: (sleepCountdown: number | null) => void;
}

const initialStoreState: IAppStoreState = {
  tracks: [],
  isPlaying: false,
  timelinePos: 0,
  totalDuration: 0,
  energy: 0,
  currentTrackIndex: null,
  eqPreset: "flat",
  eqMix: 1,
  visualPreset: "purple",
  volume: 1,
  sleepTime: null,
  sleepCountdown: null,
};

export const useAppStore = create(
  immer<IAppStoreState & IAppStoreActions>((set) => ({
    ...initialStoreState,

    setTracks: (tracks) => {
      set(
        produce((draft) => {
          draft.tracks = tracks;
        }),
      );
    },

    setIsPlaying: (isPlaying) => {
      set(
        produce((draft) => {
          draft.isPlaying = isPlaying;
        }),
      );
    },

    setTimelinePos: (timelinePos) => {
      set(
        produce((draft) => {
          draft.timelinePos = timelinePos;
        }),
      );
    },

    setTotalDuration: (totalDuration) => {
      set(
        produce((draft) => {
          draft.totalDuration = totalDuration;
        }),
      );
    },

    setEnergy: (energy) => {
      set(
        produce((draft) => {
          draft.energy = energy;
        }),
      );
    },

    setCurrentTrackIndex: (currentTrackIndex) => {
      set(
        produce((draft) => {
          draft.currentTrackIndex = currentTrackIndex;
        }),
      );
    },

    setEqPreset: (eqPreset) => {
      set(
        produce((draft) => {
          draft.eqPreset = eqPreset;
        }),
      );
    },

    setEqMix: (eqMix) => {
      set(
        produce((draft) => {
          draft.eqMix = eqMix;
        }),
      );
    },

    setVisualPreset: (visualPreset) => {
      set(
        produce((draft) => {
          draft.visualPreset = visualPreset;
        }),
      );
    },

    setVolume: (volume) => {
      set(
        produce((draft) => {
          draft.volume = volume;
        }),
      );
    },

    setSleepTime: (sleepTime) => {
      set(
        produce((draft) => {
          draft.sleepTime = sleepTime;
        }),
      );
    },

    setSleepCountdown: (sleepCountdown) => {
      set(
        produce((draft) => {
          draft.sleepCountdown = sleepCountdown;
        }),
      );
    },
  })),
);
