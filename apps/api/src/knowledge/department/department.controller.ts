import {
  type CreateDepartment,
  createDepartmentSchema,
} from '@chatbot/contracts';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../core/auth/current-user';
import { JwtGuard } from '../../core/auth/jwt.guard';
import { RequireRole, RolesGuard } from '../../core/auth/roles.guard';
import type { AccessTokenClaims } from '../../core/auth/token.service';
import { ZodBody } from '../../core/http/zod-body.pipe';
import {
  DepartmentService,
  type DepartmentSummary,
} from './department.service';

@Controller('departments')
@UseGuards(JwtGuard, RolesGuard)
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  @Get()
  async list(): Promise<DepartmentSummary[]> {
    return this.departmentService.list();
  }

  @Post()
  @RequireRole('admin')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body(new ZodBody(createDepartmentSchema)) input: CreateDepartment,
    @CurrentUser() user: AccessTokenClaims,
  ): Promise<DepartmentSummary> {
    return this.departmentService.create(input, user.userId);
  }
}
