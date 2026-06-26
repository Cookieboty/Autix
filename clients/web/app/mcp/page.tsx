import { buildGrowthPageMetadata, renderGrowthPage } from '@/lib/growth-page-route';

const slug = 'mcp';

export const generateMetadata = () => buildGrowthPageMetadata(slug);

export default function McpGrowthPage() {
  return renderGrowthPage(slug);
}
