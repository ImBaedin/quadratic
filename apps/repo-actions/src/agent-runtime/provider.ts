import type { RunArtifact, RunEvent, RunUsage } from "./events";

export interface RunEventSink {
  append(
    event: Omit<RunEvent, "sequence" | "timestamp"> & { sequence?: number; timestamp?: number },
  ): Promise<void>;
  list(): Promise<RunEvent[]>;
}

export interface ArtifactSink {
  append(artifact: RunArtifact): Promise<void>;
  list(): Promise<RunArtifact[]>;
}

export interface UsageSink {
  set(usage: RunUsage): Promise<void>;
  get(): Promise<RunUsage | undefined>;
}
