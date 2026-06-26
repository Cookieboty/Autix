import { buildGrowthPageMetadata, renderGrowthPage } from '@/lib/growth-page-route';

const slug = 'supercomputer';

export const generateMetadata = () => buildGrowthPageMetadata(slug);

export default function SupercomputerPage() {
  return renderGrowthPage(slug);
}
