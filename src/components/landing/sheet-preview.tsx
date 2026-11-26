import { DEFAULT_FORMATS, OPTION_LETTERS } from "@/lib/formats";

/**
 * Hero visual: a faithful, static rendering of the platform's digital answer sheet
 * for the Biology 2025 format. Labelled as a demo — no real candidate data.
 */
const DEMO = "BDACCABDBACDDBCAABDCBADCCABDACBD";

export function SheetPreview() {
  const bio = DEFAULT_FORMATS[0];
  return (
    <figure className="crop relative select-none" aria-label="Javoblar varaqasi interfeysi namunasi (demo)">
      <div className="sheet-hard overflow-hidden">
        {/* header strip */}
        <div className="flex items-stretch border-b-[1.5px] border-ink text-[0.7rem]">
          <div className="flex-1 border-r-[1.5px] border-ink px-3 py-2">
            <p className="eyebrow !text-[0.6rem]">Fan · format</p>
            <p className="mt-0.5 font-semibold">{bio.subjectName} · MS-{bio.version}</p>
          </div>
          <div className="border-r-[1.5px] border-ink px-3 py-2">
            <p className="eyebrow !text-[0.6rem]">Candidate ID</p>
            <p className="num mt-0.5 font-semibold tracking-widest">MM-26-······</p>
          </div>
          <div className="bg-ink px-3 py-2 text-paper">
            <p className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-paper/60">Qolgan vaqt</p>
            <p className="num mt-0.5 font-semibold">1:38:12</p>
          </div>
        </div>

        <div className="grid gap-0 sm:grid-cols-[1.35fr_1fr]">
          {/* Y1 bubbles */}
          <div className="border-b-[1.5px] border-ink p-3 sm:border-b-0 sm:border-r-[1.5px]">
            <p className="eyebrow mb-2 flex justify-between !text-[0.6rem]">
              <span>Y1 · 1–32</span>
              <span className="text-accent">bitta javob</span>
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-[3px]">
              {Array.from({ length: 32 }, (_, i) => {
                const filled = i < 23 ? DEMO[i] : null;
                return (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className="num w-5 text-right text-[0.62rem] text-muted">{i + 1}</span>
                    {OPTION_LETTERS.slice(0, 4).map((l) => (
                      <span
                        key={l}
                        aria-hidden
                        className="grid h-[15px] w-[15px] place-items-center rounded-full border border-accent font-mono text-[0.5rem] text-accent-ink"
                      >
                        {filled === l ? (
                          <span className="block h-full w-full rounded-full bg-ink animate-fill" style={{ animationDelay: `${300 + i * 55}ms` }} />
                        ) : (
                          l
                        )}
                      </span>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col">
            {/* Y2 */}
            <div className="border-b-[1.5px] border-ink p-3">
              <p className="eyebrow mb-2 !text-[0.6rem]">Y2 · 33–35 · moslashtirish</p>
              {[33, 34, 35].map((n, r) => (
                <div key={n} className="mb-1 flex items-center gap-1.5">
                  <span className="num w-5 text-right text-[0.62rem] text-muted">{n}</span>
                  {[1, 2, 3, 4].map((k) => (
                    <span key={k} className="num grid h-[17px] w-[26px] place-items-center rounded-[2px] border border-ink bg-white text-[0.55rem]">
                      {r < 2 ? `${k}${"ACEB"[(k + r) % 4]}` : k === 1 ? "1D" : "·"}
                    </span>
                  ))}
                </div>
              ))}
            </div>
            {/* O1 */}
            <div className="border-b-[1.5px] border-ink p-3">
              <p className="eyebrow mb-2 !text-[0.6rem]">O1 · 36–40 · qisqa javob</p>
              {["0,25", "C₆H₁₂O₆", "", "", ""].slice(0, 3).map((v, i) => (
                <div key={i} className="mb-1 flex items-center gap-1.5">
                  <span className="num w-5 text-right text-[0.62rem] text-muted">{36 + i}</span>
                  <span className="num h-[18px] flex-1 rounded-[2px] border border-ink bg-white px-1.5 text-[0.62rem] leading-[16px]">{v}</span>
                </div>
              ))}
            </div>
            {/* O2 */}
            <div className="flex-1 bg-paper-2/70 p-3">
              <p className="eyebrow mb-1.5 !text-[0.6rem]">O2 · 41–43 · yozma ish · 80 daq.</p>
              <div className="space-y-1">
                {bio.o2Tasks.map((t) => (
                  <div key={t.number} className="flex items-center gap-2 text-[0.62rem]">
                    <span className="num w-5 text-right text-muted">{t.number}</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-[1px] border border-ink bg-white">
                      <span className="block h-full bg-ink/80" style={{ width: `${(t.maxScore / 35) * 100}%` }} />
                    </span>
                    <span className="num w-10 text-right">{t.maxScore} b.</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between border-t-[1.5px] border-ink bg-paper px-3 py-1.5 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-ok" /> Avtosaqlandi · 14:02:37
          </span>
          <span>23 / 43 belgilandi</span>
        </div>
      </div>
      <figcaption className="absolute -top-3 right-4 rotate-2 border-[1.5px] border-accent bg-paper px-2 py-0.5 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-accent">
        Interfeys · Demo
      </figcaption>
    </figure>
  );
}
