import {
  Body,
  Controller,
  Delete,
  Get,
  Ip,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../../../auth/decorators/public.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import type { CurrentUser as ICurrentUser } from '../../../auth/interfaces/current-user.interface';
import { FiscalYearsService } from '../services/fiscal-years.service';
import { CreateFiscalYearDto } from '../dto/create-fiscal-year.dto';
import { UpdateFiscalYearDto } from '../dto/update-fiscal-year.dto';
import { ListFiscalYearsDto } from '../dto/list-fiscal-years.dto';
import { FiscalYearEntity } from '../entities/fiscal-year.entity';

@ApiTags('Fiscal Years')
@ApiBearerAuth()
// Public decorator allows calling this controller without token or cookies during testing
@Public()
@Controller('fiscal-years')
export class FiscalYearsController {
  constructor(
    private readonly fiscalYearsService: FiscalYearsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all fiscal years' })
  @ApiResponse({
    status: 200,
    description: 'List of fiscal years',
    type: [FiscalYearEntity],
  })
  async findAll(@Query() query: ListFiscalYearsDto) {
    return this.fiscalYearsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get fiscal year by ID' })
  @ApiResponse({
    status: 200,
    description: 'Fiscal year details',
    type: FiscalYearEntity,
  })
  @ApiResponse({
    status: 404,
    description: 'Fiscal year not found',
  })
  async findById(@Param('id') id: string) {
    return this.fiscalYearsService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new fiscal year (UUID auto-generated)' })
  @ApiResponse({
    status: 201,
    description: 'Fiscal year created successfully',
    type: FiscalYearEntity,
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Code already exists',
  })
  async create(
    @Body() dto: CreateFiscalYearDto,
    @CurrentUser() user?: ICurrentUser,
    @Ip() ip?: string,
  ) {
    return this.fiscalYearsService.create(dto, {
      userId: user?.userId,
      userName: user?.email,
      ip,
    });
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update fiscal year by ID in URL param (modifies only passed fields)',
  })
  @ApiResponse({
    status: 200,
    description: 'Fiscal year updated successfully',
    type: FiscalYearEntity,
  })
  @ApiResponse({
    status: 404,
    description: 'Fiscal year not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - New code already exists',
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateFiscalYearDto,
    @CurrentUser() user?: ICurrentUser,
    @Ip() ip?: string,
  ) {
    return this.fiscalYearsService.update(id, dto, {
      userId: user?.userId,
      userName: user?.email,
      ip,
    });
  }

  @Patch()
  @ApiOperation({
    summary: 'Update fiscal year by passing fiscalYearId in body (modifies only passed fields)',
  })
  @ApiResponse({
    status: 200,
    description: 'Fiscal year updated successfully',
    type: FiscalYearEntity,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Missing fiscalYearId in body',
  })
  @ApiResponse({
    status: 404,
    description: 'Fiscal year not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - New code already exists',
  })
  async updateByBody(
    @Body() dto: UpdateFiscalYearDto,
    @CurrentUser() user?: ICurrentUser,
    @Ip() ip?: string,
  ) {
    return this.fiscalYearsService.update(dto.fiscalYearId, dto, {
      userId: user?.userId,
      userName: user?.email,
      ip,
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete fiscal year (sets status = INACTIVE)' })
  @ApiResponse({
    status: 200,
    description: 'Fiscal year soft-deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Fiscal year not found',
  })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user?: ICurrentUser,
    @Ip() ip?: string,
  ) {
    return this.fiscalYearsService.softDelete(id, {
      userId: user?.userId,
      userName: user?.email,
      ip,
    });
  }
}
