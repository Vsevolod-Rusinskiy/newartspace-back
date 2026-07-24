import { IsString, IsOptional } from 'class-validator'

export class UpdateWorkingHoursDto {
  @IsOptional()
  readonly id?: string

  @IsOptional()
  @IsString()
  readonly scheduleText?: string

  @IsOptional()
  @IsString()
  readonly appointmentText?: string
}
