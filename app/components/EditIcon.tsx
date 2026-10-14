export default function EditIcon({
  size = 16,
}: {
  size?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M4 20h4.25L19.3 8.95a2.1 2.1 0 0 0 0-2.97L18.02 4.7a2.1 2.1 0 0 0-2.97 0L4 15.75V20Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m13.8 5.95 4.25 4.25M4 20l4.8-1.15"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
