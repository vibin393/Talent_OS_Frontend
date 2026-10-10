"use client";

import {
  Body1,
  Button,
  Dropdown,
  Field,
  Input,
  makeStyles,
  mergeClasses,
  MessageBar,
  MessageBarBody,
  Option,
  Spinner,
  Title1,
  tokens,
} from "@fluentui/react-components";
import { ArrowLeft20Regular, Camera24Regular, CheckmarkCircle48Regular, PersonAdd24Regular, Search24Regular } from "@fluentui/react-icons";
import { useEffect, useRef, useState } from "react";
import { AppLink } from "@/components/app-link";
import { ErrorBar, GridSkeleton, NoAccess } from "@/features/admin/ui";
import { isE164, isEmail } from "@/features/campus/logic";
import { CandidatePicker } from "@/features/privacy/candidate-picker";
import { errorMessage } from "@/lib/api/errors";
import { eventsApi } from "./api";
import { parseCheckinToken } from "./logic";
import type { CheckInIn, CheckinOut, EventOut } from "./types";
import { useEvent, useEventPermissions, useRefreshLive } from "./use-events";

type DetectedBarcode = { rawValue: string };
type BarcodeDetectorLike = { detect: (source: CanvasImageSource) => Promise<DetectedBarcode[]> };
type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => BarcodeDetectorLike;

function barcodeDetector(): BarcodeDetectorCtor | null {
  if (typeof window === "undefined") return null;
  return ((window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector ?? null) as BarcodeDetectorCtor | null;
}

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, maxWidth: "960px" },
  modes: { display: "grid", gap: tokens.spacingHorizontalM, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" },
  mode: { minHeight: "88px", fontSize: tokens.fontSizeBase500, justifyContent: "center", gap: tokens.spacingHorizontalS },
  active: { outline: `3px solid ${tokens.colorBrandStroke1}` },
  panel: { padding: tokens.spacingHorizontalXL, backgroundColor: tokens.colorNeutralBackground1, borderRadius: tokens.borderRadiusLarge, boxShadow: tokens.shadow8, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL },
  big: { minHeight: "56px", fontSize: tokens.fontSizeBase500 },
  video: { width: "100%", maxHeight: "50vh", backgroundColor: "#000", borderRadius: tokens.borderRadiusMedium, objectFit: "cover" },
  success: { display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: tokens.spacingVerticalM, padding: tokens.spacingVerticalXXL },
  ok: { color: tokens.colorPaletteGreenForeground1 },
  grid: { display: "grid", gap: tokens.spacingHorizontalM, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" },
});

type Mode = "scan" | "search" | "walk_in";

/** `/campus/events/[id]/kiosk`: tablet check-in desk (QR scan with manual fallback, candidate search, walk-in form). */
export function Kiosk({ eventId }: { eventId: string }) {
  const { canManage } = useEventPermissions();
  const ev = useEvent(eventId);
  if (!canManage) return <NoAccess what="the check-in kiosk" />;
  if (ev.isPending) return <GridSkeleton />;
  if (ev.isError) return <ErrorBar title="Could not load the event." message={errorMessage(ev.error)} />;
  return <KioskBody event={ev.data} />;
}

