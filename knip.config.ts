import type { KnipConfig } from "knip";

const config: KnipConfig = {
  workspaces: {
    "packages/*": {
      entry: "src/**/index.ts",
    },
  },
};

export default config;
