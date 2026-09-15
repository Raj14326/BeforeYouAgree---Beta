import { createWriteStream, existsSync, mkdirSync, renameSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'

const MODEL_DIR = resolve(
  process.env.BERT_MODEL_DIR || 'ml/local-models/bya-legalbert-small-unfair-tos',
)

const MODEL_FILES = [
  'config.json',
  'risk_config.json',
  'special_tokens_map.json',
  'tokenizer_config.json',
  'tokenizer.json',
  'vocab.txt',
  'onnx/model.onnx',
]

/** Download a private model from S3 when it is not present in the deployment. */
export async function ensureModelAvailable() {
  const missing = MODEL_FILES.filter((file) => !existsSync(resolve(MODEL_DIR, file)))
  if (!missing.length) return

  const bucket = process.env.MODEL_S3_BUCKET
  const prefix = (process.env.MODEL_S3_PREFIX || 'bya-legalbert-small-unfair-tos')
    .replace(/^\/+|\/+$/g, '')
  if (!bucket) {
    throw new Error(
      `Model files are missing (${missing.join(', ')}) and MODEL_S3_BUCKET is not configured.`,
    )
  }

  const client = new S3Client({})
  for (const file of missing) {
    const destination = resolve(MODEL_DIR, file)
    const temporary = `${destination}.download`
    mkdirSync(dirname(destination), { recursive: true })
    const response = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: `${prefix}/${file}` }),
    )
    if (!response.Body) throw new Error(`S3 returned an empty body for ${file}.`)
    try {
      await pipeline(response.Body as Readable, createWriteStream(temporary))
      renameSync(temporary, destination)
    } catch (error) {
      rmSync(temporary, { force: true })
      throw error
    }
  }
}
