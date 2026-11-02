import { Controller, Get, Header, Param, StreamableFile } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { DirectAccess } from '../common/internal-key.guard';
import { MediaService } from './media.service';

@ApiTags('Media')
@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  /**
   * Files never change (random names), so browsers and CDNs may cache them for good. Not rate
   * limited, and open without the internal key: the frontend proxies every image with a rewrite,
   * through one IP, and cannot add the key.
   */
  @Get(':filename')
  @SkipThrottle()
  @DirectAccess()
  // s-maxage lets CDNs in front (Vercel, Cloudflare) keep the file too, not only browsers.
  @Header('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable')
  @Header('Cross-Origin-Resource-Policy', 'cross-origin')
  async file(@Param('filename') filename: string) {
    const { media, stream } = await this.media.open(filename);
    return new StreamableFile(stream, { type: media.mimeType, length: media.size });
  }
}
