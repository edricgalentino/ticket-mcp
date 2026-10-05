/**
 * A User, shown with the mode they acted in. ADR 0004: the marker reflects how
 * something was done, not who did it, so the same person reads differently
 * depending on whether they clicked a button or their agent called a tool.
 */
export function Actor({
  name,
  kind,
}: {
  name: string;
  kind: "human" | "agent";
}) {
  return (
    <span>
      {name}
      {kind === "agent" ? (
        <span title="done through an agent, over MCP"> 🤖</span>
      ) : null}
    </span>
  );
}
