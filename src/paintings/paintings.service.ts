import * as path from 'path';
import * as fs from 'fs';
import { Injectable, NotFoundException } from '@nestjs/common';
import { CreatePaintingDto } from './dto/create-painting.dto';
import { UpdatePaintingDto } from './dto/update-painting.dto';
import { Painting } from './models/painting.model';
import { InjectModel } from '@nestjs/sequelize';
import { FindOptions, UpdateOptions } from 'sequelize';

@Injectable()
export class PaintingsService {
  private readonly uploadPath = path.join(__dirname, '../../uploads/paintings');
  constructor(
    @InjectModel(Painting)
    private paintingModel: typeof Painting,
  ) {}

  private getPaintingFileName(url: string): string {
    const parts = url.split('/');
    return parts[parts.length - 1];
  }

  async findAll(): Promise<Painting[]> {
    return this.paintingModel.findAll();
  }

  async findOne(id: string): Promise<Painting> {
    const options: FindOptions = {
      where: { id },
    };
    return this.paintingModel.findOne(options);
  }

  async create(createPainting: CreatePaintingDto): Promise<Painting> {
    const painting = new Painting();

    painting.paintingUrl = createPainting.paintingUrl;
    painting.name = createPainting.name;
    painting.artType = createPainting.artType;
    painting.price = createPainting.price;
    painting.theme = createPainting.theme;
    painting.style = createPainting.style;
    painting.base = createPainting.base;
    painting.materials = createPainting.materials;
    painting.dimensions = createPainting.dimensions;
    painting.yearOfCreation = createPainting.yearOfCreation;
    painting.format = createPainting.format;
    painting.color = createPainting.color;

    return painting.save();
  }

  async update(
    id: number,
    painting: UpdatePaintingDto,
  ): Promise<[number, Painting[]]> {
    return this.paintingModel.update(painting, {
      where: { id },
      returning: true,
    });
  }

  async delete(id: string): Promise<void> {
    const painting = await this.findOne(id);

    const url = painting.dataValues.paintingUrl;
    const paintingFileName = this.getPaintingFileName(url);

    // Удаление файла изображения
    const filePath = path.join(this.uploadPath, paintingFileName);
    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      } else {
        throw new NotFoundException(`File with id ${id} not found`);
      }
    } catch (error) {
      throw new NotFoundException(`Error deleting file: ${error.message}`);
    }

    await painting.destroy();
  }

  async deleteMany(ids: string[]): Promise<{}> {
    let deletedCount = 0;
    for (const id of ids) {
      const painting = await this.findOne(id);
      const url = painting.dataValues.paintingUrl;
      const paintingFileName = this.getPaintingFileName(url);
      const filePath = path.join(this.uploadPath, paintingFileName);
      try {
        if (fs.existsSync(filePath)) {
          await fs.promises.unlink(filePath);
          deletedCount++;
        } else {
          throw new NotFoundException(`File with id ${id} not found`);
        }
      } catch (error) {
        throw new NotFoundException(`Error deleting file: ${error.message}`);
      }
    }

    const result = await this.paintingModel.destroy({
      where: {
        id: ids,
      },
    });

    return {
      result,
      deletedCount,
    };
  }
}
