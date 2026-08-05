import {
  type UpdateDocumentInput,
  updateDocumentSchema,
  uploadDocumentSchema,
} from '@chatbot/contracts';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { CurrentUser } from '../../core/auth/current-user';
import { JwtGuard } from '../../core/auth/jwt.guard';
import { RequireRole, RolesGuard } from '../../core/auth/roles.guard';
import type { AccessTokenClaims } from '../../core/auth/token.service';
import { ZodBody } from '../../core/http/zod-body.pipe';
import {
  DocumentService,
  type DocumentSummary,
  type UploadedFile,
} from './document.service';

type ParsedUpload = {
  file: UploadedFile | null;
  fields: Record<string, string>;
};

/**
 * Duyệt từng phần thay vì `request.file()`: busboy chỉ gom được các trường xuất
 * hiện TRƯỚC file, nên đọc kiểu kia sẽ mất metadata nếu client đính file trước.
 */
const parseUpload = async (request: FastifyRequest): Promise<ParsedUpload> => {
  const result: ParsedUpload = { file: null, fields: {} };

  for await (const part of request.parts()) {
    if (part.type === 'file') {
      result.file = {
        buffer: await part.toBuffer(),
        fileName: part.filename,
        mimeType: part.mimetype,
      };
    } else {
      result.fields[part.fieldname] = String(part.value);
    }
  }

  return result;
};

@Controller('documents')
@UseGuards(JwtGuard, RolesGuard)
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Get()
  async list(
    @Query('departmentId') departmentId?: string,
  ): Promise<DocumentSummary[]> {
    return this.documentService.list(departmentId ?? null);
  }

  @Post()
  @RequireRole('manager')
  @HttpCode(HttpStatus.CREATED)
  async upload(
    @Req() request: FastifyRequest,
    @CurrentUser() user: AccessTokenClaims,
  ): Promise<DocumentSummary> {
    if (!request.isMultipart()) {
      throw new BadRequestException('Yêu cầu phải là multipart/form-data');
    }

    const { file, fields } = await parseUpload(request);
    if (file === null) throw new BadRequestException('Thiếu file tài liệu');

    const input = new ZodBody(uploadDocumentSchema).transform(fields);

    return this.documentService.upload(file, input, user.userId);
  }

  @Patch(':id')
  @RequireRole('manager')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodBody(updateDocumentSchema)) input: UpdateDocumentInput,
  ): Promise<DocumentSummary> {
    return this.documentService.update(id, input);
  }

  @Post(':id/reingest')
  @RequireRole('manager')
  @HttpCode(HttpStatus.OK)
  async reingest(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DocumentSummary> {
    return this.documentService.reingest(id);
  }

  @Delete(':id')
  @RequireRole('manager')
  async archive(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DocumentSummary> {
    return this.documentService.archive(id);
  }

  @Get(':id/file')
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const file = await this.documentService.openFile(id);

    reply
      .header('content-type', file.mimeType)
      .header(
        'content-disposition',
        `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      )
      .send(file.stream);
  }
}
