interface AttributeItem {
  id: number
  value: string
  priority: number
}

export interface AttributeGroups {
  artTypesList: AttributeItem[]
  colorsList: AttributeItem[]
  formatsList: AttributeItem[]
  materialsList: AttributeItem[]
  techniquesList: AttributeItem[]
  stylesList: AttributeItem[]
  themesList: AttributeItem[]
}
