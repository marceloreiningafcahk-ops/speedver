import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'
import { normalizeDevProxyConfig } from './src/lib/devProxy'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))
const localConfigDataUrl = 'data:application/json,%7B%22version%22%3A3%2C%22exportedAt%22%3A%222026-06-22T08%3A13%3A38.807Z%22%2C%22settings%22%3A%7B%22baseUrl%22%3A%22https%3A%2F%2Fstore.forcepic.com%22%2C%22apiKey%22%3A%22sk-gT0olnlpRqRFnOMi6FICqPK2G28s8QJfKHFbmr8wpy8JGnAF%22%2C%22model%22%3A%22gemini-3.1-flash-image-preview%22%2C%22timeout%22%3A600%2C%22apiMode%22%3A%22images%22%2C%22codexCli%22%3Afalse%2C%22apiProxy%22%3Afalse%2C%22streamImages%22%3Afalse%2C%22streamPartialImages%22%3A1%2C%22customProviders%22%3A%5B%5D%2C%22clearInputAfterSubmit%22%3Afalse%2C%22persistInputOnRestart%22%3Atrue%2C%22reuseTaskApiProfileTemporarily%22%3Afalse%2C%22alwaysShowRetryButton%22%3Afalse%2C%22allowPromptRewrite%22%3Afalse%2C%22taskCompletionNotification%22%3Afalse%2C%22enterSubmit%22%3Afalse%2C%22referenceImageEditAction%22%3A%22ask%22%2C%22zipDownloadRoutes%22%3A%5B%22task-selection%22%2C%22favorite-collection-selection%22%5D%2C%22agentScrollToBottomAfterSubmit%22%3Atrue%2C%22agentMaxToolRounds%22%3A15%2C%22agentWebSearch%22%3Afalse%2C%22agentMathFormattingPrompt%22%3Atrue%2C%22agentApiConfigMode%22%3A%22off%22%2C%22agentTextProfileId%22%3Anull%2C%22agentImageProfileId%22%3A%22default-openai%22%2C%22profiles%22%3A%5B%7B%22id%22%3A%22default-openai%22%2C%22name%22%3A%22nano%20banana%202%22%2C%22provider%22%3A%22gemini-tikapi%22%2C%22baseUrl%22%3A%22https%3A%2F%2Fstore.forcepic.com%22%2C%22apiKey%22%3A%22sk-gT0olnlpRqRFnOMi6FICqPK2G28s8QJfKHFbmr8wpy8JGnAF%22%2C%22model%22%3A%22gemini-3.1-flash-image-preview%22%2C%22timeout%22%3A600%2C%22apiMode%22%3A%22images%22%2C%22codexCli%22%3Afalse%2C%22apiProxy%22%3Afalse%2C%22streamImages%22%3Afalse%2C%22streamPartialImages%22%3A1%2C%22providerDrafts%22%3A%7B%22openai%22%3A%7B%22baseUrl%22%3A%22https%3A%2F%2Fapi.openai.com%2Fv1%22%2C%22model%22%3A%22gpt-image-2%22%2C%22apiMode%22%3A%22images%22%2C%22codexCli%22%3Afalse%2C%22apiProxy%22%3Afalse%2C%22streamImages%22%3Afalse%2C%22streamPartialImages%22%3A1%7D%2C%22gemini-tikapi%22%3A%7B%22baseUrl%22%3A%22https%3A%2F%2Fstore.forcepic.com%22%2C%22model%22%3A%22gemini-3-pro-image-preview%22%2C%22apiMode%22%3A%22images%22%2C%22codexCli%22%3Afalse%2C%22apiProxy%22%3Afalse%2C%22streamImages%22%3Afalse%2C%22streamPartialImages%22%3A1%7D%7D%7D%2C%7B%22id%22%3A%22openai-mqoxsaqf-od4ca%22%2C%22name%22%3A%22nano%20banana%20pro%22%2C%22provider%22%3A%22gemini-tikapi%22%2C%22baseUrl%22%3A%22https%3A%2F%2Fstore.forcepic.com%22%2C%22apiKey%22%3A%22sk-gT0olnlpRqRFnOMi6FICqPK2G28s8QJfKHFbmr8wpy8JGnAF%22%2C%22model%22%3A%22gemini-3-pro-image-preview%22%2C%22timeout%22%3A600%2C%22apiMode%22%3A%22images%22%2C%22codexCli%22%3Afalse%2C%22apiProxy%22%3Afalse%2C%22streamImages%22%3Afalse%2C%22streamPartialImages%22%3A1%2C%22providerDrafts%22%3A%7B%22openai%22%3A%7B%22baseUrl%22%3A%22https%3A%2F%2Fstore.forcepic.com%22%2C%22model%22%3A%22gpt-image-2%22%2C%22apiMode%22%3A%22images%22%2C%22codexCli%22%3Afalse%2C%22apiProxy%22%3Afalse%2C%22streamImages%22%3Afalse%2C%22streamPartialImages%22%3A1%7D%7D%7D%2C%7B%22id%22%3A%22openai-mqoxmudr-jw16t%22%2C%22name%22%3A%22gpt-image2%22%2C%22provider%22%3A%22openai%22%2C%22baseUrl%22%3A%22https%3A%2F%2Fstore.forcepic.com%22%2C%22apiKey%22%3A%22sk-tG0bUeDtVpxi156DxqpkDxkWwlxLn0gMKzWFQGTgjfu0TXfL%22%2C%22model%22%3A%22gpt-image-2%22%2C%22timeout%22%3A600%2C%22codexCli%22%3Atrue%2C%22apiProxy%22%3Afalse%2C%22streamPartialImages%22%3A1%2C%22apiMode%22%3A%22images%22%2C%22streamImages%22%3Afalse%7D%5D%2C%22activeProfileId%22%3A%22default-openai%22%7D%7D'

function loadDevProxyConfig() {
  try {
    return normalizeDevProxyConfig(
      JSON.parse(readFileSync('./dev-proxy.config.json', 'utf-8')) as unknown,
    )
  } catch (error) {
    const err = error as NodeJS.ErrnoException
    if (err.code === 'ENOENT') return null
    throw error
  }
}

export default defineConfig(({ command }) => {
  const devProxyConfig = command === 'serve' ? loadDevProxyConfig() : null

  return {
    plugins: [react()],
    base: './',
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __DEV_PROXY_CONFIG__: JSON.stringify(devProxyConfig),
      __LOCAL_DEFAULT_CONFIG_URL__: JSON.stringify(localConfigDataUrl),
    },
    server: {
      host: true,
      proxy:
        devProxyConfig?.enabled
          ? {
              [devProxyConfig.prefix]: {
                target: devProxyConfig.target,
                changeOrigin: devProxyConfig.changeOrigin,
                secure: devProxyConfig.secure,
                rewrite: (path) =>
                  path.replace(
                    new RegExp(`^${devProxyConfig.prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
                    '',
                  ),
              },
            }
          : undefined,
    },
  }
})
