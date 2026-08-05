import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../../core/auth/jwt.guard';
import {
  DepartmentService,
  type DepartmentSummary,
} from './department.service';

@Controller('departments')
@UseGuards(JwtGuard)
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  @Get()
  async list(): Promise<DepartmentSummary[]> {
    return this.departmentService.list();
  }
}
