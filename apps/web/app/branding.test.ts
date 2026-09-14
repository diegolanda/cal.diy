import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import process from "node:process";
import postcss, { type PluginCreator } from "postcss";
import { describe, expect, it } from "vitest";

const require = createRequire(resolve(process.cwd(), "apps/web/app/branding.test.ts"));
const tailwindcss = require("@tailwindcss/postcss") as PluginCreator<Record<string, never>>;

describe("Nuen brand assets", () => {
  it("serves the Nuen favicon from both Next.js routing systems", async () => {
    const [appFavicon, publicFavicon] = await Promise.all([
      readFile(resolve(process.cwd(), "apps/web/app/favicon.ico")),
      readFile(resolve(process.cwd(), "apps/web/public/favicon.ico")),
    ]);

    expect(appFavicon).toEqual(publicFavicon);
  });

  it("keeps wordmarks independent of an installed font", async () => {
    const wordmarks = await Promise.all([
      readFile(resolve(process.cwd(), "apps/web/public/nuen-wordmark.svg"), "utf8"),
      readFile(resolve(process.cwd(), "apps/web/public/nuen-wordmark-dark.svg"), "utf8"),
    ]);

    for (const wordmark of wordmarks) {
      expect(wordmark).toContain("<path");
      expect(wordmark).not.toMatch(/<text\b|font-family=/);
    }
  });

  it("provides a four-times-density email wordmark", async () => {
    const emailWordmark = await readFile(
      resolve(process.cwd(), "apps/web/public/emails/nuen-wordmark@4x.png")
    );

    expect(emailWordmark.readUInt32BE(16)).toBe(256);
    expect(emailWordmark.readUInt32BE(20)).toBe(104);
  });
});

describe("Nuen theme", () => {
  it("maps Tailwind utilities to the runtime brand tokens", async () => {
    const input = '@import "../styles/globals.css";\n@source inline("font-mono shadow-card");';
    const result = await postcss([tailwindcss()]).process(input, {
      from: resolve(process.cwd(), "apps/web/app/branding.test.css"),
    });

    expect(result.css).toMatch(/\.font-mono\s*\{[^}]*font-family:\s*var\(--font-mono\)/);
    expect(result.css).toMatch(/\.shadow-card\s*\{[^}]*box-shadow:/);
    expect(result.css).toMatch(
      /\.nuen-booking-background label\[for="overlayCalendar"\]\s*\{[^}]*color:\s*var\(--nuen-surface\)/
    );
  });
});
