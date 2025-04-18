import { Controller, Get } from '@nestjs/common'

@Controller()
export class AppController {
  @Get('version')
  getVersion() {
    return {
      version: '1.0.7',
      message: 'Backend is up and running'
      // date_time: new Date().toLocaleString()
    }
  }
}
