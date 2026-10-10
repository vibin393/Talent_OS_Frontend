"use client";

import { Body1, Button, Caption1, Field, Input, makeStyles, mergeClasses, MessageBar, MessageBarBody, tokens } from "@fluentui/react-components";
import { Add16Regular, Delete16Regular } from "@fluentui/react-icons";
import { useEffect, useRef, useState } from "react";
import { aadhaarLast4Error, type Box, clampBox, defaultBox, flattenRedacted, moveBox, type CanvasLike } from "./logic";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, maxWidth: "560px" },
  stage: { position: "relative", width: "100%", border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`, borderRadius: tokens.borderRadiusMedium, overflow: "hidden", touchAction: "none" },
  img: { display: "block", width: "100%", height: "auto", userSelect: "none" },
  box: {
    position: "absolute",
    backgroundColor: "#000",
    outline: `${tokens.strokeWidthThick} solid transparent`,
    cursor: "move",
    ":focus-visible": { outline: `${tokens.strokeWidthThick} solid ${tokens.colorStrokeFocus2}` },
  },
  selected: { outline: `${tokens.strokeWidthThick} solid ${tokens.colorBrandStroke1}` },
  row: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS, alignItems: "center" },
});

export type AadhaarCaptureResult = { last4: string; image: Blob | null };

type Props = {
  /** Called with the last 4 digits and the flattened (redacted, EXIF-free) JPEG -- never the original. */
  onSubmit: (result: AadhaarCaptureResult) => Promise<unknown> | void;
  busy?: boolean;
  /** Without an image only the last 4 digits are submitted. */
  imageOptional?: boolean;
  submitLabel?: string;
};

function browserCanvas(w: number, h: number): CanvasLike {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c as unknown as CanvasLike;
}

/** Aadhaar capture (NFR-24): last-4 input + photo with a client-side redaction canvas. The user covers the first
 * 8 digits with opaque boxes (drag, or arrow keys / Shift+arrows); the image is flattened and re-encoded to JPEG
 * on the device, so the original never leaves it. Reused by BGV and onboarding. */
export function AadhaarCapture({ onSubmit, busy, imageOptional = true, submitLabel = "Save Aadhaar" }: Props) {
  const styles = useStyles();
  const [last4, setLast4] = useState("");
  const [touched, setTouched] = useState(false);
  const [src, setSrc] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [selected, setSelected] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [displayWidth, setDisplayWidth] = useState(0);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const drag = useRef<{ index: number; startX: number; startY: number; box: Box; scale: number } | null>(null);

  useEffect(() => () => {
    if (src) URL.revokeObjectURL(src);
  }, [src]);

  useEffect(() => {
    const img = imgRef.current;
    if (!img || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setDisplayWidth(img.clientWidth));
    ro.observe(img);
    return () => ro.disconnect();
  }, [src]);

  const last4Error = touched ? aadhaarLast4Error(last4) : null;

  function pick(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (src) URL.revokeObjectURL(src);
    setSrc(URL.createObjectURL(file));
    setBoxes([]);
    setNatural(null);
  }

  function onLoad() {
    const img = imgRef.current;
    if (!img) return;
    const size = { width: img.naturalWidth, height: img.naturalHeight };
    setNatural(size);
    setDisplayWidth(img.clientWidth);
    setBoxes([defaultBox(size.width, size.height)]);
    setSelected(0);
  }

  function scale(): number {
    const img = imgRef.current;
    return img && natural ? natural.width / img.clientWidth : 1;
  }

  function onKey(i: number, e: React.KeyboardEvent) {
    if (!natural) return;
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      setBoxes((bs) => bs.filter((_, j) => j !== i));
      return;
    }
    const next = moveBox(boxes[i], e.key, e.shiftKey, natural.width, natural.height);
    if (!next) return;
    e.preventDefault();
    setBoxes((bs) => bs.map((b, j) => (j === i ? next : b)));
  }

  function onPointerDown(i: number, e: React.PointerEvent) {
    setSelected(i);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    drag.current = { index: i, startX: e.clientX, startY: e.clientY, box: boxes[i], scale: scale() };
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || !natural) return;
    const next = clampBox(
      { ...d.box, x: d.box.x + (e.clientX - d.startX) * d.scale, y: d.box.y + (e.clientY - d.startY) * d.scale },
      natural.width,
      natural.height,
    );
    setBoxes((bs) => bs.map((b, j) => (j === d.index ? next : b)));
  }

  async function submit() {
    setTouched(true);
    setError(null);
    if (aadhaarLast4Error(last4)) return;
    let image: Blob | null = null;
    if (src && imgRef.current && natural) {
      try {
        image = await flattenRedacted(imgRef.current, natural, boxes, browserCanvas);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not prepare the image.");
        return;
      }
    } else if (!imageOptional) {
      setError("Take or choose a photo of your Aadhaar card.");
      return;
    }
    await onSubmit({ last4: last4.trim(), image });
  }

  const view = natural && displayWidth ? displayWidth / natural.width : 1;

  return (
    <div className={styles.root}>
      <Field label="Last 4 digits of Aadhaar" required validationMessage={last4Error ?? undefined} hint="Never enter the full number.">
        <Input
          inputMode="numeric"
          maxLength={4}
          autoComplete="off"
          value={last4}
          onChange={(_, d) => setLast4(d.value.replace(/\D/g, "").slice(0, 4))}
          onBlur={() => setTouched(true)}
        />
      </Field>
      <Field label="Photo of the card" hint="Cover the first 8 digits before uploading. Your original photo stays on this device.">
        <input type="file" accept="image/*" capture="environment" aria-label="Take or choose a photo" onChange={(e) => pick(e.target.files?.[0])} />
      </Field>
      {src && (
        <>
          <div className={styles.stage} onPointerMove={onPointerMove} onPointerUp={() => (drag.current = null)}>
            {/* eslint-disable-next-line @next/next/no-img-element -- local object URL, never uploaded */}
            <img ref={imgRef} src={src} alt="Aadhaar card to redact" className={styles.img} onLoad={onLoad} draggable={false} />
            {boxes.map((b, i) => (
              <div
                key={i}
                role="button"
                tabIndex={0}
                aria-label={`Redaction box ${i + 1}. Arrow keys move, Shift and arrow keys resize, Delete removes.`}
                className={mergeClasses(styles.box, i === selected && styles.selected)}
                style={{ left: b.x * view, top: b.y * view, width: b.w * view, height: b.h * view }}
                onKeyDown={(e) => onKey(i, e)}
                onFocus={() => setSelected(i)}
                onPointerDown={(e) => onPointerDown(i, e)}
              />
            ))}
          </div>
          <div className={styles.row}>
            <Button
              icon={<Add16Regular />}
              onClick={() => natural && setBoxes((bs) => [...bs, defaultBox(natural.width, natural.height)])}
              disabled={!natural}
            >
              Add box
            </Button>
            <Button icon={<Delete16Regular />} onClick={() => setBoxes((bs) => bs.filter((_, j) => j !== selected))} disabled={boxes.length === 0}>
              Remove selected box
            </Button>
          </div>
          <Caption1>HR will check that the first 8 digits are hidden before your Aadhaar is accepted.</Caption1>
        </>
      )}
      {error && (
        <MessageBar intent="error">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}
      <div className={styles.row}>
        <Button appearance="primary" onClick={() => void submit()} disabled={busy}>
          {submitLabel}
        </Button>
        {!src && imageOptional && <Body1>You can add the photo later.</Body1>}
      </div>
    </div>
  );
}
