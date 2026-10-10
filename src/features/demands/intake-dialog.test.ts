import { describe, expect, it } from "vitest";
import { formatBytes, MAX_INTAKE_BYTES, validateIntakeFile, validateIntakeText } from "./intake";

describe("intake file validation", () => {
  it("accepts PDF and DOCX up to 10 MB", () => {
    expect(validateIntakeFile({ name: "SOW.PDF", size: 1000 })).toBeNull();
    expect(validateIntakeFile({ name: "jd.docx", size: MAX_INTAKE_BYTES })).toBeNull();
  });

  it("rejects other types, empty and oversized files", () => {
    expect(validateIntakeFile({ name: "setup.exe", size: 10 })).toBe("Only PDF and DOCX files are supported.");
    expect(validateIntakeFile({ name: "old.doc", size: 10 })).toBe("Only PDF and DOCX files are supported.");
    expect(validateIntakeFile({ name: "a.pdf", size: 0 })).toBe("The file is empty.");
    expect(validateIntakeFile({ name: "a.pdf", size: MAX_INTAKE_BYTES + 1 })).toBe("The file is larger than 10 MB.");
  });

  it("validates pasted text", () => {
    expect(validateIntakeText("   ")).toBe("Paste the requirement text.");
    expect(validateIntakeText("x".repeat(60_001))).toMatch(/too long/);
    expect(validateIntakeText("Need 2 data engineers")).toBeNull();
  });

  it("formats sizes", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(3 * 1024 * 1024)).toBe("3.0 MB");
  });
});
