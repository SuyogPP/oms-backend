import { IsArray, IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class UserImportRowDto {
  @ApiProperty({ example: 1 })
  rowNumber!: number;

  @ApiProperty({ example: 'EMP-1001', required: false })
  employeeId?: string;

  @ApiProperty({ example: 'ali.rashid' })
  username!: string;

  @ApiProperty({ example: 'ali.rashid@diez.ae' })
  email!: string;

  @ApiProperty({ example: 'Ali' })
  firstName!: string;

  @ApiProperty({ example: 'Rashid' })
  lastName!: string;

  @ApiProperty({ example: 'Procurement Specialist', required: false })
  jobTitle?: string;

  @ApiProperty({ example: 'DEP-PROC', required: false })
  departmentCode?: string;

  @ApiProperty({ example: ['PROCUREMENT_BUYER'], required: false })
  roles?: string[];

  @ApiProperty({ example: 'DEPARTMENT', required: false })
  scopeCode?: string;

  @ApiProperty({ example: 'DEP-PROC', required: false })
  scopeUnitCode?: string;
}

export class ValidateImportDto {
  @ApiProperty({ type: [UserImportRowDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UserImportRowDto)
  rows!: UserImportRowDto[];
}

export class CommitImportDto {
  @ApiProperty({ example: 'imp_9f823a01bce44' })
  @IsString()
  @IsNotEmpty()
  importToken!: string;
}
