"use client";

import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Dropdown,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Option,
  Spinner,
  SpinButton,
  Tag,
  TagGroup,
} from "@fluentui/react-components";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { isoToLocal } from "@/features/campus/logic";
import { DemandPicker } from "@/features/campus/pickers";
import type { DemandRef } from "@/features/campus/types";
import { errorMessage } from "@/lib/api/errors";
import { eventsApi } from "./api";
import { CHANNEL_LABELS, EVENT_KINDS, KIND_LABELS, localToIso } from "./logic";
import type { EventKind, EventOut, NotifyChannel } from "./types";
import { useEventMutation } from "./use-events";

const CHANNELS = Object.keys(CHANNEL_LABELS) as NotifyChannel[];

/** Create or edit a recruitment event (kind, Demands, times, venue / video link, notify channel). */
export function EventEditorDialog({ event, onClose }: { event: EventOut | null; onClose: () => void }) {
  const router = useRouter();
  const toast = useAppToast();
  const [name, setName] = useState(event?.name ?? "");
  const [kind, setKind] = useState<EventKind>(event?.kind ?? "walk_in");
  const [demands, setDemands] = useState<DemandRef[]>(event?.demands ?? []);
  const [starts, setStarts] = useState(isoToLocal(event?.starts_at));
  const [ends, setEnds] = useState(isoToLocal(event?.ends_at));
  const [tz, setTz] = useState(event?.timezone ?? "Asia/Kolkata");
  const [venue, setVenue] = useState(event?.venue ?? "");
  const [video, setVideo] = useState(event?.video_link ?? "");
  const [channel, setChannel] = useState<NotifyChannel>(event?.notify_channel ?? "none");
  const [avg, setAvg] = useState<number | null>(event?.avg_interview_minutes ?? null);
  const [error, setError] = useState<string | null>(null);
  const save = useEventMutation(async () => {
    const common = {
      name: name.trim(),
      demand_ids: demands.map((d) => d.id),
      starts_at: localToIso(starts) ?? "",
      ends_at: localToIso(ends) ?? "",
      timezone: tz.trim() || "Asia/Kolkata",
      venue: venue.trim() || null,
      video_link: video.trim() || null,
      avg_interview_minutes: avg,
      notify_channel: channel,
    };
    return event ? eventsApi.update(event.id, common) : eventsApi.create({ ...common, kind });
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const s = localToIso(starts);
    const en = localToIso(ends);
    if (name.trim().length < 2) return setError("Give the event a name of at least 2 characters.");
    if (!s || !en) return setError("Enter when the event starts and ends.");
    if (Date.parse(en) <= Date.parse(s)) return setError("The event must end after it starts.");
    if (video.trim() && !/^https?:\/\//i.test(video.trim())) return setError("The video link must start with https://.");
    if (avg !== null && (avg < 5 || avg > 180)) return setError("Average interview length is 5 to 180 minutes.");
    setError(null);
    save.mutate(undefined, {
      onSuccess: (ev) => {
        toast.success(event ? "Event saved" : "Event created");
        onClose();
        if (!event) router.push(`/campus/events/${ev.id}`);
      },
      onError: (err) => setError(errorMessage(err)),
    });
  };

  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !save.isPending && onClose()}>
      <DialogSurface style={{ maxWidth: 720 }}>
        <form onSubmit={submit} noValidate>
          <DialogBody>
            <DialogTitle>{event ? "Edit event" : "New recruitment event"}</DialogTitle>
            <DialogContent style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                <Field label="Name" required>
                  <Input value={name} maxLength={200} onChange={(_, d) => setName(d.value)} />
                </Field>
                <Field label="Kind" hint={event ? "Cannot be changed" : undefined}>
                  <Dropdown value={KIND_LABELS[kind]} selectedOptions={[kind]} disabled={!!event} onOptionSelect={(_, d) => setKind(d.optionValue as EventKind)}>
                    {EVENT_KINDS.map((k) => (
                      <Option key={k} value={k}>
                        {KIND_LABELS[k]}
                      </Option>
                    ))}
                  </Dropdown>
                </Field>
                <Field label="Starts" required>
                  <Input type="datetime-local" value={starts} onChange={(_, d) => setStarts(d.value)} />
                </Field>
                <Field label="Ends" required>
                  <Input type="datetime-local" value={ends} onChange={(_, d) => setEnds(d.value)} />
                </Field>
                <Field label="Time zone">
                  <Input value={tz} maxLength={64} onChange={(_, d) => setTz(d.value)} />
                </Field>
                <Field label="Average interview (minutes)" hint="Used for wait estimates; empty uses the campus default">
                  <SpinButton value={avg} min={5} max={180} step={5} onChange={(_, d) => setAvg(d.value ?? (d.displayValue ? Number(d.displayValue) : null))} />
                </Field>
                <Field label="Venue">
                  <Input value={venue} maxLength={500} onChange={(_, d) => setVenue(d.value)} />
                </Field>
                <Field label="Video link">
                  <Input type="url" value={video} maxLength={2000} onChange={(_, d) => setVideo(d.value)} />
                </Field>
                <Field label="Tell candidates it's their turn by" hint="Only candidates who opted in to that channel are messaged">
                  <Dropdown value={CHANNEL_LABELS[channel]} selectedOptions={[channel]} onOptionSelect={(_, d) => setChannel(d.optionValue as NotifyChannel)}>
                    {CHANNELS.map((c) => (
                      <Option key={c} value={c}>
                        {CHANNEL_LABELS[c]}
                      </Option>
                    ))}
                  </Dropdown>
                </Field>
              </div>
              <DemandPicker label="Demands hiring at this event" excludeIds={demands.map((d) => d.id)} onPick={(d) => setDemands((x) => [...x, d])} />
              {demands.length > 0 && (
                <TagGroup aria-label="Demands" onDismiss={(_, d) => setDemands((x) => x.filter((y) => y.id !== d.value))}>
                  {demands.map((d) => (
                    <Tag key={d.id} value={d.id} dismissible dismissIcon={{ "aria-label": `Remove ${d.title}` }} size="small">
                      {d.title}
                    </Tag>
                  ))}
                </TagGroup>
              )}
              {error && (
                <MessageBar intent="error" role="alert">
                  <MessageBarBody>{error}</MessageBarBody>
                </MessageBar>
              )}
            </DialogContent>
            <DialogActions>
              <Button disabled={save.isPending} onClick={onClose}>
                Cancel
              </Button>
              <Button appearance="primary" type="submit" disabled={save.isPending} icon={save.isPending ? <Spinner size="tiny" /> : undefined}>
                {event ? "Save" : "Create event"}
              </Button>
            </DialogActions>
          </DialogBody>
        </form>
      </DialogSurface>
    </Dialog>
  );
}
