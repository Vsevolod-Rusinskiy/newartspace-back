import {
  Controller,
  Get,
  // Post,
  // Body,
  // Patch,
  // Param,
  // Delete,
  UseGuards,
  Res,
  HttpStatus,
  Req,
  HttpCode,
  Logger
} from '@nestjs/common'
import { AccountService } from './account.service'
import { JWTGuard } from 'src/auth/guards/jwt.guard'
import { AuthService } from 'src/auth/auth.service'
import { Response } from 'express'
import { Request as ExpressRequest } from 'express'

interface Request extends ExpressRequest {
  token: string
}

// import { CreateAccountDto } from './dto/create-account.dto'
// import { UpdateAccountDto } from './dto/update-account.dto'

@Controller('account')
export class AccountController {
  private readonly logger = new Logger(AccountController.name)

  constructor(
    private readonly accountService: AccountService,
    private readonly authService: AuthService
  ) {}

  // @Post()
  // create(@Body() createAccountDto: CreateAccountDto) {
  //   return this.accountService.create(createAccountDto)

  @UseGuards(JWTGuard)
  @Get()
  @HttpCode(HttpStatus.OK)
  async getAllPurchases(@Req() req: Request, @Res() res: Response) {
    const token = req.token

    const user = await this.authService.getUserByTokenData(token)
    this.logger.log(user, 'user from token')
    const purchases = await this.accountService.findAll()

    return res.send(purchases)
  }

  //   @Get(':id')
  //   findOne(@Param('id') id: string) {
  //     return this.accountService.findOne(+id)
  //   }

  //   @Patch(':id')
  //   update(@Param('id') id: string, @Body() updateAccountDto: UpdateAccountDto) {
  //     return this.accountService.update(+id, updateAccountDto)
  //   }

  //   @Delete(':id')
  //   remove(@Param('id') id: string) {
  //     return this.accountService.remove(+id)
  //   }
  // }
}
