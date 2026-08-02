import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const styles = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");

describe("mobile viewport layout", () => {
  it("allocates the status rail and application body within one dynamic viewport", () => {
    expect(styles).toMatch(/@media\s*\(max-width:\s*699px\)\s*{[\s\S]*?\.app-frame\s*{[^}]*display:\s*grid;[^}]*grid-template-rows:\s*28px minmax\(0, 1fr\);[^}]*height:\s*100dvh;/);
    expect(styles).toMatch(/@media\s*\(max-width:\s*699px\)\s*{[\s\S]*?\.app-body\s*{[^}]*min-height:\s*0;[^}]*height:\s*100%;/);
    expect(styles).toMatch(/\.transcript\s*{[^}]*min-height:\s*0;[^}]*overflow-y:\s*auto;/s);
  });
});
