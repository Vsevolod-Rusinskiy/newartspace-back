import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/sequelize'
import { Welcomes } from './models/welcome.model'
import { CreateWelcomeDto } from './dto/create-welcome.dto'
import { UpdateWelcomeDto } from './dto/update-welcome.dto'

@Injectable()
export class WelcomeService {
  constructor(
    @InjectModel(Welcomes)
    private welcomeModel: typeof Welcomes
  ) {}

  async create(createWelcomeDto: CreateWelcomeDto): Promise<Welcomes> {
    return this.welcomeModel.create({ ...createWelcomeDto })
  }

  async getAllSortedWelcomes(
    sort?: string,
    order?: 'ASC' | 'DESC',
    page?: number,
    limit?: number
  ): Promise<{ data: Welcomes[]; total: number }> {
    order = order || 'DESC'
    page = page !== undefined ? page : 1
    limit = limit !== undefined ? limit : 10

    let sortField = 'createdAt'
    if (sort) {
      try {
        const parsedSort = JSON.parse(sort)
        if (Array.isArray(parsedSort) && parsedSort.length === 2) {
          sortField = parsedSort[0]
          order = parsedSort[1]
        }
      } catch (error) {
        console.error('Failed to parse sort parameter:', error)
      }
    }

    const offset = (page - 1) * limit

    const { rows: data, count: total } =
      await this.welcomeModel.findAndCountAll({
        order: [[sortField, order]],
        limit,
        offset
      })

    return { data, total }
  }

  async findOne(id: string): Promise<Welcomes> {
    const welcome = await this.welcomeModel.findByPk(id)
    if (!welcome) {
      throw new NotFoundException(`Welcome with id ${id} not found`)
    }
    return welcome
  }

  async update(
    id: number,
    updateWelcomeDto: UpdateWelcomeDto
  ): Promise<Welcomes> {
    const existingWelcome = await this.findOne(id.toString())
    if (!existingWelcome) {
      throw new NotFoundException(`Welcome with id ${id} not found`)
    }

    await existingWelcome.update(updateWelcomeDto)
    return existingWelcome
  }

  async delete(id: string): Promise<void> {
    const welcome = await this.findOne(id)
    if (!welcome) {
      throw new NotFoundException(`Welcome with id ${id} not found`)
    }
    await welcome.destroy()
  }

  async deleteMany(ids: string): Promise<{ deletedWelcomeCount: number }> {
    const idArray = JSON.parse(ids).map((id) => id.toString())
    let deletedWelcomeCount = 0

    for (const id of idArray) {
      try {
        await this.delete(id)
        deletedWelcomeCount++
      } catch (error) {
        console.error(`Error deleting welcome with id ${id}:`, error.message)
      }
    }

    return { deletedWelcomeCount }
  }
}
