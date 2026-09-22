import prepareAnalytics from './prepare-analytics.mjs';
import preparePortraits from './prepare-portraits.mjs';
import prepareSocial from './prepare-social.mjs';

export default async function prepare() {
  await prepareAnalytics();
  await preparePortraits();
  await prepareSocial();
}
