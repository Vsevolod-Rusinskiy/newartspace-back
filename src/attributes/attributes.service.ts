import { Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/sequelize'
import { Attributes } from './models/attributes.model'
import { AttributeGroups } from '../types/attributes.interface'
import { Sequelize } from 'sequelize'

@Injectable()
export class AttributesService {
  private readonly logger = new Logger(AttributesService.name)

  constructor(
    @InjectModel(Attributes)
    private attributesModel: typeof Attributes
  ) {}

  create(createAttributeDto) {
    console.log(createAttributeDto)
    return 'This action adds a new attribute'
  }

  async getAllSortedAttributes(sort?: string, order?: 'ASC' | 'DESC') {
    const attributes = await this.attributesModel.findAll({
      attributes: ['id', 'value', 'type', 'priority', 'isChecked'], // Добавлено isChecked
      order: [
        ['priority', 'DESC'],
        [Sequelize.literal(`value COLLATE "POSIX"`), order]
      ]
    })

    const groupedAttributes: AttributeGroups = {
      artTypesList: [],
      colorsList: [],
      formatsList: [],
      materialsList: [],
      techniquesList: [],
      stylesList: [],
      themesList: [],
      priceList: [],
      sizeList: []
    }

    /**
     * Собираем отсортированные списки в нужный нам объект
     * */
    attributes.forEach((attr) => {
      const type = attr.type as keyof AttributeGroups
      if (!groupedAttributes[type]) {
        groupedAttributes[type] = []
      }

      groupedAttributes[type].push({
        id: attr.id,
        value: attr.value,
        priority: attr.priority,
        isChecked: attr.isChecked
      })
    })

    groupedAttributes.materialsList = [
      ...groupedAttributes.materialsList,
      ...groupedAttributes.techniquesList
    ]

    delete groupedAttributes.techniquesList

    groupedAttributes.materialsList.sort((a, b) =>
      a.value.localeCompare(b.value)
    )

    return { data: groupedAttributes }
  }

  findOne(id: number) {
    return `This action returns a #${id} attribute`
  }

  update(id: number, updateAttributeDto) {
    console.log(updateAttributeDto)
    return `This action updates a #${id} attribute`
  }

  remove(id: number) {
    return `This action removes a #${id} attribute`
  }
}
