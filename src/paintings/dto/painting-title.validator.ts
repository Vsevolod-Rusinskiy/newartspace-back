import {
  ValidatorConstraint,
  ValidatorConstraintInterface
} from 'class-validator'

const FILE_EXT_RE = /\.(jpe?g|png|gif|webp|heic)$/i
const CAMERA_NAME_RE = /^IMG_\d/i

@ValidatorConstraint({ name: 'isNotFilenameTitle', async: false })
export class IsNotFilenameTitleConstraint
  implements ValidatorConstraintInterface
{
  validate(title: unknown): boolean {
    if (title === undefined || title === null || title === '') {
      return true
    }

    const value = String(title).trim()
    if (FILE_EXT_RE.test(value) || CAMERA_NAME_RE.test(value)) {
      return false
    }

    const half = Math.floor(value.length / 2)
    if (
      value.length >= 10 &&
      half > 0 &&
      value.slice(0, half) === value.slice(half)
    ) {
      return false
    }

    return true
  }

  defaultMessage(): string {
    return 'Название не должно быть именем файла (IMG_…, .jpg) или дублироваться'
  }
}