function KioskBody({ event }: { event: EventOut }) {
  const styles = useStyles();
  const refresh = useRefreshLive(event.id);
  const [mode, setMode] = useState<Mode>("scan");
  const [demandId, setDemandId] = useState(event.demands.length === 1 ? event.demands[0].id : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<CheckinOut | null>(null);

  useEffect(() => {
    if (!done) return;
    const t = window.setTimeout(() => setDone(null), 8000);
    return () => window.clearTimeout(t);
  }, [done]);

  const checkIn = async (body: CheckInIn) => {
    setBusy(true);
    setError(null);
    try {
      const out = await eventsApi.checkIn(event.id, { ...body, demand_id: body.demand_id ?? (demandId || null) });
      setDone(out);
      void refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.root}>
      <AppLink href={`/campus/events/${event.id}`}>
        <ArrowLeft20Regular aria-hidden style={{ verticalAlign: "middle" }} /> {event.name}
      </AppLink>
      <Title1 as="h1">Check-in</Title1>
      {event.status !== "live" && (
        <MessageBar intent="warning">
          <MessageBarBody>The event is not live yet. Check-in opens when an organiser selects Go live.</MessageBarBody>
        </MessageBar>
      )}
      {done ? (
        <section className={styles.panel} aria-live="assertive">
          <div className={styles.success} role="status">
            <CheckmarkCircle48Regular aria-hidden className={styles.ok} />
            <Title1 as="p">Welcome, {done.candidate_name ?? "candidate"}</Title1>
            <Body1>
              {done.queue_position ? `You are number ${done.queue_position} in the queue` : "You are checked in"}
              {done.demand_title ? ` for ${done.demand_title}` : ""}. Watch the board for your name.
            </Body1>
            <Button appearance="primary" className={styles.big} onClick={() => setDone(null)}>
              Next person
            </Button>
          </div>
        </section>
      ) : (
        <>
          <div className={styles.modes} role="group" aria-label="Check-in method">
            <Button className={mergeClasses(styles.mode, mode === "scan" && styles.active)} aria-pressed={mode === "scan"} icon={<Camera24Regular />} onClick={() => setMode("scan")}>
              Scan QR
            </Button>
            <Button className={mergeClasses(styles.mode, mode === "search" && styles.active)} aria-pressed={mode === "search"} icon={<Search24Regular />} onClick={() => setMode("search")}>
              Find registration
            </Button>
            <Button className={mergeClasses(styles.mode, mode === "walk_in" && styles.active)} aria-pressed={mode === "walk_in"} icon={<PersonAdd24Regular />} onClick={() => setMode("walk_in")}>
              Walk-in
            </Button>
          </div>
          {event.demands.length > 1 && (
            <Field label="Applying for">
              <Dropdown
                className={styles.big}
                value={event.demands.find((d) => d.id === demandId)?.title ?? "Any opening"}
                selectedOptions={[demandId]}
                onOptionSelect={(_, d) => setDemandId(d.optionValue ?? "")}
              >
                <Option value="">Any opening</Option>
                {event.demands.map((d) => (
                  <Option key={d.id} value={d.id}>
                    {d.title}
                  </Option>
                ))}
              </Dropdown>
            </Field>
          )}
          <section className={styles.panel}>
            {mode === "scan" && <ScanPanel busy={busy} onToken={(token) => void checkIn({ token })} />}
            {mode === "search" && <SearchPanel busy={busy} onPick={(id) => void checkIn({ candidate_id: id })} />}
            {mode === "walk_in" && <WalkInPanel busy={busy} onSubmit={(w) => void checkIn({ walk_in: w })} />}
            <div aria-live="assertive" role="alert">
              {error && (
                <MessageBar intent="error" layout="multiline">
                  <MessageBarBody>{error}</MessageBarBody>
                </MessageBar>
              )}
            </div>
            {busy && <Spinner label="Checking in…" />}
          </section>
        </>
      )}
    </div>
  );
}

function ScanPanel({ busy, onToken }: { busy: boolean; onToken: (token: string) => void }) {
  const styles = useStyles();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [supported] = useState(() => barcodeDetector() !== null);
  const [camera, setCamera] = useState<"off" | "on" | "denied">("off");
  const [manual, setManual] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);
  const onTokenRef = useRef(onToken);
  const busyRef = useRef(busy);
  useEffect(() => {
    onTokenRef.current = onToken;
    busyRef.current = busy;
  });

  useEffect(() => {
    if (camera !== "on") return;
    const Ctor = barcodeDetector();
    if (!Ctor) return;
    let stream: MediaStream | null = null;
    let timer: number | undefined;
    let stopped = false;
    let last = "";
    const detector = new Ctor({ formats: ["qr_code"] });
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then(async (s) => {
        if (stopped) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        const v = videoRef.current;
        if (!v) return;
        v.srcObject = s;
        await v.play().catch(() => undefined);
        timer = window.setInterval(async () => {
          if (!videoRef.current || busyRef.current || videoRef.current.readyState < 2) return;
          try {
            const codes = await detector.detect(videoRef.current);
            const token = codes.map((c) => parseCheckinToken(c.rawValue)).find(Boolean);
            if (token && token !== last) {
              last = token;
              onTokenRef.current(token);
            }
          } catch {
            // A frame that cannot be decoded: try the next one.
          }
        }, 400);
      })
      .catch(() => setCamera("denied"));
    return () => {
      stopped = true;
      if (timer) window.clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [camera]);

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault();
    const token = parseCheckinToken(manual);
    if (!token) {
      setManualError("Enter the check-in link or code from the candidate's pass.");
      return;
    }
    setManualError(null);
    setManual("");
    onToken(token);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {supported ? (
        camera === "on" ? (
          <>
            <video ref={videoRef} className={styles.video} muted playsInline aria-label="Camera preview for QR scanning" />
            <Button className={styles.big} onClick={() => setCamera("off")}>
              Stop camera
            </Button>
          </>
        ) : (
          <>
            {camera === "denied" && (
              <MessageBar intent="warning">
                <MessageBarBody>The camera is not available. Type the code instead.</MessageBarBody>
              </MessageBar>
            )}
            <Button appearance="primary" className={styles.big} icon={<Camera24Regular />} onClick={() => setCamera("on")}>
              Start camera
            </Button>
          </>
        )
      ) : (
        <Body1>This browser cannot scan QR codes. Use a handheld scanner into the box below, or type the code.</Body1>
      )}
      <form onSubmit={submitManual} noValidate style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="Check-in link or code" validationState={manualError ? "error" : "none"} validationMessage={manualError ?? undefined}>
          <Input className={styles.big} value={manual} autoComplete="off" onChange={(_, d) => setManual(d.value)} />
        </Field>
        <Button type="submit" appearance="primary" className={styles.big} disabled={busy || !manual.trim()}>
          Check in
        </Button>
      </form>
    </div>
  );
}

function SearchPanel({ busy, onPick }: { busy: boolean; onPick: (candidateId: string) => void }) {
  const styles = useStyles();
  const [id, setId] = useState<string | null>(null);
  const [label, setLabel] = useState<string | undefined>();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <CandidatePicker
        label="Search by name, email or phone"
        value={id}
        valueLabel={label}
        onChange={(cid, c) => {
          setId(cid);
          setLabel(c?.full_name);
        }}
      />
      <Button appearance="primary" className={styles.big} disabled={busy || !id} onClick={() => id && onPick(id)}>
        Check in {label ?? ""}
      </Button>
    </div>
  );
}

