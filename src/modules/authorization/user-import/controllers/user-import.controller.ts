import {
  Controller,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserImportService } from '../services/user-import.service';
import { ValidateImportDto, CommitImportDto } from '../dto/validate-import.dto';
import { PermissionGuard } from '../../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import type { CurrentUser as ICurrentUser } from '../../../auth/interfaces/current-user.interface';

@ApiTags('Authorization - User Import')
@ApiBearerAuth('JWT')
@Controller('authorization/users/import')
export class UserImportController {
  constructor(private readonly userImportService: UserImportService) {}

  @Post('validate')
  @RequirePermissions('USER.IMPORT')
  @UseGuards(PermissionGuard)
  @ApiOperation({ summary: 'Validate CSV/Excel user batch for bulk import' })
  async validateImport(
    @Body() dto: ValidateImportDto,
    @CurrentUser() currentUser?: ICurrentUser,
  ) {
    return this.userImportService.validateImport(dto, currentUser?.userId);
  }

  @Post('commit')
  @RequirePermissions('USER.IMPORT')
  @UseGuards(PermissionGuard)
  @ApiOperation({ summary: 'Commit validated batch of users atomically' })
  async commitImport(
    @Body() dto: CommitImportDto,
    @CurrentUser() currentUser?: ICurrentUser,
  ) {
    return this.userImportService.commitImport(dto, currentUser?.userId);
  }
}
