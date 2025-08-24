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

  async findAll(): Promise<Welcomes[]> {
    return this.welcomeModel.findAll()
  }
}
