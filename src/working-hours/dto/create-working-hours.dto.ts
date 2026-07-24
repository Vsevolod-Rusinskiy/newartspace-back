import { IsString, IsOptional } from 'class-validator'

export class CreateWorkingHoursDto {
  @IsOptional()
  @IsString()
  readonly scheduleText?: string

  @IsOptional()
  @IsString()
  readonly appointmentText?: string
}
