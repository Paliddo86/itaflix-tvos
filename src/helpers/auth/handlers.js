import * as TVDML from 'tvdml';

import { get as i18n } from '../../localization';

// eslint-disable-next-line import/prefer-default-export
export async function defaultErrorHandlers(error) {
  let messageCode = "error";
  let payload = {};
  if (error && error.code) {
    messageCode = error.code === 'EBADCREDENTIALS'
      ? 'login-error-wrong-login'
      : 'login-error-something-went-wrong';
      payload = await this.reset()
  }
  let description = error ? error.message : null;

    const promise = TVDML.renderModal(
      <document>
        <alertTemplate>
          <title>{i18n(messageCode)}</title>
          <description class="grey_description">
          {description || i18n('generic-error')}
        </description>
          <button onSelect={TVDML.removeModal}>
            <text>Ok</text>
          </button>
        </alertTemplate>
      </document>,
    );

    return promise.sink(payload);
}
