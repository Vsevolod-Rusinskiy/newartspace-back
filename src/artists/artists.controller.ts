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
  UseInterceptors
} from '@nestjs/common'

import { CreateArtistDto } from './dto/create-artist.dto'
import { UpdateArtistDto } from './dto/update-artist.dto'
import { ArtistsService } from './artists.service'
import { StorageService } from '../common/services/storage.service'

@Controller('artists')
export class ArtistsController {
  constructor(
    private readonly artistsService: ArtistsService,
    private readonly storageService: StorageService
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Header('Content-Type', 'application/json')
  createArtist(@Body() createArtist: CreateArtistDto) {
    return this.artistsService.create(createArtist)
  }

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
    const yandexArtistUrl = await this.storageService.uploadFile(
      file.buffer,
      fileName,
      'artists'
    )
    return {
      artistUrl: yandexArtistUrl
    }
  }

  @Get()
  async getAllSortedArtists(
    @Query('sort') sort: string,
    @Query('order') order: 'ASC' | 'DESC' = 'ASC',
    @Query('page') page,
    @Query('limit') limit
  ) {
    const { data, total } = await this.artistsService.getAllSortedArtists(
      sort,
      order,
      page,
      limit
    )
    return { data, total, page, pageCount: Math.ceil(total / limit) }
  }

  @Get(':id')
  async getOneArtist(@Param('id') id: string) {
    const artist = await this.artistsService.findOne(id)
    return artist
  }

  @Patch(':id')
  async updateArtist(
    @Body() updateArtist: UpdateArtistDto,
    @Param('id') id: string
  ) {
    const artist = await this.artistsService.update(+id, updateArtist)
    return artist
  }

  @Delete('delete-image')
  async deleteFile(@Body('fileName') fileName: string) {
    if (!fileName) {
      throw new BadRequestException('File name is required')
    }
    await this.storageService.deleteFile(fileName, 'artists')
    return { message: 'File deleted successfully' }
  }

  @Delete(':id')
  async deleteArtist(@Param('id') id: string) {
    await this.artistsService.delete(id)
    return { message: 'Artist deleted successfully' }
  }

  @Delete('deleteMany/:ids')
  async deleteManyArtists(@Param('ids') ids: string) {
    const deletedCount = await this.artistsService.deleteMany(ids)
    return { message: 'Artists deleted successfully', deletedCount }
  }
}