import * as TVDML from 'tvdml';

import moment from 'moment';

import * as user from '../user';
import * as localization from '../localization';

import { deepEqualShouldUpdate } from '../utils/components';

import { AUTH, GUEST, BASIC } from './menu/constants';
import styles from '../common/styles';

const datePattern = 'DD-MM-YYYY';

export default function menuRoute(items) {
  return TVDML.createPipeline().pipe(
    TVDML.render(
      TVDML.createComponent({
        getInitialState() {
          const language = localization.getLanguage();

          return {
            language,
            menu: items,
            rendered: false,
            ...this.getUserState(),
          };
        },

        getUserState() {
          const nickname = user.getLogin();
          const authorized = user.isAuthorized();
          const isFamilyAccount = user.isFamily();
          const isExtendedAccount = user.isExtended();
          const avatar = isFamilyAccount ? '👪' : this.getUserIcon();

          return {
            avatar,
            nickname,
            authorized,
            isFamilyAccount,
            isExtendedAccount,
          };
        },

        componentWillMount() {
          this.languageChangeStream = localization.subscription();
          this.languageChangeStream.pipe(({ language }) => {
            this.setState({ language });
          });

          this.userStateChangeStream = user.subscription();
          this.userStateChangeStream.pipe(() => {
            this.setState(this.getUserState());
          });

          this.appResumeStream = TVDML.subscribe(TVDML.event.RESUME);
          this.appResumeStream.pipe(() => this.setState(this.getUserState()));
        },

        componentDidMount() {
          // eslint-disable-next-line react/no-did-mount-set-state
          this.setState({ rendered: true });
        },

        componentWillUnmount() {
          this.appResumeStream.unsubscribe();
          this.languageChangeStream.unsubscribe();
          this.userStateChangeStream.unsubscribe();
        },

        shouldComponentUpdate: deepEqualShouldUpdate,

        render() {
          const { menu, avatar, nickname, rendered, authorized } = this.state;

          const menuItems = menu.filter(
            item => !this.isActiveTokens(item.hidden),
          );

          return (
            <document>
              <head>{styles}</head>
              <menuBarTemplate>
                <menuBar>
                  {menuItems.map(({ route, active }) => {
                    const isActive = this.isActiveTokens(active);

                    return (
                      <menuItem
                        style="tv-highlight-color: rgba(185, 5, 5, 1)"
                        key={route}
                        route={route}
                        // eslint-disable-next-line no-mixed-operators
                        autoHighlight={(!rendered && isActive) || undefined}
                      >
                        <title style="tv-highlight-color:rgb(255,255,255)">{localization.get(`menu-${route}`)}</title>
                      </menuItem>
                    );
                  })}
                </menuBar>
              </menuBarTemplate>
            </document>
          );
        },

        isActiveTokens(tokens) {
          if (typeof tokens === 'boolean') return tokens;

          const tokensList = Array.isArray(tokens) ? tokens : [tokens];

          if (this.state.authorized) {
            if (tokensList.includes(AUTH)) {
              return true;
            } else if (
              !this.state.isExtendedAccount &&
              tokensList.includes(BASIC)
            ) {
              return true;
            }
          } else if (tokensList.includes(GUEST)) {
            return true;
          }

          return false;
        },

        getUserIcon() {
          if (moment().isSame(moment('01-01', datePattern).add(256, 'days'))) {
            return '👨‍💻';
          }
          if (this.currentDateIsBetween('01-01', '07-01')) return '🎅';
          if (this.currentDateIs('31-10')) return '🎃';
          if (this.currentDateIs('14-02')) return '❤️';
          if (this.currentDateIs('01-03')) return '🌹';
          if (this.currentDateIs('01-06')) return '🌻';
          if (this.currentDateIs('09-07')) return '🦄';
          return '👱';
        },

        currentDateIs(date) {
          return moment().isSame(moment(date, datePattern));
        },

        currentDateIsBetween(start, end) {
          const startMoment = moment(start, datePattern);
          const endMoment = moment(end, datePattern);
          return moment().isBetween(startMoment, endMoment);
        },
      }),
    ),
  );
}
