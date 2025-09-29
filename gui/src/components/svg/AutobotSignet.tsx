interface AutobotSignetProps {
  /** Height of the signet in pixels */
  height?: number;
  /** Width of the signet in pixels */
  width?: number;
  /** Additional CSS classes to apply to the image */
  className?: string;
}

/**
 * The Autobot signet/logo symbol
 */
export default function AutobotSignet({
  height = 32,
  width = 32,
  className = "",
}: AutobotSignetProps) {
  return (
    <img
      src="/logos/etri_logo.png"
      alt="ETRI"
      width={width}
      height={height}
      className={className}
      style={{ objectFit: "contain" }}
    />
  );
}
