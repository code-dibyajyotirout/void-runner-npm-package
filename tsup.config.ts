import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  tsconfig: "tsconfig.lib.json",
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: true,
  injectStyle: false,
  external: ["react", "react-dom"],
});
