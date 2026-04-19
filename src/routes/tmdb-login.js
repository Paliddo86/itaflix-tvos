import * as TVDML from 'tvdml';

import * as user from '../user';
import { get as i18n } from '../localization';
import TMDB from '../request/tmdb';

import { getStartParams, noop } from '../utils';
import { deepEqualShouldUpdate } from '../utils/components';

import Loader from '../components/loader';
import commonStyles from '../common/styles';

import logo from '../assets/img/logo.png';

export default function tmdbLoginRoute(options = {}) {
  const { onSuccess = noop(), onError = noop() } = options;

  return TVDML.createPipeline().pipe(
    TVDML.render(
      TVDML.createComponent({
        getInitialState() {
          return {
            step: 'username', // username, password, authorizing, success
            username: '',
            password: '',
            usernameValid: false,
            passwordValid: false,
            loading: false,
            error: null,
            autologinAttempt: false,
          };
        },

        componentDidMount() {
          // Check if we have saved credentials and should attempt autologin
          const savedUsername = user.getTmdbUsername();
          const savedPassword = user.getLoginData().password;
          
          if (savedUsername && savedPassword && !user.isTmdbSessionExpired() && user.isTmdbAuthenticated()) {
            this.setState({ autologinAttempt: true, step: 'authorizing' });
            this.performLogin(savedUsername, savedPassword);
          } else {
            // Setup keyboard listener for username field on initial mount
            setTimeout(() => this.setupUsernameKeyboard(), 100);
          }
        },

        setupUsernameKeyboard() {
          if (this.usernameField) {
            const keyboard = this.usernameField.getFeature('Keyboard');
            if (keyboard) {
              keyboard.text = '';
              keyboard.onTextChange = () => {
                this.setState({ usernameValid: !!keyboard.text });
              };
            }
          }
        },

        setupPasswordKeyboard() {
          if (this.passwordField) {
            const keyboard = this.passwordField.getFeature('Keyboard');
            if (keyboard) {
              keyboard.text = '';
              keyboard.onTextChange = () => {
                this.setState({ passwordValid: !!keyboard.text });
              };
            }
          }
        },

        shouldComponentUpdate: deepEqualShouldUpdate,

        performLogin(username, password) {
          this.setState({ loading: true, error: null });

          TMDB.createRequestToken()
            .then(requestToken => {
              return TMDB.createSessionWithCredentials(username, password, requestToken)
                .then(sessionData => {
                  return TMDB.getAccountDetails(sessionData.session_id)
                    .then(accountDetails => {
                      // Salva la sessione
                      user.setTmdbSession(
                        sessionData.session_id,
                        username,
                        accountDetails.id
                      );

                      // Salva le credenziali nel localStorage per l'autologin
                      user.set({
                        tmdb_username: username,
                        password, // Salva la password per l'autologin futuro
                      });

                      this.setState({ loading: false, step: 'success' });

                      // Call success callback
                        onSuccess({ username, accountId: accountDetails.id });
                    });
                });
            })
            .catch(error => {
              console.error('Login error:', error);
              const errorMessage = error.message || i18n('tmdb-login-error-generic');
              this.setState({
                loading: false,
                error: errorMessage,
                step: this.state.autologinAttempt ? 'username' : this.state.step,
                autologinAttempt: false,
              });
              onError(error);
            });
        },

        render() {
          const { BASEURL } = getStartParams();
          const { step, username, password, usernameValid, passwordValid, loading, error } = this.state;

          if (loading || step === 'authorizing') {
            return (
              <document>
                <formTemplate>
                  <banner>
                    <img src={BASEURL + logo} width="218" height="218" />
                    <description>{i18n('tmdb-login-authorizing')}</description>
                  </banner>
                  <Loader />
                </formTemplate>
              </document>
            );
          }

          if (step === 'success') {
            return (
              <document>
                  <alertTemplate>
                    <img src={BASEURL + logo} width="218" height="218" />
                    <description>{i18n('tmdb-login-success')} {username}</description>
                  <button onSelect={TVDML.removeModal}>
                    <text>Ok</text>
                  </button>
                  </alertTemplate>
              </document>
            );
          }

          if (step === 'username') {
            return (
              <document>
                <head>
                  <style content={commonStyles} />
                </head>
                <formTemplate>
                  <banner>
                    <img src={BASEURL + logo} width="218" height="218" />
                    <title>{i18n('tmdb-login-title')}</title>
                    <description>{i18n('tmdb-login-username-description')}</description>
                    {error && <description style="color: rgb(255, 0, 0)">{error}</description>}
                  </banner>
                  <textField
                    id="tmdb-login-username"
                    ref={node => (this.usernameField = node)}
                  >
                    {i18n('tmdb-login-username-placeholder')}
                  </textField>
                  <footer>
                    <button 
                      onSelect={this.onUsernameSubmit}
                      disabled={!usernameValid}
                    >
                      <text>{i18n('tmdb-login-next')}</text>
                    </button>
                  </footer>
                </formTemplate>
              </document>
            );
          }

          if (step === 'password') {
            return (
              <document>
                <head>
                  <style content={commonStyles} />
                </head>
                <formTemplate>
                  <banner>
                    <img src={BASEURL + logo} width="218" height="218" />
                    <title>{i18n('tmdb-login-title')}</title>
                    <description>{i18n('tmdb-login-password-description')} {username}</description>
                    {error && <description style="color: rgb(255, 0, 0)">{error}</description>}
                  </banner>
                  <textField
                    id="tmdb-login-password"
                    secure="true"
                    value=""
                    ref={node => (this.passwordField = node)}
                  >
                    {i18n('tmdb-login-password-placeholder')}
                  </textField>
                  <footer>
                    <button 
                      onSelect={this.onPasswordSubmit}
                      disabled={!passwordValid}
                    >
                      <text>{i18n('tmdb-login-login')}</text>
                    </button>
                  </footer>
                </formTemplate>
              </document>
            );
          }
        },

        onUsernameSubmit() {
          if (this.usernameField) {
            const keyboard = this.usernameField.getFeature('Keyboard');
            if (keyboard && keyboard.text) {
              const usernameText = keyboard.text;

              // Puliamo il testo della tastiera per evitare che venga 
              // trasportato nel campo password nel passo successivo.
              keyboard.text = '';

              this.setState({
                username: usernameText,
                password: '',
                step: 'password',
                passwordValid: false,
              });
            }
          }
        },

        onPasswordSubmit() {
          if (this.passwordField) {
            const keyboard = this.passwordField.getFeature('Keyboard');
            if (keyboard && keyboard.text) {
              const { username } = this.state;
              this.performLogin(username, keyboard.text);
            }
          }
        },

        componentDidUpdate(prevProps, prevState) {
          if (this.state.step !== prevState.step) {
            if (this.state.step === 'username' && this.usernameField) {
              const keyboard = this.usernameField.getFeature('Keyboard');
              if (keyboard) {
                keyboard.onTextChange = () => {
                  this.setState({ usernameValid: !!keyboard.text });
                };
              }
            } else if (this.state.step === 'password' && this.passwordField) {
              const keyboard = this.passwordField.getFeature('Keyboard');
              if (keyboard) {
                // Forza la pulizia del buffer della tastiera quando si passa al campo password
                keyboard.text = '';
                keyboard.onTextChange = () => {
                  this.setState({ passwordValid: !!keyboard.text });
                };
              }
            }
          }
        },
      }),
    ),
  );
}
