import { describe, expect, it } from "vitest";
import { isLegalTransition, legalTransitionsFrom } from "./transitions";

describe("legalTransitionsFrom", () => {
  it("lets a Todo ticket start progressing", () => {
    expect(legalTransitionsFrom("Todo")).toEqual(["InProgress"]);
  });

  it("lets an InProgress ticket finish", () => {
    expect(legalTransitionsFrom("InProgress")).toEqual(["Done"]);
  });

  it("lets a Done ticket be reopened, closing the cycle", () => {
    expect(legalTransitionsFrom("Done")).toEqual(["Todo"]);
  });
});

describe("isLegalTransition", () => {
  it("rejects skipping InProgress", () => {
    expect(isLegalTransition("Todo", "Done")).toBe(false);
  });

  it("rejects moving backwards out of InProgress", () => {
    expect(isLegalTransition("InProgress", "Todo")).toBe(false);
  });

  it("rejects a ticket transitioning to the status it already holds", () => {
    expect(isLegalTransition("Todo", "Todo")).toBe(false);
  });
});
