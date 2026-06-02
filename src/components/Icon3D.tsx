import { cn } from "@/lib/utils";

/**
 * Icon3D — wrapper that renders Microsoft Fluent Emoji 3D PNGs from jsDelivr.
 * Source: https://github.com/microsoft/fluentui-emoji (MIT)
 * CDN:    https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/<Folder>/3D/<file>_3d.png
 *
 * Add new entries to ICONS below as needed.
 */

const BASE =
  "https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets";

const ICONS = {
  home: "House/3D/house_3d.png",
  coins: "Coin/3D/coin_3d.png",
  zap: "High voltage/3D/high_voltage_3d.png",
  user: "Bust in silhouette/3D/bust_in_silhouette_3d.png",
  play: "Play button/3D/play_button_3d.png",
  calendar: "Calendar/3D/calendar_3d.png",
  sparkles: "Sparkles/3D/sparkles_3d.png",
  link: "Link/3D/link_3d.png",
  crown: "Crown/3D/crown_3d.png",
  userplus: "Person/3D/person_3d.png",
  check: "Check mark button/3D/check_mark_button_3d.png",
  lock: "Locked/3D/locked_3d.png",
  wallet: "Money bag/3D/money_bag_3d.png",
  trending: "Chart increasing/3D/chart_increasing_3d.png",
  users: "People hugging/3D/people_hugging_3d.png",
  fire: "Fire/3D/fire_3d.png",
  rocket: "Rocket/3D/rocket_3d.png",
  party: "Party popper/3D/party_popper_3d.png",
  bank: "Dollar banknote/3D/dollar_banknote_3d.png",
  list: "Clipboard/3D/clipboard_3d.png",
  headphones: "Headphone/3D/headphone_3d.png",
  receipt: "Receipt/3D/receipt_3d.png",
} as const;

export type Icon3DName = keyof typeof ICONS;

interface Icon3DProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  name: Icon3DName;
  size?: number;
}

export const Icon3D = ({ name, size = 24, className, alt, ...rest }: Icon3DProps) => {
  const path = ICONS[name];
  const url = `${BASE}/${path.split("/").map(encodeURIComponent).join("/")}`;
  return (
    <img
      src={url}
      alt={alt ?? name}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      draggable={false}
      className={cn("inline-block select-none object-contain", className)}
      style={{ width: size, height: size }}
      {...rest}
    />
  );
};

export default Icon3D;
