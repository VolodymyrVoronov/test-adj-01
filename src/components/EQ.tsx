import type { RefObject } from "react";
import { useShallow } from "zustand/react/shallow";

import { useAppStore } from "@/store/app";

import { Button } from "./ui/button";
import { Slider } from "./ui/slider";
import { ButtonGroup } from "./ui/button-group";

export interface IEQProps {
  eqNodesRef: RefObject<BiquadFilterNode[]>;
  eqDryGainRef: RefObject<GainNode | null>;
  eqWetGainRef: RefObject<GainNode | null>;
}

const EQ = ({ eqNodesRef, eqDryGainRef, eqWetGainRef }: IEQProps) => {
  const [eqPreset, eqMix, setEqPreset, setEqMix] = useAppStore(
    useShallow((state) => [
      state.eqPreset,
      state.eqMix,
      state.setEqPreset,
      state.setEqMix,
    ]),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label className="font-medium">EQ Presets</label>
        <ButtonGroup className="w-full">
          <Button
            variant={eqPreset === "flat" ? "default" : "outline"}
            onClick={() => {
              setEqPreset("flat");
              eqNodesRef.current[0].gain.value = 0;
              eqNodesRef.current[1].gain.value = 0;
              eqNodesRef.current[2].gain.value = 0;
            }}
            className="flex-1"
            size="lg"
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
            className="flex-1"
            size="lg"
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
            className="flex-1"
            size="lg"
          >
            Bass Boost
          </Button>
        </ButtonGroup>
      </div>

      <div className="flex flex-col gap-2">
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
    </div>
  );
};

export default EQ;
