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
  } catch {
    return null
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
  const res = await s3.send(new ListObjectsV2Command({
    Bucket: BUCKET,
    Prefix: 'jobs/',
  }))
  const metaKeys = (res.Contents ?? [])
    .map(o => o.Key!)
    .filter(k => k.endsWith('/meta.json'))

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
}

export async function presignedPutUrl(key: string, contentType: string): Promise<string> {
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
