import {
  ArrowDownIcon,
  ArrowUpIcon,
  Disc3Icon,
  PlayIcon,
  XIcon,
} from "lucide-react";
import type { RefObject } from "react";
import { useShallow } from "zustand/react/shallow";

import { useAppStore } from "@/store/app";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Button } from "./ui/button";

export interface ITracksUploaderProps {
  startTimelineRef: RefObject<number>;
}

const Tracks = ({ startTimelineRef }: ITracksUploaderProps) => {
  const [
    tracks,
    currentTrackIndex,
    timelinePos,
    isPlaying,
    setTracks,
    setTotalDuration,
    setTimelinePos,
  ] = useAppStore(
    useShallow((state) => [
      state.tracks,
      state.currentTrackIndex,
      state.timelinePos,
      state.isPlaying,
      state.setTracks,
      state.setTotalDuration,
      state.setTimelinePos,
    ]),
  );

  const deleteTrack = (trackId: string) => {
    const trackIndex = tracks.findIndex((t) => t.id === trackId);
    if (trackIndex === -1) return;

    // Check if track is currently playing
    let cursor = startTimelineRef.current;
    let isTrackPlaying = false;
    for (let i = 0; i < tracks.length; i++) {
      const t = tracks[i];
      if (cursor + t.duration > timelinePos) {
        if (t.id === trackId && isPlaying) {
          isTrackPlaying = true;
        }
        break;
      }
      cursor += t.duration;
    }

    if (!isTrackPlaying) {
      const newTracks = tracks.filter((t) => t.id !== trackId);
      setTracks(newTracks);

      // Recalculate total duration
      const newTotalDuration = newTracks.reduce(
        (acc, t) => acc + t.duration,
        0,
      );
      setTotalDuration(newTotalDuration);

      // Adjust timelinePos if it is beyond new total duration
      if (timelinePos > newTotalDuration) {
        setTimelinePos(newTotalDuration);
        startTimelineRef.current = newTotalDuration;
      }
    }
  };

  const moveTrackUp = (trackIndex: number) => {
    if (trackIndex === 0) return;

    const n = [...tracks];
    [n[trackIndex - 1], n[trackIndex]] = [n[trackIndex], n[trackIndex - 1]];
    setTracks(n);
  };

  const moveTrackDown = (trackIndex: number) => {
    if (trackIndex === tracks.length - 1) return;

    const n = [...tracks];
    [n[trackIndex + 1], n[trackIndex]] = [n[trackIndex], n[trackIndex + 1]];

    setTracks(n);
  };

  if (tracks.length === 0) {
    return (
      <Empty>
        <EmptyMedia variant="icon">
          <Disc3Icon className="animate-spin" />
        </EmptyMedia>
        <EmptyHeader>No tracks found</EmptyHeader>
        <EmptyTitle>Upload some audio files</EmptyTitle>
        <EmptyDescription>
          Start by uploading some audio files. Find the "Upload" button at the
          top of the page.
        </EmptyDescription>
      </Empty>
    );
  }

  return (
    <div className="h-svh space-y-2 overflow-auto">
      {tracks.map((t, i) => {
        const isPlayingTrack = currentTrackIndex === i;

        return (
          <Item variant="outline" key={t.id}>
            <ItemMedia variant="icon">
              {isPlayingTrack && <PlayIcon className="animate-pulse" />}
            </ItemMedia>

            <ItemContent>
              <ItemTitle>{t.file.name}</ItemTitle>
            </ItemContent>

            <ItemActions>
              <Button
                size="icon-sm"
                disabled={isPlayingTrack}
                onClick={() => deleteTrack(t.id)}
                title={`Delete ${t.file.name}`}
                variant="destructive"
              >
                <XIcon />
              </Button>

              <Button
                size="icon-sm"
                disabled={i === 0 || isPlayingTrack}
                onClick={() => moveTrackUp(i)}
                title={`Move ${t.file.name} up`}
              >
                <ArrowUpIcon />
              </Button>

              <Button
                size="icon-sm"
                disabled={i === tracks.length - 1 || isPlayingTrack}
                onClick={() => moveTrackDown(i)}
                title={`Move ${t.file.name} down`}
              >
                <ArrowDownIcon />
              </Button>
            </ItemActions>
          </Item>
        );
      })}
    </div>
  );
};

export default Tracks;
