import re

# 1. DTO
dto_path = "src/modules/authorization/vendor-users/dto/create-vendor-user.dto.ts"
with open(dto_path, "r") as f: dto = f.read()
dto = dto.replace("IsUUID", "IsInt")
dto = dto.replace("IsInt,\n", "IsInt,\n  IsNumber,")
dto = dto.replace("@IsUUID()", "@IsInt()")
dto = dto.replace("@ApiProperty({ example: '1053433E-F36B-1410-85ED-009A959FB122' })", "@ApiProperty({ example: 101 })")
dto = dto.replace("vendorId!: string;", "vendorId!: number;")
if "IsNumber," not in dto:
    dto = dto.replace("IsInt,", "IsInt,\n  IsNumber,")
with open(dto_path, "w") as f: f.write(dto)

# 2. Interface
iface_path = "src/modules/authorization/vendor-users/interfaces/vendor-users.interface.ts"
with open(iface_path, "r") as f: iface = f.read()
iface = iface.replace("vendorId: string;", "vendorId: number;")
with open(iface_path, "w") as f: f.write(iface)

# 3. Controller
ctrl_path = "src/modules/authorization/vendor-users/controllers/vendor-users.controller.ts"
with open(ctrl_path, "r") as f: ctrl = f.read()
ctrl = ctrl.replace("vendorId: string", "vendorId: number")
ctrl = ctrl.replace("vendorId') vendorId: string", "vendorId', ParseIntPipe) vendorId: number")
if "ParseIntPipe" not in ctrl:
    ctrl = ctrl.replace("Param,", "Param, ParseIntPipe,")
with open(ctrl_path, "w") as f: f.write(ctrl)

print("Basic types updated")
