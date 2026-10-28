// Kept separate so the transformation can be checked without loading Firebase config.
const marker = '// TCG ROYAL dedicated Preview signing';
function applyPreviewSigning(contents) {
  if (contents.includes(marker)) return contents;
  const releaseDebug = /(release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/;
  if (!releaseDebug.test(contents) || !contents.includes('    buildTypes {')) {
    throw new Error('Unrecognized Android signing template; refusing to keep default release signing');
  }
  const properties = `
${marker}
def tcgSigningFile = rootProject.file("../.signing-preview/release.properties")
def tcgSigningProperties = new Properties()
if (tcgSigningFile.exists()) {
    tcgSigningFile.withInputStream { tcgSigningProperties.load(it) }
}
`;
  const signing = `    signingConfigs {
        tcgPreview {
            if (tcgSigningFile.exists()) {
                storeFile new File(tcgSigningFile.parentFile, tcgSigningProperties.getProperty("storeFile"))
                storePassword tcgSigningProperties.getProperty("storePassword")
                keyAlias tcgSigningProperties.getProperty("keyAlias")
                keyPassword tcgSigningProperties.getProperty("keyPassword")
            }
        }
    }
`;
  const guard = `
tasks.register("verifyPreviewReleaseSigning") {
    doLast {
        if (!tcgSigningFile.exists() || ["storeFile", "storePassword", "keyAlias", "keyPassword"].any { !tcgSigningProperties.getProperty(it) }) {
            throw new GradleException("Dedicated Preview release signing credentials are required; debug signing is forbidden.")
        }
        if (tcgSigningProperties.getProperty("keyAlias") == "androiddebugkey" || tcgSigningProperties.getProperty("storeFile").endsWith("debug.keystore")) {
            throw new GradleException("Debug signing is forbidden for Preview release APKs.")
        }
    }
}
tasks.matching { it.name == "preReleaseBuild" }.configureEach {
    dependsOn("verifyPreviewReleaseSigning")
}
`;
  return properties + contents.replace(releaseDebug, '$1signingConfig signingConfigs.tcgPreview\n            debuggable false')
    .replace('    buildTypes {', signing + '    buildTypes {') + guard;
}
module.exports = { applyPreviewSigning };
