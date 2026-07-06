import { IsIn } from 'class-validator';
import { GalleryReportStatus } from '../../../platform/prisma/generated';

export class ResolveGalleryReportDto {
  @IsIn(['RESOLVED', 'DISMISSED'])
  status!: GalleryReportStatus;
}
