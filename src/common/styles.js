export default (
  <style
    content={`
      .grey_text {
        color: rgb(84, 82, 80);
      }

      .grey_description {
        color: rgb(132, 133, 135);
      }

      .darkBackgroundColor {
        background-color: #000000;
      }

      .text-red {
        color: rgba(185, 5, 5, 1);
      }

      .shelf_indent {
        margin: 0 0 60;
      }

      @media tv-template and (tv-theme:dark) {
        .foo { color:rgb(255, 255, 255); }
      }

      .center-logo {
        display: flex;
        justify-content: center;
      }

      .dropdown-badge {
        tv-tint-color: rgb(84, 82, 80);
        margin: 0 0 5 0;
      }
      
      .text-highlight-primary {
        tv-text-style: none;
        color: #ffffff;
        font-size: 38;
        tv-highlight-color: rgba(185, 5, 5, 1);
      }

      #header-banner {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 1000;
        background-color: rgba(0, 0, 0, 0.9);
        padding: 10 0;
      }

      #collection {
        margin-top: 85px;
      }
    `}
  />
);
