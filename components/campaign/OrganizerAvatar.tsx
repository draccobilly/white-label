type Props = {
  name: string;
  imageUrl?: string | null;
  className: string;
  children?: React.ReactNode;
};

export function OrganizerAvatar({ name, imageUrl, className, children }: Props) {
  const initial = name.trim().charAt(0).toUpperCase() || "A";
  const src = imageUrl?.trim() || "";

  return (
    <span className={`${className}${src ? " has-photo" : ""}`} aria-hidden>
      {src ? <img src={src} alt="" /> : initial}
      {children}
    </span>
  );
}
