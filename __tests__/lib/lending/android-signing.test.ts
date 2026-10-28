import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
const loadModule = createRequire(import.meta.url);
const { applyPreviewSigning } = loadModule('../../../mobile/preview-signing.cjs') as { applyPreviewSigning: (source: string) => string };
const source = `android {
    buildTypes {
        debug { signingConfig signingConfigs.debug }
        release {
            signingConfig signingConfigs.debug
        }
    }
}`;
describe('Preview release signing', () => {
  it('replaces release debug signing, keeps local debug builds and disables release debugging', () => {
    const result = applyPreviewSigning(source);
    expect(result).toContain('debug { signingConfig signingConfigs.debug }');
    expect(result).toMatch(/release\s*\{\s*signingConfig signingConfigs.tcgPreview\s*debuggable false/);
    expect(result).toContain('dependsOn("verifyPreviewReleaseSigning")');
    expect(result).toContain('Debug signing is forbidden');
  });
  it('does not silently fall back when Expo changes its generated template', () => {
    expect(() => applyPreviewSigning('android { unknown {} }')).toThrow('refusing');
  });
  it('is idempotent when prebuild updates the same project', () => {
    const result = applyPreviewSigning(source);
    expect(applyPreviewSigning(result)).toBe(result);
  });
});
