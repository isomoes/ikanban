import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const styles = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");

describe("mobile viewport layout", () => {
  it("allocates the v0.3.1 titlebar and conversation within one dynamic viewport", () => {
    expect(styles).toMatch(/\.app-frame\s*{[^}]*grid-template-rows:\s*40px minmax\(0, 1fr\);/);
    expect(styles).toMatch(/@media\s*\(max-width:\s*699px\)\s*{[\s\S]*?\.app-frame\s*{[^}]*height:\s*100dvh;/);
    expect(styles).toMatch(/@media\s*\(max-width:\s*699px\)\s*{[\s\S]*?\.app-body\s*{[^}]*min-height:\s*0;[^}]*height:\s*100%;/);
    expect(styles).toMatch(/\.transcript\s*{[^}]*min-height:\s*0;[^}]*overflow-y:\s*auto;/s);
  });

  it("keeps the original message and dock proportions", () => {
    expect(styles).toMatch(/\.user-text\s*{[^}]*max-width:\s*min\(82%,\s*64ch\);/s);
    expect(styles).toMatch(/\.assistant-text li\s*>\s*p:first-child\s*{[^}]*display:\s*inline;[^}]*margin:\s*0;/s);
    expect(styles).toMatch(/\.composer-shell\s*{[^}]*border-radius:\s*12px;/s);
    expect(styles).toMatch(/\.composer-tray\s*{[^}]*margin-top:\s*-14px;/s);
  });
});

describe("document scrolling and theme", () => {
  it("keeps the document root fixed while the transcript owns scrolling", () => {
    expect(styles).toMatch(/html\s*{[^}]*position:\s*fixed;[^}]*inset:\s*0;/s);
    expect(styles).toMatch(/html,\s*body,\s*#root\s*{[^}]*height:\s*100%;[^}]*overflow:\s*hidden;/s);
    expect(styles).toMatch(/\.transcript\s*{[^}]*overflow-y:\s*auto;/s);
  });

  it("uses the GitHub Dark Colorblind palette", () => {
    expect(styles).toMatch(/:root\s*{[^}]*color-scheme:\s*dark;[^}]*--background-base:\s*#0d1117;[^}]*--text-strong:\s*#f0f6fc;[^}]*--focus:\s*#58a6ff;/s);
  });
});
