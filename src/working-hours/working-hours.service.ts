import { InjectModel } from '@nestjs/sequelize'
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException
} from '@nestjs/common'
import { CreateWorkingHoursDto } from './dto/create-working-hours.dto'
import { UpdateWorkingHoursDto } from './dto/update-working-hours.dto'
import { WorkingHours } from './models/working-hours.model'

@Injectable()
export class WorkingHoursService {
  private readonly logger = new Logger(WorkingHoursService.name)

  constructor(
    @InjectModel(WorkingHours)
    private workingHoursModel: typeof WorkingHours
  ) {}

  async create(
    createWorkingHoursDto: CreateWorkingHoursDto
  ): Promise<WorkingHours> {
    try {
      const workingHours = new WorkingHours({ ...createWorkingHoursDto })
      await workingHours.save()
      return workingHours
    } catch (error) {
      this.logger.error(`Error creating working hours: ${error.message}`)
      throw new InternalServerErrorException(
        `Error creating working hours: ${error.message}`
      )
    }
  }

  async findAll(
    page?: number,
    limit?: number
  ): Promise<{ data: WorkingHours[]; total: number }> {
    page = page !== undefined ? page : 1
    limit = limit !== undefined ? limit : 10

    const { rows: data, count: total } =
      await this.workingHoursModel.findAndCountAll({
        order: [['id', 'DESC']],
        limit: limit,
        offset: (page - 1) * limit,
        distinct: true
      })

    return { data, total }
  }

  async findOne(id: string): Promise<WorkingHours> {
    const workingHours = await this.workingHoursModel.findOne({
      where: { id: Number(id) }
    })

    if (!workingHours) {
      throw new NotFoundException(`Working hours with id ${id} not found`)
    }

    return workingHours
  }

  async update(
    id: number,
    updateWorkingHoursDto: UpdateWorkingHoursDto
  ): Promise<WorkingHours> {
    const workingHours = await this.findOne(id.toString())
    if (!workingHours) {
      throw new NotFoundException(`Working hours with id ${id} not found`)
    }

    const [, [updatedWorkingHours]] = await this.workingHoursModel.update(
      updateWorkingHoursDto,
      {
        where: { id },
        returning: true
      }
    )

    return updatedWorkingHours
  }

  async delete(id: string): Promise<void> {
    const workingHours = await this.findOne(id)
    if (!workingHours) {
      throw new NotFoundException(`Working hours with id ${id} not found`)
    }

    try {
      await workingHours.destroy()
    } catch (error) {
      this.logger.error(`Error deleting working hours: ${error.message}`)
      throw new InternalServerErrorException(
        `Error deleting working hours: ${error.message}`
      )
    }
  }
}
