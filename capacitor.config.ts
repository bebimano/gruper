import type { CapacitorConfig } from "@capacitor/cli";

// Native shell for Play Store / App Store. It loads the published web app,
// so new machines and clients appear without store updates.
const config: CapacitorConfig = {
  appId: "app.gruper.remote",
  appName: "Gruper Remote",
  webDir: "dist",
  server: {
    // Replace with your published URL after publishing.
    url: "https://id-preview--ecea4172-4f31-4ac1-9537-d8b96647ae3d.lovable.app",
    cleartext: false,
  },
  backgroundColor: "#16191e",
};

export default config;
