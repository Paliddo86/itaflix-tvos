import config from '../../package.json';

export const supportUHD = Device.productType !== 'AppleTV5,3';
export const version = `v${config.version}`;