import { describe, expect, it } from "vitest";
import { parseBooklet, sanitizeFragment } from "../src/lib/booklet-parse";

const BOOKLET = `
<section class="task" id="t1"><p class="q"><b>1.</b> Sistematikadagi eng kichik <i>asosiy</i> birlik?</p>
<ul class="opts"><li><b>A</b>tur</li><li><b>B</b>avlod</li><li><b>C</b>oila</li><li><b>D</b>turkum</li></ul></section>
<section class="task" id="t39"><p class="q"><b>39.</b> 2<sup>2x</sup> = 4 <script>alert(1)</script><img src="x" onerror="alert(1)"></p></section>
<section class="task" id="t7"><p class="q"><b>7.</b> Figure <svg><circle r="3"/></svg></p>
<ul class="opts"><li><b>A</b><span onclick="x()">bir</span></li><li><b>B</b>ikki</li></ul></section>
<section class="task" id="t8"><div class="pick" data-q="8"><button data-opt="A">A</button></div></section>`;

describe("parseBooklet", () => {
  const qs = parseBooklet(BOOKLET);

  it("extracts stem and lettered options", () => {
    const q1 = qs.find((q) => q.n === 1)!;
    expect(q1.stem).toBe("Sistematikadagi eng kichik <i>asosiy</i> birlik?");
    expect(q1.options.map((o) => o.letter).join("")).toBe("ABCD");
    expect(q1.options[2].html).toBe("oila");
    expect(q1.hasFigure).toBe(false);
  });

  it("removes scripts, event handlers and non-data images", () => {
    const q = qs.find((q) => q.n === 39)!;
    expect(q.stem).not.toMatch(/script|onerror|alert/);
    expect(q.stem).toContain("<sup>2x</sup>");
    expect(q.hasFigure).toBe(true);
    expect(q.options).toEqual([]);
  });

  it("strips attributes and flags figures", () => {
    const q = qs.find((q) => q.n === 7)!;
    expect(q.options[0].html).toBe("<span>bir</span>");
    expect(q.hasFigure).toBe(true);
  });

  it("skips tasks without a question stem", () => {
    expect(qs.some((q) => q.n === 8)).toBe(false);
  });
});

describe("sanitizeFragment", () => {
  it("keeps data: images only", () => {
    expect(sanitizeFragment('<img src="data:image/png;base64,AAAA" onload="x">').html).toBe('<img src="data:image/png;base64,AAAA" alt="" style="max-width:100%;height:auto;vertical-align:middle">');
    expect(sanitizeFragment('<img src="https://evil/x.png">').html).toBe("[rasm]");
  });
  it("drops unknown tags but keeps their text", () => {
    expect(sanitizeFragment('<a href="javascript:x">link</a> <b>ok</b>').html).toBe("link <b>ok</b>");
  });
});
