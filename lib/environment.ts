const TEST_ENVIRONMENT_LABEL = 'テスト環境'

export function getEnvironmentLabel() {
  const explicitLabel =
    process.env.SITE_ENV_LABEL?.trim() ||
    process.env.EMAIL_ENV_LABEL?.trim() ||
    process.env.NEXT_PUBLIC_ENV_LABEL?.trim()

  if (explicitLabel) return explicitLabel

  if (
    process.env.VERCEL_ENV === 'preview' ||
    process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview'
  ) {
    return TEST_ENVIRONMENT_LABEL
  }

  return null
}
