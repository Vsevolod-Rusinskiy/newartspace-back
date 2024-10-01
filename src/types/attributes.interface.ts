interface AttributeItem {
  id: number
  value: string
  priority: number
  isChecked: boolean
}

export interface AttributeGroups {
  artTypesList: AttributeItem[]
  colorsList: AttributeItem[]
  formatsList: AttributeItem[]
  materialsList: AttributeItem[]
  techniquesList: AttributeItem[]
  stylesList: AttributeItem[]
  themesList: AttributeItem[]
  priceList: AttributeItem[]
  sizeList: AttributeItem[]
}
