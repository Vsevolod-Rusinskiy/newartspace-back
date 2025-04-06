// src/one-click-order/one-click-order.service.ts
import { HttpStatus, HttpException, Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/sequelize'
import { RequestFormDto } from './dto/request-form.dto'
import { Painting } from '../paintings/models/painting.model'
import { Artist } from '../artists/models/artist.model'
import { MailService } from '../mail/mail.service'
import { OrdersService } from '../orders/orders.service'
import { CreateOrderDto } from '../orders/dto/create-order.dto'
import { UsersService } from '../users/users.service'
import { TelegramService } from '../telegram/telegram.service'
import { EmailTemplateService } from '../email-templates/email-template.service'

@Injectable()
export class RequestFormService {
  private readonly logger = new Logger(RequestFormService.name)

  constructor(
    @InjectModel(Painting)
    private paintingModel: typeof Painting,
    private mailService: MailService,
    private ordersService: OrdersService,
    private usersService: UsersService,
    private telegramService: TelegramService,
    private emailTemplateService: EmailTemplateService
  ) {}

  private async findUserByEmail(email: string): Promise<number | null> {
    try {
      const user = await this.usersService.findOne(email)
      return user ? user.id : null
    } catch (error) {
      this.logger.error('Ошибка при поиске пользователя:', error.message)
      return null
    }
  }

  private async sendTelegramMessage(message: string) {
    try {
      await this.telegramService.sendMessage(message)
      this.logger.log('Сообщение в Telegram отправлено успешно')
    } catch (error) {
      this.logger.error('Ошибка при отправке в Telegram:', error.message)
      // не бросаем исключение, чтобы остальные операции могли продолжиться
    }
  }

  private async sendEmails(
    clientEmail: string,
    adminMessage: string,
    paintingInfo: string,
    clientName: string,
    paintings: Painting[],
    totalSum: number,
    deliveryMethod: string
  ) {
    try {
      // Создаем HTML-шаблон для письма клиенту
      const clientHTML = this.emailTemplateService.createEmailTemplate(
        clientName,
        paintings,
        totalSum,
        deliveryMethod
      )

      await this.mailService.sendMail(
        'Ваш заказ получен',
        clientEmail,
        clientHTML,
        process.env.ADMIN_EMAIL,
        true // указываем, что отправляем HTML
      )

      // Для админа отправляем обычное текстовое письмо
      await this.mailService.sendMail(
        'Новый заказ',
        process.env.ADMIN_EMAIL,
        adminMessage,
        clientEmail
      )

      this.logger.log('Письма успешно отправлены')
    } catch (error) {
      this.logger.error('Ошибка при отправке писем:', error.message)
      throw new Error('Ошибка при отправке писем')
    }
  }

  async sendOrderReproduction(orderData: RequestFormDto) {
    this.logger.log('Отправка заказа: ' + JSON.stringify(orderData))

    let paintingInfo = 'Картина не выбрана'
    let painting = null

    if (orderData.paintingId) {
      painting = await this.paintingModel.findOne({
        where: { id: orderData.paintingId },
        include: [{ model: Artist }]
      })

      if (painting) {
        paintingInfo = `Картина "${painting.title}" художника ${painting.artist.artistName}`
      }
    }

    const deliveryInfo = `Способ доставки: ${orderData.deliveryMethod === 'delivery' ? 'Доставка' : 'Самовывоз из галереи'}`

    const message = `Имя: ${orderData.name}
Телефон: ${orderData.phone}
Email: ${orderData.email}
${paintingInfo}
${deliveryInfo}
Тип формы: репродукция`

    try {
      await this.sendTelegramMessage(`Новый заказ: \n${message}`)

      // Ищем пользователя по email
      const userId = await this.findUserByEmail(orderData.email)

      // Создаем массив с одной картиной для HTML шаблона
      const paintings = painting ? [painting] : []

      // Рассчитываем итоговую цену, используя сервис шаблонов
      const totalPrice = painting
        ? this.emailTemplateService.calculateItemPrice(painting)
        : 0

      // Отправляем email с красивым HTML для клиента
      await this.sendEmails(
        orderData.email,
        message,
        paintingInfo,
        orderData.name,
        paintings,
        totalPrice,
        orderData.deliveryMethod
      )

      // Создаем заказ
      if (painting) {
        const createOrderDto: CreateOrderDto = {
          customerName: orderData.name,
          customerEmail: orderData.email,
          customerPhone: orderData.phone,
          description: `Заказ репродукции. ${deliveryInfo}`,
          totalPrice: totalPrice,
          userId: userId,
          orderItems: [
            {
              paintingId: painting.id,
              quantity: 1,
              price: totalPrice
            }
          ]
        }
        await this.ordersService.create(createOrderDto)
      }

      return { success: true }
    } catch (error) {
      throw new HttpException(
        'Ошибка при создании заказа',
        HttpStatus.BAD_REQUEST
      )
    }
  }

  async sendOrderCart(orderData: RequestFormDto) {
    this.logger.log('Отправка заказа корзины: ' + JSON.stringify(orderData))

    let cartItemsInfo = 'Картины не выбраны'
    let paintingsListForClient = ''
    let paintings = []

    if (orderData.cartItemIds && orderData.cartItemIds.length > 0) {
      paintings = await this.paintingModel.findAll({
        where: { id: orderData.cartItemIds },
        include: [{ model: Artist }]
      })

      if (paintings.length > 0) {
        const paintingsList = paintings
          .map(
            (painting) =>
              `- "${painting.title}" художника ${painting.artist.artistName}`
          )
          .join('\n')

        cartItemsInfo = `Выбранные картины:\n${paintingsList}`
        paintingsListForClient = paintings
          .map(
            (painting) =>
              `"${painting.title}" художника ${painting.artist.artistName}`
          )
          .join(', ')
      }
    }

    const deliveryInfo = `Способ доставки: ${orderData.deliveryMethod === 'delivery' ? 'Доставка' : 'Самовывоз из галереи'}`

    const message = `Имя: ${orderData.name}
Телефон: ${orderData.phone}
Email: ${orderData.email}
${cartItemsInfo}
${deliveryInfo}
Тип формы: заказ из корзины`

    try {
      await this.sendTelegramMessage(`Новый заказ: \n${message}`)

      // Ищем пользователя по email
      const userId = await this.findUserByEmail(orderData.email)

      // Рассчитываем общую сумму, используя сервис шаблонов
      const totalPrice =
        this.emailTemplateService.calculateTotalPrice(paintings)

      // Отправляем email с красивым HTML для клиента
      await this.sendEmails(
        orderData.email,
        message,
        paintingsListForClient,
        orderData.name,
        paintings,
        totalPrice,
        orderData.deliveryMethod
      )

      // Создаем заказ
      if (paintings.length > 0) {
        const createOrderDto: CreateOrderDto = {
          customerName: orderData.name,
          customerEmail: orderData.email,
          customerPhone: orderData.phone,
          description: `Заказ из корзины. ${deliveryInfo}`,
          totalPrice: totalPrice,
          userId: userId,
          orderItems: paintings.map((painting) => ({
            paintingId: painting.id,
            quantity: 1,
            price: this.emailTemplateService.calculateItemPrice(painting)
          }))
        }
        await this.ordersService.create(createOrderDto)
      }

      return { success: true }
    } catch (error) {
      throw new HttpException(
        'Ошибка при создании заказа',
        HttpStatus.BAD_REQUEST
      )
    }
  }
}
