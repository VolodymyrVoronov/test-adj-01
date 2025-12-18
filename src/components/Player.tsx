import { useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { useAppStore } from "@/store/app";

import {
  ScrubBarContainer,
  ScrubBarProgress,
  ScrubBarThumb,
  ScrubBarTimeLabel,
  ScrubBarTrack,
} from "@/components/ui/scrub-bar";

export interface IPlayerProps {
  scheduleFromTimeline: (timelineSeconds: number) => void;
}

const Player = ({ scheduleFromTimeline }: IPlayerProps) => {
  const [timelinePos, totalDuration, setTimelinePos] = useAppStore(
    useShallow((state) => [
      state.timelinePos,
      state.totalDuration,
      state.setTimelinePos,
    ]),
  );

  const [isScrubbing, setIsScrubbing] = useState(false);

  return (
    <div className="flex w-full flex-col gap-2">
      <label htmlFor="scrub-bar" className="text-sm font-medium">
        Timeline
      </label>
      <ScrubBarContainer
        id="scrub-bar"
        duration={totalDuration}
        value={timelinePos}
        onScrub={(time) => {
          scheduleFromTimeline(time);
          setTimelinePos(time);
        }}
        onScrubStart={() => setIsScrubbing(true)}
        onScrubEnd={() => setIsScrubbing(false)}
        className="flex flex-row gap-2"
      >
        <ScrubBarTimeLabel time={timelinePos} />

        <ScrubBarTrack className="mx-2">
          <ScrubBarProgress />
          <ScrubBarThumb className="bg-primary" data-scrubbing={isScrubbing} />
        </ScrubBarTrack>

        <ScrubBarTimeLabel time={totalDuration} />
      </ScrubBarContainer>
    </div>
  );
};

export default Player;
