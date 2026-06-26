import { buildGrowthPageMetadata, renderGrowthPage } from '@/lib/growth-page-route';

const slug = 'original-series';

export const generateMetadata = () => buildGrowthPageMetadata(slug);

export default function OriginalSeriesPage() {
  return renderGrowthPage(slug);
}
