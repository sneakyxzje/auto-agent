import type { ImageAssetSummary } from '@chatbot/contracts';
import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { CurrentUser } from '../core/auth/current-user';
import { JwtGuard } from '../core/auth/jwt.guard';
import type { AccessTokenClaims } from '../core/auth/token.service';
import { RateLimiter } from '../redis/rate-limiter.service';
import { ImageService, type UploadedImage } from './image.service';

const UPLOADS_PER_HOUR = 30;

const readImagePart = async (
  request: FastifyRequest,
): Promise<UploadedImage | null> => {
  let file: UploadedImage | null = null;

  for await (const part of request.parts()) {
    if (part.type === 'file') {
      file = { buffer: await part.toBuffer(), fileName: part.filename };
    }
  }

  return file;
};

@Controller('images')
@UseGuards(JwtGuard)
export class ImageController {
  constructor(
    private readonly images: ImageService,
    private readonly rateLimiter: RateLimiter,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async upload(
    @Req() request: FastifyRequest,
    @CurrentUser() user: AccessTokenClaims,
  ): Promise<ImageAssetSummary> {
    await this.rateLimiter.consume({
      key: `image-upload:${user.userId}`,
      limit: UPLOADS_PER_HOUR,
      windowSeconds: 3_600,
    });

    if (!request.isMultipart()) {
      throw new BadRequestException('Yêu cầu phải là multipart/form-data');
    }

    const file = await readImagePart(request);
    if (file === null) throw new BadRequestException('Thiếu file ảnh');

    return this.images.upload(file, user.userId);
  }

  @Get(':id')
  async serve(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const file = await this.images.openFile(id);

    reply
      .header('content-type', file.mime)
      .header('cache-control', 'private, max-age=86400')
      .send(file.stream);
  }
}
