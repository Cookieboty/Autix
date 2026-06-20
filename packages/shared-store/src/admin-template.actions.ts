import {
  batchJobApi,
  imageTemplateAdminApi,
  videoTemplateAdminApi,
  type BatchJob,
  type ImageTemplate as SdkImageTemplate,
  type PaginatedResult,
  type TemplateStatus as SdkTemplateStatus,
  type VideoTemplate as SdkVideoTemplate,
} from '@autix/sdk';

export type { BatchJob };

export type AdminTemplateResourceType = 'image-templates' | 'video-templates';
export type AdminImageTemplate = SdkImageTemplate;
export type AdminVideoTemplate = SdkVideoTemplate;
export type AdminTemplateStatus = SdkTemplateStatus;
export type AdminTemplateItem = AdminImageTemplate | AdminVideoTemplate;
export type AdminTemplateReviewAction = 'approve' | 'reject' | 'revise';

export interface AdminTemplateListParams {
  resourceType?: AdminTemplateResourceType;
  status?: AdminTemplateStatus;
  page?: number;
  pageSize?: number;
}

export interface AdminTemplateReviewInput {
  resourceType?: AdminTemplateResourceType;
  id: string;
  action: AdminTemplateReviewAction;
  reason?: string;
}

export interface AdminTemplateBatchReviewInput {
  resourceType?: AdminTemplateResourceType;
  ids: string[];
  action: AdminTemplateReviewAction;
  reason?: string;
}

export interface AdminTemplateBatchDeleteInput {
  resourceType?: AdminTemplateResourceType;
  ids: string[];
}

export interface AdminTemplateHotInput {
  resourceType?: AdminTemplateResourceType;
  id: string;
  isHot: boolean;
}

export interface AdminTemplateExportParams {
  resourceType?: AdminTemplateResourceType;
  status?: AdminTemplateStatus;
  category?: string;
}

const getAdminApi = (resourceType: AdminTemplateResourceType = 'image-templates') =>
  resourceType === 'image-templates' ? imageTemplateAdminApi : videoTemplateAdminApi;

export const adminTemplateActions = {
  list: async ({
    resourceType = 'image-templates',
    page = 1,
    pageSize = 15,
    status,
  }: AdminTemplateListParams = {}): Promise<PaginatedResult<AdminTemplateItem>> => {
    const { data } = await getAdminApi(resourceType).list({ status, page, pageSize });
    return {
      items: data.items ?? [],
      total: data.total ?? 0,
      page: data.page ?? page,
      pageSize: data.pageSize ?? pageSize,
      hasMore: data.hasMore ?? false,
    };
  },
  review: ({
    resourceType = 'image-templates',
    id,
    action,
    reason,
  }: AdminTemplateReviewInput): Promise<unknown> =>
    getAdminApi(resourceType).review(id, {
      action,
      reason: action !== 'approve' ? reason : undefined,
    }),
  batchReview: ({
    resourceType = 'image-templates',
    ids,
    action,
    reason,
  }: AdminTemplateBatchReviewInput): Promise<unknown> =>
    getAdminApi(resourceType).batchReview(
      ids,
      action,
      action !== 'approve' ? reason : undefined,
    ),
  batchDelete: ({
    resourceType = 'image-templates',
    ids,
  }: AdminTemplateBatchDeleteInput): Promise<unknown> =>
    getAdminApi(resourceType).batchDelete(ids),
  setHot: ({
    resourceType = 'image-templates',
    id,
    isHot,
  }: AdminTemplateHotInput): Promise<unknown> =>
    getAdminApi(resourceType).setHot(id, isHot),
  importTemplates: (
    resourceType: AdminTemplateResourceType,
    items: Record<string, any>[],
  ) => getAdminApi(resourceType).importTemplates(items),
  importTemplate: async (resourceType: AdminTemplateResourceType = 'image-templates') => {
    const { data } = await getAdminApi(resourceType).importTemplate();
    return data;
  },
  exportTemplates: async ({
    resourceType = 'image-templates',
    status,
    category,
  }: AdminTemplateExportParams = {}) => {
    const { data } = await getAdminApi(resourceType).exportTemplates({ status, category });
    return data;
  },
  getBatchJob: async (jobId: string) => {
    const { data } = await batchJobApi.get(jobId);
    return data;
  },
};
