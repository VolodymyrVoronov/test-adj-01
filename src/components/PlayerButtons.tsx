import { useShallow } from "zustand/react/shallow";
import { PauseIcon, PlayIcon, SquareIcon } from "lucide-react";

import { useAppStore } from "@/store/app";

import { Button } from "./ui/button";
import { ButtonGroup } from "@/components/ui/button-group";

export interface IPlayerButtonsProps {
  scheduleFromTimeline: (timelineSeconds: number) => void;
  pausePlayback: () => void;
  stopAll: () => void;
}

const PlayerButtons = ({
  scheduleFromTimeline,
  pausePlayback,
  stopAll,
}: IPlayerButtonsProps) => {
  const [timelinePos, isPlaying, tracks] = useAppStore(
    useShallow((state) => [state.timelinePos, state.isPlaying, state.tracks]),
  );

  return (
    <ButtonGroup className="w-full">
      <Button
        onClick={() => scheduleFromTimeline(timelinePos)}
        disabled={isPlaying || !tracks.length}
        className="flex-1"
        size="lg"
      >
        Play
        <PlayIcon />
      </Button>

      <Button
        onClick={pausePlayback}
        disabled={!isPlaying}
        className="flex-1"
        size="lg"
      >
        Pause
        <PauseIcon />
      </Button>

      <Button
        onClick={stopAll}
        disabled={!isPlaying}
        className="flex-1"
        size="lg"
      >
        Stop
        <SquareIcon />
      </Button>
    </ButtonGroup>
  );
};

export default PlayerButtons;
