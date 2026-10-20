import { CAMERAS, LOOKS, PLAYER_SETS, QUALITIES, TIMES, WEATHERS, type LookTestOptions } from "./options";

type Key = "look" | "time" | "weather" | "quality" | "camera" | "players";

const GROUPS: { key: Key; label: string; values: readonly string[]; names: Record<string, string> }[] = [
  { key: "look", label: "Look", values: LOOKS, names: { stylised: "Stylised", toon: "Toon" } },
  { key: "time", label: "Time", values: TIMES, names: { day: "Day", dusk: "Dusk", night: "Night" } },
  {
    key: "weather",
    label: "Weather",
    values: WEATHERS,
    names: { clear: "Clear", rain: "Rain", snow: "Snow" },
  },
  {
    key: "camera",
    label: "Camera",
    values: CAMERAS,
    names: { classic: "Classic '94", broadcast: "Broadcast", orbit: "Orbit" },
  },
  { key: "quality", label: "Quality", values: QUALITIES, names: { low: "Low", high: "High" } },
  {
    key: "players",
    label: "Players",
    values: PLAYER_SETS,
    names: { old: "Today's", new: "New", both: "Both" },
  },
];

/** The settings panel: segmented buttons for every look-test option. */
export function buildPanel(
  options: LookTestOptions,
  onChange: (key: Key, value: string) => void,
): { setStatus(text: string): void } {
  const panel = document.getElementById("panel")!;
  const body = document.createElement("div");
  body.className = "panel-body";
  for (const g of GROUPS) {
    const row = document.createElement("div");
    row.className = "row";
    const label = document.createElement("span");
    label.className = "label";
    label.textContent = g.label;
    row.append(label);
    const seg = document.createElement("div");
    seg.className = "seg";
    seg.setAttribute("role", "group");
    seg.setAttribute("aria-label", g.label);
    for (const v of g.values) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = g.names[v];
      b.dataset.key = g.key;
      b.dataset.value = v;
      b.setAttribute("aria-pressed", String(options[g.key] === v));
      b.addEventListener("click", () => {
        for (const other of seg.querySelectorAll("button"))
          other.setAttribute("aria-pressed", String(other === b));
        onChange(g.key, v);
      });
      seg.append(b);
    }
    row.append(seg);
    body.append(row);
  }
  const status = document.createElement("div");
  status.className = "status";
  body.append(status);

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "panel-toggle";
  toggle.textContent = "Settings";
  toggle.setAttribute("aria-expanded", "true");
  toggle.addEventListener("click", () => {
    const open = panel.classList.toggle("collapsed") === false;
    toggle.setAttribute("aria-expanded", String(open));
  });
  panel.append(toggle, body);
  if (window.matchMedia("(max-width: 640px)").matches) panel.classList.add("collapsed");

  return {
    setStatus(text: string) {
      status.textContent = text;
    },
  };
}
