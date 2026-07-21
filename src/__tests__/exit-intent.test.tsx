import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ExitIntentCapture } from "@/components/landing/ExitIntentCapture";

afterEach(() => localStorage.clear());

describe("ExitIntentCapture", () => {
  it("opens the title-cased offer when exit intent is detected", () => {
    render(<ExitIntentCapture />);

    fireEvent.mouseOut(document, { clientY: 0, relatedTarget: null });

    expect(screen.getByRole("heading", { name: /Before You Go/i })).toBeVisible();
    expect(screen.getByRole("button", { name: "Get My Free Scan" })).toBeVisible();
  });
});
