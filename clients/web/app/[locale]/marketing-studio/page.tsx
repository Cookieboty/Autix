// import { buildGrowthPageMetadata, renderGrowthPage } from '@/lib/growth-page-route';
//
// const slug = 'marketing-studio';
//
// export const generateMetadata = () => buildGrowthPageMetadata(slug);
//
// export default function MarketingStudioPage() {
//   return renderGrowthPage(slug);
// }

import { notFound } from 'next/navigation';

export default function MarketingStudioPage() {
  notFound();
}
