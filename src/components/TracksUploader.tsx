import { AnimatePresence, motion } from "motion/react";
import { useCallback, useRef, useState, type RefObject } from "react";
import { useShallow } from "zustand/react/shallow";

import { useAppStore } from "@/store/app";
import type { ITrack } from "@/types";

import { Input } from "@/components/ui/input";
import { Item, ItemContent, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

export interface ITracksUploaderProps {
  audioCtxRef: RefObject<AudioContext | null>;
  startTimelineRef: RefObject<number>;

  initAudio: () => void;
}

const TracksUploader = ({
  audioCtxRef,
  startTimelineRef,
  initAudio,
}: ITracksUploaderProps) => {
  const [
    tracks,
    timelinePos,
    totalDuration,
    setTracks,
    setTotalDuration,
    setTimelinePos,
  ] = useAppStore(
    useShallow((state) => [
      state.tracks,
      state.timelinePos,
      state.totalDuration,
      state.setTracks,
      state.setTotalDuration,
      state.setTimelinePos,
    ]),
  );

  const inputRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files) return;

      setUploading(true);

      initAudio();

      const ctx = audioCtxRef.current!;
      const newTracks: ITrack[] = [];

      for (const file of Array.from(files)) {
        const buf = await file.arrayBuffer();
        const audioBuf = await ctx.decodeAudioData(buf);
        newTracks.push({
          id: crypto.randomUUID(),
          file,
          buffer: audioBuf,
          duration: audioBuf.duration,
        });
      }

      const updatedTracks = [...tracks, ...newTracks];
      setTracks(updatedTracks);

      inputRef.current!.value = "";

      const newTotalDuration = updatedTracks.reduce(
        (acc, t) => acc + t.duration,
        0,
      );

      setTotalDuration(newTotalDuration);

      if (timelinePos >= totalDuration) {
        setTimelinePos(newTotalDuration);
        startTimelineRef.current = newTotalDuration;
      }

      setUploading(false);
    },
    [
      audioCtxRef,
      initAudio,
      setTimelinePos,
      setTotalDuration,
      setTracks,
      startTimelineRef,
      timelinePos,
      totalDuration,
      tracks,
    ],
  );

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="tracks">
        <span>Upload your tracks</span>
      </Label>
      <Input
        ref={inputRef}
        id="tracks"
        type="file"
        accept="audio/*"
        multiple
        onChange={(e) => handleFiles(e.target.files)}
        disabled={uploading}
      />

      <AnimatePresence initial={false} mode="wait">
        {uploading && (
          <motion.div
            key="loading"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{
              duration: 0.3,
              ease: "easeInOut",
            }}
          >
            <Item variant="muted">
              <ItemMedia>
                <Spinner />
              </ItemMedia>
              <ItemContent>
                <ItemTitle className="line-clamp-1">
                  Uploading tracks...
                </ItemTitle>
              </ItemContent>
            </Item>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TracksUploader;
