/** @type {import('electron-builder').Configuration} */
const config = {
  appId: "com.axiom.assistant",
  productName: "AXIOM",
  copyright: "Copyright © 2025 AXIOM",
  asar: true,
  compression: "maximum",

  directories: {
    output: "release",
    buildResources: "build-resources",
  },

  files: [
    "dist-electron/**/*",
    "dist/public/**/*",
    "icons/**/*",
    "!node_modules/**/*",
    "!src/**/*",
    "!electron/**/*",
  ],

  extraResources: [
    {
      from: "../api-server/dist",
      to: "api-server/dist",
      filter: ["**/*"],
    },
  ],

  mac: {
    category: "public.app-category.productivity",
    target: [
      { target: "dmg", arch: ["x64", "arm64"] },
      { target: "zip", arch: ["x64", "arm64"] },
    ],
    icon: "icons/icon.icns",
    hardenedRuntime: true,
    gatekeeperAssess: false,
    extendInfo: {
      LSUIElement: true,
      NSMicrophoneUsageDescription:
        "AXIOM uses the microphone for voice input commands.",
    },
  },

  win: {
    target: [{ target: "nsis", arch: ["x64"] }],
    icon: "icons/icon.ico",
  },

  linux: {
    target: [{ target: "AppImage", arch: ["x64"] }],
    icon: "icons/icon.png",
    category: "Utility",
  },

  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    runAfterFinish: true,
  },

  publish: null,
};

module.exports = config;
