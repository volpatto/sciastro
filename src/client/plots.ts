/** Progressive Plotly enhancement. The large plotting library is loaded only on
 * pages containing saved figures; no CDN, Python kernel or remote data service. */
type PlotSpec = {
  data: unknown[];
  layout?: Record<string, unknown>;
  frames?: unknown[];
  config?: Record<string, unknown>;
};
type Plotly = {
  newPlot(
    element: HTMLElement,
    data: unknown[],
    layout: Record<string, unknown>,
    config: Record<string, unknown>,
  ): Promise<unknown>;
  relayout(
    element: HTMLElement,
    updates: Record<string, unknown>,
  ): Promise<unknown>;
  addFrames(element: HTMLElement, frames: unknown[]): Promise<unknown>;
  toImage(
    element: HTMLElement,
    options: { format: 'png'; width: number; height: number; scale: number },
  ): Promise<string>;
  purge(element: HTMLElement): void;
  Plots: { resize(element: HTMLElement): void | Promise<unknown> };
};
let ready: Promise<void> | undefined;
const records: {
  element: HTMLElement;
  canvas: HTMLElement;
  spec: PlotSpec;
  plotly: Plotly;
  snapshot: Promise<void>;
}[] = [];
const portuguese = () => document.documentElement.lang.startsWith('pt');
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
function layoutFor(spec: PlotSpec, print = false) {
  const layout = clone(spec.layout ?? {});
  const style = getComputedStyle(document.documentElement);
  const text = print
    ? '#202331'
    : style.getPropertyValue('--ink').trim() || '#202331';
  const line = print
    ? '#d9dce5'
    : style.getPropertyValue('--line').trim() || '#d9dce5';
  const paper = print
    ? '#ffffff'
    : style.getPropertyValue('--paper').trim() || '#ffffff';
  const result: Record<string, unknown> = {
    colorway: ['#5360c4', '#9462b5', '#348aa7', '#c27548', '#728841'],
    ...layout,
    autosize: true,
    paper_bgcolor: print ? '#fff' : (layout.paper_bgcolor ?? paper),
    plot_bgcolor: print ? '#fff' : (layout.plot_bgcolor ?? paper),
    font: {
      family: getComputedStyle(document.body).fontFamily,
      size: 13,
      ...object(layout.font),
      color: print ? '#202331' : (object(layout.font).color ?? text),
    },
    margin: {
      l: 58,
      r: 24,
      t: layout.title ? 64 : 28,
      b: 56,
      ...object(layout.margin),
    },
    height: Math.max(240, Math.min(1000, Number(layout.height) || 420)),
    transition: { duration: 0 },
  };
  delete result.width;
  for (const name of new Set([
    'xaxis',
    'yaxis',
    ...Object.keys(layout).filter((key) => /^[xy]axis\d*$/.test(key)),
  ])) {
    result[name] = {
      gridcolor: line,
      zerolinecolor: line,
      linecolor: line,
      automargin: true,
      ...object(layout[name]),
    };
    if (print)
      result[name] = { ...object(result[name]), color: text, gridcolor: line };
  }
  return result;
}
function configFor(spec: PlotSpec) {
  return {
    displaylogo: false,
    scrollZoom: false,
    ...clone(spec.config ?? {}),
    responsive: true,
    showLink: false,
    showSendToCloud: false,
    editable: false,
    toImageButtonOptions: {
      format: 'png',
      filename: 'figure',
      scale: 2,
      ...object(spec.config?.toImageButtonOptions),
    },
  };
}
async function makeSnapshot(record: (typeof records)[number]) {
  const image = record.element.querySelector<HTMLImageElement>('.plotly-print');
  if (!image) return;
  const temporary = document.createElement('div');
  temporary.className = 'plotly-print-render';
  temporary.setAttribute('aria-hidden', 'true');
  document.body.append(temporary);
  try {
    const layout = layoutFor(record.spec, true);
    await record.plotly.newPlot(
      temporary,
      clone(record.spec.data),
      { ...layout, width: 840, autosize: false },
      { staticPlot: true, displayModeBar: false },
    );
    image.src = await record.plotly.toImage(temporary, {
      format: 'png',
      width: 840,
      height: Number(layout.height),
      scale: 2,
    });
    await image.decode();
    record.element.dataset.printReady = 'true';
  } finally {
    record.plotly.purge(temporary);
    temporary.remove();
  }
}
export function initializePlots(): Promise<void> {
  return (ready ??= (async () => {
    const figures = [
      ...document.querySelectorAll<HTMLElement>('.sciastro-plot'),
    ];
    if (!figures.length) return;
    try {
      const [{ default: implementation }] = await Promise.all([
        import('plotly.js-dist-min'),
        document.fonts.ready,
      ]);
      const plotly = implementation as Plotly;
      await Promise.all(
        figures.map(async (element) => {
          const status = element.querySelector<HTMLElement>('.plotly-status');
          try {
            const canvas = element.querySelector<HTMLElement>('.plotly-canvas');
            const payload =
              element.querySelector<HTMLScriptElement>('[data-plotly-spec]');
            if (!canvas || !payload?.textContent)
              throw new Error('Missing figure data');
            const spec = JSON.parse(payload.textContent) as PlotSpec;
            await plotly.newPlot(
              canvas,
              clone(spec.data),
              layoutFor(spec),
              configFor(spec),
            );
            if (spec.frames?.length)
              await plotly.addFrames(canvas, clone(spec.frames));
            element.dataset.plotReady = 'true';
            if (status) status.hidden = true;
            const record = {
              element,
              canvas,
              spec,
              plotly,
              snapshot: Promise.resolve(),
            };
            records.push(record);
            // The print action also awaits this image. Ctrl+P uses it once ready.
            record.snapshot = makeSnapshot(record).catch(() => {
              // An original notebook PNG/SVG remains available as a print fallback.
              element.dataset.printError = 'true';
            });
            let width = 0;
            const observer = new ResizeObserver(([entry]) => {
              const next = Math.round(entry.contentRect.width);
              if (next > 0 && next !== width) {
                width = next;
                void Promise.resolve(plotly.Plots.resize(canvas)).catch(
                  () => {},
                );
              }
            });
            observer.observe(element);
          } catch {
            element.dataset.plotError = 'true';
            if (status) {
              status.hidden = false;
              status.textContent = portuguese()
                ? 'Não foi possível exibir o gráfico interativo.'
                : 'The interactive chart could not be displayed.';
            }
          }
        }),
      );
      const refreshTheme = () => {
        for (const { canvas, spec } of records) {
          const layout = layoutFor(spec);
          const updates: Record<string, unknown> = {
            paper_bgcolor: layout.paper_bgcolor,
            plot_bgcolor: layout.plot_bgcolor,
            font: layout.font,
          };
          // Change appearance without resetting the reader's zoom or hidden traces.
          for (const key of Object.keys(layout).filter((key) =>
            /^[xy]axis\d*$/.test(key),
          )) {
            for (const attribute of ['gridcolor', 'zerolinecolor', 'linecolor'])
              updates[`${key}.${attribute}`] = object(layout[key])[attribute];
          }
          void plotly.relayout(canvas, updates).catch(() => {});
        }
      };
      const themeObserver = new MutationObserver(refreshTheme);
      themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme'],
      });
      matchMedia('(prefers-color-scheme: dark)').addEventListener(
        'change',
        refreshTheme,
      );
    } catch {
      for (const element of figures) {
        element.dataset.plotError = 'true';
        const status = element.querySelector<HTMLElement>('.plotly-status');
        if (status)
          status.textContent = portuguese()
            ? 'Não foi possível carregar o gráfico interativo.'
            : 'The interactive chart could not be loaded.';
      }
    }
  })());
}

/** Wait for legible white-background chart images before opening the print dialog. */
export async function preparePlotsForPrint() {
  await initializePlots();
  await Promise.all(records.map((record) => record.snapshot));
}
