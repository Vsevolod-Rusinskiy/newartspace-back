import { Injectable } from '@nestjs/common';
import { CreatePaintingDto } from './dto/create-painting.dto';
import { UpdatePaintingDto } from './dto/update-painting.dto';
import { Painting } from './models/painting.model';
import { InjectModel } from '@nestjs/sequelize';

@Injectable()
export class PaintingsService {
  constructor(
    @InjectModel(Painting)
    private paintingModel: typeof Painting,
  ) {}

  async findAll(): Promise<Painting[]> {
    return this.paintingModel.findAll();
  }

  async findOne(id: string): Promise<Painting> {
    return this.paintingModel.findOne({
      where: {
        id,
      },
    });
  }

  async create(createPainting: CreatePaintingDto): Promise<Painting> {
    const painting = new Painting();

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
    await painting.destroy();
  }
}
