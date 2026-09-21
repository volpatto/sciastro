import prepareAnalytics from './prepare-analytics.mjs';
import preparePortraits from './prepare-portraits.mjs';

export default async function prepare() {
  await prepareAnalytics();
  await preparePortraits();
}
