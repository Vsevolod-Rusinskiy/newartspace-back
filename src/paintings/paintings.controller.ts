import { FileInterceptor } from '@nestjs/platform-express'

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  ParseIntPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  Logger
} from '@nestjs/common'

import { CreatePaintingDto } from './dto/create-painting.dto'
import { UpdatePaintingDto } from './dto/update-painting.dto'
import { PaintingsService } from './paintings.service'
import { StorageService } from '../common/services/storage.service'
import { AdminJwtGuard } from 'src/auth/guards/admin-jwt.guard'
import { PaintingWithAuthor } from './paintings.service'
import { SimilarPaintingsQueryDto } from './dto/similar-paintings-query.dto'
import { CacheRevalidationPublisher } from '../common/cache-revalidation/cache-revalidation.publisher'

@Controller('paintings')
export class PaintingsController {
  private readonly logger = new Logger(PaintingsController.name)
  constructor(
    private readonly paintingService: PaintingsService,
    private readonly storageService: StorageService,
    private readonly cacheRevalidationPublisher: CacheRevalidationPublisher
  ) {}

  @UseGuards(AdminJwtGuard)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Header('Content-Type', 'application/json')
  async createPainting(@Body() createPainting: CreatePaintingDto) {
    this.logger.debug(`Received data: ${JSON.stringify(createPainting)}`)
    const painting = await this.paintingService.create(createPainting)
    this.cacheRevalidationPublisher.schedule({
      entity: 'painting',
      action: 'created',
      ids: [painting.id]
    })
    return painting
  }

  @UseGuards(AdminJwtGuard)
  @Post('upload-image')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is required')
    }

    const maxSizeInBytes = 1048576
    if (file.size > maxSizeInBytes) {
      throw new BadRequestException(
        'File size exceeds the maximum limit of 1 MB'
      )
    }

    const fileName = file.originalname
    const yandexImgUrl = await this.storageService.uploadFile(
      file.buffer,
      fileName,
      'paintings'
    )
    return {
      imgUrl: yandexImgUrl
    }
  }

  @Get()
  async getAllSortedPaintings(
    @Query('sort') sort: string,
    @Query('order') order: 'ASC' | 'DESC' = 'ASC',
    @Query('page') page,
    @Query('limit') limit,
    @Query('filters') filters,
    @Query('artStyle') artStyle,
    @Query('filter') filter: string
  ) {
    const { data, total } = await this.paintingService.getAllSortedPaintings(
      sort,
      order,
      page,
      limit,
      filters,
      artStyle,
      filter
    )

    this.logger.debug(`Received data: ${JSON.stringify(filters)}`)
    this.logger.debug(`Search filter: ${filter}`)
    return { data, total, page, pageCount: Math.ceil(total / limit) }
  }

  @UseGuards(AdminJwtGuard)
  @Get('admin')
  async getAllAdminPaintings(
    @Query('sort') sort: string,
    @Query('order') order: 'ASC' | 'DESC' = 'ASC',
    @Query('page') page,
    @Query('limit') limit,
    @Query('filters') filters,
    @Query('artStyle') artStyle,
    @Query('filter') filter: string
  ) {
    const { data, total } = await this.paintingService.getAllSortedPaintings(
      sort,
      order,
      page,
      limit,
      filters,
      artStyle,
      filter,
      true
    )

    return { data, total, page, pageCount: Math.ceil(total / limit) }
  }

  @UseGuards(AdminJwtGuard)
  @Get('admin/:id')
  async getOneAdminPainting(
    @Param('id') id: string
  ): Promise<PaintingWithAuthor> {
    return this.paintingService.findOne(id)
  }

  @Get('getMany/:ids')
  async getManyPaintings(@Param('ids') ids: string) {
    return this.paintingService.findMany(ids)
  }

  @Get(':id/similar')
  async getSimilarPaintings(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: SimilarPaintingsQueryDto
  ): Promise<PaintingWithAuthor[]> {
    return this.paintingService.findSimilar(id.toString(), query.limit)
  }

  @Get(':id')
  async getOnePainting(@Param('id') id: string): Promise<PaintingWithAuthor> {
    const painting = await this.paintingService.findPublicOne(id)
    return painting
  }

  @UseGuards(AdminJwtGuard)
  @Patch(':id')
  async updatePainting(
    @Body() updatePainting: UpdatePaintingDto,
    @Param('id') id: string
  ) {
    this.logger.debug(`Received data: ${JSON.stringify(updatePainting)}`)
    const painting = await this.paintingService.update(+id, updatePainting)
    this.cacheRevalidationPublisher.schedule({
      entity: 'painting',
      action: 'updated',
      ids: [id]
    })
    return painting
  }

  @UseGuards(AdminJwtGuard)
  @Delete('delete-image')
  async deleteFile(@Body('fileName') fileName: string) {
    if (!fileName) {
      throw new BadRequestException('File name is required')
    }
    await this.storageService.deleteFile(fileName, 'paintings')
    return { message: 'File deleted successfully' }
  }

  @UseGuards(AdminJwtGuard)
  @Delete(':id')
  async deletePainting(@Param('id') id: string) {
    await this.paintingService.delete(id)
    this.cacheRevalidationPublisher.schedule({
      entity: 'painting',
      action: 'deleted',
      ids: [id]
    })
    return { message: 'Painting deleted successfully' }
  }

  @UseGuards(AdminJwtGuard)
  @Delete('deleteMany/:ids')
  async deleteManyPaintings(@Param('ids') ids: string) {
    const parsedIds = JSON.parse(ids) as Array<string | number>
    const deletedCount = await this.paintingService.deleteMany(ids)
    this.cacheRevalidationPublisher.schedule({
      entity: 'painting',
      action: 'deleted',
      ids: parsedIds
    })
    return { message: 'Paintings deleted successfully', deletedCount }
  }
}
