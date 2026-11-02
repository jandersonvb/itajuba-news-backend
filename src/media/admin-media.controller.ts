import { Controller, Delete, Get, Param, ParseUUIDPipe, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { AdminPortal, Roles, StaffOnly } from '../auth/admin.decorators';
import { MAX_UPLOAD_BYTES, MediaService } from './media.service';

/** Every role can list and upload (reporters illustrate their drafts); only admins and editors delete. */
@ApiTags('Admin · Media')
@StaffOnly()
@Controller('admin/media')
export class AdminMediaController {
  constructor(private readonly media: MediaService) {}

  @Get()
  list(@AdminPortal() portalId: string) {
    return this.media.listAll(portalId);
  }

  /** Multipart upload in the `file` field. Returns the record with `url` (`/media/<file>`). */
  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }))
  upload(@UploadedFile() file: Express.Multer.File | undefined, @AdminPortal() portalId: string) {
    return this.media.upload(file, portalId);
  }

  @Delete(':id')
  @Roles('admin', 'editor')
  remove(@Param('id', ParseUUIDPipe) id: string, @AdminPortal() portalId: string) {
    return this.media.remove(id, portalId);
  }
}
