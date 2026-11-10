import test from "node:test";
import assert from "node:assert/strict";
import {
  createDefaultDesignSystem,
} from "../../packages/design-core/src/index.ts";
import {
  exportDtcgTokens,
  importInterchangeTokens,
} from "../../packages/design-core/src/token-interchange.ts";

test("Token interchange imports Penpot / Tokens Studio style token sets and resolves themes", () => {
  const baseSystem = createDefaultDesignSystem();

  const externalTokens = {
    $metadata: {
      tokenSetOrder: ["global", "dark"],
    },
    $themes: [
      {
        id: "theme-light",
        name: "Brand Light",
        selectedTokenSets: {
          global: "enabled",
        },
      },
      {
        id: "theme-dark",
        name: "Brand Dark",
        selectedTokenSets: {
          global: "enabled",
          dark: "enabled",
        },
      },
    ],
    global: {
      colors: {
        background: {
          $type: "color",
          $value: "#ffffff",
        },
        primary: {
          $type: "color",
          $value: "#1d4ed8",
        },
      },
      spacing: {
        base: {
          $type: "dimension",
          $value: "16px",
        },
      },
    },
    dark: {
      colors: {
        background: {
          $type: "color",
          $value: "#0f172a",
        },
      },
    },
  };

  const result = importInterchangeTokens(externalTokens, baseSystem);
  assert.ok(result.designSystem);
  assert.strictEqual(result.designSystem.modes.length, 2);

  const tokens = result.designSystem.tokens;
  const bgToken = tokens.find(t => t.name === "colors.background");
  assert.ok(bgToken, "colors.background should be imported");
  assert.strictEqual(bgToken.type, "color");
  if (bgToken.value.type === "color") {
    assert.strictEqual(bgToken.value.value.toLowerCase(), "#ffffff");
  }

  // Dark mode override check
  const darkMode = result.designSystem.modes.find(m => m.name.toLowerCase().includes("dark"));
  assert.ok(darkMode);
  if (darkMode && bgToken.modeValues?.[darkMode.id]?.type === "color") {
    assert.strictEqual(bgToken.modeValues[darkMode.id].value.toLowerCase(), "#0f172a");
  }
});

test("Token interchange handles alias resolution and unsupported types gracefully", () => {
  const baseSystem = createDefaultDesignSystem();

  const payload = {
    color: {
      brand: {
        $type: "color",
        $value: "#10b981",
      },
      accent: {
        $type: "color",
        $value: "{color.brand}",
      },
    },
    unsupported: {
      customGrad: {
        $type: "gradient",
        $value: "linear-gradient(to right, red, blue)",
      },
    },
  };

  const result = importInterchangeTokens(payload, baseSystem);
  assert.ok(result.designSystem);
  // Unsupported types should produce a warning
  assert.ok(result.warnings.some(w => w.includes("unsupported") || w.includes("gradient")));

  // Alias {color.brand} should resolve to current value #10b981
  const accentToken = result.designSystem.tokens.find(t => t.name === "color.accent");
  assert.ok(accentToken);
  if (accentToken.value.type === "color") {
    assert.strictEqual(accentToken.value.value.toLowerCase(), "#10b981");
  }
});

test("Token interchange rejects payloads exceeding token count limit", () => {
  const baseSystem = createDefaultDesignSystem();
  const oversized: Record<string, unknown> = {};
  for (let i = 0; i < 5001; i++) {
    oversized[`tok_${i}`] = {
      $type: "number",
      $value: i,
    };
  }

  assert.throws(
    () => importInterchangeTokens(oversized, baseSystem),
    /contains more than 5000 tokens/i
  );
});
