import type { Readable } from 'node:stream';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Inject, Injectable } from '@nestjs/common';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';

/**
 * MinIO lúc dev và S3 lúc chạy thật dùng chung một client. `forcePathStyle` là bắt
 * buộc cho MinIO: kiểu virtual-host cần DNS wildcard theo tên bucket, thứ không có
 * trong docker compose.
 */
@Injectable()
export class ObjectStorage {
  private readonly client: S3Client;
  private ready: Promise<void> | null = null;

  constructor(@Inject(ENV) private readonly env: Env) {
    this.client = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      forcePathStyle: true,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY,
        secretAccessKey: env.S3_SECRET_KEY,
      },
    });
  }

  readonly put = async (
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<void> => {
    await this.ensureBucket();
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.env.S3_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  };

  readonly get = async (key: string): Promise<Readable> => {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.env.S3_BUCKET, Key: key }),
    );

    return result.Body as Readable;
  };

  readonly remove = async (key: string): Promise<void> => {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.env.S3_BUCKET, Key: key }),
    );
  };

  /**
   * Tạo bucket lần đầu nếu chưa có, và chỉ thử đúng một lần cho cả vòng đời tiến
   * trình — mỗi lần upload mà gọi HeadBucket là thêm một vòng mạng vô ích.
   */
  private readonly ensureBucket = (): Promise<void> => {
    this.ready ??= this.createBucketIfMissing().catch((error: unknown) => {
      this.ready = null;
      throw error;
    });

    return this.ready;
  };

  private readonly createBucketIfMissing = async (): Promise<void> => {
    try {
      await this.client.send(
        new HeadBucketCommand({ Bucket: this.env.S3_BUCKET }),
      );
    } catch {
      await this.client.send(
        new CreateBucketCommand({ Bucket: this.env.S3_BUCKET }),
      );
    }
  };
}
