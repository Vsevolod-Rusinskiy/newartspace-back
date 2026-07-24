import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards
} from '@nestjs/common'
import { AttributesService } from './attributes.service'
import { CreateAttributeDto } from './dto/create-attribute.dto'
import { UpdateAttributeDto } from './dto/update-attribute.dto'
import { AdminJwtGuard } from 'src/auth/guards/admin-jwt.guard'

@Controller('attributes')
export class AttributesController {
  constructor(private readonly attributesService: AttributesService) {}

  @UseGuards(AdminJwtGuard)
  @Post()
  create(@Body() createAttributeDto: CreateAttributeDto) {
    return this.attributesService.create(createAttributeDto)
  }

  @Get()
  async getAllSortedAttributes(
    @Query('sort') sort: string = 'value',
    @Query('order') order: 'ASC' | 'DESC' = 'ASC'
  ) {
    const data = await this.attributesService.getAllSortedAttributes(
      sort,
      order
    )
    return data
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.attributesService.findOne(+id)
  }

  @UseGuards(AdminJwtGuard)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateAttributeDto: UpdateAttributeDto
  ) {
    return this.attributesService.update(+id, updateAttributeDto)
  }

  @UseGuards(AdminJwtGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.attributesService.remove(+id)
  }
}
