import type { CapacitorConfig } from "@capacitor/cli";

// Native shell for Play Store / App Store. It loads the published web app,
// so new machines and clients appear without store updates.
const config: CapacitorConfig = {
  appId: "app.gruper.remote",
  appName: "Gruper Remote",
  webDir: "dist",
  server: {
    url: "https://gruper.lovable.app",
    cleartext: false,
  },
  backgroundColor: "#ffffff",
};

export default config;
