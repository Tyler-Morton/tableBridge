import { render, screen } from "@testing-library/react";
import { ConfidenceTag } from "../ConfidenceTag";

describe("ConfidenceTag", () => {
  it('shows "OK" above the threshold', () => {
    render(<ConfidenceTag confidence={0.95} />);
    expect(screen.getByText(/OK/i)).toBeInTheDocument();
    expect(screen.getByText(/95%/)).toBeInTheDocument();
  });
  it('shows "Review" below the threshold', () => {
    render(<ConfidenceTag confidence={0.6} />);
    expect(screen.getByText(/Review/i)).toBeInTheDocument();
  });
});
