import type { SleepTimer } from "@/types";

export const CROSSFADE_SECONDS = 5;

export const SLEEP_TIMERS: { label: string; value: SleepTimer }[] = [
  { label: "10 minutes", value: 600 },
  { label: "20 minutes", value: 1200 },
  { label: "30 minutes", value: 1800 },
  { label: "40 minutes", value: 2400 },
  { label: "50 minutes", value: 3000 },
  { label: "1 hour", value: 3600 },
  { label: "2 hours", value: 7200 },
  { label: "4 hours", value: 14400 },
];
