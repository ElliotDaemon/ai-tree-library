// Bottom-right credit. Links to elliotdaemon.com. The wordmark uses
// Josefin Sans (the same font as elliotdaemon.com) with a subtle chrome
// shine that sweeps across every ~6s.

"use client";

interface Props { visible: boolean }

export default function CreditBadge({ visible }: Props) {
  return (
    <a
      href="https://elliotdaemon.com"
      target="_blank"
      rel="noopener noreferrer"
      className={`ne-credit ${visible ? "" : "ne-hidden"}`}
      aria-label="Designed by Elliot Daemon — visit elliotdaemon.com"
    >
      <span className="ne-credit-label">Designed by</span>
      <span className="ne-credit-mark">
        ELLIOT DAEMON
        <span className="ne-credit-r">®</span>
      </span>
    </a>
  );
}
