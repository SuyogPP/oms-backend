import re

# 1. vendor-users.controller.ts ParseIntPipe
ctrl = "src/modules/authorization/vendor-users/controllers/vendor-users.controller.ts"
with open(ctrl, "r") as f: content = f.read()
content = content.replace("Param, ParseIntPipe,", "Param,")
content = content.replace("ApiParam, ParseIntPipe,", "ApiParam,")
content = content.replace("import { Param, ParseIntPipe, Get, Post, Body, Put, Patch, Delete } from '@nestjs/common';", "import { Param, ParseIntPipe, Get, Post, Body, Put, Patch, Delete } from '@nestjs/common';")
if "import { ParseIntPipe" not in content and "ParseIntPipe," not in content.split("from '@nestjs/common'")[0]:
    content = content.replace("import { Controller,", "import { Controller, ParseIntPipe,")
with open(ctrl, "w") as f: f.write(content)

# 2. vendor-users.entity.ts
ent = "src/modules/authorization/vendor-users/entities/vendor-users.entity.ts"
with open(ent, "r") as f: content = f.read()
content = content.replace("vendorId!: string;", "vendorId!: number;")
with open(ent, "w") as f: f.write(content)

# 3. vendor-users.mapper.ts
mapper = "src/modules/authorization/vendor-users/vendor-users.mapper.ts"
with open(mapper, "r") as f: content = f.read()
content = content.replace("isDeleted: model.isDeleted,\n", "")
content = content.replace("profile: model.profile ? { ...model.profile } : null,\n", "")
with open(mapper, "w") as f: f.write(content)

# 4. vendor-users.service.ts
srv = "src/modules/authorization/vendor-users/services/vendor-users.service.ts"
with open(srv, "r") as f: content = f.read()
content = content.replace("performed_by: operatorUserId,", "performed_by: operatorUserId || null,")
content = content.replace("validateV2_VendorLink(dto.vendorId)", "validateV2_VendorLink(dto.vendorId.toString())") # hack for V2 validate
content = content.replace("validateV5_VendorOrgUnitProfile(\n      USER_TYPES.VENDOR,\n      {},\n    )", "validateV5_VendorOrgUnitProfile(\n      USER_TYPES.VENDOR,\n      null,\n    )")
with open(srv, "w") as f: f.write(content)

# 5. users.repository.ts
users_repo = "src/modules/authorization/users/repositories/users.repository.ts"
with open(users_repo, "r") as f: content = f.read()
content = content.replace("displayName: r.displayName,", "")
with open(users_repo, "w") as f: f.write(content)

print("Fixed TS errors")
