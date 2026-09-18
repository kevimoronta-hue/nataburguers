import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Stroke({ size = 20, children, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export function CartIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M3 4h2.2l2.1 10.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.5L20.5 8H6.3" />
      <circle cx={10} cy={19.5} r={1.4} fill="currentColor" stroke="none" />
      <circle cx={17} cy={19.5} r={1.4} fill="currentColor" stroke="none" />
    </Stroke>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M12 5.5v13M5.5 12h13" />
    </Stroke>
  );
}

export function MinusIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M5.5 12h13" />
    </Stroke>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M4 7h16M9.5 7V4.8h5V7M6.5 7l.9 12.1a1.6 1.6 0 0 0 1.6 1.5h6a1.6 1.6 0 0 0 1.6-1.5L17.5 7" />
    </Stroke>
  );
}

export function PinIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Z" />
      <circle cx={12} cy={10} r={2.6} />
    </Stroke>
  );
}

export function MopedIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M3 16.5h2.2M18.8 16.5H21M14.5 16.5H9.2" />
      <circle cx={7} cy={16.5} r={2.6} />
      <circle cx={17} cy={16.5} r={2.6} />
      <path d="M9.6 16.5 12 8h3.4l2.2 6M12 8h-2.3M15.4 8h2.4l1.4 3.4" />
    </Stroke>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <circle cx={12} cy={12} r={9} />
      <path d="M12 7.4v5.2M12 16.2h.01" />
    </Stroke>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="m4.5 12.5 4.7 4.7L19.5 6.9" />
    </Stroke>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Stroke>
  );
}

export function ArrowDownIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M12 4.5v15M5.5 13l6.5 6.5L18.5 13" />
    </Stroke>
  );
}

export function WhatsAppIcon({ size = 20, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d="M12.04 2C6.6 2 2.2 6.4 2.2 11.84c0 1.74.46 3.44 1.32 4.94L2.1 22l5.36-1.4a9.8 9.8 0 0 0 4.58 1.16h.01c5.43 0 9.84-4.4 9.84-9.84C21.89 6.4 17.48 2 12.04 2Zm0 17.92h-.01a8.2 8.2 0 0 1-4.16-1.14l-.3-.18-3.18.83.85-3.1-.2-.32a8.14 8.14 0 0 1-1.25-4.35c0-4.5 3.67-8.17 8.18-8.17 2.18 0 4.23.85 5.78 2.4a8.1 8.1 0 0 1 2.39 5.78c0 4.51-3.67 8.18-8.1 8.18Zm4.49-6.12c-.25-.13-1.46-.72-1.68-.8-.23-.08-.39-.13-.55.13-.17.24-.64.79-.78.95-.14.17-.29.19-.53.06-.25-.12-1.04-.38-1.98-1.22-.73-.65-1.22-1.46-1.37-1.7-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.43.13-.15.17-.25.25-.41.09-.17.05-.31-.02-.44-.06-.12-.55-1.33-.76-1.82-.2-.48-.4-.41-.55-.42h-.47c-.16 0-.42.06-.64.3-.22.25-.84.83-.84 2.02 0 1.18.86 2.33.98 2.49.13.16 1.7 2.6 4.12 3.64.58.25 1.03.4 1.38.51.58.19 1.1.16 1.52.1.47-.07 1.46-.6 1.66-1.18.21-.58.21-1.07.15-1.18-.06-.1-.22-.16-.47-.28Z" />
    </svg>
  );
}
