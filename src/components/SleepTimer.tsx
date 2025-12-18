import { AnimatePresence, motion } from "motion/react";
import { useEffect, type RefObject } from "react";
import { useShallow } from "zustand/react/shallow";

import { SLEEP_TIMERS } from "@/constants";
import { formatTime } from "@/helpers";
import { useAppStore } from "@/store/app";

import { Button } from "./ui/button";

export interface ISleepTimerProps {
  sleepTimeoutRef: RefObject<ReturnType<typeof setTimeout> | null>;

  stopAll: () => void;
}

const SleepTimer = ({ sleepTimeoutRef, stopAll }: ISleepTimerProps) => {
  const [
    totalDuration,
    sleepTime,
    sleepCountdown,
    setSleepTime,
    setSleepCountdown,
  ] = useAppStore(
    useShallow((state) => [
      state.totalDuration,
      state.sleepTime,
      state.sleepCountdown,
      state.setSleepTime,
      state.setSleepCountdown,
    ]),
  );

  useEffect(() => {
    if (sleepTime === null) {
      return;
    }

    const interval = setInterval(() => {
      if (sleepCountdown === null) return;
      if (sleepCountdown <= 1) {
        clearInterval(interval);
        return;
      }

      setSleepCountdown(sleepCountdown - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [setSleepCountdown, sleepCountdown, sleepTime]);

  if (!totalDuration || totalDuration < 600) {
    return null;
  }

  const scheduleSleepTimer = (seconds: number | null) => {
    if (sleepTimeoutRef.current) {
      clearTimeout(sleepTimeoutRef.current);
      sleepTimeoutRef.current = null;
    }
    if (seconds !== null && seconds > 0) {
      sleepTimeoutRef.current = setTimeout(() => {
        stopAll();
        setSleepTime(null);
      }, seconds * 1000);

      setSleepTime(seconds);
      setSleepCountdown(seconds);
    }
  };

  const resetSleepTimer = () => {
    if (sleepTimeoutRef.current) {
      clearTimeout(sleepTimeoutRef.current);
      sleepTimeoutRef.current = null;
    }
    setSleepTime(null);
  };

  return (
    <div className="flex w-full flex-col gap-2">
      <span className="text-sm font-medium">Sleep Timer</span>

      <div className="flex flex-row flex-wrap gap-2">
        {SLEEP_TIMERS.map(({ label, value }) => {
          if (totalDuration > value) {
            return (
              <Button
                key={value}
                variant={sleepTime === value ? "default" : "outline"}
                onClick={() => scheduleSleepTimer(value)}
                size="sm"
              >
                {label}
              </Button>
            );
          } else {
            return null;
          }
        })}
      </div>

      <AnimatePresence mode="wait" key={sleepCountdown}>
        {sleepCountdown !== null && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">
              Sleep timer will be activated in:
            </span>
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
              className="text-muted-foreground text-sm font-semibold"
            >
              {formatTime(sleepCountdown)}
            </motion.span>
          </div>
        )}
      </AnimatePresence>

      {sleepTime && (
        <Button variant="destructive" onClick={() => resetSleepTimer()}>
          Reset Sleep Timer
        </Button>
      )}
    </div>
  );
};

export default SleepTimer;
