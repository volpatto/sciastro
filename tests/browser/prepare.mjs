import prepareAnalytics from './prepare-analytics.mjs';
import preparePortraits from './prepare-portraits.mjs';
import prepareSocial from './prepare-social.mjs';
import prepareLayouts from './prepare-layouts.mjs';
import prepareAppearance from './prepare-appearance.mjs';

export default async function prepare() {
  await prepareAnalytics();
  await preparePortraits();
  await prepareSocial();
  await prepareLayouts();
  await prepareAppearance();
}