function WalkInPanel({ busy, onSubmit }: { busy: boolean; onSubmit: (w: { full_name: string; email: string; phone: string | null }) => void }) {
  const styles = useStyles();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const found: Record<string, string> = {};
    if (!name.trim()) found.name = "Enter the candidate's name.";
    if (!isEmail(email)) found.email = "Enter a valid email address.";
    if (phone.trim() && !isE164(phone)) found.phone = "Use +country code, for example +919876543210.";
    setErrors(found);
    if (Object.keys(found).length) return;
    onSubmit({ full_name: name.trim(), email: email.trim(), phone: phone.replace(/[\s-]/g, "") || null });
  };
  return (
    <form onSubmit={submit} noValidate style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className={styles.grid}>
        <Field label="Full name" required validationState={errors.name ? "error" : "none"} validationMessage={errors.name}>
          <Input className={styles.big} value={name} maxLength={200} autoComplete="off" onChange={(_, d) => setName(d.value)} />
        </Field>
        <Field label="Email" required validationState={errors.email ? "error" : "none"} validationMessage={errors.email}>
          <Input className={styles.big} type="email" value={email} maxLength={320} autoComplete="off" onChange={(_, d) => setEmail(d.value)} />
        </Field>
        <Field label="Mobile (optional)" validationState={errors.phone ? "error" : "none"} validationMessage={errors.phone}>
          <Input className={styles.big} type="tel" value={phone} maxLength={40} autoComplete="off" onChange={(_, d) => setPhone(d.value)} />
        </Field>
      </div>
      <Body1>Check the spelling of the name and email with the candidate before you continue.</Body1>
      <Button type="submit" appearance="primary" className={styles.big} disabled={busy}>
        Check in walk-in
      </Button>
    </form>
  );
}
