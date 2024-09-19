import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query
} from '@nestjs/common'
import { AttributesService } from './attributes.service'
import { CreateAttributeDto } from './dto/create-attribute.dto'
import { UpdateAttributeDto } from './dto/update-attribute.dto'

@Controller('attributes')
export class AttributesController {
  constructor(private readonly attributesService: AttributesService) {}

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

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateAttributeDto: UpdateAttributeDto
  ) {
    return this.attributesService.update(+id, updateAttributeDto)
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.attributesService.remove(+id)
  }
}
