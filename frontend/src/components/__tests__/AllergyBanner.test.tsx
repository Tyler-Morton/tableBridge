import { render, screen } from "@testing-library/react";
import { AllergyBanner } from "../AllergyBanner";

describe("AllergyBanner", () => {
  it("renders nothing when no allergies or dietary tags", () => {
    const { container } = render(<AllergyBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("shows an allergy alert when allergies are present", () => {
    render(<AllergyBanner allergies={["peanuts"]} />);
    expect(screen.getByText(/Allergy alert/i)).toBeInTheDocument();
    expect(screen.getByText("peanuts")).toBeInTheDocument();
  });
});
