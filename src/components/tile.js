import { link } from '../utils';

import { get as i18n } from '../localization';

export default function Tile({ key, attrs = {}, events = {} }) {
  const {
    route,
    title,
    poster,
    counter,
    subtitle,
    isUpdated,
    quality,
    isWatched,
    payload = payload || {},
    autoHighlight,
    asCover
  } = attrs;

  const tilePoster = asCover ? payload.cover : poster;

  const { onPlay, onSelect, onHighlight, onHoldselect } = events;

  const showTopShadow = quality;
  const showBottomShadow = counter || isWatched || isUpdated;

  return (
    <lockup
      key={key}
      onPlay={onPlay}
      onSelect={onSelect || link(route, payload)}
      onHighlight={onHighlight}
      onHoldselect={onHoldselect}
      autoHighlight={autoHighlight ? 'true' : undefined}
    >
      <img
        src={tilePoster}
        width={asCover ? "400" : "190"}
        height={asCover ? "225" : "285"}
        class="tile-img"
        contentsMode="aspectFitBB"
        aspectRatio="0.75:1"
        style={`
          tv-placeholder: tv;
          tv-tint-color: linear-gradient(
            top,
            rgba(0, 0, 0, ${showTopShadow ? '0.7' : '0'})
            0.2,
            transparent,
            0.8,
            transparent,
            rgba(0, 0, 0, ${showBottomShadow ? '0.7' : '0'})
          );
          border-radius: 4;
        `}
      />
      <title
        class="tile-title"
        style="tv-text-highlight-style: marquee-on-highlight"
      >
        {title}
      </title>
      <subtitle class="tile-subtitle">{subtitle}</subtitle>
      <overlay style="margin: 0; padding: 0;">
      {quality && (
            <textBadge
            style={`
              margin: 12 10 0 0;
              border-radius: 0;
              tv-align: right;
              tv-position: top;
              color: rgb(255, 255, 255);
              background-color: #b90505;
            `}
          >
            {quality}
          </textBadge>
        )}
      {(isUpdated || payload.updateType) && (
            <textBadge
            style={`
              margin: 0 10 12 0;
              border-radius: 0;
              tv-align: center;
              tv-position: bottom;
              color: rgb(255, 255, 255);
              background-color: #b90505;
            `}
          >
            {payload.updateType? payload.updateType : i18n('tvshow-next')}
          </textBadge>
        )}
        {!isWatched && counter && (
          <textBadge
            type="fill"
            style={`
              font-size: 20;
              border-radius: 30;
              margin: 0 10 12 0;
              padding: 1 8;
              tv-align: right;
              tv-position: bottom;
              tv-tint-color: rgb(255, 255, 255);
            `}
          >
            {counter}
          </textBadge>
        )}
        {isWatched && (
          <textBadge
            type="fill"
            style={`
              font-size: 20;
              border-radius: 30;
              margin: 0 10 12 0;
              padding: 1 5;
              tv-align: right;
              tv-position: bottom;
              tv-tint-color: rgb(255, 255, 255);
            `}
          >
            ✓
          </textBadge>
        )}
      </overlay>
    </lockup>
  );
}
