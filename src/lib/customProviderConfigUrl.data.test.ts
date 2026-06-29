import { describe, expect, it } from 'vitest'
import { loadCustomProviderSettingsFromUrl } from './customProviderConfigUrl'

describe('data url custom provider config', () => {
  it('loads imported settings from data url', async () => {
    const payload = {
      customProviders: [{
        id: 'custom-data',
        name: 'Data Custom',
        submit: {
          path: 'images/generations',
          method: 'POST',
          contentType: 'json',
          body: { model: '$profile.model', prompt: '$prompt' },
          result: { imageUrlPaths: ['data.*.url'], b64JsonPaths: [] },
        },
      }],
      profiles: [{
        id: 'data-profile',
        name: 'Data Profile',
        provider: 'custom-data',
        baseUrl: 'https://api.example.com/v1',
        apiKey: 'data-key',
        model: 'data-model',
        timeout: 300,
        apiMode: 'images',
        codexCli: false,
        apiProxy: false,
      }],
    }
    const url = `data:application/json,${encodeURIComponent(JSON.stringify({ version: 1, settings: payload }))}`

    const result = await loadCustomProviderSettingsFromUrl(url, async () => {
      throw new Error('data urls should not fetch')
    })

    expect(result?.customProviders[0]).toMatchObject({ id: 'custom-data', name: 'Data Custom' })
    expect(result?.profiles[0]).toMatchObject({ id: 'data-profile', provider: 'custom-data' })
  })
})
