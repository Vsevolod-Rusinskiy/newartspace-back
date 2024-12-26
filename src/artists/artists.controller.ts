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

@Controller('artists')
export class ArtistsController {
  constructor(
    private readonly artistsService: ArtistsService,
    private readonly storageService: StorageService
  ) {}

  @UseGuards(AdminJwtGuard)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Header('Content-Type', 'application/json')
  createArtist(@Body() createArtist: CreateArtistDto) {
    return this.artistsService.create(createArtist)
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
    @Query('letter') letter
  ) {
    const { data, total } = await this.artistsService.getAllSortedArtists(
      sort,
      order,
      page,
      limit,
      letter
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
    return { message: 'Artist deleted successfully' }
  }

  @UseGuards(AdminJwtGuard)
  @Delete('deleteMany/:ids')
  async deleteManyArtists(@Param('ids') ids: string) {
    const deletedCount = await this.artistsService.deleteMany(ids)
    return { message: 'Artists deleted successfully', deletedCount }
  }
}
