export interface ITrack {
  id: string;
  file: File;
  buffer: AudioBuffer;
  duration: number;
}

export type EqPreset = "flat" | "club" | "bass";
export type VisualPreset = "purple" | "sunset" | "ocean";

export type SleepTimer = 600 | 1200 | 1800 | 2400 | 3000 | 3600 | 7200 | 14400;
