import { Injectable } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { ConfigService } from '@nestjs/config';
import * as streamifier from 'streamifier';

@Injectable()
export class CloudinaryService {
  constructor(private configService: ConfigService) {
    cloudinary.config({
      cloud_name: this.configService.get('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get('CLOUDINARY_API_SECRET'),
    });
  }

  async uploadImage(file: Express.Multer.File): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const upload = cloudinary.uploader.upload_stream(
        { folder: 'real-estate' },
        (error, result) => {
          if (error) return reject(error);
          resolve(result!);
        },
      );
      streamifier.createReadStream(file.buffer).pipe(upload);
    });
  }

  async uploadImages(
    files: Express.Multer.File[],
  ): Promise<UploadApiResponse[]> {
    return Promise.all(files.map((file) => this.uploadImage(file)));
  }

  async deleteImage(publicId: string): Promise<any> {
    return cloudinary.uploader.destroy(publicId);
  }
}
