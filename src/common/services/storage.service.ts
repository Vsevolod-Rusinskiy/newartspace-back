import {
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException
} from '@nestjs/common'
import * as AWS from 'aws-sdk'
import * as dotenv from 'dotenv'
import { v4 as uuidv4 } from 'uuid'

dotenv.config()

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name)
  private s3?: AWS.S3
  private bucketName: string = process.env.BUCKET_NAME

  constructor() {
    if (process.env.SEO_SAFE_MODE === 'true') return
    const credentials = new AWS.Credentials({
      accessKeyId: process.env.ACCESS_KEY_ID,
      secretAccessKey: process.env.SECRET_ACCESS_KEY
    })

    this.s3 = new AWS.S3({
      credentials: credentials,
      region: 'ru-central1',
      endpoint: 'https://storage.yandexcloud.net',
      s3ForcePathStyle: true
    })
  }

  async uploadFile(
    fileBuffer: Buffer,
    originalFileName: string,
    category: string
  ): Promise<string> {
    this.assertStorageEnabled()
    const fileExtension = originalFileName.split('.').pop()
    const uniqueFileName = `${uuidv4()}.${fileExtension}`
    const key = `${category}/${uniqueFileName}`

    const params = {
      Bucket: this.bucketName,
      Key: key,
      Body: fileBuffer,
      ACL: 'public-read',
      ContentType: 'application/octet-stream'
    }

    try {
      const data = await this.s3!.upload(params).promise()
      this.logger.log(
        `File ${uniqueFileName} uploaded successfully: ${data.Location}`
      )
      return data.Location
    } catch (error) {
      this.logger.error(
        `Error uploading file ${uniqueFileName}: ${error.message}`
      )
      throw new InternalServerErrorException(
        `Error uploading file ${uniqueFileName}: ${error.message}`
      )
    }
  }

  async deleteFile(fileName: string, category: string): Promise<void> {
    this.assertStorageEnabled()
    const key = `${category}/${fileName}`

    const params = {
      Bucket: this.bucketName,
      Key: key
    }

    try {
      await this.s3!.deleteObject(params).promise()
      this.logger.log(
        `File ${fileName} in category ${category} deleted successfully.`
      )
    } catch (error) {
      this.logger.error(
        `Error deleting file ${fileName} in category ${category}: ${error.message}`
      )
      throw new InternalServerErrorException(
        `Error deleting file ${fileName} in category ${category}: ${error.message}`
      )
    }
  }

  async fileExists(fileName: string, category: string): Promise<boolean> {
    this.assertStorageEnabled()
    const key = `${category}/${fileName}`

    try {
      await this.s3!.headObject({ Bucket: this.bucketName, Key: key }).promise()
      return true
    } catch (error) {
      if (
        error?.code === 'NotFound' ||
        error?.code === 'NoSuchKey' ||
        error?.statusCode === 404
      ) {
        return false
      }
      this.logger.error(
        `Error checking file ${fileName} in category ${category}: ${error?.message || 'unknown error'}`
      )
      throw new InternalServerErrorException(
        `Error checking file ${fileName} in category ${category}`
      )
    }
  }

  private assertStorageEnabled(): void {
    if (process.env.SEO_SAFE_MODE === 'true') {
      throw new ServiceUnavailableException(
        'Storage is disabled in SEO_SAFE mode'
      )
    }
  }
}
