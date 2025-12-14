export interface ITrack {
  id: string;
  file: File;
  buffer: AudioBuffer;
  duration: number;
}

export type EqPreset = "flat" | "club" | "bass";
export type VisualPreset = "purple" | "sunset" | "ocean";
