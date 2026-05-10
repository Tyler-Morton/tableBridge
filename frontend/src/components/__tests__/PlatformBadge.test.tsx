import { render, screen } from "@testing-library/react";
import { PlatformBadge } from "../PlatformBadge";

describe("PlatformBadge", () => {
  it("renders the human-readable platform name", () => {
    render(<PlatformBadge platform="doordash" />);
    expect(screen.getByText("DoorDash")).toBeInTheDocument();
  });
  it("falls back to the raw value for unknown platforms", () => {
    render(<PlatformBadge platform="postmates" />);
    expect(screen.getByText("postmates")).toBeInTheDocument();
  });
});
