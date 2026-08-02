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

  it("keeps the normal conversation measure in fullscreen", () => {
    expect(styles).toMatch(/\.transcript\s*{[^}]*width:\s*min\(100%,\s*800px\);/s);
    expect(styles).toMatch(/\.composer\s*{[^}]*width:\s*min\(100%,\s*800px\);/s);
    expect(styles).not.toMatch(/@media\s*\(min-width:\s*1536px\)[\s\S]*?1000px/);
  });

  it("keeps the v0.3.14 conversation density", () => {
    expect(styles).toMatch(/\.transcript-list\s*{[^}]*gap:\s*8px;/s);
    expect(styles).not.toMatch(/@media\s*\(max-width:\s*699px\)\s*{[\s\S]*?\.transcript-list\s*{/);
  });

  it("collapses source whitespace in rendered Markdown", () => {
    expect(styles).toMatch(/\.user-text\s*{[^}]*white-space:\s*pre-wrap;/s);
    expect(styles).not.toMatch(/\.assistant-text\s*,\s*\.user-text\s*{[^}]*white-space:\s*pre-wrap;/s);
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

describe("session board", () => {
  it("uses the v0.3.14 progress and idle board without a workspace rail", () => {
    expect(styles).toMatch(/\.session-board\s*{[^}]*width:\s*min\(100%,\s*1280px\);/s);
    expect(styles).toMatch(/\.board-header\s*{[^}]*width:\s*100%;/s);
    expect(styles).toMatch(/\.board-columns\s*{[^}]*width:\s*100%;/s);
    expect(styles).toMatch(/\.board-columns\s*{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/s);
    expect(styles).toMatch(/@media\s*\(max-width:\s*699px\)\s*{[\s\S]*?\.board-columns\s*{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/s);
    expect(styles).not.toMatch(/\.workspace-sidebar\s*{/);
  });
});
