const fs = require('node:fs');
const path = require('node:path');
const { withAppBuildGradle } = require('expo/config-plugins');
const { applyPreviewSigning } = require('./preview-signing.cjs');
const { withTcgNetworking } = require('./networking-plugin.cjs');
const config = structuredClone(require('./app.json').expo);
let projectId;
const servicesPath = process.env.GOOGLE_SERVICES_JSON_PATH || path.join(__dirname, 'google-services.json');
if (fs.existsSync(servicesPath)) {
  const services = JSON.parse(fs.readFileSync(servicesPath, 'utf8'));
  if (!services.client?.some(c => c.client_info?.android_client_info?.package_name === config.android.package)) {
    throw new Error('Firebase config must match com.tcgroyal.lending.preview');
  }
  config.android.googleServicesFile = servicesPath;
  projectId = services.project_info.project_id;
}
const plistPath = process.env.GOOGLE_SERVICES_PLIST_PATH || path.join(__dirname, 'GoogleService-Info.plist');
if (fs.existsSync(plistPath)) {
  const services = require('@expo/plist').default.parse(fs.readFileSync(plistPath, 'utf8'));
  if (services.BUNDLE_ID !== config.ios.bundleIdentifier || !services.PROJECT_ID || (projectId && services.PROJECT_ID !== projectId)) {
    throw new Error('iOS Firebase config must match the Preview bundle and Android Firebase project');
  }
  config.ios.googleServicesFile = plistPath;
  projectId = services.PROJECT_ID;
}
if (projectId) {
  config.plugins.push('@react-native-firebase/app', '@react-native-firebase/auth');
  config.extra = { ...config.extra, firebaseProjectId: projectId };
}
// Hash long generated C++ object paths to keep Windows Ninja builds below MAX_PATH.
module.exports = { expo: withAppBuildGradle(withTcgNetworking(config), mod => {
  mod.modResults.contents = applyPreviewSigning(mod.modResults.contents);
  const marker = '// TCG ROYAL short CMake object paths';
  if (!mod.modResults.contents.includes(marker)) {
    mod.modResults.contents += `\n${marker}\nandroid { defaultConfig { externalNativeBuild { cmake { arguments "-DCMAKE_OBJECT_PATH_MAX=240" } } } }\n`;
  }
  return mod;
}) };
