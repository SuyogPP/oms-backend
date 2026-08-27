import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Res,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { UserImportService } from '../services/user-import.service';
import {
  ValidateImportDto,
  CommitImportDto,
} from '../dto/validate-import.dto';
import { PermissionGuard } from '../../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import type { CurrentUser as ICurrentUser } from '../../../auth/interfaces/current-user.interface';
import { RateLimit } from '../../../../common/rate-limit/rate-limit.decorator';
import { RateLimitTier } from '../../../../common/rate-limit/rate-limit.constants';
import { USER_PERMISSIONS } from '../../users/users.constants';

@ApiTags('Authorization - User Import')
@ApiBearerAuth('JWT')
@Controller('authorization/users/import')
export class UserImportController {
  constructor(private readonly userImportService: UserImportService) {}

  @Get('template')
  @RequirePermissions(USER_PERMISSIONS.IMPORT)
  @UseGuards(PermissionGuard)
  @ApiOperation({
    summary: 'Download CSV template for bulk user import',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'CSV template file stream',
  })
  getTemplate(@Res() res: Response) {
    const csvContent = this.userImportService.getTemplate();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="user_import_template.csv"',
    );
    return res.status(HttpStatus.OK).send(csvContent);
  }

  @Post('validate')
  @RequirePermissions(USER_PERMISSIONS.IMPORT)
  @UseGuards(PermissionGuard)
  @RateLimit(RateLimitTier.TIER_6_FILE_OPS)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Phase 1: Validate batch against Section 5.1/6.2 rules; returns validation token valid for 30m',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Batch validation completed with per-row results',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Empty batch or exceeds 500 rows limit',
  })
  async validateImport(
    @Body() dto: ValidateImportDto,
    @CurrentUser() currentUser?: ICurrentUser,
  ) {
    return this.userImportService.validateImport(dto, currentUser?.userId);
  }

  @Post('commit')
  @RequirePermissions(USER_PERMISSIONS.IMPORT)
  @UseGuards(PermissionGuard)
  @RateLimit(RateLimitTier.TIER_7_REPORTS)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Phase 2: Atomically commit validated batch using token (All-or-nothing; issues invitations)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Batch committed and users invited successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Expired or invalid import token',
  })
  async commitImport(
    @Body() dto: CommitImportDto,
    @CurrentUser() currentUser?: ICurrentUser,
  ) {
    return this.userImportService.commitImport(dto, currentUser?.userId);
  }
}
