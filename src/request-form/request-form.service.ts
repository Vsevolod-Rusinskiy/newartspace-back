// src/one-click-order/one-click-order.service.ts
import { HttpStatus, HttpException, Injectable, Logger } from '@nestjs/common'
import axios from 'axios'
import { RequestFormDto } from './dto/request-form.dto'
import { InjectModel } from '@nestjs/sequelize'
import { Painting } from '../paintings/models/painting.model'
import { Artist } from '../artists/models/artist.model'
import { MailService } from '../mail/mail.service'
import { OrdersService } from '../orders/orders.service'
import { CreateOrderDto } from '../orders/dto/create-order.dto'
import { UsersService } from '../users/users.service'

@Injectable()
export class RequestFormService {
  private readonly logger = new Logger(RequestFormService.name)

  constructor(
    @InjectModel(Painting)
    private paintingModel: typeof Painting,
    private mailService: MailService,
    private ordersService: OrdersService,
    private usersService: UsersService
  ) {}

  private async findUserByEmail(email: string): Promise<number | null> {
    try {
      const user = await this.usersService.findOne(email)
      return user ? user.id : null
    } catch (error) {
      this.logger.warn(`User not found for email: ${email}`)
      return null
    }
  }

  private async sendTelegramMessage(message: string) {
    const TELEGRAM_BOT_TOKEN = process.env.YOUR_BOT_TOKEN
    const CHAT_ID = process.env.CHAT_ID
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`

    try {
      await axios.post(url, {
        chat_id: CHAT_ID,
        text: message
      })
      this.logger.log('Сообщение отправлено в Telegram')
    } catch (error) {
      this.logger.error(
        'Ошибка при отправке сообщения в Telegram: ' + error.message
      )
      throw new Error(error.message)
    }
  }

  private createCartItemHTML(painting: Painting): string {
    // Расчет цены со скидкой
    const calculatePriceWithDiscount = (price: number, discount: number) => {
      return Math.round(price - (price * discount) / 100)
    }

    // Вычисление итоговой цены для товара
    let finalPrice = painting.price
    let discountText = ''
    let originalPriceHTML = ''

    if (painting.priceType === 'Скидка' && painting.discount) {
      finalPrice = calculatePriceWithDiscount(painting.price, painting.discount)
      discountText = `<div style="color: #ff3a44; font-weight: bold;">СКИДКА ${painting.discount}%</div>`
      originalPriceHTML = `<span style="text-decoration: line-through; color: #878787; margin-right: 8px;">${painting.price} ₽</span>`
    } else if (painting.priceType === 'Специальное предложение') {
      discountText = `<div style="color: #ff3a44; font-weight: bold;">СПЕЦИАЛЬНОЕ ПРЕДЛОЖЕНИЕ</div>`
    } else if (painting.discount) {
      finalPrice = calculatePriceWithDiscount(painting.price, painting.discount)
      discountText = `<div style="color: #ff3a44; font-weight: bold;">СКИДКА ${painting.discount}%</div>`
      originalPriceHTML = `<span style="text-decoration: line-through; color: #878787; margin-right: 8px;">${painting.price} ₽</span>`
    }

    // Информация о размерах
    const dimensions =
      painting.height && painting.width
        ? `${painting.height} x ${painting.width}`
        : 'Не указан'

    // Информация о материалах
    const materials =
      [painting.material, painting.technique].filter(Boolean).join(', ') ||
      'Не указаны'

    return `
    <div style="display: flex; margin-bottom: 20px; padding: 15px; border: 1px solid #eaeaea; border-radius: 5px; background-color: #fff; font-family: 'Oswald', sans-serif;">
      <div style="width: 150px; height: 150px; position: relative; margin-right: 15px; flex-shrink: 0;">
        <img src="${painting.imgUrl}" alt="${painting.title}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 4px;" />
      </div>
      
      <div style="flex: 1; display: flex; flex-direction: column;">
        <div style="font-size: 14px; color: #878787; margin-bottom: 10px; font-family: 'Oswald', sans-serif;">
          <p style="margin: 5px 0;"><span style="color: #6a6a6a; font-weight: 500;">Название:</span> ${painting.title}</p>
          <p style="margin: 5px 0;"><span style="color: #6a6a6a; font-weight: 500;">Автор:</span> ${painting.artist?.artistName || 'Не указан'}</p>
          <p style="margin: 5px 0;"><span style="color: #6a6a6a; font-weight: 500;">Размер:</span> ${dimensions}</p>
          <p style="margin: 5px 0;"><span style="color: #6a6a6a; font-weight: 500;">Материалы:</span> ${materials}</p>
          <p style="margin: 5px 0;"><span style="color: #6a6a6a; font-weight: 500;">Год:</span> ${painting.yearOfCreation || 'Не указан'}</p>
        </div>
      </div>
      
      <div style="width: 150px; display: flex; flex-direction: column; align-items: flex-end; border-left: 1px solid #eaeaea; padding-left: 15px;">
        <div style="text-align: right; margin-bottom: 15px; font-family: 'Oswald', sans-serif;">
          ${originalPriceHTML}
          <span style="font-size: 18px; font-weight: bold; color: #ff3a44;">${finalPrice} ₽</span>
          ${discountText}
        </div>
      </div>
    </div>
    `
  }

  private createEmailTemplate(
    clientName: string,
    paintings: Painting[],
    totalSum: number,
    deliveryMethod: string
  ): string {
    // Создаем HTML для каждого товара
    const itemsHTML = paintings
      .map((painting) => this.createCartItemHTML(painting))
      .join('')

    // Определяем метод доставки
    const deliveryText =
      deliveryMethod === 'delivery' ? 'Доставка' : 'Самовывоз из галереи'

    // HTML-шаблон для письма
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Ваш заказ получен</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;500;600;700&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Oswald', sans-serif; line-height: 1.6; color: #878787; background-color: #f9f9f9; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; padding: 20px 0; border-bottom: 1px solid #eaeaea; }
        .content { background-color: #fff; padding: 20px; border-radius: 5px; margin-top: 20px; }
        .footer { text-align: center; margin-top: 30px; padding: 20px 0; border-top: 1px solid #eaeaea; font-size: 12px; color: #878787; }
        .cart-total { background-color: #f8f8f8; padding: 15px; border-radius: 5px; margin-top: 20px; }
        .cart-total-row { display: flex; justify-content: space-between; padding: 10px 0; }
        .cart-total-label { font-size: 16px; color: #ff3a44; }
        .cart-total-value { font-size: 18px; font-weight: bold; color: #ff3a44; }
        .delivery-info { margin-top: 20px; padding: 10px; background-color: #f0f0f0; border-left: 4px solid #ff3a44; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="color: #878787; margin: 0; font-family: 'Oswald', sans-serif; font-weight: 700;">Новое пространство</h1>
          <p style="color: #878787; font-family: 'Oswald', sans-serif; font-weight: 400;">Галерея молодых и малоизвестных художников</p>
        </div>
        
        <div class="content">
          <h2 style="font-family: 'Oswald', sans-serif; font-weight: 600; color: #878787;">Здравствуйте, ${clientName}!</h2>
          <p>Благодарим за ваш заказ. Вот детали вашего заказа:</p>
          
          <div class="items-container">
            ${itemsHTML}
          </div>
          
          <div class="delivery-info">
            <p><strong>Способ получения:</strong> ${deliveryText}</p>
          </div>
          
          <div class="cart-total">
            <div class="cart-total-row">
              <span class="cart-total-label">Итого:</span>
              <span class="cart-total-value">${totalSum} ₽</span>
            </div>
          </div>
          
          <p style="margin-top: 30px;">В ближайшее время наш менеджер свяжется с вами для уточнения деталей.</p>
        </div>
        
        <div class="footer">
          <p><strong>Контакты:</strong><br>
          +7 (921) 932-62-15<br>
          Пн - Пт с 13:00 до 19:00<br>
          Сб - по предварительной договоренности</p>
          
          <p><strong>Адрес:</strong><br>
          Санкт-Петербург, ул. Ново-Рыбинская,<br>
          д. 19-21, БЦ «Квартал», центральный<br>
          вход, 2 этаж, пом. 9</p>
          
          <p>© Новое пространство</p>
        </div>
      </div>
    </body>
    </html>
    `
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
      const clientHTML = this.createEmailTemplate(
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
      const totalPrice = painting ? painting.price : 0

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
          totalPrice: painting.price,
          userId: userId,
          orderItems: [
            {
              paintingId: painting.id,
              quantity: 1,
              price: painting.price
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

      // Рассчитываем общую сумму
      const totalPrice = paintings.reduce((sum, painting) => {
        // Учитываем скидки при расчете
        if (painting.discount) {
          return (
            sum +
            Math.round(
              painting.price - (painting.price * painting.discount) / 100
            )
          )
        }
        return sum + painting.price
      }, 0)

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
            price: painting.price
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
