import { cloneParams, type SimParams } from "../sim/params";
import { applyChanges, changes, formatValue, getValue, setValue } from "./tuning";
import { TUNING_GROUPS, type TuningField } from "./tuningSchema";

const STORAGE_KEY = "nutmeg.tuning";

/**
 * The in-browser tuning panel (`?tune=1`, docs/specs/02): a slider for every gameplay constant, applied live.
 * Changes are kept in this browser until reset, and "Copy changes" puts them on the clipboard as JSON to paste
 * into a Playtest feedback issue.
 */
export function mountTuningPanel(params: SimParams): void {
  const defaults = cloneParams(params);
  load(params);

  const panel = document.createElement("aside");
  panel.id = "tuning";
  panel.innerHTML = `
    <header>
      <strong>Tuning</strong>
      <span class="tuning-count"></span>
      <button type="button" data-act="hide" title="Hide (T)">Hide</button>
    </header>
    <div class="tuning-actions">
      <button type="button" data-act="copy">Copy changes</button>
      <button type="button" data-act="paste">Paste</button>
      <button type="button" data-act="reset">Reset all</button>
    </div>
    <div class="tuning-io" hidden>
      <textarea spellcheck="false" placeholder='{ "action": { "passArrivalSpeed": 9 } }'></textarea>
      <div><button type="button" data-act="apply">Apply</button> <span class="tuning-msg"></span></div>
    </div>
    <div class="tuning-groups"></div>
    <p class="tuning-note">T shows or hides this panel. Changes stay in this browser until you reset them.</p>`;
  document.body.append(panel);

  const count = panel.querySelector<HTMLElement>(".tuning-count")!;
  const io = panel.querySelector<HTMLElement>(".tuning-io")!;
  const text = io.querySelector("textarea")!;
  const msg = io.querySelector<HTMLElement>(".tuning-msg")!;
  const rows = new Map<TuningField, () => void>();

  const groups = panel.querySelector(".tuning-groups")!;
  TUNING_GROUPS.forEach((group, i) => {
    const details = document.createElement("details");
    details.open = i < 2;
    details.innerHTML = `<summary>${group.title}</summary>`;
    for (const f of group.fields) details.append(row(f));
    groups.append(details);
  });
  refresh();

  function row(f: TuningField): HTMLElement {
    const el = document.createElement("label");
    el.className = "tuning-row";
    if (f.hint) el.title = f.hint;
    el.innerHTML = `<span class="tuning-label"></span><span class="tuning-value"></span>
      <button type="button" class="tuning-undo" title="Back to default">↺</button>
      <input type="range" min="${f.min}" max="${f.max}" step="${f.step}" data-key="${f.section}.${f.key}">`;
    el.querySelector(".tuning-label")!.textContent = f.label;
    const value = el.querySelector<HTMLElement>(".tuning-value")!;
    const slider = el.querySelector("input")!;
    const undo = el.querySelector("button")!;
    const update = () => {
      const v = getValue(params, f);
      slider.value = String(v);
      value.textContent = formatValue(f, v);
      el.classList.toggle("changed", v !== getValue(defaults, f));
    };
    slider.addEventListener("input", () => {
      setValue(params, f, Number(slider.value));
      update();
      saved();
    });
    // Hand the keyboard back to the game once the slider is let go.
    slider.addEventListener("change", () => slider.blur());
    undo.addEventListener("click", (e) => {
      e.preventDefault();
      setValue(params, f, getValue(defaults, f));
      update();
      saved();
    });
    rows.set(f, update);
    return el;
  }

  function refresh(): void {
    rows.forEach((update) => update());
    const n = Object.values(changes(params, defaults)).reduce((sum, s) => sum + Object.keys(s).length, 0);
    count.textContent = n === 0 ? "defaults" : `${n} changed`;
  }

  function saved(): void {
    refresh();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(changes(params, defaults)));
    } catch {
      // Storage can be unavailable (private mode); tuning still works for this visit.
    }
  }

  panel.addEventListener("click", async (e) => {
    const act = (e.target as HTMLElement).dataset.act;
    if (act === "hide") panel.hidden = true;
    if (act === "reset") {
      applyChanges(params, defaults);
      saved();
    }
    if (act === "paste") {
      io.hidden = false;
      text.value = "";
      msg.textContent = "Paste settings, then Apply";
      text.focus();
    }
    if (act === "apply") {
      try {
        const n = applyChanges(params, JSON.parse(text.value));
        msg.textContent = `Applied ${n} value${n === 1 ? "" : "s"}`;
        saved();
      } catch {
        msg.textContent = "That isn't valid JSON";
      }
    }
    if (act === "copy") {
      const json = JSON.stringify(changes(params, defaults), null, 2);
      io.hidden = false;
      text.value = json;
      try {
        await navigator.clipboard.writeText(json);
        msg.textContent = "Copied: paste it into a Playtest feedback issue";
      } catch {
        text.select();
        msg.textContent = "Select the text above and copy it";
      }
    }
  });

  // Typing in the text box must not steer the players.
  for (const type of ["keydown", "keyup"] as const) {
    text.addEventListener(type, (e) => e.stopPropagation());
  }
  window.addEventListener("keydown", (e) => {
    if (e.code === "KeyT") panel.hidden = !panel.hidden;
  });
}

function load(params: SimParams): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) applyChanges(params, JSON.parse(raw));
  } catch {
    // Missing or unreadable saved tuning: start from the defaults.
  }
}
