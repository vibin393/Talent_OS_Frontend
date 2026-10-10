import { describe, expect, it } from "vitest";
import { filenameFromDisposition } from "./download";

describe("filenameFromDisposition", () => {
  it("reads plain and RFC 5987 file names", () => {
    expect(filenameFromDisposition('attachment; filename="audit-log.csv"')).toBe("audit-log.csv");
    expect(filenameFromDisposition("attachment; filename=report.csv")).toBe("report.csv");
    expect(filenameFromDisposition("attachment; filename*=UTF-8''r%C3%A9sum%C3%A9.pdf")).toBe("résumé.pdf");
    expect(filenameFromDisposition(null)).toBeNull();
    expect(filenameFromDisposition("inline")).toBeNull();
  });
});
