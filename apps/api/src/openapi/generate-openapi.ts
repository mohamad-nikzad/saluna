import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { contractApp, openApiDocumentConfig } from './contract-app'

const outputPath = resolve(
  fileURLToPath(
    new URL('../../../../packages/api-contract/openapi.json', import.meta.url),
  ),
)

const document = contractApp.getOpenAPIDocument(openApiDocumentConfig)

mkdirSync(dirname(outputPath), { recursive: true })
writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8')

console.log(`Wrote OpenAPI contract to ${outputPath}`)
