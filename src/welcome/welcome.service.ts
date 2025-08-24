import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/sequelize'
import { Welcomes } from './models/welcome.model'
import { CreateWelcomeDto } from './dto/create-welcome.dto'

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

    const sortField = sort || 'createdAt'
    const offset = (page - 1) * limit

    const { rows: data, count: total } =
      await this.welcomeModel.findAndCountAll({
        order: [[sortField, order]],
        limit,
        offset
      })

    return { data, total }
  }
}
