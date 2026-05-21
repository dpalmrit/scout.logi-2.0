import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { Job } from '@/lib/types'

const s3 = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

const BUCKET = process.env.PITCHSCOUT_LAB_BUCKET!

export async function getJob(jobId: string): Promise<Job | null> {
  try {
    const res = await s3.send(new GetObjectCommand({
      Bucket: BUCKET,
      Key: `jobs/${jobId}/meta.json`,
    }))
    const body = await res.Body!.transformToString()
    return JSON.parse(body) as Job
  } catch (err: unknown) {
    if ((err as { name?: string }).name === 'NoSuchKey') return null
    throw err
  }
}

export async function putJob(job: Job): Promise<void> {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: `jobs/${job.id}/meta.json`,
    Body: JSON.stringify(job),
    ContentType: 'application/json',
  }))
}

export async function listJobsForUser(userId: string): Promise<Job[]> {
  try {
    const metaKeys: string[] = []
    let continuationToken: string | undefined

    do {
      const res = await s3.send(new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: 'jobs/',
        ContinuationToken: continuationToken,
      }))
      for (const obj of res.Contents ?? []) {
        if (obj.Key?.endsWith('/meta.json')) metaKeys.push(obj.Key)
      }
      continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined
    } while (continuationToken)

    const jobs = await Promise.all(
      metaKeys.map(async key => {
        const obj = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
        const body = await obj.Body!.transformToString()
        return JSON.parse(body) as Job
      })
    )
    return jobs
      .filter(j => j.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  } catch (err: unknown) {
    throw new Error(`Failed to list jobs for user ${userId}: ${(err as Error).message ?? err}`)
  }
}

export async function presignedPutUrl(key: string, contentType: string): Promise<string> {
  if (!key.startsWith('jobs/')) throw new Error(`Invalid key prefix: ${key}`)
  return getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType }),
    { expiresIn: 3600 }
  )
}

export async function presignedGetUrl(key: string): Promise<string> {
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn: 3600 }
  )
}
