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
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
  UseGuards
} from '@nestjs/common'

import { CreateArtistDto } from './dto/create-artist.dto'
import { UpdateArtistDto } from './dto/update-artist.dto'
import { ArtistsService } from './artists.service'
import { StorageService } from '../common/services/storage.service'
import { AdminJwtGuard } from 'src/auth/guards/admin-jwt.guard'
import { CacheRevalidationPublisher } from '../common/cache-revalidation/cache-revalidation.publisher'

@Controller('artists')
export class ArtistsController {
  constructor(
    private readonly artistsService: ArtistsService,
    private readonly storageService: StorageService,
    private readonly cacheRevalidationPublisher: CacheRevalidationPublisher
  ) {}

  @UseGuards(AdminJwtGuard)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Header('Content-Type', 'application/json')
  async createArtist(@Body() createArtist: CreateArtistDto) {
    const artist = await this.artistsService.create(createArtist)
    this.cacheRevalidationPublisher.schedule({
      entity: 'artist',
      action: 'created',
      ids: [artist.id]
    })
    return artist
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
      'artists'
    )
    return {
      imgUrl: yandexImgUrl
    }
  }

  @Get()
  async getAllSortedArtists(
    @Query('sort') sort: string,
    @Query('order') order: 'ASC' | 'DESC' = 'ASC',
    @Query('page') page,
    @Query('limit') limit,
    @Query('letter') letter,
    @Query('filter') filter: string
  ) {
    const { data, total } = await this.artistsService.getAllSortedArtists(
      sort,
      order,
      page,
      limit,
      letter,
      filter
    )
    return { data, total, page, pageCount: Math.ceil(total / limit) }
  }

  @Get(':id')
  async getOneArtist(@Param('id') id: string) {
    const artist = await this.artistsService.findOne(id)
    return artist
  }

  @UseGuards(AdminJwtGuard)
  @Patch(':id')
  async updateArtist(
    @Body() updateArtist: UpdateArtistDto,
    @Param('id') id: string
  ) {
    const artist = await this.artistsService.update(+id, updateArtist)
    this.cacheRevalidationPublisher.schedule({
      entity: 'artist',
      action: 'updated',
      ids: [id]
    })
    return artist
  }

  @UseGuards(AdminJwtGuard)
  @Delete('delete-image')
  async deleteFile(@Body('fileName') fileName: string) {
    if (!fileName) {
      throw new BadRequestException('File name is required')
    }
    await this.storageService.deleteFile(fileName, 'artists')
    return { message: 'File deleted successfully' }
  }

  @UseGuards(AdminJwtGuard)
  @Delete(':id')
  async deleteArtist(@Param('id') id: string) {
    await this.artistsService.delete(id)
    this.cacheRevalidationPublisher.schedule({
      entity: 'artist',
      action: 'deleted',
      ids: [id]
    })
    return { message: 'Artist deleted successfully' }
  }

  @UseGuards(AdminJwtGuard)
  @Delete('deleteMany/:ids')
  async deleteManyArtists(@Param('ids') ids: string) {
    const parsedIds = JSON.parse(ids) as Array<string | number>
    const deletedCount = await this.artistsService.deleteMany(ids)
    this.cacheRevalidationPublisher.schedule({
      entity: 'artist',
      action: 'deleted',
      ids: parsedIds
    })
    return { message: 'Artists deleted successfully', deletedCount }
  }
}
