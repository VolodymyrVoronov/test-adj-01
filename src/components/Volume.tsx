import { type RefObject } from "react";
import { useShallow } from "zustand/react/shallow";

import { useAppStore } from "@/store/app";

import { Slider } from "./ui/slider";

export interface IVolumeProps {
  audioCtxRef: RefObject<AudioContext | null>;
  masterGainRef: RefObject<GainNode | null>;
}

const Volume = ({ audioCtxRef, masterGainRef }: IVolumeProps) => {
  const [volume, setVolume] = useAppStore(
    useShallow((state) => [state.volume, state.setVolume]),
  );

  return (
    <div className="flex w-full flex-col gap-2">
      <label htmlFor="volume" className="text-sm font-medium">
        Volume {volume.toFixed(2)}
      </label>

      <Slider
        id="volume"
        min={0}
        max={1}
        step={0.01}
        value={[volume]}
        onValueChange={(v) => {
          const val = v[0];
          setVolume(val);
          if (masterGainRef.current) {
            masterGainRef.current.gain.setTargetAtTime(
              val,
              audioCtxRef.current!.currentTime,
              0.05,
            );
          }
        }}
      />
    </div>
  );
};

export default Volume;
