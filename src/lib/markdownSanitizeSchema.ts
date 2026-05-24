import { defaultSchema } from "rehype-sanitize";
import type { Schema } from "hast-util-sanitize";

const base = defaultSchema;
const baseAttrs = (base.attributes ?? {}) as Record<
  string,
  ReadonlyArray<string | [string, ...(string | number | boolean | RegExp)[]]>
>;

export const noaSanitizeSchema: Schema = {
  ...base,
  tagNames: [...(base.tagNames ?? []), "mark", "span", "div"],
  attributes: {
    ...baseAttrs,
    mark: [["className", "hl"]],
    span: [
      ...(baseAttrs.span ?? []),
      ["className", /^hl-(lime|red|green|yellow|purple)$/],
    ],
    div: [
      ...(baseAttrs.div ?? []),
      ["className", /^callout(\s+callout-(info|tip|warn|success|danger))?$/],
    ],
    code: [
      ...(baseAttrs.code ?? []),
      ["className", /^language-/, /^hljs/],
    ],
  },
  clobberPrefix: base.clobberPrefix ?? "user-content-",
};
