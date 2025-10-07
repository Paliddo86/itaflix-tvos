export default function Loader({ attrs = {} }) {
  const { title } = attrs;

  return (
    <document>
      <loadingTemplate>
        <activityIndicator>
          <title>{title}</title>
        </activityIndicator>
      </loadingTemplate>
    </document>
  );
}
