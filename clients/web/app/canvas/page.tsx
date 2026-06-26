import { buildGrowthPageMetadata, renderGrowthPage } from '@/lib/growth-page-route';

const slug = 'canvas';

export const generateMetadata = () => buildGrowthPageMetadata(slug);

export default function CanvasPage() {
  return renderGrowthPage(slug);
}
