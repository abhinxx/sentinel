"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EMPTY, reduce, type CallState, type SentinelEvent } from "./stream";

export type Source = { kind: "replay"; name: string } | { kind: "live" };

const LIVE_URL =
  process.env.NEXT_PUBLIC_SENTINEL_SSE ?? "http://localhost:8787/events";

/** Max wall-clock gap between replayed events, so nothing stalls the demo. */
const MAX_GAP_MS = 2500;

export function useEventStream(source: Source) {
  const [state, setState] = useState<CallState>(EMPTY);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [connected, setConnected] = useState(false);
  const [flash, setFlash] = useState(0);

  // Refs so the replay loop isn't torn down on every speed/pause toggle.
  const idx = useRef(0);
  const events = useRef<SentinelEvent[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const playingRef = useRef(playing);
  const speedRef = useRef(speed);
  playingRef.current = playing;
  speedRef.current = speed;

  const push = useCallback((e: SentinelEvent) => {
    setState((s) => reduce(s, e));
    if (e.type === "intercept") setFlash((f) => f + 1);
  }, []);

  const restart = useCallback(() => {
    clearTimeout(timer.current);
    idx.current = 0;
    setState(EMPTY);
    setPlaying(true);
  }, []);

  // ---- replay -------------------------------------------------------------
  useEffect(() => {
    if (source.kind !== "replay") return;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      if (!playingRef.current) {
        timer.current = setTimeout(tick, 120);
        return;
      }
      const list = events.current;
      const i = idx.current;
      if (i >= list.length) return;

      push(list[i]);
      idx.current = i + 1;

      const next = list[i + 1];
      if (!next) return;
      // First event renders immediately: an empty dashboard on load reads as
      // "broken" rather than "waiting".
      const raw = i === 0 ? 0 : (next.t - list[i].t) * 1000;
      const gap = Math.min(raw, MAX_GAP_MS);
      timer.current = setTimeout(tick, Math.max(gap / speedRef.current, 40));
    };

    fetch(`/recordings/${source.name}.json`)
      .then((r) => r.json())
      .then((data: SentinelEvent[]) => {
        if (cancelled) return;
        events.current = data.sort((a, b) => a.seq - b.seq);
        idx.current = 0;
        setState(EMPTY);
        setConnected(true);
        tick();
      })
      .catch(() => setConnected(false));

    return () => {
      cancelled = true;
      clearTimeout(timer.current);
    };
  }, [source.kind, source.kind === "replay" ? source.name : "", push]);

  // ---- live ---------------------------------------------------------------
  useEffect(() => {
    if (source.kind !== "live") return;
    setState(EMPTY);
    const es = new EventSource(LIVE_URL);
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (m) => {
      try {
        push(JSON.parse(m.data) as SentinelEvent);
      } catch {
        /* ignore malformed frame */
      }
    };
    return () => es.close();
  }, [source.kind, push]);

  return {
    state,
    playing,
    setPlaying,
    speed,
    setSpeed,
    connected,
    flash,
    restart,
    progress:
      events.current.length > 0 ? idx.current / events.current.length : 0,
  };
}
