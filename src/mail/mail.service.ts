import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import * as nodemailer from 'nodemailer'

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name)
  private transporter

  constructor() {
    if (process.env.SEO_SAFE_MODE === 'true') return
    this.transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD
      }
    })

    this.transporter.verify((error, success) => {
      console.log(success)
      if (error) {
        this.logger.error(`Mail configuration error: ${error.message}`)
      } else {
        this.logger.log('Mail server is ready to take our messages')
      }
    })
  }

  async sendMail(
    subject: string,
    toEmail: string,
    content: string,
    replyToEmail?: string,
    isHtml: boolean = false
  ) {
    if (process.env.SEO_SAFE_MODE === 'true') {
      throw new ServiceUnavailableException('Mail is disabled in SEO_SAFE mode')
    }
    try {
      const mailOptions = {
        from: '"Новое пространство" <' + process.env.ADMIN_EMAIL + '>',
        to: toEmail,
        subject,
        replyTo: replyToEmail || process.env.ADMIN_EMAIL
      }

      if (isHtml) {
        mailOptions['html'] = content
      } else {
        mailOptions['text'] = content
      }

      const response = await this.transporter.sendMail(mailOptions)
      this.logger.log(`Email sent successfully to ${toEmail}`)
      return response
    } catch (error) {
      this.logger.error(`Failed to send email to ${toEmail}: ${error.message}`)
      throw error
    }
  }
}
